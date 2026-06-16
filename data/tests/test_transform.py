"""Pruebas unitarias de la transformación pura (sin bases de datos)."""

from __future__ import annotations

from datetime import datetime

from etl import transform


def test_fila_intento_enriquece_y_mapea():
    intento = {
        "id": "i1",
        "usuario_id": "u1",
        "pregunta_ref": "q1",
        "correcto": True,
        "creado_en": datetime(2026, 6, 7, 10, 30, 0),
        "certificacion": "aws-saa",
        "modo": "simulacro",
    }
    preguntas = {"q1": {"tema": "redes", "dificultad": "media", "tipo": "opcion_multiple"}}

    fila = transform.fila_intento(intento, preguntas)

    assert fila["tema"] == "redes"
    assert fila["dificultad"] == "media"
    assert fila["tipo_pregunta"] == "opcion_multiple"
    assert fila["es_correcto"] == 1
    assert fila["intentos_n"] == 1
    assert fila["fecha"] == datetime(2026, 6, 7, 10, 30, 0).date()


def test_fila_intento_incorrecto_y_sin_enriquecimiento():
    intento = {
        "id": "i2",
        "usuario_id": "u1",
        "pregunta_ref": "huerfana",
        "correcto": False,
        "creado_en": datetime(2026, 6, 7, 11, 0, 0),
        "certificacion": "aws-saa",
        "modo": "practica",
    }
    fila = transform.fila_intento(intento, {})

    assert fila["es_correcto"] == 0
    assert fila["tema"] == transform.DESCONOCIDO
    assert fila["dificultad"] == transform.DESCONOCIDO
    assert fila["tipo_pregunta"] == transform.DESCONOCIDO


def test_fila_corrida_aceptado():
    corrida = {
        "id": "c1",
        "usuario_id": "u1",
        "problema_ref": "p1",
        "lenguaje": "python",
        "veredicto": "accepted",
        "casos_pasados": 2,
        "casos_total": 2,
        "duracion_ms": 42,
        "creado_en": datetime(2026, 6, 7, 12, 0, 0),
    }
    problemas = {"p1": {"area": "algoritmos", "dificultad": "facil"}}

    fila = transform.fila_corrida(corrida, problemas)

    assert fila["aceptado"] == 1
    assert fila["area"] == "algoritmos"
    assert fila["lenguaje"] == "python"


def test_fila_corrida_no_aceptado_y_sin_enriquecimiento():
    corrida = {
        "id": "c2",
        "usuario_id": "u1",
        "problema_ref": "huerfano",
        "lenguaje": "python",
        "veredicto": "wrong_answer",
        "casos_pasados": 1,
        "casos_total": 2,
        "duracion_ms": 10,
        "creado_en": datetime(2026, 6, 7, 12, 5, 0),
    }
    fila = transform.fila_corrida(corrida, {})

    assert fila["aceptado"] == 0
    assert fila["area"] == transform.DESCONOCIDO
    assert fila["dificultad"] == transform.DESCONOCIDO


def test_fila_qa_enriquece_y_mapea():
    revision = {
        "id": "r1",
        "usuario_id": "u1",
        "qa_ref": "qa1",
        "nivel": 3,
        "creado_en": datetime(2026, 6, 7, 13, 0, 0),
    }
    qa = {"qa1": {"puesto": "backend", "area": "sistemas", "categoria": "concurrencia"}}

    fila = transform.fila_qa(revision, qa)

    assert fila["qa_id"] == "r1"
    assert fila["qa_ref"] == "qa1"
    assert fila["puesto"] == "backend"
    assert fila["area"] == "sistemas"
    assert fila["categoria"] == "concurrencia"
    assert fila["nivel"] == 3
    assert fila["fecha"] == datetime(2026, 6, 7, 13, 0, 0).date()


def test_fila_qa_sin_enriquecimiento():
    revision = {
        "id": "r2",
        "usuario_id": "u1",
        "qa_ref": "huerfana",
        "nivel": 1,
        "creado_en": datetime(2026, 6, 7, 13, 5, 0),
    }
    fila = transform.fila_qa(revision, {})

    assert fila["puesto"] == transform.DESCONOCIDO
    assert fila["area"] == transform.DESCONOCIDO
    assert fila["categoria"] == transform.DESCONOCIDO
    assert fila["nivel"] == 1
