"""API HTTP del DSS (FastAPI).

Expone la readiness de un estudiante para una certificación. La conexión a
ClickHouse es perezosa (no se conecta al importar el módulo), para que las pruebas
unitarias y la recolección de pytest no requieran la base.
"""

from __future__ import annotations

from functools import lru_cache

import clickhouse_connect
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from dss import modelo
from dss.config import Config
from dss.repo import Repo

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
