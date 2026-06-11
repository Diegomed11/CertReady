"""API HTTP del DSS (FastAPI).

Expone la readiness de un estudiante para una certificación. La conexión a
ClickHouse es perezosa (no se conecta al importar el módulo), para que las pruebas
unitarias y la recolección de pytest no requieran la base.
"""

from __future__ import annotations

from functools import lru_cache

import clickhouse_connect
from fastapi import FastAPI, HTTPException, UploadFile
from pydantic import BaseModel

from dss import modelo, recomendador
from dss.config import Config
from dss.repo import Repo

# Tamaño máximo del CV aceptado (defensa de entrada).
MAX_CV_BYTES = 5 * 1024 * 1024

app = FastAPI(title="CertReady DSS", version="dev")


@lru_cache(maxsize=1)
def _contexto() -> tuple[Repo, Config]:
    """Crea (una vez) el repo de ClickHouse y la config."""
    cfg = Config.load()
    client = clickhouse_connect.get_client(
        host=cfg.ch_host, port=cfg.ch_port, username=cfg.ch_user, password=cfg.ch_password
    )
    return Repo(client, cfg.ch_database), cfg


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
    repo, cfg = _contexto()

    poblacion = repo.accuracy_celdas(certificacion)
    if not poblacion:
        raise HTTPException(status_code=404, detail="sin datos para la certificación")

    respuestas = repo.respuestas_usuario(usuario_id, certificacion)
    if not respuestas:
        raise HTTPException(
            status_code=404, detail="el usuario no tiene intentos en la certificación"
        )

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
    accion = modelo.siguiente_accion(theta, celdas)

    return ReadinessResponse(
        usuario_id=usuario_id,
        certificacion=certificacion,
        readiness_pct=round(100.0 * modelo.readiness(theta, celdas), 1),
        probabilidad_aprobar=round(
            modelo.prob_aprobar(theta, celdas, umbral=cfg.umbral, n_items=cfg.n_items), 4
        ),
        habilidad_theta=round(theta, 4),
        por_celda=[
            CeldaDominio(
                tema=c.tema,
                dificultad=c.dificultad,
                dominio_pct=round(100.0 * modelo.dominio(theta, c.b), 1),
                intentos=conteo.get((c.tema, c.dificultad), 0),
            )
            for c in celdas
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

    El archivo se procesa en memoria y **no se persiste**. No depende de ClickHouse.
    """
    datos = await file.read()
    if not datos:
        raise HTTPException(status_code=400, detail="archivo vacío")
    if len(datos) > MAX_CV_BYTES:
        raise HTTPException(status_code=413, detail="archivo demasiado grande (máx 5 MB)")
    texto = recomendador.extraer_texto(file.filename or "", datos)
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
    repo, _ = _contexto()
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
