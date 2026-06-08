"""Transformación pura de filas operativas a filas de hecho dimensionales.

Sin entrada/salida: son funciones puras (fila + enriquecimiento -> fila de hecho),
por lo que se prueban sin bases de datos.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

DESCONOCIDO = "desconocido"


def _utc(dt: datetime) -> datetime:
    """Normaliza un datetime a UTC consciente de zona.

    Un datetime naive se asume en UTC; uno con zona se convierte. Así el instante
    es inequívoco al guardarlo en ClickHouse (columnas ``DateTime('UTC')``) y al
    comparar watermarks, evitando corrimientos por la zona local del proceso.
    """
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def fila_intento(intento: dict[str, Any], preguntas: dict[str, dict[str, Any]]) -> dict[str, Any]:
    """Construye una fila de ``fact_intento`` a partir de un intento de examen.

    Parameters
    ----------
    intento : fila de ``exams.intentos`` unida a su sesión (id, usuario_id,
        pregunta_ref, correcto, creado_en, certificacion, modo).
    preguntas : mapa ``pregunta_ref -> {tema, dificultad, tipo}`` desde MongoDB.

    Returns
    -------
    dict : fila lista para insertar en ``analytics.fact_intento``.
    """
    meta = preguntas.get(intento["pregunta_ref"], {})
    creado = _utc(intento["creado_en"])
    return {
        "intento_id": intento["id"],
        "usuario_id": intento["usuario_id"],
        "certificacion": intento.get("certificacion") or DESCONOCIDO,
        "tema": meta.get("tema") or DESCONOCIDO,
        "dificultad": meta.get("dificultad") or DESCONOCIDO,
        "tipo_pregunta": meta.get("tipo") or DESCONOCIDO,
        "modo": intento.get("modo") or DESCONOCIDO,
        "fecha": creado.date(),
        "creado_en": creado,
        "es_correcto": 1 if intento["correcto"] else 0,
        "intentos_n": 1,
    }


def fila_corrida(corrida: dict[str, Any], problemas: dict[str, dict[str, Any]]) -> dict[str, Any]:
    """Construye una fila de ``fact_corrida`` a partir de una corrida del juez.

    Parameters
    ----------
    corrida : fila de ``judge.corridas`` (id, usuario_id, problema_ref, lenguaje,
        veredicto, casos_pasados, casos_total, duracion_ms, creado_en).
    problemas : mapa ``problema_ref -> {area, dificultad}`` desde MongoDB.

    Returns
    -------
    dict : fila lista para insertar en ``analytics.fact_corrida``.
    """
    meta = problemas.get(corrida["problema_ref"], {})
    creado = _utc(corrida["creado_en"])
    return {
        "corrida_id": corrida["id"],
        "usuario_id": corrida["usuario_id"],
        "problema_ref": corrida["problema_ref"],
        "area": meta.get("area") or DESCONOCIDO,
        "dificultad": meta.get("dificultad") or DESCONOCIDO,
        "lenguaje": corrida.get("lenguaje") or DESCONOCIDO,
        "veredicto": corrida["veredicto"],
        "aceptado": 1 if corrida["veredicto"] == "accepted" else 0,
        "casos_pasados": corrida["casos_pasados"],
        "casos_total": corrida["casos_total"],
        "duracion_ms": corrida["duracion_ms"],
        "fecha": creado.date(),
        "creado_en": creado,
    }
