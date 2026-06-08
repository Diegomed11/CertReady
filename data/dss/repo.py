"""Lectura del modelo dimensional (ClickHouse) para el DSS."""

from __future__ import annotations

from clickhouse_connect.driver.client import Client


class Repo:
    """Acceso de solo lectura a ``fact_intento`` en ClickHouse."""

    def __init__(self, client: Client, database: str = "analytics") -> None:
        self.client = client
        self.db = database

    def accuracy_celdas(self, certificacion: str) -> dict[tuple[str, str], tuple[float, int]]:
        """Tasa de acierto poblacional por celda de una certificación.

        Returns
        -------
        dict : ``(tema, dificultad) -> (p_global, n_intentos)`` sobre todos los
        usuarios; calibra la dificultad de cada celda.
        """
        res = self.client.query(
            f"select tema, dificultad, avg(es_correcto), count() "  # noqa: S608 (db es interno)
            f"from {self.db}.fact_intento where certificacion = {{c:String}} "
            f"group by tema, dificultad",
            parameters={"c": certificacion},
        )
        return {(t, d): (float(p), int(n)) for t, d, p, n in res.result_rows}

    def respuestas_usuario(self, usuario_id: str, certificacion: str) -> list[tuple[str, str, int]]:
        """Intentos del usuario en una certificación: ``(tema, dificultad, es_correcto)``."""
        res = self.client.query(
            f"select tema, dificultad, es_correcto "  # noqa: S608 (db es interno)
            f"from {self.db}.fact_intento "
            f"where certificacion = {{c:String}} and usuario_id = {{u:String}}",
            parameters={"c": certificacion, "u": usuario_id},
        )
        return [(t, d, int(e)) for t, d, e in res.result_rows]
