"""Integración del DSS contra ClickHouse real vía FastAPI TestClient.

Gated por ``DATA_ETL_IT=1`` (requiere ClickHouse; usa la base ``analytics``).
Verifica que un estudiante fuerte obtiene mayor readiness que uno débil y que la
salida es coherente.
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
DT = datetime(2026, 6, 7, 10, 0, 0, tzinfo=UTC)


def _fila(intento_id, usuario, dificultad, b_tema, ok):
    return {
        "intento_id": intento_id,
        "usuario_id": usuario,
        "certificacion": CERT,
        "tema": b_tema,
        "dificultad": dificultad,
        "tipo_pregunta": "opcion_multiple",
        "modo": "simulacro",
        "fecha": DT.date(),
        "creado_en": DT,
        "es_correcto": 1 if ok else 0,
        "intentos_n": 1,
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

    filas = [
        # fuerte: acierta fácil y difícil.
        _fila("s1", "u_fuerte", "facil", "redes", True),
        _fila("s2", "u_fuerte", "dificil", "redes", True),
        # débil: acierta fácil, falla difícil.
        _fila("w1", "u_debil", "facil", "redes", True),
        _fila("w2", "u_debil", "dificil", "redes", False),
    ]
    cargador.insertar("fact_intento", load.COLUMNAS_INTENTO, filas)
    yield TestClient(app)
    ch.command(f"alter table analytics.fact_intento delete where certificacion = '{CERT}'")


def _readiness(cliente, usuario):
    r = cliente.get(f"/v1/readiness/{usuario}", params={"certificacion": CERT})
    assert r.status_code == 200, r.text
    return r.json()


def test_health(cliente):
    assert cliente.get("/v1/health").json()["status"] == "ok"


def test_fuerte_supera_a_debil(cliente):
    fuerte = _readiness(cliente, "u_fuerte")
    debil = _readiness(cliente, "u_debil")

    assert fuerte["readiness_pct"] > debil["readiness_pct"]
    assert fuerte["habilidad_theta"] > debil["habilidad_theta"]
    for resp in (fuerte, debil):
        assert 0.0 <= resp["readiness_pct"] <= 100.0
        assert 0.0 <= resp["probabilidad_aprobar"] <= 1.0
        assert resp["por_celda"]
        assert resp["siguiente_accion"] is not None


def test_usuario_sin_intentos_404(cliente):
    r = cliente.get("/v1/readiness/u_inexistente", params={"certificacion": CERT})
    assert r.status_code == 404
