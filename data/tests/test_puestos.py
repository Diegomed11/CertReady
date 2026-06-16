"""Pruebas del catálogo de puestos del DSS (sin ClickHouse).

El endpoint ``/v1/puestos`` solo lee ``puestos.json`` y la ruta de puesto
desconocido responde 404 antes de tocar ClickHouse, así que estas pruebas no
requieren la base ni el gate ``DATA_ETL_IT``.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from dss import modelo
from dss.api import _puestos, app

cliente = TestClient(app)


def test_catalogo_no_vacio_y_bien_formado():
    r = cliente.get("/v1/puestos")
    assert r.status_code == 200
    puestos = r.json()
    assert puestos, "el catálogo de puestos no debe estar vacío"
    for p in puestos:
        assert p["slug"] and p["nombre"] and "descripcion" in p


def test_puesto_desconocido_404():
    r = cliente.get("/v1/job-readiness/u1", params={"puesto": "no-existe"})
    assert r.status_code == 404


def test_definiciones_tienen_senales_con_pesos_validos():
    for p in _puestos():
        senales = p.get("senales", {})
        assert senales, f"{p['slug']} debe declarar señales"
        for clave in ("examenes", "codigo", "qa"):
            assert clave in senales, f"{p['slug']} sin señal {clave}"
            assert float(senales[clave]["peso"]) >= 0.0
        # Las claves de contenido son listas (certificaciones / áreas).
        assert isinstance(senales["examenes"].get("certificaciones"), list)
        assert isinstance(senales["codigo"].get("areas"), list)
        assert isinstance(senales["qa"].get("areas"), list)


def test_combinar_con_pesos_del_catalogo_da_rango_valido():
    # Sanidad: con scores arbitrarios, combinar da un valor en [0,1].
    p = _puestos()[0]["senales"]
    r = modelo.combinar_readiness(
        [
            (float(p["examenes"]["peso"]), 0.7),
            (float(p["codigo"]["peso"]), 0.4),
            (float(p["qa"]["peso"]), 1.0),
        ]
    )
    assert r is not None and 0.0 <= r <= 1.0
