"""Configuración del DSS desde el entorno (12-factor)."""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Config:
    """Configuración efectiva del DSS."""

    ch_host: str
    ch_port: int
    ch_user: str
    ch_password: str
    ch_database: str
    umbral: float  # nota mínima para aprobar (proporción [0,1]).
    n_items: int  # nº de ítems de un examen, para la probabilidad de aprobar.

    @classmethod
    def load(cls) -> Config:
        """Construye la Config desde el entorno (todas con default seguro)."""
        return cls(
            ch_host=os.getenv("CLICKHOUSE_HOST", "localhost"),
            ch_port=int(os.getenv("CLICKHOUSE_PORT", "8123")),
            ch_user=os.getenv("CLICKHOUSE_USER", "default"),
            ch_password=os.getenv("CLICKHOUSE_PASSWORD", ""),
            ch_database=os.getenv("CLICKHOUSE_DB", "analytics"),
            umbral=float(os.getenv("DSS_UMBRAL_APROBACION", "0.7")),
            n_items=int(os.getenv("DSS_ITEMS_EXAMEN", "20")),
        )
