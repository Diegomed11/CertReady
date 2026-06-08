"""Carga a ClickHouse: aplica el esquema, inserta hechos y mueve el watermark."""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import clickhouse_connect
from clickhouse_connect.driver.client import Client

from etl.config import Config

# Orden de columnas para el INSERT (debe coincidir con las filas de transform).
COLUMNAS_INTENTO = [
    "intento_id",
    "usuario_id",
    "certificacion",
    "tema",
    "dificultad",
    "tipo_pregunta",
    "modo",
    "fecha",
    "creado_en",
    "es_correcto",
    "intentos_n",
]

COLUMNAS_CORRIDA = [
    "corrida_id",
    "usuario_id",
    "problema_ref",
    "area",
    "dificultad",
    "lenguaje",
    "veredicto",
    "aceptado",
    "casos_pasados",
    "casos_total",
    "duracion_ms",
    "fecha",
    "creado_en",
]

_EPOCH = datetime(1970, 1, 1, tzinfo=UTC)


def leer_schema() -> str:
    """Lee el DDL embebido junto a este módulo."""
    return (Path(__file__).with_name("schema.sql")).read_text(encoding="utf-8")


def cliente(cfg: Config) -> Client:
    """Crea el cliente de ClickHouse a partir de la configuración."""
    return clickhouse_connect.get_client(
        host=cfg.ch_host,
        port=cfg.ch_port,
        username=cfg.ch_user,
        password=cfg.ch_password,
    )


class Cargador:
    """Encapsula la base de datos analítica y las operaciones de carga.

    La base se parametriza para que las pruebas usen una aislada (p. ej.
    ``analytics_test``) sin tocar la de desarrollo.
    """

    def __init__(self, client: Client, database: str = "analytics") -> None:
        self.client = client
        self.db = database

    def aplicar_schema(self, schema_sql: str) -> None:
        """Aplica el DDL (idempotente) sustituyendo el marcador de base."""
        sql = schema_sql.format(db=self.db)
        for sentencia in (s.strip() for s in sql.split(";")):
            if sentencia:
                self.client.command(sentencia)

    def insertar(self, tabla: str, columnas: list[str], filas: list[dict[str, Any]]) -> int:
        """Inserta filas (lista de dicts) en la tabla dada.

        Returns
        -------
        int : número de filas insertadas.
        """
        if not filas:
            return 0
        datos = [[fila[col] for col in columnas] for fila in filas]
        self.client.insert(f"{self.db}.{tabla}", datos, column_names=columnas)
        return len(filas)

    def watermark(self, fuente: str) -> datetime:
        """Último ``creado_en`` procesado para una fuente (epoch si no hay)."""
        res = self.client.query(
            f"select max(ultimo_ts) from {self.db}.etl_estado where fuente = {{f:String}}",
            parameters={"f": fuente},
        )
        valor = res.result_rows[0][0] if res.result_rows else None
        # max() sin filas devuelve 1970-01-01, a veces naive: normalizamos a UTC
        # consciente de zona para comparar y filtrar sin ambigüedad.
        if valor is None:
            return _EPOCH
        if valor.tzinfo is None:
            return valor.replace(tzinfo=UTC)
        return valor.astimezone(UTC)

    def set_watermark(self, fuente: str, ts: datetime) -> None:
        """Registra el watermark de una fuente (normalizado a UTC)."""
        ts_utc = ts.replace(tzinfo=UTC) if ts.tzinfo is None else ts.astimezone(UTC)
        self.client.insert(
            f"{self.db}.etl_estado",
            [[fuente, ts_utc]],
            column_names=["fuente", "ultimo_ts"],
        )
