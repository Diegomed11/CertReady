"""Pruebas del recomendador de certificaciones (sin descargar el modelo).

Se inyecta un ``embed_fn`` falso (bolsa de palabras sobre el vocabulario de
habilidades) para probar el ranking de forma determinista y sin red.
"""

from __future__ import annotations

import re

import numpy as np

from dss import recomendador as R


def _fake_embed():
    """Embedder falso: vector de presencia de habilidades del dataset por texto."""
    vocab = sorted(R._vocabulario().keys())
    idx = {v: i for i, v in enumerate(vocab)}

    def embed(textos: list[str]) -> np.ndarray:
        out = np.zeros((len(textos), len(vocab)), dtype=np.float32)
        for fila, t in enumerate(textos):
            tn = R._norm(t)
            for v, i in idx.items():
                if re.search(rf"\b{re.escape(v)}\b", tn):
                    out[fila, i] = 1.0
        return out

    return embed


CV_NUBE = (
    "Ingeniero de software con experiencia en AWS: EC2, S3, VPC, RDS y Lambda. "
    "He diseñado arquitecturas de alta disponibilidad y trabajado con IAM y costos."
)
CV_REDES = (
    "Técnico de redes con conocimientos de routing, switching, TCP/IP, subnetting, "
    "VLAN y OSPF. Manejo equipos Cisco y diagnóstico de redes."
)


def test_extraer_texto_plano():
    assert R.extraer_texto("cv.txt", b"hola mundo") == "hola mundo"


def test_perfil_detecta_skills_y_area():
    perfil = R.perfil_desde_texto(CV_NUBE)
    assert "aws" in perfil.skills
    assert "ec2" in perfil.skills
    assert "Nube" in perfil.areas
    assert perfil.resumen


def test_recomienda_nube_para_perfil_aws():
    res = R.recomendar(CV_NUBE, embed_fn=_fake_embed())
    slugs = [r["slug"] for r in res["recomendaciones"]]
    assert "aws-saa" in slugs[:3]
    # la cert con contenido propio debe marcarse como tal
    aws = next(r for r in res["recomendaciones"] if r["slug"] == "aws-saa")
    assert aws["tiene_contenido"] is True
    assert aws["slug_estudio"] == "aws-saa"
    assert aws["match_pct"] > 0


def test_recomienda_redes_para_perfil_cisco():
    res = R.recomendar(CV_REDES, embed_fn=_fake_embed())
    top_areas = [r["area"] for r in res["recomendaciones"][:3]]
    assert "Redes" in top_areas


def test_caminos_no_vacios_y_estructura():
    res = R.recomendar(CV_NUBE, embed_fn=_fake_embed())
    assert res["caminos"], "debe proponer al menos un camino"
    cam = res["caminos"][0]
    assert cam["pasos"]
    paso = cam["pasos"][0]
    for k in ("slug", "nombre", "proveedor", "nivel", "match_pct", "por_que", "tiene_contenido"):
        assert k in paso
