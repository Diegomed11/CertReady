"""Regenera el dataset del recomendador (``data/dss/certificaciones.json``).

Compila la entrada **curada de ``aws-saa``** (se conserva tal cual del archivo
actual) más una entrada por cada manifiesto de ``scripts/catalog/<slug>.json``, con
``slug_estudio = slug`` para que **todas** enlacen a Estudiar. Así el recomendador y
el catálogo comparten exactamente los mismos slugs (sin desincronización).

Uso:
    data\\.venv\\Scripts\\python.exe scripts\\build-reco-dataset.py
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CATALOG_DIR = ROOT / "scripts" / "catalog"
DATASET = ROOT / "data" / "dss" / "certificaciones.json"


def entrada_aws_saa() -> dict:
    """Recupera la entrada curada de aws-saa del dataset actual (o un mínimo si falta)."""
    if DATASET.is_file():
        data = json.loads(DATASET.read_text(encoding="utf-8"))
        for c in data.get("certificaciones", []):
            if c.get("slug") == "aws-saa":
                c["slug_estudio"] = "aws-saa"
                return c
    return {
        "slug": "aws-saa",
        "nombre": "AWS Certified Solutions Architect – Associate",
        "proveedor": "AWS",
        "area": "Nube",
        "nivel": "associate",
        "descripcion": "Diseño de arquitecturas seguras, resilientes, de alto rendimiento y "
        "optimizadas en costo sobre AWS.",
        "skills": [
            "aws",
            "arquitectura",
            "ec2",
            "s3",
            "vpc",
            "alta disponibilidad",
            "costos",
        ],
        "roles": ["arquitecto de soluciones", "ingeniero de nube"],
        "slug_estudio": "aws-saa",
    }


def entrada_desde_manifiesto(c: dict) -> dict:
    return {
        "slug": c["slug"],
        "nombre": c["nombre"],
        "proveedor": c["proveedor"],
        "area": c.get("area", "Nube"),
        "nivel": c["nivel"],
        "descripcion": c.get("descripcion", ""),
        "skills": c.get("skills", []),
        "roles": c.get("roles", []),
        "slug_estudio": c["slug"],
    }


def main() -> None:
    certs = [entrada_aws_saa()]
    for ruta in sorted(CATALOG_DIR.glob("*.json")):
        if ruta.name == "_lista.json":
            continue
        c = json.loads(ruta.read_text(encoding="utf-8"))
        if c.get("slug") == "aws-saa":
            continue
        certs.append(entrada_desde_manifiesto(c))

    salida = {
        "_nota": "Dataset del recomendador. GENERADO por scripts/build-reco-dataset.py desde "
        "scripts/catalog/*.json (no editar a mano). aws-saa se conserva curado. "
        "Nombres nominativos, sin logos; 'slug_estudio' enlaza a la cert con contenido.",
        "certificaciones": certs,
    }
    DATASET.write_text(
        json.dumps(salida, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Escrito {DATASET.relative_to(ROOT)} con {len(certs)} certificaciones")


if __name__ == "__main__":
    main()
