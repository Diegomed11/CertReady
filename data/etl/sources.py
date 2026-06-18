"""Lectura de los hechos operativos y su enriquecimiento.

Los hechos viven en PostgreSQL (``exams.intentos`` + ``exams.sesiones`` y
``judge.ejecuciones``); la definición que los enriquece (tema/dificultad/tipo de la
pregunta, área/dificultad del problema) vive en MongoDB. Todas las consultas son
parametrizadas (defensa contra inyección).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

import psycopg
from psycopg.rows import dict_row
from pymongo.database import Database

# Las consultas filtran por watermark (creado_en > %s) para ser incrementales.

_SQL_INTENTOS = """
    select i.id::text          as id,
           i.usuario_id::text  as usuario_id,
           i.pregunta_ref      as pregunta_ref,
           i.correcto          as correcto,
           i.creado_en         as creado_en,
           s.certificacion     as certificacion,
           s.modo              as modo
    from exams.intentos i
    join exams.sesiones s on s.id = i.sesion_id
    where i.creado_en > %s
    order by i.creado_en
"""

_SQL_EJECUCIONES = """
    select id::text         as id,
           usuario_id::text as usuario_id,
           problema_ref     as problema_ref,
           lenguaje         as lenguaje,
           veredicto        as veredicto,
           casos_pasados    as casos_pasados,
           casos_total      as casos_total,
           duracion_ms      as duracion_ms,
           creado_en        as creado_en
    from judge.ejecuciones
    where creado_en > %s
    order by creado_en
"""

_SQL_REVISIONES_QA = """
    select id::text         as id,
           usuario_id::text as usuario_id,
           qa_ref           as qa_ref,
           nivel            as nivel,
           creado_en        as creado_en
    from progress.qa_revisiones
    where creado_en > %s
    order by creado_en
"""


def leer_intentos(conn: psycopg.Connection, desde: datetime) -> list[dict[str, Any]]:
    """Devuelve los intentos de examen creados después de ``desde``."""
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(_SQL_INTENTOS, (desde,))
        return cur.fetchall()


def leer_ejecuciones(conn: psycopg.Connection, desde: datetime) -> list[dict[str, Any]]:
    """Devuelve las ejecuciones del juez creadas después de ``desde``."""
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(_SQL_EJECUCIONES, (desde,))
        return cur.fetchall()


def leer_revisiones_qa(conn: psycopg.Connection, desde: datetime) -> list[dict[str, Any]]:
    """Devuelve las autoevaluaciones de Q&A creadas después de ``desde``."""
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(_SQL_REVISIONES_QA, (desde,))
        return cur.fetchall()


def mapa_preguntas(db: Database, refs: set[str]) -> dict[str, dict[str, Any]]:
    """Mapa ``pregunta_ref -> {tema, dificultad, tipo}`` para las refs dadas."""
    if not refs:
        return {}
    cursor = db.preguntas.find(
        {"_id": {"$in": list(refs)}},
        {"tema": 1, "dificultad": 1, "tipo": 1},
    )
    return {doc["_id"]: doc for doc in cursor}


def mapa_problemas(db: Database, refs: set[str]) -> dict[str, dict[str, Any]]:
    """Mapa ``problema_ref -> {area, dificultad}`` para las refs dadas."""
    if not refs:
        return {}
    cursor = db.problemas.find(
        {"_id": {"$in": list(refs)}},
        {"area": 1, "dificultad": 1},
    )
    return {doc["_id"]: doc for doc in cursor}


def mapa_qa(db: Database, refs: set[str]) -> dict[str, dict[str, Any]]:
    """Mapa ``qa_ref -> {puesto, area, categoria}`` para las refs dadas."""
    if not refs:
        return {}
    cursor = db.qa.find(
        {"_id": {"$in": list(refs)}},
        {"puesto": 1, "area": 1, "categoria": 1},
    )
    return {doc["_id"]: doc for doc in cursor}
