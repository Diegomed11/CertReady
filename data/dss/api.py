"""API HTTP del DSS (FastAPI).

Plano **analítico de negocio**: expone agregados (por lotes) sobre exámenes,
código y Q&A para decisiones de plataforma, más el recomendador de CV. La
analítica por-usuario vive ahora en los servicios Go; el DSS ya no la sirve.

La conexión a ClickHouse es perezosa (no se conecta al importar el módulo), para
que las pruebas unitarias y la recolección de pytest no requieran la base. Si
ClickHouse no está disponible, los endpoints de negocio degradan a 200 con
listas/ceros en vez de 500.
"""

from __future__ import annotations

import time
from functools import lru_cache

import clickhouse_connect
from clickhouse_connect.driver.client import Client
from fastapi import FastAPI, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from dss import recomendador
from dss.config import Config
from dss.repo import Repo

# Tamaño máximo del CV aceptado (defensa de entrada).
MAX_CV_BYTES = 5 * 1024 * 1024

app = FastAPI(title="CertReady DSS", version="dev")


# --- Rate-limit de la subida de CV (anti abuso) -------------------------------
# Token-bucket en memoria por IP, SOLO para POST /v1/recommendations. En
# producción el límite distribuido lo aplica el WAF; esto es defensa base por
# instancia.
_RL_CAP = 8.0  # ráfaga máxima por IP
_RL_REFILL = 0.1  # tokens/segundo (~6/min sostenido)
_rl_buckets: dict[str, tuple[float, float]] = {}  # ip -> (tokens, last_monotonic)


def _cliente_ip(request: Request) -> str:
    """IP del cliente: primer salto de X-Forwarded-For tras un proxy, o la remota."""
    xff = request.headers.get("x-forwarded-for", "")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "?"


@app.middleware("http")
async def _rate_limit_subidas(request: Request, call_next):
    """Limita POST /v1/recommendations por IP (token-bucket en memoria)."""
    if request.method == "POST" and request.url.path == "/v1/recommendations":
        ip = _cliente_ip(request)
        now = time.monotonic()
        tokens, last = _rl_buckets.get(ip, (_RL_CAP, now))
        tokens = min(_RL_CAP, tokens + (now - last) * _RL_REFILL)
        if tokens < 1:
            _rl_buckets[ip] = (tokens, now)
            return JSONResponse(
                status_code=429,
                content={"detail": "demasiadas subidas; intenta de nuevo en un momento"},
                headers={"Retry-After": "10"},
            )
        _rl_buckets[ip] = (tokens - 1.0, now)
    return await call_next(request)


@lru_cache(maxsize=1)
def _config() -> Config:
    """Carga (una vez) la configuración del DSS (no toca ClickHouse)."""
    return Config.load()


@lru_cache(maxsize=1)
def _client() -> Client:
    """Crea (una vez) el cliente de ClickHouse, con timeouts cortos.

    El ``connect_timeout`` bajo evita que la API se quede colgada cuando ClickHouse
    no está disponible (sin él, la conexión puede tardar ~10 s en fallar): así los
    endpoints degradan rápido a "sin datos" en vez de aparentar que se traban.
    """
    cfg = _config()
    return clickhouse_connect.get_client(
        host=cfg.ch_host,
        port=cfg.ch_port,
        username=cfg.ch_user,
        password=cfg.ch_password,
        connect_timeout=2,
        send_receive_timeout=10,
    )


def _repo_o_none() -> Repo | None:
    """Devuelve el repo de ClickHouse, o ``None`` si la base no está disponible.

    Hace ``ping`` para detectar tanto el arranque en frío sin ClickHouse como una
    conexión que murió después; si falla, limpia la caché del cliente para
    reintentar en la siguiente petición. Permite que los endpoints degraden con
    claridad (200 "sin datos") en vez de colgarse o devolver 500.
    """
    try:
        client = _client()
        if not client.ping():
            raise RuntimeError("clickhouse no responde al ping")
        return Repo(client, _config().ch_database)
    except Exception:
        _client.cache_clear()
        return None


@app.get("/v1/health")
def health() -> dict[str, str]:
    """Liveness."""
    return {"status": "ok", "service": "dss"}


# --- Recomendador de certificaciones por CV (no requiere ClickHouse) ----------
class PasoCamino(BaseModel):
    slug: str
    nombre: str
    proveedor: str
    area: str
    nivel: str
    match_pct: int
    por_que: str
    tiene_contenido: bool
    slug_estudio: str | None


class Camino(BaseModel):
    nombre: str
    motivo: str
    pasos: list[PasoCamino]


class PerfilOut(BaseModel):
    skills: list[str]
    areas: list[str]
    nivel: str
    resumen: str


class RecomendacionesResponse(BaseModel):
    perfil: PerfilOut
    caminos: list[Camino]
    recomendaciones: list[PasoCamino]


@app.post("/v1/recommendations", response_model=RecomendacionesResponse)
async def recommendations(file: UploadFile) -> RecomendacionesResponse:
    """Lee el CV subido (PDF/DOCX/texto) y devuelve perfil + caminos recomendados.

    El archivo se trata como **no confiable**: se rechaza por tamaño antes de
    materializarlo, se parsea de forma defensiva (anti zip-bomb, límite de páginas)
    y **no se persiste**. No depende de ClickHouse.
    """
    # Rechazo temprano por el tamaño declarado (si el cliente lo informa).
    if file.size is not None and file.size > MAX_CV_BYTES:
        raise HTTPException(status_code=413, detail="archivo demasiado grande (máx 5 MB)")
    # Lectura ACOTADA: no materializamos en memoria más de MAX_CV_BYTES (+1 para
    # detectar el exceso). Evita el DoS de cargar entero un archivo enorme.
    datos = await file.read(MAX_CV_BYTES + 1)
    if not datos:
        raise HTTPException(status_code=400, detail="archivo vacío")
    if len(datos) > MAX_CV_BYTES:
        raise HTTPException(status_code=413, detail="archivo demasiado grande (máx 5 MB)")
    try:
        texto = recomendador.extraer_texto(file.filename or "", datos)
    except recomendador.CVInvalido as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if len(texto.strip()) < 30:
        raise HTTPException(
            status_code=422, detail="no se pudo leer texto del CV; sube un PDF/DOCX con texto"
        )
    return RecomendacionesResponse(**recomendador.recomendar(texto))


# --- Analítica de negocio (agregada; requiere ClickHouse) ---------------------
# Plano agregado para decisiones de plataforma (no por-usuario). Si ClickHouse no
# está disponible, los endpoints degradan a 200 con listas/ceros.
class ExamenesResumen(BaseModel):
    intentos: int
    acierto_pct: float


class CodigoResumen(BaseModel):
    ejecuciones: int
    aceptacion_pct: float


class QaResumen(BaseModel):
    autoevaluaciones: int
    nivel_promedio_pct: float


class ActividadMes(BaseModel):
    mes: str
    intentos: int
    ejecuciones: int
    qa: int
    usuarios: int


class OverviewResponse(BaseModel):
    usuarios: int
    examenes: ExamenesResumen
    codigo: CodigoResumen
    qa: QaResumen
    actividad_mensual: list[ActividadMes]


@app.get("/v1/business/overview", response_model=OverviewResponse)
def business_overview() -> OverviewResponse:
    """Resumen de negocio: usuarios, señales globales y actividad mensual.

    Degrada a 200 con ceros/listas vacías si ClickHouse no está disponible.
    """
    repo = _repo_o_none()
    if repo is None:
        return OverviewResponse(
            usuarios=0,
            examenes=ExamenesResumen(intentos=0, acierto_pct=0.0),
            codigo=CodigoResumen(ejecuciones=0, aceptacion_pct=0.0),
            qa=QaResumen(autoevaluaciones=0, nivel_promedio_pct=0.0),
            actividad_mensual=[],
        )
    try:
        usuarios = repo.usuarios_distinct()
        ex_n, ex_pct = repo.examenes_resumen()
        co_n, co_pct = repo.codigo_resumen()
        qa_n, qa_pct = repo.qa_resumen()
        actividad = repo.actividad_mensual()
    except Exception:
        return OverviewResponse(
            usuarios=0,
            examenes=ExamenesResumen(intentos=0, acierto_pct=0.0),
            codigo=CodigoResumen(ejecuciones=0, aceptacion_pct=0.0),
            qa=QaResumen(autoevaluaciones=0, nivel_promedio_pct=0.0),
            actividad_mensual=[],
        )
    return OverviewResponse(
        usuarios=usuarios,
        examenes=ExamenesResumen(intentos=ex_n, acierto_pct=ex_pct),
        codigo=CodigoResumen(ejecuciones=co_n, aceptacion_pct=co_pct),
        qa=QaResumen(autoevaluaciones=qa_n, nivel_promedio_pct=qa_pct),
        actividad_mensual=[
            ActividadMes(mes=m, intentos=i, ejecuciones=e, qa=q, usuarios=u)
            for m, i, e, q, u in actividad
        ],
    )


class ExamenTema(BaseModel):
    certificacion: str
    tema: str
    acierto_pct: float
    intentos: int
    estado: str  # ok | facil | dificil | poco_volumen


class CodigoArea(BaseModel):
    area: str
    aceptacion_pct: float
    ejecuciones: int


class QaArea(BaseModel):
    area: str
    nivel_promedio_pct: float
    autoevaluaciones: int


class AreasResponse(BaseModel):
    examenes_por_tema: list[ExamenTema]
    codigo_por_area: list[CodigoArea]
    qa_por_area: list[QaArea]


def _estado_tema(acierto_pct: float, intentos: int) -> str:
    """Clasifica un tema por su acierto y volumen de intentos.

    Returns ``"poco_volumen"`` si hay menos de 5 intentos; si no, ``"facil"`` si
    el acierto supera 90, ``"dificil"`` si es menor a 30, ``"ok"`` en otro caso.
    """
    if intentos < 5:
        return "poco_volumen"
    if acierto_pct > 90:
        return "facil"
    if acierto_pct < 30:
        return "dificil"
    return "ok"


@app.get("/v1/business/areas", response_model=AreasResponse)
def business_areas() -> AreasResponse:
    """Desglose por tema/área de exámenes, código y Q&A.

    ``examenes_por_tema`` ordenado por acierto ascendente (los gaps arriba).
    Degrada a 200 con listas vacías si ClickHouse no está disponible.
    """
    repo = _repo_o_none()
    if repo is None:
        return AreasResponse(examenes_por_tema=[], codigo_por_area=[], qa_por_area=[])
    try:
        temas = repo.examenes_por_tema()
        codigo = repo.codigo_por_area()
        qa = repo.qa_por_area()
    except Exception:
        return AreasResponse(examenes_por_tema=[], codigo_por_area=[], qa_por_area=[])

    examenes_por_tema = sorted(
        (
            ExamenTema(
                certificacion=c,
                tema=t,
                acierto_pct=p,
                intentos=n,
                estado=_estado_tema(p, n),
            )
            for c, t, p, n in temas
        ),
        key=lambda e: e.acierto_pct,
    )
    return AreasResponse(
        examenes_por_tema=examenes_por_tema,
        codigo_por_area=[CodigoArea(area=a, aceptacion_pct=p, ejecuciones=n) for a, p, n in codigo],
        qa_por_area=[QaArea(area=a, nivel_promedio_pct=p, autoevaluaciones=n) for a, p, n in qa],
    )


class ActivosMes(BaseModel):
    mes: str
    usuarios: int


class VidaUtilRango(BaseModel):
    rango: str
    usuarios: int


class ChurnResponse(BaseModel):
    activos_por_mes: list[ActivosMes]
    vida_util: list[VidaUtilRango]
    dias_activo_promedio: float
    abandono_pct: float


# Días de inactividad a partir de los cuales se considera abandono.
_ABANDONO_DIAS = 14


def _bucket_vida(dias: int) -> str:
    """Bucket de vida útil de un usuario por días entre primera y última actividad."""
    if dias == 0:
        return "1 día"
    if dias <= 7:
        return "2-7 días"
    if dias <= 30:
        return "8-30 días"
    return ">30 días"


@app.get("/v1/business/churn", response_model=ChurnResponse)
def business_churn() -> ChurnResponse:
    """Retención y abandono de la plataforma.

    ``vida_util`` bucketea a los usuarios por el lapso entre su primera y última
    actividad; ``abandono_pct`` es el % de usuarios cuya última actividad fue hace
    más de 14 días. Degrada a 200 con ceros/listas vacías si ClickHouse no está
    disponible.
    """
    rangos_orden = ["1 día", "2-7 días", "8-30 días", ">30 días"]
    repo = _repo_o_none()
    vacio = ChurnResponse(
        activos_por_mes=[],
        vida_util=[VidaUtilRango(rango=r, usuarios=0) for r in rangos_orden],
        dias_activo_promedio=0.0,
        abandono_pct=0.0,
    )
    if repo is None:
        return vacio
    try:
        activos = repo.activos_por_mes()
        vidas = repo.vida_util_usuarios()
    except Exception:
        return vacio

    conteo = {r: 0 for r in rangos_orden}
    for vida_dias, _, _ in vidas:
        conteo[_bucket_vida(vida_dias)] += 1

    total = len(vidas)
    dias_activo_promedio = round(sum(a for _, a, _ in vidas) / total, 1) if total else 0.0
    abandonados = sum(1 for _, _, desde in vidas if desde > _ABANDONO_DIAS)
    abandono_pct = round(100.0 * abandonados / total, 1) if total else 0.0

    return ChurnResponse(
        activos_por_mes=[ActivosMes(mes=m, usuarios=u) for m, u in activos],
        vida_util=[VidaUtilRango(rango=r, usuarios=conteo[r]) for r in rangos_orden],
        dias_activo_promedio=dias_activo_promedio,
        abandono_pct=abandono_pct,
    )
