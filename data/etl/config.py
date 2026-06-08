"""Configuración del ETL desde el entorno (12-factor).

No hay secretos en código: las conexiones se leen de variables de entorno, con
fallback a las genéricas que ya usan los servicios (``DATABASE_URL``,
``MONGO_URI``).
"""

from __future__ import annotations

import os
from dataclasses import dataclass


def _getenv(clave: str, *fallbacks: str, defecto: str | None = None) -> str | None:
    """Devuelve la primera variable de entorno no vacía, o ``defecto``.

    Parameters
    ----------
    clave : nombre preferente de la variable.
    fallbacks : nombres alternativos a probar en orden.
    defecto : valor si ninguna está definida.
    """
    for nombre in (clave, *fallbacks):
        valor = os.getenv(nombre)
        if valor:
            return valor
    return defecto


@dataclass(frozen=True)
class Config:
    """Configuración efectiva del ETL."""

    pg_dsn: str
    mongo_uri: str
    mongo_db: str
    ch_host: str
    ch_port: int
    ch_user: str
    ch_password: str
    ch_database: str

    @classmethod
    def load(cls) -> Config:
        """Construye la Config desde el entorno.

        Raises
        ------
        ValueError
            Si falta la conexión obligatoria a PostgreSQL o a MongoDB.
        """
        pg_dsn = _getenv("DATA_DATABASE_URL", "DATABASE_URL")
        if not pg_dsn:
            raise ValueError("falta DATA_DATABASE_URL o DATABASE_URL")
        mongo_uri = _getenv("DATA_MONGO_URI", "MONGO_URI")
        if not mongo_uri:
            raise ValueError("falta DATA_MONGO_URI o MONGO_URI")

        return cls(
            pg_dsn=pg_dsn,
            mongo_uri=mongo_uri,
            mongo_db=_getenv("DATA_MONGO_DB", "MONGO_DB", defecto="certready"),
            ch_host=_getenv("CLICKHOUSE_HOST", defecto="localhost"),
            ch_port=int(_getenv("CLICKHOUSE_PORT", defecto="8123")),
            ch_user=_getenv("CLICKHOUSE_USER", defecto="default"),
            ch_password=_getenv("CLICKHOUSE_PASSWORD", defecto=""),
            ch_database=_getenv("CLICKHOUSE_DB", defecto="analytics"),
        )
