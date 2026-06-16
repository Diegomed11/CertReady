"""Punto de entrada del ETL: incremental e idempotente.

Ejecuta una pasada: lee los hechos nuevos (desde el watermark) de PostgreSQL, los
enriquece con MongoDB, los transforma y los carga en ClickHouse, y avanza el
watermark. Reejecutar sin datos nuevos no cambia nada.

    python -m etl.run
"""

from __future__ import annotations

import logging

import psycopg
from pymongo import MongoClient

from etl import load, sources, transform
from etl.config import Config

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("etl")


def ejecutar(cfg: Config) -> dict[str, int]:
    """Corre una pasada del ETL y devuelve el conteo cargado por hecho."""
    client = load.cliente(cfg)
    cargador = load.Cargador(client, cfg.ch_database)
    cargador.aplicar_schema(load.leer_schema())

    wm_intentos = cargador.watermark("intentos")
    wm_corridas = cargador.watermark("corridas")
    wm_qa = cargador.watermark("qa_revisiones")

    with psycopg.connect(cfg.pg_dsn) as pg:
        intentos = sources.leer_intentos(pg, wm_intentos)
        corridas = sources.leer_corridas(pg, wm_corridas)
        revisiones = sources.leer_revisiones_qa(pg, wm_qa)

    mongo = MongoClient(cfg.mongo_uri)
    try:
        db = mongo[cfg.mongo_db]
        preguntas = sources.mapa_preguntas(db, {i["pregunta_ref"] for i in intentos})
        problemas = sources.mapa_problemas(db, {c["problema_ref"] for c in corridas})
        qa = sources.mapa_qa(db, {r["qa_ref"] for r in revisiones})
    finally:
        mongo.close()

    filas_intento = [transform.fila_intento(i, preguntas) for i in intentos]
    filas_corrida = [transform.fila_corrida(c, problemas) for c in corridas]
    filas_qa = [transform.fila_qa(r, qa) for r in revisiones]

    n_intentos = cargador.insertar("fact_intento", load.COLUMNAS_INTENTO, filas_intento)
    n_corridas = cargador.insertar("fact_corrida", load.COLUMNAS_CORRIDA, filas_corrida)
    n_qa = cargador.insertar("fact_qa", load.COLUMNAS_QA, filas_qa)

    if intentos:
        cargador.set_watermark("intentos", max(i["creado_en"] for i in intentos))
    if corridas:
        cargador.set_watermark("corridas", max(c["creado_en"] for c in corridas))
    if revisiones:
        cargador.set_watermark("qa_revisiones", max(r["creado_en"] for r in revisiones))

    log.info("ETL completado: %d intentos, %d corridas, %d Q&A", n_intentos, n_corridas, n_qa)
    return {"intentos": n_intentos, "corridas": n_corridas, "qa": n_qa}


def main() -> None:
    ejecutar(Config.load())


if __name__ == "__main__":
    main()
