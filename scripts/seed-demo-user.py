"""Siembra datos de DEMO para un usuario, para probar la preparación por puesto.

Rellena, en PostgreSQL (`certready_dev`), actividad realista pero **aleatoria** de
un usuario en las tres señales del DSS:

- **Exámenes**: sesiones de simulacro + intentos (acierto ponderado por dificultad)
  sobre las preguntas reales de `aws-saa` (leídas de MongoDB).
- **Código**: corridas del juez sobre los problemas reales (`p_suma`, …), con
  veredicto mayormente `accepted`.
- **Q&A**: autoevaluaciones (nivel 1–3) de las preguntas de entrevista reales.

Luego basta correr el ETL (`python -m etl.run`) para que el DSS muestre números.

El `usuario_id` es el **`sub`** del JWT (lo que ve el DSS). Se busca en `idp_users`
por email; si no está, se deriva igual que el emisor (`tools/oidc-mock`): SHA-1 del
email en minúsculas, formateado como UUID. Es **idempotente**: borra primero la
actividad demo de ese usuario y vuelve a insertarla.

Uso (con el venv de data, que ya trae psycopg + pymongo):
    data\\.venv\\Scripts\\python.exe scripts\\seed-demo-user.py
    # o con otro correo:
    set SEED_USER_EMAIL=otro@correo.com & data\\.venv\\Scripts\\python.exe scripts\\seed-demo-user.py
"""

from __future__ import annotations

import hashlib
import os
import random
from datetime import UTC, datetime, timedelta

import psycopg
from psycopg.types.json import Json
from pymongo import MongoClient

# --- Config (12-factor; defaults solo de dev local) --------------------------
PG_DSN = os.getenv(
    "DATABASE_URL", "postgres://postgres@localhost:5432/certready_dev?sslmode=disable"
)
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB = os.getenv("MONGO_DB", "certready")
EMAIL = os.getenv("SEED_USER_EMAIL", "medinayc03@gmail.com")
CERT = os.getenv("SEED_CERT_SLUG", "aws-saa")

# Acierto ponderado por dificultad: un perfil sólido pero no perfecto.
P_ACIERTO = {"facil": 0.9, "media": 0.7, "dificil": 0.45}
# Reproducible entre corridas (combinado con el borrado previo, da un demo estable).
random.seed(7)


def sub_de_email(email: str) -> str:
    """Deriva el `sub` igual que el emisor OIDC mock (SHA-1 del email, formato UUID)."""
    h = hashlib.sha1(
        email.lower().strip().encode()
    ).hexdigest()  # noqa: S324 (no es seguridad)
    return f"{h[0:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:32]}"


def resolver_sub(conn: psycopg.Connection, email: str) -> str:
    """Devuelve el `sub` autoritativo de `idp_users`, o lo deriva si no existe."""
    try:
        row = conn.execute(
            "select sub, name from idp_users where lower(email) = lower(%s)", (email,)
        ).fetchone()
    except psycopg.Error:
        row = None
    if row:
        print(f"  usuario encontrado en idp_users: {email} (name={row[1]!r})")
        return row[0]
    derivado = sub_de_email(email)
    print(
        f"  [aviso] {email} no está en idp_users; uso el sub derivado {derivado}.\n"
        "          Si el login usa otro correo, regístralo o pasa SEED_USER_EMAIL."
    )
    return derivado


def _ts(dia: int, hora: int = 10, minuto: int = 0) -> datetime:
    """Timestamp UTC a `dia` días atrás (para repartir la actividad en el tiempo).

    `minuto` se suma con timedelta (no con replace), así que admite valores > 59:
    el desfase desborda a horas/días sin error cuando hay muchos ítems.
    """
    base = (datetime.now(UTC) - timedelta(days=dia)).replace(
        hour=hora, minute=0, second=0, microsecond=0
    )
    return base + timedelta(minutes=minuto)


def limpiar(conn: psycopg.Connection, sub: str) -> None:
    """Borra la actividad demo previa del usuario (idempotencia)."""
    conn.execute("delete from exams.intentos where usuario_id = %s", (sub,))
    conn.execute("delete from exams.sesiones where usuario_id = %s", (sub,))
    conn.execute("delete from judge.corridas where usuario_id = %s", (sub,))
    conn.execute("delete from progress.qa_revisiones where usuario_id = %s", (sub,))


def sembrar_examenes(conn: psycopg.Connection, sub: str, preguntas: list[dict]) -> int:
    """Crea 3 simulacros finalizados con intentos; acierto ponderado por dificultad."""
    if not preguntas:
        print("  [aviso] no hay preguntas de", CERT, "en Mongo; omito exámenes")
        return 0
    random.shuffle(preguntas)
    lotes = [preguntas[0:8], preguntas[8:16], preguntas[16:24]]
    total_intentos = 0
    for i, lote in enumerate(lotes):
        lote = [p for p in lote if p.get("_id")]
        if not lote:
            continue
        refs = [p["_id"] for p in lote]
        aciertos = 0
        intentos: list[tuple] = []
        for p in lote:
            dif = p.get("dificultad", "media")
            ok = random.random() < P_ACIERTO.get(dif, 0.7)
            aciertos += 1 if ok else 0
            intentos.append((p["_id"], ok))
        puntaje = round(100.0 * aciertos / len(lote), 1)
        inicio = _ts(10 - i * 3, hora=9)
        fin = inicio + timedelta(minutes=40)
        sesion_id = conn.execute(
            """insert into exams.sesiones
                   (usuario_id, certificacion, modo, estado, puntaje, preguntas,
                    iniciado_en, finalizado_en)
               values (%s, %s, 'simulacro', 'finalizada', %s, %s, %s, %s)
               returning id""",
            (sub, CERT, puntaje, Json(refs), inicio, fin),
        ).fetchone()[0]
        for j, (ref, ok) in enumerate(intentos):
            conn.execute(
                """insert into exams.intentos
                       (sesion_id, usuario_id, pregunta_ref, correcto, seleccion, creado_en)
                   values (%s, %s, %s, %s, %s, %s)""",
                (
                    sesion_id,
                    sub,
                    ref,
                    ok,
                    Json(["a"]),
                    inicio + timedelta(minutes=j + 1),
                ),
            )
            total_intentos += 1
    return total_intentos


def sembrar_codigo(conn: psycopg.Connection, sub: str, problemas: list[dict]) -> int:
    """Crea ~8 corridas del juez; sesga a `accepted` y garantiza problemas resueltos."""
    if not problemas:
        print("  [aviso] no hay problemas en Mongo; omito código")
        return 0
    veredictos_fallo = ["wrong_answer", "runtime_error", "time_limit_exceeded"]
    n = 0
    for ronda in range(3):
        for p in problemas:
            # Primera ronda: todos resueltos (asegura señal de código positiva).
            acepta = True if ronda == 0 else random.random() < 0.6
            total = random.randint(2, 3)
            if acepta:
                ver, pasados = "accepted", total
            else:
                ver = random.choice(veredictos_fallo)
                pasados = random.randint(0, total - 1)
            conn.execute(
                """insert into judge.corridas
                       (usuario_id, problema_ref, lenguaje, veredicto,
                        casos_pasados, casos_total, duracion_ms, creado_en)
                   values (%s, %s, 'python', %s, %s, %s, %s, %s)""",
                (
                    sub,
                    p["_id"],
                    ver,
                    pasados,
                    total,
                    random.randint(60, 600),
                    _ts(9 - ronda * 2, hora=12, minuto=ronda * 7),
                ),
            )
            n += 1
            if ronda > 0 and random.random() < 0.4:
                break  # variar el nº de corridas por ronda
    return n


def sembrar_qa(conn: psycopg.Connection, sub: str, qa: list[dict]) -> int:
    """Crea una autoevaluación (nivel 1–3, sesgado a 2–3) por pregunta de Q&A."""
    if not qa:
        print("  [aviso] no hay preguntas de Q&A en Mongo; omito Q&A")
        return 0
    for k, q in enumerate(qa):
        nivel = random.choices([1, 2, 3], weights=[1, 2, 3])[0]
        conn.execute(
            """insert into progress.qa_revisiones (usuario_id, qa_ref, nivel, creado_en)
               values (%s, %s, %s, %s)""",
            (sub, q["_id"], nivel, _ts(6, hora=18, minuto=k * 5)),
        )
    return len(qa)


def main() -> None:
    mongo = MongoClient(MONGO_URI)
    try:
        db = mongo[MONGO_DB]
        preguntas = list(
            db.preguntas.find({"certificacion": CERT}, {"_id": 1, "dificultad": 1})
        )
        problemas = list(db.problemas.find({}, {"_id": 1, "area": 1}))
        qa = list(db.qa.find({}, {"_id": 1, "area": 1}))
    finally:
        mongo.close()

    print(f"Sembrando demo para {EMAIL} en {PG_DSN}")
    with psycopg.connect(PG_DSN) as conn:
        sub = resolver_sub(conn, EMAIL)
        limpiar(conn, sub)
        n_int = sembrar_examenes(conn, sub, preguntas)
        n_cod = sembrar_codigo(conn, sub, problemas)
        n_qa = sembrar_qa(conn, sub, qa)
        conn.commit()

    print(
        f"Listo. usuario_id (sub) = {sub}\n"
        f"  exámenes: {n_int} intentos · código: {n_cod} corridas · Q&A: {n_qa} revisiones\n"
        "Ahora corre el ETL para volcarlo a ClickHouse:\n"
        "  cd data\n"
        "  $env:CLICKHOUSE_USER='certready'; $env:CLICKHOUSE_PASSWORD='certready'\n"
        "  $env:DATABASE_URL='" + PG_DSN + "'; $env:MONGO_URI='" + MONGO_URI + "'\n"
        "  .\\.venv\\Scripts\\python.exe -m etl.run"
    )


if __name__ == "__main__":
    main()
