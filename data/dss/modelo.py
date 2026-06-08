"""Modelo de readiness por IRT Rasch (1PL), en funciones puras (numpy).

Una "celda" es la combinación (certificación, tema, dificultad), el grano
disponible en ``fact_intento``. La dificultad de cada celda se calibra de la
población; la habilidad del estudiante (theta) se estima por MAP sobre sus
intentos. De ahí salen la readiness, la probabilidad de aprobar y la siguiente
mejor acción. Sin entrada/salida: todo es testeable sin bases de datos.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass

import numpy as np

_EPS = 1e-6
# Prior N(0, sigma^2) sobre theta: regulariza el arranque en frío y evita que
# theta diverja a ±infinito con un historial de todo correcto o todo incorrecto.
_THETA_PRIOR_VAR = 4.0


def sigmoid(x: float | np.ndarray) -> float | np.ndarray:
    """Función logística."""
    return 1.0 / (1.0 + np.exp(-x))


def logit(p: float | np.ndarray) -> float | np.ndarray:
    """Inversa de la logística, con recorte para evitar ±infinito."""
    p = np.clip(p, _EPS, 1.0 - _EPS)
    return np.log(p / (1.0 - p))


def dificultad_celda(p_global: float) -> float:
    """Dificultad Rasch de una celda: ``b = -logit(p)``.

    Una celda con baja tasa de acierto poblacional es más difícil (b alto).
    """
    return float(-logit(p_global))


@dataclass(frozen=True)
class Celda:
    """Celda de análisis con su dificultad calibrada y su peso."""

    tema: str
    dificultad: str
    b: float  # dificultad Rasch
    peso: float  # nº de ítems / frecuencia poblacional (peso en la readiness)


def estimar_theta(
    dificultades: Sequence[float], aciertos: Sequence[int], *, iters: int = 50
) -> float:
    """Estima la habilidad theta por MAP (Newton-Raphson 1D).

    Parameters
    ----------
    dificultades : dificultad ``b`` del ítem de cada intento.
    aciertos : 1 si el intento fue correcto, 0 si no.
    iters : máximo de iteraciones de Newton.

    Returns
    -------
    float : habilidad estimada (0 si no hay intentos).
    """
    b = np.asarray(dificultades, dtype=float)
    y = np.asarray(aciertos, dtype=float)
    if b.size == 0:
        return 0.0

    theta = 0.0
    for _ in range(iters):
        p = sigmoid(theta - b)
        grad = float(np.sum(y - p)) - theta / _THETA_PRIOR_VAR
        hess = -float(np.sum(p * (1.0 - p))) - 1.0 / _THETA_PRIOR_VAR
        paso = grad / hess
        theta -= paso
        if abs(paso) < 1e-7:
            break
    return float(theta)


def _pesos(celdas: Sequence[Celda]) -> np.ndarray:
    w = np.array([c.peso for c in celdas], dtype=float)
    total = w.sum()
    if total <= 0:
        return np.full(len(celdas), 1.0 / len(celdas))
    return w / total


def readiness(theta: float, celdas: Sequence[Celda]) -> float:
    """Readiness = P(acierto) esperada, ponderada por las celdas. En [0,1]."""
    if not celdas:
        return 0.0
    b = np.array([c.b for c in celdas])
    p = sigmoid(theta - b)
    return float(np.sum(_pesos(celdas) * p))


def prob_aprobar(
    theta: float, celdas: Sequence[Celda], *, umbral: float = 0.7, n_items: int = 20
) -> float:
    """Probabilidad de que el puntaje de un examen de ``n_items`` alcance el umbral.

    Aproximación normal del puntaje medio: media = readiness, varianza =
    ``mean(p(1-p))/n_items``. Returns un valor en [0,1].
    """
    if not celdas:
        return 0.0
    b = np.array([c.b for c in celdas])
    w = _pesos(celdas)
    p = sigmoid(theta - b)
    media = float(np.sum(w * p))
    var = float(np.sum(w * p * (1.0 - p))) / max(n_items, 1)
    if var <= 0.0:
        return 1.0 if media >= umbral else 0.0
    z = (media - umbral) / math.sqrt(var)
    return 0.5 * (1.0 + math.erf(z / math.sqrt(2.0)))


def siguiente_accion(theta: float, celdas: Sequence[Celda]) -> Celda | None:
    """Celda con menor dominio del estudiante: donde más conviene estudiar."""
    if not celdas:
        return None
    return min(celdas, key=lambda c: float(sigmoid(theta - c.b)))


def dominio(theta: float, b: float) -> float:
    """Dominio del estudiante en una celda: ``sigmoid(theta - b)`` en [0,1]."""
    return float(sigmoid(theta - b))
