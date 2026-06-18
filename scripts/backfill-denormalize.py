"""Backfill de denormalización: tema/dificultad (exams.intentos) y área
(judge.corridas) desde MongoDB hacia PostgreSQL.

La analítica por-usuario se movió al plano OPERATIVO: el "acierto por tema" y los
"problemas por área" se calculan directo de Postgres (tiempo real, sin OLAP). Las
escrituras nuevas ya denormalizan estos campos al calificar; este script rellena
las filas creadas ANTES del cambio. Es idempotente: re-ejecutar fija los mismos
valores (no duplica ni varía nada una vez relleno).

Uso (en la EC2, con el venv de data):
    export DATABASE_URL='postgres://postgres@localhost:5432/certready_dev?sslmode=disable'
    export MONGO_URI='mongodb://localhost:27017'
    data/.venv/bin/python scripts/backfill-denormalize.py
"""

from __future__ import annotations

import os

import psycopg
from pymongo import MongoClient

PG_DSN = os.getenv(
    "DATABASE_URL", "postgres://postgres@localhost:5432/certready_dev?sslmode=disable"
)
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB = os.getenv("MONGO_DB", "certready")
DESCONOCIDO = "desconocido"


def backfill_intentos(conn: psycopg.Connection, db) -> int:
    """Rellena tema/dificultad de exams.intentos según la pregunta en MongoDB."""
    refs = [r[0] for r in conn.execute("select distinct pregunta_ref from exams.intentos").fetchall()]
    if not refs:
        return 0
    meta = {
        d["_id"]: (d.get("tema") or DESCONOCIDO, d.get("dificultad") or DESCONOCIDO)
        for d in db.preguntas.find({"_id": {"$in": refs}}, {"tema": 1, "dificultad": 1})
    }
    n = 0
    for ref, (tema, dif) in meta.items():
        cur = conn.execute(
            "update exams.intentos set tema = %s, dificultad = %s where pregunta_ref = %s",
            (tema, dif, ref),
        )
        n += cur.rowcount
    return n


def backfill_corridas(conn: psycopg.Connection, db) -> int:
    """Rellena el área de judge.corridas según el problema en MongoDB."""
    refs = [r[0] for r in conn.execute("select distinct problema_ref from judge.corridas").fetchall()]
    if not refs:
        return 0
    meta = {
        d["_id"]: (d.get("area") or DESCONOCIDO)
        for d in db.problemas.find({"_id": {"$in": refs}}, {"area": 1})
    }
    n = 0
    for ref, area in meta.items():
        cur = conn.execute(
            "update judge.corridas set area = %s where problema_ref = %s",
            (area, ref),
        )
        n += cur.rowcount
    return n


def backfill_qa(conn: psycopg.Connection, db) -> int:
    """Rellena el área de progress.qa_revisiones según la Q&A en MongoDB."""
    refs = [r[0] for r in conn.execute("select distinct qa_ref from progress.qa_revisiones").fetchall()]
    if not refs:
        return 0
    meta = {
        d["_id"]: (d.get("area") or DESCONOCIDO)
        for d in db.qa.find({"_id": {"$in": refs}}, {"area": 1})
    }
    n = 0
    for ref, area in meta.items():
        cur = conn.execute(
            "update progress.qa_revisiones set area = %s where qa_ref = %s",
            (area, ref),
        )
        n += cur.rowcount
    return n


def main() -> None:
    mongo = MongoClient(MONGO_URI)
    try:
        db = mongo[MONGO_DB]
        with psycopg.connect(PG_DSN) as conn:
            ni = backfill_intentos(conn, db)
            nc = backfill_corridas(conn, db)
            nq = backfill_qa(conn, db)
            conn.commit()
    finally:
        mongo.close()
    print(
        f"Backfill listo. intentos: {ni} · corridas: {nc} · q&a: {nq} (filas actualizadas)."
    )


if __name__ == "__main__":
    main()
