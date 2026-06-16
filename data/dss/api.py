"""API HTTP del DSS (FastAPI).

Expone la readiness de un estudiante para una certificación. La conexión a
ClickHouse es perezosa (no se conecta al importar el módulo), para que las pruebas
unitarias y la recolección de pytest no requieran la base.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import clickhouse_connect
from clickhouse_connect.driver.client import Client
from fastapi import FastAPI, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from dss import modelo, recomendador
from dss.config import Config
from dss.repo import Repo

# Tamaño máximo del CV aceptado (defensa de entrada).
MAX_CV_BYTES = 5 * 1024 * 1024

# Catálogo curado de puestos (señales y pesos de la preparación por rol).
PUESTOS_PATH = Path(__file__).resolve().parent / "puestos.json"

app = FastAPI(title="CertReady DSS", version="dev")


# --- Rate-limit de la subida de CV (anti abuso) -------------------------------
# Token-bucket en memoria por IP, SOLO para POST /v1/recommendations (no afecta a
# readiness/analytics). En producción el límite distribuido lo aplica el WAF; esto
# es defensa base por instancia.
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
    claridad (200 "sin datos" o 503) en vez de colgarse o devolver 500.
    """
    try:
        client = _client()
        if not client.ping():
            raise RuntimeError("clickhouse no responde al ping")
        return Repo(client, _config().ch_database)
    except Exception:
        _client.cache_clear()
        return None


@lru_cache(maxsize=1)
def _puestos() -> list[dict]:
    """Carga (una vez) el catálogo de puestos desde ``puestos.json``."""
    data = json.loads(PUESTOS_PATH.read_text(encoding="utf-8"))
    return data.get("puestos", [])


def _puesto(slug: str) -> dict:
    """Devuelve la definición de un puesto por slug, o 404 si no existe."""
    for p in _puestos():
        if p.get("slug") == slug:
            return p
    raise HTTPException(status_code=404, detail="puesto no encontrado")


def _pct(score: float | None) -> float | None:
    """Pasa un score [0,1] a porcentaje [0,100] con un decimal (None se conserva)."""
    return round(100.0 * score, 1) if score is not None else None


@dataclass
class _CalculoCert:
    """Resultado intermedio del cálculo de readiness IRT de una certificación."""

    theta: float
    celdas: list[modelo.Celda]
    conteo: dict[tuple[str, str], int]
    readiness: float


def _calcular_cert(repo: Repo, usuario_id: str, certificacion: str) -> _CalculoCert | None:
    """Calcula la readiness IRT del usuario en una certificación.

    Returns ``None`` si la certificación no tiene población calibrable o si el
    usuario no tiene intentos en ella (sin historial no se personaliza).
    """
    poblacion = repo.accuracy_celdas(certificacion)
    if not poblacion:
        return None
    respuestas = repo.respuestas_usuario(usuario_id, certificacion)
    if not respuestas:
        return None

    celdas = [
        modelo.Celda(tema=t, dificultad=d, b=modelo.dificultad_celda(p), peso=float(n))
        for (t, d), (p, n) in poblacion.items()
    ]
    b_por_celda = {(c.tema, c.dificultad): c.b for c in celdas}

    dificultades: list[float] = []
    aciertos: list[int] = []
    conteo: dict[tuple[str, str], int] = {}
    for t, d, e in respuestas:
        dificultades.append(b_por_celda[(t, d)])
        aciertos.append(e)
        conteo[(t, d)] = conteo.get((t, d), 0) + 1

    theta = modelo.estimar_theta(dificultades, aciertos)
    return _CalculoCert(theta, celdas, conteo, modelo.readiness(theta, celdas))


class CeldaDominio(BaseModel):
    tema: str
    dificultad: str
    dominio_pct: float
    intentos: int


class SiguienteAccion(BaseModel):
    tema: str
    dificultad: str
    motivo: str


class ReadinessResponse(BaseModel):
    usuario_id: str
    certificacion: str
    readiness_pct: float
    probabilidad_aprobar: float
    habilidad_theta: float
    por_celda: list[CeldaDominio]
    siguiente_accion: SiguienteAccion | None


@app.get("/v1/health")
def health() -> dict[str, str]:
    """Liveness."""
    return {"status": "ok", "service": "dss"}


@app.get("/v1/readiness/{usuario_id}", response_model=ReadinessResponse)
def readiness(usuario_id: str, certificacion: str) -> ReadinessResponse:
    """Estima la preparación del usuario para la certificación dada.

    Returns 404 si la certificación no tiene datos o el usuario no tiene intentos
    en ella (sin historial no se personaliza).
    """
    cfg = _config()
    repo = _repo_o_none()
    if repo is None:
        raise HTTPException(status_code=503, detail="servicio de análisis no disponible")

    calc = _calcular_cert(repo, usuario_id, certificacion)
    if calc is None:
        raise HTTPException(status_code=404, detail="sin datos suficientes para la certificación")

    accion = modelo.siguiente_accion(calc.theta, calc.celdas)

    return ReadinessResponse(
        usuario_id=usuario_id,
        certificacion=certificacion,
        readiness_pct=round(100.0 * calc.readiness, 1),
        probabilidad_aprobar=round(
            modelo.prob_aprobar(calc.theta, calc.celdas, umbral=cfg.umbral, n_items=cfg.n_items), 4
        ),
        habilidad_theta=round(calc.theta, 4),
        por_celda=[
            CeldaDominio(
                tema=c.tema,
                dificultad=c.dificultad,
                dominio_pct=round(100.0 * modelo.dominio(calc.theta, c.b), 1),
                intentos=calc.conteo.get((c.tema, c.dificultad), 0),
            )
            for c in calc.celdas
        ],
        siguiente_accion=(
            SiguienteAccion(
                tema=accion.tema,
                dificultad=accion.dificultad,
                motivo="es la celda con menor dominio estimado; estudiarla sube más tu readiness",
            )
            if accion is not None
            else None
        ),
    )


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


# --- Analítica por usuario (dashboards; requiere ClickHouse) -------------------
class TemaAcierto(BaseModel):
    tema: str
    aciertos: int
    total: int
    pct: float


class PuntoTendencia(BaseModel):
    fecha: str
    pct: float
    intentos: int


class AnaliticaResponse(BaseModel):
    certificacion: str
    total: int
    aciertos: int
    pct: float
    por_tema: list[TemaAcierto]
    tendencia: list[PuntoTendencia]


@app.get("/v1/analytics/{usuario_id}", response_model=AnaliticaResponse)
def analytics(usuario_id: str, certificacion: str) -> AnaliticaResponse:
    """Acierto por tema y tendencia diaria del usuario (para los dashboards).

    Si no hay intentos, devuelve listas vacías (200), no 404: el front muestra
    "sin datos" sin romperse.
    """
    repo = _repo_o_none()
    if repo is None:
        # ClickHouse no disponible: vacío (200) para no romper el dashboard.
        return AnaliticaResponse(
            certificacion=certificacion,
            total=0,
            aciertos=0,
            pct=0.0,
            por_tema=[],
            tendencia=[],
        )
    por_tema = repo.acierto_por_tema(usuario_id, certificacion)
    serie = repo.serie_por_fecha(usuario_id, certificacion)
    total = sum(n for _, _, n in por_tema)
    aciertos = sum(a for _, a, _ in por_tema)
    return AnaliticaResponse(
        certificacion=certificacion,
        total=total,
        aciertos=aciertos,
        pct=round(100.0 * aciertos / total, 1) if total else 0.0,
        por_tema=[
            TemaAcierto(tema=t, aciertos=a, total=n, pct=round(100.0 * a / n, 1) if n else 0.0)
            for t, a, n in por_tema
        ],
        tendencia=[
            PuntoTendencia(fecha=f, pct=round(100.0 * a / n, 1) if n else 0.0, intentos=n)
            for f, a, n in serie
        ],
    )


# --- Preparación por puesto (combina exámenes + código + Q&A) ------------------
class PuestoResumen(BaseModel):
    slug: str
    nombre: str
    descripcion: str
    qa_areas: list[str]  # áreas conceptuales de Q&A (para filtrar el banco)
    code_areas: list[str]  # áreas de código (para filtrar los problemas)


class SenalPreparacion(BaseModel):
    clave: str  # examenes | codigo | qa
    etiqueta: str
    score_pct: float | None  # None si la señal no tiene datos
    peso: float
    cobertura: int  # nº de ítems con datos (certs / problemas / preguntas)
    detalle: str


class JobReadinessResponse(BaseModel):
    usuario_id: str
    puesto: str
    nombre: str
    readiness_pct: float | None  # None si ninguna señal tiene datos
    nivel: str
    senales: list[SenalPreparacion]
    enfoque: str | None  # señal (con datos) de menor score: dónde conviene mejorar


def _nivel_label(score: float | None) -> str:
    """Etiqueta legible para una readiness [0,1] (o sin datos)."""
    if score is None:
        return "Sin datos"
    if score < 0.4:
        return "Inicial"
    if score < 0.6:
        return "En progreso"
    if score < 0.8:
        return "Sólido"
    return "Listo"


@app.get("/v1/puestos", response_model=list[PuestoResumen])
def puestos() -> list[PuestoResumen]:
    """Catálogo de puestos para los que se puede estimar preparación.

    Incluye las áreas de cada especialidad (qa_areas/code_areas) para que la UI
    arme los filtros de Entrevistas: elegir una especialidad equivale a filtrar el
    banco por sus áreas (que pueden compartirse entre especialidades).
    """
    out: list[PuestoResumen] = []
    for p in _puestos():
        senales = p.get("senales", {})
        out.append(
            PuestoResumen(
                slug=p["slug"],
                nombre=p.get("nombre", p["slug"]),
                descripcion=p.get("descripcion", ""),
                qa_areas=list(senales.get("qa", {}).get("areas", [])),
                code_areas=list(senales.get("codigo", {}).get("areas", [])),
            )
        )
    return out


@app.get("/v1/job-readiness/{usuario_id}", response_model=JobReadinessResponse)
def job_readiness(usuario_id: str, puesto: str) -> JobReadinessResponse:
    """Estima qué tan preparado está el usuario para un puesto.

    Combina tres señales —exámenes (readiness IRT), código (problemas resueltos)
    y Q&A (autoevaluación)— con los pesos del catálogo, renormalizados sobre las
    señales que tienen datos. Devuelve 200 siempre (404 solo si el puesto no
    existe): las señales sin datos se marcan y no hunden el resultado.
    """
    cat = _puesto(puesto)
    senales_cfg = cat.get("senales", {})
    ex_cfg = senales_cfg.get("examenes", {})
    co_cfg = senales_cfg.get("codigo", {})
    qa_cfg = senales_cfg.get("qa", {})
    ex_peso = float(ex_cfg.get("peso", 0.0))
    co_peso = float(co_cfg.get("peso", 0.0))
    qa_peso = float(qa_cfg.get("peso", 0.0))

    # Si ClickHouse no está disponible, todas las señales quedan sin datos y la
    # respuesta degrada con claridad (200 "Sin datos"), sin colgarse ni dar 500.
    ex_scores: list[float] = []
    codigo: list[tuple[str, str, int, int]] = []
    qa: list[tuple[str, str, str, int, int]] = []
    resueltos = 0

    repo = _repo_o_none()
    if repo is not None:
        try:
            ex_scores = [
                calc.readiness
                for cert in ex_cfg.get("certificaciones", [])
                if (calc := _calcular_cert(repo, usuario_id, cert)) is not None
            ]
            codigo = repo.codigo_por_area(usuario_id, co_cfg.get("areas", []))
            resueltos = sum(m for _, _, m, _ in codigo)
            qa = repo.qa_por_area(usuario_id, qa_cfg.get("areas", []))
        except Exception:
            # La conexión murió a mitad de las consultas: degradar a sin datos.
            ex_scores, codigo, qa, resueltos = [], [], [], 0

    ex_score = sum(ex_scores) / len(ex_scores) if ex_scores else None
    co_score = resueltos / len(codigo) if codigo else None
    qa_score = sum(modelo.nivel_a_score(n) for _, _, _, n, _ in qa) / len(qa) if qa else None

    combinado = modelo.combinar_readiness(
        [(ex_peso, ex_score), (co_peso, co_score), (qa_peso, qa_score)]
    )

    senales = [
        SenalPreparacion(
            clave="examenes",
            etiqueta="Exámenes",
            score_pct=_pct(ex_score),
            peso=ex_peso,
            cobertura=len(ex_scores),
            detalle=(
                f"{len(ex_scores)} certificación(es) con intentos"
                if ex_scores
                else "sin intentos de examen"
            ),
        ),
        SenalPreparacion(
            clave="codigo",
            etiqueta="Código",
            score_pct=_pct(co_score),
            peso=co_peso,
            cobertura=len(codigo),
            detalle=(
                f"{resueltos}/{len(codigo)} problemas resueltos"
                if codigo
                else "sin envíos de código"
            ),
        ),
        SenalPreparacion(
            clave="qa",
            etiqueta="Entrevista (Q&A)",
            score_pct=_pct(qa_score),
            peso=qa_peso,
            cobertura=len(qa),
            detalle=(f"{len(qa)} preguntas autoevaluadas" if qa else "sin autoevaluaciones"),
        ),
    ]

    con_datos = [s for s in senales if s.score_pct is not None]
    enfoque = min(con_datos, key=lambda s: s.score_pct).etiqueta if con_datos else None

    return JobReadinessResponse(
        usuario_id=usuario_id,
        puesto=puesto,
        nombre=cat.get("nombre", puesto),
        readiness_pct=_pct(combinado),
        nivel=_nivel_label(combinado),
        senales=senales,
        enfoque=enfoque,
    )
