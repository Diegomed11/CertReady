"""DSS (sistema de soporte a decisiones) de CertReady.

Estima la preparación (readiness) de un estudiante para una certificación a partir
de su historial de intentos (modelo dimensional en ClickHouse), con un modelo IRT
Rasch (1PL) calibrado por población. Se expone como servicio FastAPI.
"""
