"""Lectura del modelo dimensional (ClickHouse) para el DSS."""

from __future__ import annotations

from collections.abc import Sequence

from clickhouse_connect.driver.client import Client


class Repo:
    """Acceso de solo lectura a los hechos analíticos en ClickHouse.

    Cubre las tres señales de preparación: exámenes (``fact_intento``), código
    (``fact_ejecucion``) y preguntas de entrevista (``fact_qa``).
    """

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

    def acierto_por_tema(self, usuario_id: str, certificacion: str) -> list[tuple[str, int, int]]:
        """Acierto del usuario por tema: ``(tema, aciertos, total)`` (para dashboards)."""
        res = self.client.query(
            f"select tema, sum(es_correcto), count() "  # noqa: S608 (db es interno)
            f"from {self.db}.fact_intento "
            f"where certificacion = {{c:String}} and usuario_id = {{u:String}} "
            f"group by tema order by tema",
            parameters={"c": certificacion, "u": usuario_id},
        )
        return [(t, int(a), int(n)) for t, a, n in res.result_rows]

    def serie_por_fecha(self, usuario_id: str, certificacion: str) -> list[tuple[str, int, int]]:
        """Tendencia diaria del usuario: ``(fecha, aciertos, total)`` ordenada por fecha."""
        res = self.client.query(
            f"select toString(fecha), sum(es_correcto), count() "  # noqa: S608 (db es interno)
            f"from {self.db}.fact_intento "
            f"where certificacion = {{c:String}} and usuario_id = {{u:String}} "
            f"group by fecha order by fecha",
            parameters={"c": certificacion, "u": usuario_id},
        )
        return [(f, int(a), int(n)) for f, a, n in res.result_rows]

    def codigo_por_area(
        self, usuario_id: str, areas: Sequence[str]
    ) -> list[tuple[str, str, int, int]]:
        """Desempeño del usuario en código por problema, en las áreas dadas.

        Agrupa por problema y se queda con el **mejor** veredicto (``max(aceptado)``):
        haber resuelto el problema alguna vez cuenta como dominado, sin penalizar
        los intentos previos fallidos.

        Returns
        -------
        list : ``(problema_ref, area, mejor_aceptado, intentos)`` por problema
        distinto; lista vacía si no hay áreas o ejecuciones.
        """
        if not areas:
            return []
        res = self.client.query(
            f"select problema_ref, any(area), max(aceptado), count() "  # noqa: S608 (db es interno)
            f"from {self.db}.fact_ejecucion "
            f"where usuario_id = {{u:String}} and area in {{a:Array(String)}} "
            f"group by problema_ref",
            parameters={"u": usuario_id, "a": list(areas)},
        )
        return [(p, a, int(m), int(n)) for p, a, m, n in res.result_rows]

    def qa_por_area(
        self, usuario_id: str, areas: Sequence[str]
    ) -> list[tuple[str, str, str, int, int]]:
        """Autoevaluación del usuario en Q&A por pregunta, en las áreas dadas.

        Agrupa por pregunta y toma el **mejor** nivel declarado (``max(nivel)``):
        refleja el estado más reciente de dominio percibido.

        Returns
        -------
        list : ``(qa_ref, area, categoria, mejor_nivel, revisiones)`` por pregunta
        distinta; lista vacía si no hay áreas o revisiones.
        """
        if not areas:
            return []
        res = self.client.query(
            f"select qa_ref, any(area), any(categoria), max(nivel), count() "  # noqa: S608 (db es interno)
            f"from {self.db}.fact_qa "
            f"where usuario_id = {{u:String}} and area in {{a:Array(String)}} "
            f"group by qa_ref",
            parameters={"u": usuario_id, "a": list(areas)},
        )
        return [(q, a, c, int(m), int(n)) for q, a, c, m, n in res.result_rows]
