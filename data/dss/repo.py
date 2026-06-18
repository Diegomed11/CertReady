"""Lectura del modelo dimensional (ClickHouse) para el DSS.

El DSS es el plano **analítico de negocio**: agrega los hechos (exámenes, código,
Q&A) por lotes para decisiones de plataforma. Las consultas son de solo lectura y
parametrizadas; la analítica por-usuario vive ahora en los servicios Go.
"""

from __future__ import annotations

from clickhouse_connect.driver.client import Client


class Repo:
    """Acceso de solo lectura a los hechos analíticos en ClickHouse.

    Cubre las tres señales de la plataforma: exámenes (``fact_intento``), código
    (``fact_ejecucion``) y preguntas de entrevista (``fact_qa``), agregadas a
    nivel de negocio (sin filtrar por usuario).
    """

    def __init__(self, client: Client, database: str = "analytics") -> None:
        self.client = client
        self.db = database

    # --- Overview de negocio --------------------------------------------------
    def usuarios_distinct(self) -> int:
        """Usuarios distintos en la unión de las tres tablas de hechos.

        Returns
        -------
        int : número de ``usuario_id`` únicos que aparecen en al menos una de
        ``fact_intento``, ``fact_ejecucion`` o ``fact_qa``.
        """
        res = self.client.query(
            f"select uniqExact(usuario_id) from ("  # noqa: S608 (db es interno)
            f"  select usuario_id from {self.db}.fact_intento "
            f"  union all select usuario_id from {self.db}.fact_ejecucion "
            f"  union all select usuario_id from {self.db}.fact_qa)"
        )
        rows = res.result_rows
        return int(rows[0][0]) if rows else 0

    def examenes_resumen(self) -> tuple[int, float]:
        """Total de intentos de examen y acierto medio global.

        Returns
        -------
        tuple : ``(intentos, acierto_pct)``; ``acierto_pct`` en [0,100].
        """
        res = self.client.query(
            f"select count(), avg(es_correcto) from {self.db}.fact_intento"  # noqa: S608
        )
        rows = res.result_rows
        if not rows or rows[0][0] is None:
            return 0, 0.0
        n = int(rows[0][0])
        p = float(rows[0][1]) if rows[0][1] is not None else 0.0
        return n, round(100.0 * p, 1)

    def codigo_resumen(self) -> tuple[int, float]:
        """Total de ejecuciones de código y aceptación media global.

        Returns
        -------
        tuple : ``(ejecuciones, aceptacion_pct)``; ``aceptacion_pct`` en [0,100].
        """
        res = self.client.query(
            f"select count(), avg(aceptado) from {self.db}.fact_ejecucion"  # noqa: S608
        )
        rows = res.result_rows
        if not rows or rows[0][0] is None:
            return 0, 0.0
        n = int(rows[0][0])
        p = float(rows[0][1]) if rows[0][1] is not None else 0.0
        return n, round(100.0 * p, 1)

    def qa_resumen(self) -> tuple[int, float]:
        """Total de autoevaluaciones de Q&A y nivel promedio en porcentaje.

        ``nivel_promedio_pct = avg((nivel-1)/2)*100`` (nivel en 1..3).

        Returns
        -------
        tuple : ``(autoevaluaciones, nivel_promedio_pct)`` en [0,100].
        """
        res = self.client.query(
            f"select count(), avg((nivel - 1) / 2) from {self.db}.fact_qa"  # noqa: S608
        )
        rows = res.result_rows
        if not rows or rows[0][0] is None:
            return 0, 0.0
        n = int(rows[0][0])
        p = float(rows[0][1]) if rows[0][1] is not None else 0.0
        return n, round(100.0 * p, 1)

    def actividad_mensual(self) -> list[tuple[str, int, int, int, int]]:
        """Actividad agregada por mes sobre las tres tablas.

        Returns
        -------
        list : ``(mes, intentos, ejecuciones, qa, usuarios)`` ordenado por mes
        ascendente; ``mes`` con formato ``YYYY-MM``. ``usuarios`` son los
        ``usuario_id`` distintos activos en cualquiera de las tres tablas ese mes.
        """
        res = self.client.query(
            f"select mes, "  # noqa: S608 (db es interno)
            f"  sum(es_intento), sum(es_ejecucion), sum(es_qa), uniqExact(usuario_id) "
            f"from ("
            f"  select usuario_id, formatDateTime(fecha, '%Y-%m') as mes, "
            f"    1 as es_intento, 0 as es_ejecucion, 0 as es_qa "
            f"  from {self.db}.fact_intento "
            f"  union all select usuario_id, formatDateTime(fecha, '%Y-%m'), 0, 1, 0 "
            f"  from {self.db}.fact_ejecucion "
            f"  union all select usuario_id, formatDateTime(fecha, '%Y-%m'), 0, 0, 1 "
            f"  from {self.db}.fact_qa) "
            f"group by mes order by mes"
        )
        return [(str(m), int(i), int(e), int(q), int(u)) for m, i, e, q, u in res.result_rows]

    # --- Áreas / temas --------------------------------------------------------
    def examenes_por_tema(self) -> list[tuple[str, str, float, int]]:
        """Acierto por (certificación, tema) sobre toda la plataforma.

        Returns
        -------
        list : ``(certificacion, tema, acierto_pct, intentos)``; ``acierto_pct``
        en [0,100]. Sin ordenar (la capa de API ordena por acierto asc).
        """
        res = self.client.query(
            f"select certificacion, tema, avg(es_correcto), count() "  # noqa: S608
            f"from {self.db}.fact_intento "
            f"group by certificacion, tema"
        )
        return [
            (str(c), str(t), round(100.0 * float(p), 1), int(n)) for c, t, p, n in res.result_rows
        ]

    def codigo_por_area(self) -> list[tuple[str, float, int]]:
        """Aceptación por área de código sobre toda la plataforma.

        Returns
        -------
        list : ``(area, aceptacion_pct, ejecuciones)``; ``aceptacion_pct`` en
        [0,100]. Ordenado por área.
        """
        res = self.client.query(
            f"select area, avg(aceptado), count() "  # noqa: S608 (db es interno)
            f"from {self.db}.fact_ejecucion "
            f"group by area order by area"
        )
        return [(str(a), round(100.0 * float(p), 1), int(n)) for a, p, n in res.result_rows]

    def qa_por_area(self) -> list[tuple[str, float, int]]:
        """Nivel promedio por área de Q&A sobre toda la plataforma.

        ``nivel_promedio_pct = avg((nivel-1)/2)*100`` (nivel en 1..3).

        Returns
        -------
        list : ``(area, nivel_promedio_pct, autoevaluaciones)`` en [0,100].
        Ordenado por área.
        """
        res = self.client.query(
            f"select area, avg((nivel - 1) / 2), count() "  # noqa: S608 (db es interno)
            f"from {self.db}.fact_qa "
            f"group by area order by area"
        )
        return [(str(a), round(100.0 * float(p), 1), int(n)) for a, p, n in res.result_rows]

    # --- Churn / retención ----------------------------------------------------
    def activos_por_mes(self) -> list[tuple[str, int]]:
        """Usuarios activos distintos por mes (unión de las tres tablas).

        Returns
        -------
        list : ``(mes, usuarios)`` ordenado por mes ascendente; ``mes`` con
        formato ``YYYY-MM``.
        """
        res = self.client.query(
            f"select formatDateTime(fecha, '%Y-%m') as mes, uniqExact(usuario_id) "  # noqa: S608
            f"from ("
            f"  select usuario_id, fecha from {self.db}.fact_intento "
            f"  union all select usuario_id, fecha from {self.db}.fact_ejecucion "
            f"  union all select usuario_id, fecha from {self.db}.fact_qa) "
            f"group by mes order by mes"
        )
        return [(str(m), int(u)) for m, u in res.result_rows]

    def vida_util_usuarios(self) -> list[tuple[int, int, int]]:
        """Vida útil y actividad por usuario sobre la unión de las tres tablas.

        Por usuario calcula: vida = ``max(fecha) - min(fecha)`` en días, número de
        días distintos con actividad y los días transcurridos desde su última
        actividad respecto de ``today()`` de ClickHouse.

        Returns
        -------
        list : ``(vida_dias, dias_activos, dias_desde_ultima)`` por usuario.
        """
        res = self.client.query(
            f"select "  # noqa: S608 (db es interno)
            f"  dateDiff('day', min(fecha), max(fecha)) as vida_dias, "
            f"  uniqExact(fecha) as dias_activos, "
            f"  dateDiff('day', max(fecha), today()) as dias_desde_ultima "
            f"from ("
            f"  select usuario_id, fecha from {self.db}.fact_intento "
            f"  union all select usuario_id, fecha from {self.db}.fact_ejecucion "
            f"  union all select usuario_id, fecha from {self.db}.fact_qa) "
            f"group by usuario_id"
        )
        return [(int(v), int(a), int(u)) for v, a, u in res.result_rows]
