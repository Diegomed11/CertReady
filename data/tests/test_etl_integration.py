"""Integración de la capa de carga contra un ClickHouse real.

Gated por ``DATA_ETL_IT=1`` (requiere ClickHouse; por defecto localhost:8123).
Verifica el esquema, la inserción, el roundtrip del watermark y el cálculo de la
medida central (accuracy) sobre una base aislada ``analytics_test``.
"""

from __future__ import annotations

import os
from datetime import UTC, datetime

import pytest

pytestmark = pytest.mark.skipif(
    os.getenv("DATA_ETL_IT") != "1",
    reason="define DATA_ETL_IT=1 para la integración con ClickHouse",
)

import clickhouse_connect  # noqa: E402

from etl import load, transform  # noqa: E402

DB = "analytics_test"


@pytest.fixture
def cargador():
    client = clickhouse_connect.get_client(
        host=os.getenv("CLICKHOUSE_HOST", "localhost"),
        port=int(os.getenv("CLICKHOUSE_PORT", "8123")),
        username=os.getenv("CLICKHOUSE_USER", "default"),
        password=os.getenv("CLICKHOUSE_PASSWORD", ""),
    )
    client.command(f"drop database if exists {DB}")
    c = load.Cargador(client, DB)
    c.aplicar_schema(load.leer_schema())
    yield c
    client.command(f"drop database if exists {DB}")


def _intento(id_: str, ref: str, correcto: bool):
    return {
        "id": id_,
        "usuario_id": "u1",
        "pregunta_ref": ref,
        "correcto": correcto,
        "creado_en": datetime(2026, 6, 7, 10, 0, 0),
        "certificacion": "aws-saa",
        "modo": "simulacro",
    }


def test_carga_y_accuracy(cargador):
    preguntas = {
        "q1": {"tema": "redes", "dificultad": "media", "tipo": "opcion_multiple"},
        "q2": {"tema": "redes", "dificultad": "media", "tipo": "opcion_multiple"},
        "q3": {"tema": "seguridad", "dificultad": "facil", "tipo": "opcion_multiple"},
    }
    crudos = [
        _intento("i1", "q1", True),
        _intento("i2", "q2", False),
        _intento("i3", "q3", True),
    ]
    filas = [transform.fila_intento(i, preguntas) for i in crudos]
    n = cargador.insertar("fact_intento", load.COLUMNAS_INTENTO, filas)
    assert n == 3

    # accuracy por tema: redes = 1/2 = 0.5 ; seguridad = 1/1 = 1.0
    res = cargador.client.query(
        f"select tema, avg(es_correcto) from {DB}.fact_intento group by tema order by tema"
    )
    accuracy = {tema: round(val, 3) for tema, val in res.result_rows}
    assert accuracy == {"redes": 0.5, "seguridad": 1.0}


def test_idempotencia_replacing(cargador):
    preguntas = {"q1": {"tema": "redes", "dificultad": "media", "tipo": "opcion_multiple"}}
    fila = transform.fila_intento(_intento("i1", "q1", True), preguntas)

    cargador.insertar("fact_intento", load.COLUMNAS_INTENTO, [fila])
    cargador.insertar("fact_intento", load.COLUMNAS_INTENTO, [fila])

    # Misma clave (intento_id) -> ReplacingMergeTree colapsa con FINAL.
    res = cargador.client.query(f"select count() from {DB}.fact_intento final")
    assert res.result_rows[0][0] == 1


def test_watermark_roundtrip(cargador):
    assert cargador.watermark("intentos") == datetime(1970, 1, 1, tzinfo=UTC)
    ts = datetime(2026, 6, 7, 10, 0, 0, tzinfo=UTC)
    cargador.set_watermark("intentos", ts)
    assert cargador.watermark("intentos") == ts
