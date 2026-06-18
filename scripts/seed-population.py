"""Siembra una POBLACIÓN sintética para que la analítica y el OLAP cobren sentido.

Crea N usuarios "fantasma" (solo datos, no existen en Cognito) con actividad variada
en **varias certificaciones, temas, dificultades y fechas**, y con **distintos niveles
de habilidad**. Esto:

- Llena los hechos del modelo dimensional (`fact_intento`, `fact_codigo`, `fact_qa`)
  con muchos usuarios → los dashboards y el "esquema estrella" se ven poblados.
- Da una **población real** para que el IRT calibre la dificultad por celda
  (`tema`, `dificultad`) y la *readiness* de tu usuario sea significativa.

NO toca a tu usuario real (usa `sub` sintéticos deterministas). Es **idempotente**:
borra la población anterior y la vuelve a generar igual (semilla fija).

Uso (en la EC2, con el venv de data):
    export DATABASE_URL='postgres://postgres@localhost:5432/certready_dev?sslmode=disable'
    export MONGO_URI='mongodb://localhost:27017'
    SEED_POP_N=40 data/.venv/bin/python scripts/seed-population.py
    # luego, para que el OLAP lo tome (resetear watermark + ETL):
    #   curl -s 'http://localhost:8123/?user=certready&password=certready' --data-binary 'TRUNCATE TABLE analytics.etl_estado'
    #   cd data && .venv/bin/python -m etl.run
"""

from __future__ import annotations

import os
import random
import uuid
from datetime import UTC, datetime, timedelta

import psycopg
from psycopg.types.json import Json
from pymongo import MongoClient

PG_DSN = os.getenv(
    "DATABASE_URL", "postgres://postgres@localhost:5432/certready_dev?sslmode=disable"
)
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB = os.getenv("MONGO_DB", "certready")
N = int(os.getenv("SEED_POP_N", "40"))  # cuántos usuarios sintéticos
CLEAN_MAX = 250  # limpia hasta este nº de usuarios sintéticos previos (evita huérfanos)

# Acierto base por dificultad, luego escalado por la habilidad del usuario.
MULT = {"facil": 1.15, "media": 0.95, "dificil": 0.65}
VEREDICTOS_FALLO = ["wrong_answer", "runtime_error", "time_limit_exceeded"]

random.seed(42)  # reproducible: combinado con el borrado previo, da una población estable


def pop_sub(i: int) -> str:
    """`sub` sintético determinista (mismo i → mismo UUID)."""
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, f"certready-pop-{i}"))


def _ts(dia: int, minuto: int = 0) -> datetime:
    base = (datetime.now(UTC) - timedelta(days=dia)).replace(
        hour=random.randint(8, 20), minute=0, second=0, microsecond=0
    )
    return base + timedelta(minutes=minuto)


def limpiar(conn: psycopg.Connection) -> None:
    """Borra la población sintética previa (idempotencia)."""
    subs = [pop_sub(i) for i in range(CLEAN_MAX)]
    conn.execute("delete from exams.intentos where usuario_id = any(%s)", (subs,))
    conn.execute("delete from exams.sesiones where usuario_id = any(%s)", (subs,))
    conn.execute("delete from judge.corridas where usuario_id = any(%s)", (subs,))
    conn.execute("delete from progress.qa_revisiones where usuario_id = any(%s)", (subs,))


def sembrar_usuario(
    conn: psycopg.Connection,
    sub: str,
    skill: float,
    pregs_por_cert: dict[str, list[dict]],
    problemas: list[dict],
    qa: list[dict],
) -> tuple[int, int, int]:
    n_int = n_cod = n_qa = 0

    # --- Exámenes: 1-3 certificaciones, 1-3 sesiones por cert -------------------
    certs = list(pregs_por_cert.keys())
    elegidas = random.sample(certs, k=min(len(certs), random.randint(1, 3)))
    for cert in elegidas:
        pool = pregs_por_cert[cert]
        for _ in range(random.randint(1, 3)):
            lote = random.sample(pool, k=min(8, len(pool)))
            aciertos = 0
            intentos: list[tuple] = []
            for p in lote:
                dif = p.get("dificultad", "media")
                pr = max(0.05, min(0.98, skill * MULT.get(dif, 0.95)))
                ok = random.random() < pr
                aciertos += 1 if ok else 0
                intentos.append((p["_id"], ok))
            puntaje = round(100.0 * aciertos / len(lote), 1)
            dia = random.randint(1, 35)
            inicio = _ts(dia)
            sesion_id = conn.execute(
                """insert into exams.sesiones
                       (usuario_id, certificacion, modo, estado, puntaje, preguntas,
                        iniciado_en, finalizado_en)
                   values (%s, %s, 'simulacro', 'finalizada', %s, %s, %s, %s)
                   returning id""",
                (sub, cert, puntaje, Json([r for r, _ in intentos]), inicio,
                 inicio + timedelta(minutes=40)),
            ).fetchone()[0]
            for j, (ref, ok) in enumerate(intentos):
                conn.execute(
                    """insert into exams.intentos
                           (sesion_id, usuario_id, pregunta_ref, correcto, seleccion, creado_en)
                       values (%s, %s, %s, %s, %s, %s)""",
                    (sesion_id, sub, ref, ok, Json(["a"]), inicio + timedelta(minutes=j + 1)),
                )
                n_int += 1

    # --- Código: subconjunto de problemas, aceptación según habilidad ----------
    for p in random.sample(problemas, k=min(len(problemas), random.randint(2, 6))):
        acepta = random.random() < skill
        total = random.randint(2, 3)
        if acepta:
            ver, pasados = "accepted", total
        else:
            ver, pasados = random.choice(VEREDICTOS_FALLO), random.randint(0, total - 1)
        conn.execute(
            """insert into judge.corridas
                   (usuario_id, problema_ref, lenguaje, veredicto,
                    casos_pasados, casos_total, duracion_ms, creado_en)
               values (%s, %s, 'python', %s, %s, %s, %s, %s)""",
            (sub, p["_id"], ver, pasados, total, random.randint(60, 600),
             _ts(random.randint(1, 35))),
        )
        n_cod += 1

    # --- Q&A: subconjunto, nivel sesgado por habilidad -------------------------
    for q in random.sample(qa, k=min(len(qa), random.randint(3, 10))):
        if skill > 0.75:
            nivel = random.choices([1, 2, 3], weights=[1, 2, 5])[0]
        elif skill > 0.55:
            nivel = random.choices([1, 2, 3], weights=[2, 4, 3])[0]
        else:
            nivel = random.choices([1, 2, 3], weights=[5, 3, 1])[0]
        conn.execute(
            """insert into progress.qa_revisiones (usuario_id, qa_ref, nivel, creado_en)
               values (%s, %s, %s, %s)""",
            (sub, q["_id"], nivel, _ts(random.randint(1, 35))),
        )
        n_qa += 1

    return n_int, n_cod, n_qa


def main() -> None:
    mongo = MongoClient(MONGO_URI)
    try:
        db = mongo[MONGO_DB]
        preguntas = list(db.preguntas.find({}, {"_id": 1, "certificacion": 1, "dificultad": 1}))
        problemas = list(db.problemas.find({}, {"_id": 1}))
        qa = list(db.qa.find({}, {"_id": 1}))
    finally:
        mongo.close()

    # Agrupar preguntas por certificación; solo certs con >= 6 preguntas (sesiones decentes).
    pregs_por_cert: dict[str, list[dict]] = {}
    for p in preguntas:
        pregs_por_cert.setdefault(p.get("certificacion", "desconocida"), []).append(p)
    pregs_por_cert = {c: ps for c, ps in pregs_por_cert.items() if len(ps) >= 6}

    if not pregs_por_cert or not problemas or not qa:
        print("[error] faltan datos en Mongo (preguntas/problemas/qa). Corre los seeders primero.")
        return

    print(f"Sembrando {N} usuarios sintéticos en {PG_DSN}")
    print(f"  certificaciones con preguntas: {len(pregs_por_cert)} · problemas: {len(problemas)} · qa: {len(qa)}")
    tot_int = tot_cod = tot_qa = 0
    with psycopg.connect(PG_DSN) as conn:
        limpiar(conn)
        for i in range(N):
            sub = pop_sub(i)
            skill = round(random.uniform(0.40, 0.92), 2)  # población con niveles variados
            a, b, c = sembrar_usuario(conn, sub, skill, pregs_por_cert, problemas, qa)
            tot_int += a
            tot_cod += b
            tot_qa += c
        conn.commit()

    print(
        f"Listo. {N} usuarios · {tot_int} intentos · {tot_cod} corridas · {tot_qa} Q&A.\n"
        "Ahora resetea el watermark y corre el ETL para volcarlo a ClickHouse:\n"
        "  curl -s 'http://localhost:8123/?user=certready&password=certready' "
        "--data-binary 'TRUNCATE TABLE analytics.etl_estado'\n"
        "  cd data && .venv/bin/python -m etl.run"
    )


if __name__ == "__main__":
    main()
