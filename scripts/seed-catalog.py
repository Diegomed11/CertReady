"""Siembra el catálogo extendido de CertReady desde los manifiestos por cert.

Lee ``scripts/catalog/<slug>.json`` (todas las certificaciones menos ``aws-saa``,
que tiene su propio pipeline profundo) y, de forma **idempotente**:

- **PostgreSQL** (``catalog``): upsert de ``certificaciones`` y ``temas``, con
  limpieza de temas huérfanos por cert.
- **MongoDB**: upsert de ``materiales`` (``_id = m_<cert>_<tema>``) y ``preguntas``
  (``_id = q_<cert>_<tema>_<n>``). El prefijo por cert evita colisiones de ``_id``
  entre certificaciones (los ``_id`` de ``aws-saa`` van sin prefijo, no colisionan).

Las claves de contenido son el **slug** legible (``certificacion`` + ``tema``),
igual que en el resto del proyecto. Contenido **original** (regla de marcas).

Uso (con el venv de data):
    data\\.venv\\Scripts\\python.exe scripts\\seed-catalog.py
"""

from __future__ import annotations

import json
import os
from datetime import UTC, datetime
from pathlib import Path

import psycopg
from pymongo import MongoClient

CATALOG_DIR = Path(__file__).resolve().parent / "catalog"
PG_DSN = os.getenv("DATA_DATABASE_URL") or os.getenv(
    "DATABASE_URL", "postgresql://postgres@localhost:5432/certready_dev"
)
MONGO_URI = os.getenv("SEED_MONGO_URI") or os.getenv(
    "MONGO_URI", "mongodb://localhost:27017"
)
MONGO_DB = os.getenv("SEED_MONGO_DB") or os.getenv("MONGO_DB", "certready")
AHORA = datetime(2026, 6, 10, tzinfo=UTC)
LETRAS = ["a", "b", "c", "d", "e", "f", "g", "h"]


def cargar_manifiestos() -> list[dict]:
    """Carga y ordena los manifiestos de cert (omite el índice ``_lista.json``)."""
    certs = []
    for ruta in sorted(CATALOG_DIR.glob("*.json")):
        if ruta.name == "_lista.json":
            continue
        certs.append(json.loads(ruta.read_text(encoding="utf-8")))
    return certs


def _pregunta_doc(cert: str, tema: str, n: int, q: dict) -> dict | None:
    """Convierte una pregunta del manifiesto al documento de Mongo (o None si inválida)."""
    tipo = q.get("tipo")
    if tipo not in ("opcion_multiple", "respuesta_multiple"):
        return None
    opts = q.get("opciones") or []
    correctos = q.get("correctas") or []
    if not 1 <= len(opts) <= len(LETRAS) or not correctos:
        return None
    if any(not isinstance(i, int) or i < 0 or i >= len(opts) for i in correctos):
        return None
    ct = cert.replace("-", "_")
    tt = tema.replace("-", "_")
    return {
        "_id": f"q_{ct}_{tt}_{n}",
        "certificacion": cert,
        "tema": tema,
        "dificultad": q.get("dificultad", "media"),
        "tipo": tipo,
        "enunciado": (q.get("enunciado") or "").strip(),
        "opciones": [{"id": LETRAS[i], "texto": t} for i, t in enumerate(opts)],
        "respuesta_correcta": [LETRAS[i] for i in correctos],
        "explicacion": (q.get("explicacion") or "").strip(),
        "tags": [tema],
    }


def sembrar_postgres(certs: list[dict]) -> None:
    """Upsert de certificaciones + temas en Postgres (con limpieza por cert)."""
    with psycopg.connect(PG_DSN, autocommit=True) as conn, conn.cursor() as cur:
        for c in certs:
            cur.execute(
                """
                insert into catalog.certificaciones (slug, nombre, proveedor, nivel, descripcion)
                values (%s, %s, %s, %s, %s)
                on conflict (slug) do update set
                  nombre = excluded.nombre, proveedor = excluded.proveedor,
                  nivel = excluded.nivel, descripcion = excluded.descripcion,
                  actualizado_en = now()
                returning id
                """,
                (
                    c["slug"],
                    c["nombre"],
                    c["proveedor"],
                    c["nivel"],
                    c.get("descripcion"),
                ),
            )
            cert_id = cur.fetchone()[0]
            temas = c.get("temas") or []
            for t in temas:
                cur.execute(
                    """
                    insert into catalog.temas (certificacion_id, slug, nombre, dominio, orden)
                    values (%s, %s, %s, %s, %s)
                    on conflict (certificacion_id, slug) do update set
                      nombre = excluded.nombre, dominio = excluded.dominio,
                      orden = excluded.orden, actualizado_en = now()
                    """,
                    (
                        cert_id,
                        t["slug"],
                        t["nombre"],
                        t.get("dominio"),
                        t.get("orden", 0),
                    ),
                )
            slugs = [t["slug"] for t in temas]
            cur.execute(
                "delete from catalog.temas where certificacion_id = %s and not (slug = any(%s))",
                (cert_id, slugs),
            )
    print(f"  postgres: {len(certs)} certificaciones + sus temas")


def sembrar_mongo(certs: list[dict]) -> None:
    """Upsert de materiales + preguntas en Mongo (con limpieza por cert)."""
    db = MongoClient(MONGO_URI)[MONGO_DB]
    n_mat = n_q = 0
    for c in certs:
        cert = c["slug"]
        materiales, preguntas = [], []
        for t in c.get("temas") or []:
            tema = t["slug"]
            ct = cert.replace("-", "_")
            tt = tema.replace("-", "_")
            hoja = t.get("hoja") or {}
            if hoja.get("titulo") and hoja.get("markdown"):
                materiales.append(
                    {
                        "_id": f"m_{ct}_{tt}",
                        "certificacion": cert,
                        "tema": tema,
                        "titulo": hoja["titulo"].strip(),
                        "formato": "markdown",
                        "contenido": hoja["markdown"].strip(),
                        "recursos": [],
                        "creado_en": AHORA,
                    }
                )
            for i, q in enumerate(t.get("preguntas") or []):
                doc = _pregunta_doc(cert, tema, i + 1, q)
                if doc:
                    preguntas.append(doc)
        for d in materiales:
            db["materiales"].replace_one({"_id": d["_id"]}, d, upsert=True)
        for d in preguntas:
            db["preguntas"].replace_one({"_id": d["_id"]}, d, upsert=True)
        # Limpieza de huérfanos de ESTA cert (temas retirados).
        slugs = [t["slug"] for t in c.get("temas") or []]
        db["materiales"].delete_many({"certificacion": cert, "tema": {"$nin": slugs}})
        db["preguntas"].delete_many({"certificacion": cert, "tema": {"$nin": slugs}})
        n_mat += len(materiales)
        n_q += len(preguntas)
    print(f"  mongo: {n_mat} materiales + {n_q} preguntas")


def main() -> None:
    certs = cargar_manifiestos()
    print(f"Sembrando catálogo extendido: {len(certs)} certificaciones")
    sembrar_postgres(certs)
    sembrar_mongo(certs)
    print("Listo.")


if __name__ == "__main__":
    main()
