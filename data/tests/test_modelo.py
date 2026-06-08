"""Pruebas unitarias del modelo IRT Rasch (puras, sin bases de datos)."""

from __future__ import annotations

from dss import modelo


def test_sigmoid_logit_roundtrip():
    for p in (0.1, 0.5, 0.9):
        assert abs(float(modelo.sigmoid(modelo.logit(p))) - p) < 1e-6


def test_dificultad_celda_monotonia():
    # Menor tasa de acierto poblacional => celda más difícil (b mayor).
    assert modelo.dificultad_celda(0.2) > modelo.dificultad_celda(0.8)


def test_estimar_theta_ordena_por_desempeno():
    fuerte = modelo.estimar_theta([1.0, 1.0, 2.0], [1, 1, 1])  # acierta lo difícil
    debil = modelo.estimar_theta([-1.0, -1.0, -2.0], [0, 0, 0])  # falla lo fácil
    medio = modelo.estimar_theta([0.0, 0.0, 0.0, 0.0], [1, 0, 1, 0])

    assert fuerte > 0 > debil
    assert debil < medio < fuerte
    assert modelo.estimar_theta([], []) == 0.0


def _celdas():
    return [
        modelo.Celda(tema="redes", dificultad="facil", b=-1.0, peso=2.0),
        modelo.Celda(tema="redes", dificultad="dificil", b=2.0, peso=1.0),
    ]


def test_readiness_monotona_en_theta():
    celdas = _celdas()
    assert modelo.readiness(2.0, celdas) > modelo.readiness(-2.0, celdas)
    r = modelo.readiness(0.0, celdas)
    assert 0.0 <= r <= 1.0


def test_prob_aprobar_rango_y_monotonia():
    celdas = _celdas()
    alta = modelo.prob_aprobar(3.0, celdas, umbral=0.7, n_items=20)
    baja = modelo.prob_aprobar(-3.0, celdas, umbral=0.7, n_items=20)
    assert 0.0 <= baja <= alta <= 1.0


def test_siguiente_accion_elige_celda_mas_debil():
    celdas = _celdas()
    accion = modelo.siguiente_accion(0.0, celdas)
    # Con theta=0, la celda de mayor dificultad (b=2) es la de menor dominio.
    assert accion is not None
    assert accion.dificultad == "dificil"
