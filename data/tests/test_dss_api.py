"""Integración del DSS (analítica de negocio) contra ClickHouse real.

Gated por ``DATA_ETL_IT=1`` (requiere ClickHouse; usa la base ``analytics``).
Inserta hechos sintéticos en las tres tablas y verifica que los endpoints de
negocio agregan de forma coherente y respetan el contrato.
"""

from __future__ import annotations

import os
from datetime import UTC, datetime

import pytest

pytestmark = pytest.mark.skipif(
    os.getenv("DATA_ETL_IT") != "1",
    reason="define DATA_ETL_IT=1 para la integración del DSS con ClickHouse",
)

import clickhouse_connect  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from dss.api import app  # noqa: E402
from etl import load  # noqa: E402

CERT = "dss-e2e"
AREA = "dss-e2e-area"
DT = datetime(2026, 6, 7, 10, 0, 0, tzinfo=UTC)


def _intento(intento_id, usuario, tema, ok):
    return {
        "intento_id": intento_id,
        "usuario_id": usuario,
        "certificacion": CERT,
        "tema": tema,
        "dificultad": "facil",
        "tipo_pregunta": "opcion_multiple",
        "modo": "simulacro",
        "fecha": DT.date(),
        "creado_en": DT,
        "es_correcto": 1 if ok else 0,
        "intentos_n": 1,
    }


def _ejecucion(ejecucion_id, usuario, aceptado):
    return {
        "ejecucion_id": ejecucion_id,
        "usuario_id": usuario,
        "problema_ref": f"p-{ejecucion_id}",
        "area": AREA,
        "dificultad": "facil",
        "lenguaje": "python",
        "veredicto": "ok" if aceptado else "fail",
        "aceptado": 1 if aceptado else 0,
        "casos_pasados": 10 if aceptado else 5,
        "casos_total": 10,
        "duracion_ms": 100,
        "fecha": DT.date(),
        "creado_en": DT,
    }


def _qa(qa_id, usuario, nivel):
    return {
        "qa_id": qa_id,
        "usuario_id": usuario,
        "qa_ref": f"q-{qa_id}",
        "puesto": "backend",
        "area": AREA,
        "categoria": "conceptual",
        "nivel": nivel,
        "fecha": DT.date(),
        "creado_en": DT,
    }


@pytest.fixture(scope="module")
def cliente():
    ch = clickhouse_connect.get_client(
        host=os.getenv("CLICKHOUSE_HOST", "localhost"),
        port=int(os.getenv("CLICKHOUSE_PORT", "8123")),
        username=os.getenv("CLICKHOUSE_USER", "default"),
        password=os.getenv("CLICKHOUSE_PASSWORD", ""),
    )
    cargador = load.Cargador(ch, "analytics")
    cargador.aplicar_schema(load.leer_schema())
    ch.command(f"alter table analytics.fact_intento delete where certificacion = '{CERT}'")
    ch.command(f"alter table analytics.fact_ejecucion delete where area = '{AREA}'")
    ch.command(f"alter table analytics.fact_qa delete where area = '{AREA}'")

    cargador.insertar(
        "fact_intento",
        load.COLUMNAS_INTENTO,
        [
            _intento("i1", "u_a", "redes", True),
            _intento("i2", "u_a", "redes", True),
            _intento("i3", "u_b", "redes", False),
        ],
    )
    cargador.insertar(
        "fact_ejecucion",
        load.COLUMNAS_EJECUCION,
        [_ejecucion("e1", "u_a", True), _ejecucion("e2", "u_c", False)],
    )
    cargador.insertar(
        "fact_qa",
        load.COLUMNAS_QA,
        [_qa("q1", "u_b", 3), _qa("q2", "u_d", 1)],
    )
    yield TestClient(app)
    ch.command(f"alter table analytics.fact_intento delete where certificacion = '{CERT}'")
    ch.command(f"alter table analytics.fact_ejecucion delete where area = '{AREA}'")
    ch.command(f"alter table analytics.fact_qa delete where area = '{AREA}'")


def test_health(cliente):
    assert cliente.get("/v1/health").json()["status"] == "ok"


def test_overview_contrato_y_coherencia(cliente):
    r = cliente.get("/v1/business/overview")
    assert r.status_code == 200, r.text
    body = r.json()
    assert set(body) == {"usuarios", "examenes", "codigo", "qa", "actividad_mensual"}
    # u_a, u_b, u_c, u_d -> al menos 4 usuarios distintos.
    assert body["usuarios"] >= 4
    assert body["examenes"]["intentos"] >= 3
    assert 0.0 <= body["examenes"]["acierto_pct"] <= 100.0
    assert body["codigo"]["ejecuciones"] >= 2
    assert body["qa"]["autoevaluaciones"] >= 2
    # actividad_mensual ordenada por mes ascendente.
    meses = [p["mes"] for p in body["actividad_mensual"]]
    assert meses == sorted(meses)
    for p in body["actividad_mensual"]:
        assert set(p) == {"mes", "intentos", "ejecuciones", "qa", "usuarios"}


def test_areas_contrato_y_orden(cliente):
    r = cliente.get("/v1/business/areas")
    assert r.status_code == 200, r.text
    body = r.json()
    assert set(body) == {"examenes_por_tema", "codigo_por_area", "qa_por_area"}
    # examenes_por_tema ordenado por acierto ascendente (gaps arriba).
    aciertos = [e["acierto_pct"] for e in body["examenes_por_tema"]]
    assert aciertos == sorted(aciertos)
    for e in body["examenes_por_tema"]:
        assert e["estado"] in {"ok", "facil", "dificil", "poco_volumen"}


def test_churn_contrato(cliente):
    r = cliente.get("/v1/business/churn")
    assert r.status_code == 200, r.text
    body = r.json()
    assert set(body) == {
        "activos_por_mes",
        "vida_util",
        "dias_activo_promedio",
        "abandono_pct",
    }
    rangos = [v["rango"] for v in body["vida_util"]]
    assert rangos == ["1 día", "2-7 días", "8-30 días", ">30 días"]
    assert 0.0 <= body["abandono_pct"] <= 100.0
