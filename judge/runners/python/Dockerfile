# Imagen del runner de Python para el juez de código.
#
# Construir desde la raíz del repo o desde esta carpeta:
#   docker build -t certready/judge-python:latest judge/runners/python
#
# La imagen es deliberadamente mínima: NO trae el código del usuario (se monta de
# solo lectura en /sandbox en tiempo de ejecución) y NO necesita red. Todo el
# endurecimiento (sin red, FS de solo lectura, límites de CPU/memoria/PIDs, sin
# privilegios) se aplica en `docker run` desde judge/internal/runner/docker.go.
#
# Usa `timeout` (coreutils, presente en Debian slim) para el corte fino de tiempo.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOME=/tmp

# El usuario sin privilegios 65534:65534 (nobody) ya existe en la imagen base; el
# contenedor se ejecuta como ese usuario vía `docker run --user`.
WORKDIR /sandbox
