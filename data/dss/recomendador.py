"""Recomendador de certificaciones por CV (DSS).

Lee un CV (texto, PDF o DOCX), detecta el perfil del usuario (habilidades, área y
nivel) y propone *caminos* de certificación. El emparejamiento combina embeddings
semánticos locales (ONNX vía ``fastembed``, sin servicios externos) con el solape
de habilidades del dataset curado ``certificaciones.json``.

Diseño (alineado con las reglas de la capa de datos):
- El modelo de embeddings se carga **perezosamente** (no al importar) y la lógica
  de ranking es **pura**: acepta una función ``embed_fn`` inyectable, de modo que
  las pruebas unitarias corren sin descargar el modelo.
- El CV se procesa **en memoria** y **no se persiste**; no sale de la máquina.
"""

from __future__ import annotations

import io
import json
import os
import re
import unicodedata
from collections.abc import Callable
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import numpy as np

DATASET = Path(__file__).resolve().parent / "certificaciones.json"
# Modelo multilingüe ligero (ONNX, ~120 MB). Configurable por entorno por si cambia
# el set soportado por fastembed.
MODELO_EMBED = os.getenv(
    "DSS_EMBED_MODEL", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
)

# Progresión de niveles para ordenar los pasos de un camino.
NIVEL_ORDEN = {"foundational": 0, "associate": 1, "professional": 2, "specialty": 2}

EmbedFn = Callable[[list[str]], np.ndarray]


@dataclass(frozen=True)
class Cert:
    """Certificación del dataset curado."""

    slug: str
    nombre: str
    proveedor: str
    area: str
    nivel: str
    descripcion: str
    skills: tuple[str, ...]
    roles: tuple[str, ...]
    slug_estudio: str | None

    @property
    def texto_embed(self) -> str:
        """Texto representativo de la cert para el embedding."""
        return (
            f"{self.nombre}. {self.descripcion} "
            f"Habilidades: {', '.join(self.skills)}. Roles: {', '.join(self.roles)}."
        )


@dataclass(frozen=True)
class Perfil:
    """Perfil detectado a partir del CV."""

    skills: tuple[str, ...]
    areas: tuple[str, ...]
    nivel: str
    resumen: str


@lru_cache(maxsize=1)
def cargar_certs() -> tuple[Cert, ...]:
    """Carga (una vez) el dataset de certificaciones."""
    data = json.loads(DATASET.read_text(encoding="utf-8"))
    return tuple(
        Cert(
            slug=c["slug"],
            nombre=c["nombre"],
            proveedor=c["proveedor"],
            area=c["area"],
            nivel=c["nivel"],
            descripcion=c["descripcion"],
            skills=tuple(c.get("skills", [])),
            roles=tuple(c.get("roles", [])),
            slug_estudio=c.get("slug_estudio"),
        )
        for c in data["certificaciones"]
    )


def _norm(s: str) -> str:
    """Minúsculas sin acentos (para comparar habilidades y texto)."""
    s = unicodedata.normalize("NFD", s.lower())
    return "".join(ch for ch in s if unicodedata.category(ch) != "Mn")


# --- extracción de texto del CV -----------------------------------------------
def extraer_texto(nombre: str, datos: bytes) -> str:
    """Extrae el texto de un CV en PDF, DOCX o texto plano.

    Parameters
    ----------
    nombre : nombre original del archivo (se usa la extensión).
    datos  : bytes del archivo.

    Returns
    -------
    str : texto plano extraído (puede venir con saltos de línea).
    """
    ext = Path(nombre or "").suffix.lower()
    if ext == ".pdf":
        from pypdf import PdfReader

        lector = PdfReader(io.BytesIO(datos))
        return "\n".join((p.extract_text() or "") for p in lector.pages)
    if ext == ".docx":
        import docx

        doc = docx.Document(io.BytesIO(datos))
        return "\n".join(p.text for p in doc.paragraphs)
    return datos.decode("utf-8", errors="ignore")


# --- perfil -------------------------------------------------------------------
@lru_cache(maxsize=1)
def _vocabulario() -> dict[str, str]:
    """Habilidad normalizada -> habilidad canónica (unión de skills del dataset)."""
    vocab: dict[str, str] = {}
    for c in cargar_certs():
        for s in c.skills:
            vocab[_norm(s)] = s
    return vocab


_SENIOR = ("senior", "lider", "arquitecto", "principal", "jefe", "gerente", "10 anos", "experto")
_JUNIOR = ("junior", "estudiante", "practicante", "becario", "trainee", "recien", "sin experiencia")


def perfil_desde_texto(texto: str) -> Perfil:
    """Detecta habilidades, áreas probables y nivel a partir del texto del CV."""
    t = _norm(texto)
    encontradas: list[str] = []
    for norm_s, canon in _vocabulario().items():
        if norm_s and re.search(rf"\b{re.escape(norm_s)}\b", t):
            encontradas.append(canon)
    encontradas = sorted(set(encontradas))

    areas = _areas_probables(encontradas)
    nivel = _nivel_estimado(t)
    resumen = _resumen(encontradas, areas, nivel)
    return Perfil(skills=tuple(encontradas), areas=tuple(areas), nivel=nivel, resumen=resumen)


def _areas_probables(skills: list[str]) -> list[str]:
    """Áreas más frecuentes entre las certs que comparten las skills detectadas."""
    if not skills:
        return []
    detectadas = {_norm(s) for s in skills}
    puntos: dict[str, int] = {}
    for c in cargar_certs():
        solape = sum(1 for s in c.skills if _norm(s) in detectadas)
        if solape:
            puntos[c.area] = puntos.get(c.area, 0) + solape
    return [a for a, _ in sorted(puntos.items(), key=lambda kv: -kv[1])[:2]]


def _nivel_estimado(t_norm: str) -> str:
    """Nivel aproximado por señales de seniority en el texto."""
    if any(p in t_norm for p in _SENIOR):
        return "professional"
    if any(p in t_norm for p in _JUNIOR):
        return "foundational"
    return "associate"


def _resumen(skills: list[str], areas: list[str], nivel: str) -> str:
    area_txt = " y ".join(areas) if areas else "tecnología"
    n = {"foundational": "inicial", "associate": "intermedio", "professional": "avanzado"}.get(
        nivel, "intermedio"
    )
    if skills:
        muestra = ", ".join(skills[:6])
        return f"Perfil orientado a {area_txt} (nivel {n}). Habilidades detectadas: {muestra}."
    return f"Perfil orientado a {area_txt} (nivel {n})."


# --- embeddings (perezoso) ----------------------------------------------------
@lru_cache(maxsize=1)
def _embedder():  # noqa: ANN202 (tipo de fastembed se resuelve en runtime)
    """Crea (una vez) el modelo de embeddings ONNX. Descarga el modelo la 1.ª vez."""
    from fastembed import TextEmbedding

    return TextEmbedding(model_name=MODELO_EMBED)


def _embed_real(textos: list[str]) -> np.ndarray:
    vecs = list(_embedder().embed(textos))
    return np.asarray(vecs, dtype=np.float32)


def calentar() -> None:
    """Fuerza la carga del modelo (para llamarlo al arrancar el servicio)."""
    _embed_real(["query: hola"])


def _unit(v: np.ndarray) -> np.ndarray:
    n = float(np.linalg.norm(v))
    return v / n if n else v


def _unit_rows(m: np.ndarray) -> np.ndarray:
    n = np.linalg.norm(m, axis=1, keepdims=True)
    n[n == 0] = 1.0
    return m / n


# --- ranking (puro) -----------------------------------------------------------
def _skill_score(cert: Cert, perfil_skills: set[str]) -> tuple[float, list[str]]:
    """Aporte por solape de habilidades y la lista de coincidencias (canónicas)."""
    coincide = [s for s in cert.skills if _norm(s) in perfil_skills]
    m = len(coincide)
    return (m / (m + 3.0), coincide)  # rendimiento decreciente, en [0,1)


def _puntuar(
    certs: tuple[Cert, ...], sem: np.ndarray, perfil: Perfil
) -> list[tuple[Cert, float, list[str]]]:
    """Combina similitud semántica + solape de skills + bonus de área."""
    pskills = {_norm(s) for s in perfil.skills}
    pareas = set(perfil.areas)
    out: list[tuple[Cert, float, list[str]]] = []
    for c, s in zip(certs, sem, strict=True):
        sem_pos = max(0.0, float(s))
        sk, coincide = _skill_score(c, pskills)
        area_bonus = 0.08 if c.area in pareas else 0.0
        score = min(1.0, 0.5 * sem_pos + 0.42 * sk + area_bonus)
        out.append((c, score, coincide))
    out.sort(key=lambda x: -x[1])
    return out


def _paso(cert: Cert, score: float, coincide: list[str]) -> dict:
    if coincide:
        por_que = "Coincide con tu perfil: " + ", ".join(coincide[:3])
    else:
        por_que = f"Refuerza tu camino en {cert.area}"
    return {
        "slug": cert.slug,
        "nombre": cert.nombre,
        "proveedor": cert.proveedor,
        "area": cert.area,
        "nivel": cert.nivel,
        "match_pct": round(100.0 * score),
        "por_que": por_que,
        "tiene_contenido": cert.slug_estudio is not None,
        "slug_estudio": cert.slug_estudio,
    }


def _construir_caminos(ranked: list[tuple[Cert, float, list[str]]], perfil: Perfil) -> list[dict]:
    """Agrupa las certs por área (priorizando el perfil) en 2-3 caminos ordenados."""
    orden_areas: list[str] = []
    for a in list(perfil.areas) + [c.area for c, _, _ in ranked]:
        if a not in orden_areas:
            orden_areas.append(a)

    caminos: list[dict] = []
    for area in orden_areas:
        en_area = [r for r in ranked if r[0].area == area]
        if not en_area or en_area[0][1] < 0.25:
            continue
        en_area.sort(key=lambda r: (NIVEL_ORDEN.get(r[0].nivel, 1), -r[1]))
        pasos = [_paso(c, s, m) for c, s, m in en_area[:4]]
        caminos.append(
            {
                "nombre": f"Camino: {area}",
                "motivo": f"Alineado con tu perfil de {area.lower()}.",
                "pasos": pasos,
            }
        )
        if len(caminos) == 3:
            break
    return caminos


def recomendar(texto: str, embed_fn: EmbedFn | None = None) -> dict:
    """Genera el perfil, los caminos y las recomendaciones a partir del texto del CV.

    Parameters
    ----------
    texto    : texto del CV ya extraído.
    embed_fn : función de embeddings inyectable (para pruebas sin el modelo real).

    Returns
    -------
    dict : ``{perfil, caminos, recomendaciones}`` (estructuras planas, listas para
    serializar). El texto del CV no se almacena.
    """
    certs = cargar_certs()
    perfil = perfil_desde_texto(texto)
    ef = embed_fn or _embed_real

    cv_vec = _unit(ef([texto])[0])
    cert_mat = _unit_rows(ef([c.texto_embed for c in certs]))
    sem = cert_mat @ cv_vec

    ranked = _puntuar(certs, sem, perfil)
    caminos = _construir_caminos(ranked, perfil)
    recomendaciones = [_paso(c, s, m) for c, s, m in ranked[:6]]

    return {
        "perfil": {
            "skills": list(perfil.skills),
            "areas": list(perfil.areas),
            "nivel": perfil.nivel,
            "resumen": perfil.resumen,
        },
        "caminos": caminos,
        "recomendaciones": recomendaciones,
    }
