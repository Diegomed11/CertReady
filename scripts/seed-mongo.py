"""Siembra datos de ejemplo en MongoDB para el desarrollo local de CertReady.

Inserta material de estudio, preguntas de examen, problemas de código y preguntas
de Q&A en la base ``certready`` de MongoDB. Es idempotente: reejecutar no duplica
(usa ``replace_one`` con ``upsert`` por ``_id``).

Las preguntas y el material se asocian a la certificación de ejemplo ``aws-saa``
leyendo su id real desde PostgreSQL (catalog), porque el front filtra por ese id
(el mismo ``objetivo_id`` con el que el usuario se inscribe).

Uso (con el venv de data, que ya trae pymongo y psycopg):
    data\\.venv\\Scripts\\python.exe scripts\\seed-mongo.py
"""

from __future__ import annotations

import os
import sys
from datetime import UTC, datetime

import psycopg
from pymongo import MongoClient

PG_DSN = os.getenv("SEED_PG_DSN", "postgres://postgres@localhost:5432/certready_dev?sslmode=disable")
MONGO_URI = os.getenv("SEED_MONGO_URI", "mongodb://localhost:27017")
MONGO_DB = os.getenv("SEED_MONGO_DB", "certready")
CERT_SLUG = os.getenv("SEED_CERT_SLUG", "aws-saa")

AHORA = datetime(2026, 6, 8, tzinfo=UTC)


def cert_id() -> str:
    """Devuelve el id de la certificación de ejemplo desde catalog (o aborta)."""
    with psycopg.connect(PG_DSN) as conn, conn.cursor() as cur:
        cur.execute("select id from catalog.certificaciones where slug = %s", (CERT_SLUG,))
        fila = cur.fetchone()
    if not fila:
        print(
            f"No encontré la certificación '{CERT_SLUG}' en catalog. "
            "Corre primero scripts/dev-up.ps1 (siembra la cert).",
            file=sys.stderr,
        )
        sys.exit(1)
    return str(fila[0])


def opcion(id_: str, texto: str) -> dict:
    return {"id": id_, "texto": texto}


def pregunta(
    _id: str, cert: str, tema: str, dif: str, enunciado: str, ops: list[dict], correcta: list[str], expl: str
) -> dict:
    return {
        "_id": _id,
        "certificacion": cert,
        "tema": tema,
        "dificultad": dif,
        "tipo": "opcion_multiple",
        "enunciado": enunciado,
        "opciones": ops,
        "respuesta_correcta": correcta,
        "explicacion": expl,
        "tags": [tema.lower()],
    }


def material(_id: str, cert: str, tema: str, titulo: str, contenido: str) -> dict:
    return {
        "_id": _id,
        "certificacion": cert,
        "tema": tema,
        "titulo": titulo,
        "formato": "markdown",
        "contenido": contenido,
        "recursos": ["https://docs.aws.amazon.com/"],
        "creado_en": AHORA,
    }


PLANTILLA_PY = (
    "import sys\n\n\n"
    "def main():\n"
    "    datos = sys.stdin.read().split()\n"
    "    # Escribe tu solución usando 'datos' e imprime el resultado.\n\n\n"
    "main()\n"
)


def problema(
    _id: str, titulo: str, enunciado: str, dif: str, area: str, casos: list[dict], etiquetas: list[str]
) -> dict:
    return {
        "_id": _id,
        "titulo": titulo,
        "enunciado": enunciado,
        "dificultad": dif,
        "area": area,
        "etiquetas": etiquetas,
        "lenguajes_permitidos": ["python"],
        "plantillas": {"python": PLANTILLA_PY},
        "limite_tiempo_ms": 2000,
        "limite_memoria_mb": 128,
        "casos": casos,
        "creado_en": AHORA,
    }


def caso(entrada: str, salida: str, oculto: bool = False) -> dict:
    return {"entrada": entrada, "salida_esperada": salida, "oculto": oculto, "peso": 1}


def qa(
    _id: str, puesto: str, area: str, categoria: str, enunciado: str, respuesta: str, claves: list[str]
) -> dict:
    return {
        "_id": _id,
        "puesto": puesto,
        "area": area,
        "categoria": categoria,
        "enunciado": enunciado,
        "tipo": "conceptual",
        "respuesta_modelo": respuesta,
        "puntos_clave": claves,
        "etiquetas": [area.lower()],
        "creado_en": AHORA,
    }


def main() -> None:
    cert = cert_id()
    db = MongoClient(MONGO_URI)[MONGO_DB]

    materiales = [
        material(
            "m_iam",
            cert,
            "IAM",
            "Fundamentos de IAM",
            "# IAM\n\n**IAM** gestiona identidades y permisos en AWS.\n\n"
            "- *Usuarios*, *grupos* y *roles*.\n"
            "- Políticas en JSON con `Effect`, `Action`, `Resource`.\n"
            "- Principio de **mínimo privilegio**.\n\n"
            "> Prefiere **roles** sobre claves de acceso de larga duración.",
        ),
        material(
            "m_s3",
            cert,
            "S3",
            "Almacenamiento en S3",
            "# Amazon S3\n\nObjetos en *buckets*. Clases de almacenamiento:\n\n"
            "| Clase | Uso |\n|---|---|\n| Standard | Acceso frecuente |\n"
            "| IA | Acceso poco frecuente |\n| Glacier | Archivado |\n\n"
            "Durabilidad de **11 nueves**.",
        ),
        material(
            "m_vpc",
            cert,
            "VPC",
            "Redes con VPC",
            "# VPC\n\nRed virtual aislada. Componentes:\n\n"
            "- Subredes públicas y privadas.\n- *Route tables*, *IGW*, *NAT*.\n"
            "- *Security groups* (stateful) vs *NACL* (stateless).",
        ),
    ]

    preguntas = [
        pregunta(
            "q_iam_1", cert, "IAM", "facil",
            "¿Qué recurso de IAM se recomienda para dar permisos temporales a una instancia EC2?",
            [opcion("a", "Un usuario IAM con clave de acceso"),
             opcion("b", "Un rol IAM"),
             opcion("c", "La cuenta raíz"),
             opcion("d", "Una contraseña compartida")],
            ["b"],
            "Los **roles** otorgan credenciales temporales sin claves de larga duración.",
        ),
        pregunta(
            "q_s3_1", cert, "S3", "facil",
            "¿Qué clase de S3 conviene para datos de archivado con acceso muy infrecuente?",
            [opcion("a", "S3 Standard"), opcion("b", "S3 Intelligent-Tiering"),
             opcion("c", "S3 Glacier"), opcion("d", "S3 Express One Zone")],
            ["c"],
            "**Glacier** es la opción de menor costo para archivado.",
        ),
        pregunta(
            "q_ec2_1", cert, "EC2", "media",
            "¿Qué tipo de compra de EC2 ofrece el mayor descuento a cambio de un compromiso de 1-3 años?",
            [opcion("a", "On-Demand"), opcion("b", "Spot"),
             opcion("c", "Savings Plans / Reserved"), opcion("d", "Dedicated Host")],
            ["c"],
            "Los **Savings Plans / Reserved Instances** dan el mayor descuento por compromiso.",
        ),
        pregunta(
            "q_vpc_1", cert, "VPC", "media",
            "En una VPC, ¿qué elemento es *stateful* y filtra a nivel de instancia?",
            [opcion("a", "Network ACL"), opcion("b", "Security Group"),
             opcion("c", "Route Table"), opcion("d", "Internet Gateway")],
            ["b"],
            "Los **Security Groups** son stateful y operan a nivel de ENI/instancia.",
        ),
        pregunta(
            "q_rds_1", cert, "RDS", "dificil",
            "¿Qué opción de RDS mejora la disponibilidad con una réplica síncrona en otra AZ?",
            [opcion("a", "Read Replica"), opcion("b", "Multi-AZ"),
             opcion("c", "Aurora Serverless"), opcion("d", "Backups automáticos")],
            ["b"],
            "**Multi-AZ** mantiene una réplica síncrona para failover automático.",
        ),
        pregunta(
            "q_lambda_1", cert, "Lambda", "dificil",
            "¿Cuál es el límite máximo de tiempo de ejecución de una función Lambda?",
            [opcion("a", "60 segundos"), opcion("b", "5 minutos"),
             opcion("c", "15 minutos"), opcion("d", "1 hora")],
            ["c"],
            "El tope de ejecución de Lambda es de **15 minutos**.",
        ),
    ]

    problemas = [
        problema(
            "p_suma", "Suma de dos enteros",
            "Lee dos enteros separados por espacio en una línea y escribe su suma.",
            "facil", "algoritmos",
            [caso("2 3", "5"), caso("10 20", "30"), caso("-4 9", "5", oculto=True)],
            ["matematicas", "io"],
        ),
        problema(
            "p_par", "Par o impar",
            "Lee un entero N y escribe `par` si es par o `impar` si es impar.",
            "facil", "algoritmos",
            [caso("4", "par"), caso("7", "impar"), caso("0", "par", oculto=True)],
            ["condicionales"],
        ),
        problema(
            "p_max", "Máximo de una lista",
            "La primera línea trae N; la segunda, N enteros separados por espacio. Escribe el mayor.",
            "media", "algoritmos",
            [caso("3\n4 9 2", "9"), caso("5\n-1 -7 -3 -9 -2", "-1"), caso("1\n42", "42", oculto=True)],
            ["listas"],
        ),
    ]

    preguntas_qa = [
        qa(
            "qa_idempotencia", "backend", "sistemas", "APIs",
            "¿Qué significa que una operación HTTP sea idempotente y por qué importa?",
            "Una operación es **idempotente** si ejecutarla varias veces produce el mismo efecto que "
            "ejecutarla una vez. `GET`, `PUT` y `DELETE` lo son; `POST` no necesariamente. Importa para "
            "**reintentos seguros** ante fallos de red.",
            ["GET/PUT/DELETE idempotentes", "POST no", "reintentos sin efectos duplicados"],
        ),
        qa(
            "qa_indices", "backend", "bases-de-datos", "rendimiento",
            "¿Cuándo conviene (y cuándo no) añadir un índice a una tabla?",
            "Un índice **acelera lecturas** por esa columna, pero **encarece escrituras** y ocupa espacio. "
            "Conviene en columnas muy consultadas/filtradas; no conviene en tablas con muchas escrituras y "
            "pocas lecturas, o columnas de baja cardinalidad.",
            ["acelera lecturas", "encarece escrituras", "cardinalidad y selectividad"],
        ),
        qa(
            "qa_concurrencia", "backend", "sistemas", "concurrencia",
            "Explica la diferencia entre concurrencia y paralelismo.",
            "**Concurrencia** es gestionar varias tareas que progresan de forma intercalada; **paralelismo** "
            "es ejecutarlas literalmente a la vez en varios núcleos. Puedes tener concurrencia sin "
            "paralelismo (un solo núcleo con multitarea).",
            ["intercalado vs simultáneo", "depende del hardware", "Go: goroutines"],
        ),
        qa(
            "qa_rest_grpc", "backend", "sistemas", "APIs",
            "¿Cuándo elegirías gRPC frente a REST/JSON?",
            "**gRPC** (HTTP/2 + protobuf) brilla en comunicación **servicio-a-servicio** de baja latencia y "
            "streaming; **REST/JSON** es más simple, legible y universal para clientes públicos y "
            "navegadores.",
            ["gRPC: interno, binario, streaming", "REST: público, simple", "contrato protobuf"],
        ),
    ]

    def upsert(coll: str, docs: list[dict]) -> None:
        c = db[coll]
        for d in docs:
            c.replace_one({"_id": d["_id"]}, d, upsert=True)
        print(f"  {coll}: {len(docs)} documentos")

    print(f"Sembrando en {MONGO_URI}/{MONGO_DB} (certificacion={cert})")
    upsert("materiales", materiales)
    upsert("preguntas", preguntas)
    upsert("problemas", problemas)
    upsert("qa", preguntas_qa)
    print("Listo.")


if __name__ == "__main__":
    main()
