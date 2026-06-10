"""Siembra datos de ejemplo en MongoDB para el desarrollo local de CertReady.

Inserta el **temario real** de AWS Solutions Architect Associate (SAA-C03) como
material de estudio (una lección por tema) y preguntas de examen (4 por tema),
más problemas de código y preguntas de Q&A para Entrevistas. Es idempotente
(``replace_one`` con upsert por ``_id``).

La clave de certificación y de tema es el **slug** legible (``aws-saa``, ``iam``,
…), igual que los temas del catálogo, no un UUID. Las lecciones y preguntas son
**originales** (no copian documentación oficial ni preguntas reales de examen).

Uso (con el venv de data, que ya trae pymongo):
    data\\.venv\\Scripts\\python.exe scripts\\seed-mongo.py
"""

from __future__ import annotations

import os
from datetime import UTC, datetime

from pymongo import MongoClient

MONGO_URI = os.getenv("SEED_MONGO_URI", "mongodb://localhost:27017")
MONGO_DB = os.getenv("SEED_MONGO_DB", "certready")
CERT = os.getenv("SEED_CERT_SLUG", "aws-saa")
AHORA = datetime(2026, 6, 9, tzinfo=UTC)

# --- Temario SAA-C03: (slug, título lección, markdown, preguntas) -------------
# Cada pregunta: (id, dificultad, enunciado, [4 opciones], índice correcto, explicación).
SYLLABUS = [
    (
        "fundamentos",
        "Fundamentos de AWS",
        "# Fundamentos de AWS\n\n"
        "AWS se organiza en **Regiones** (zonas geográficas) y cada Región tiene varias "
        "**Zonas de Disponibilidad (AZ)**: centros de datos aislados pero cercanos. Repartir "
        "una aplicación en **varias AZ** es la base de la alta disponibilidad.\n\n"
        "El **modelo de responsabilidad compartida** divide la seguridad: AWS protege *la nube* "
        "(hardware, red, instalaciones) y tú proteges *lo que pones en ella* (datos, configuración, "
        "accesos).\n\n"
        "El **Well-Architected Framework** define **6 pilares** para diseñar bien: excelencia "
        "operativa, seguridad, fiabilidad, eficiencia del rendimiento, optimización de costos y "
        "sostenibilidad.",
        [
            ("q_fundamentos_1", "facil", "¿Qué es una Zona de Disponibilidad (AZ)?",
             ["Una Región geográfica completa", "Uno o más centros de datos aislados dentro de una Región",
              "Un tipo de instancia EC2", "Un servicio de DNS"], 1,
             "Una **AZ** es uno o más centros de datos aislados dentro de una Región."),
            ("q_fundamentos_2", "facil",
             "En el modelo de responsabilidad compartida, ¿quién protege los datos del cliente?",
             ["AWS", "El cliente", "Nadie", "El proveedor de internet"], 1,
             "AWS protege la nube; el **cliente** protege lo que pone en ella, incluidos sus datos."),
            ("q_fundamentos_3", "media", "¿Cuántos pilares tiene el Well-Architected Framework?",
             ["3", "4", "6", "10"], 2, "Son **6** pilares."),
            ("q_fundamentos_4", "media",
             "Para alta disponibilidad, ¿cómo conviene desplegar una aplicación?",
             ["En una sola AZ", "En varias AZ de una Región", "Solo en la cuenta raíz",
              "En una única instancia grande"], 1,
             "Distribuir en **varias AZ** elimina el punto único de fallo."),
        ],
    ),
    (
        "iam",
        "Identidad y acceso: IAM",
        "# IAM\n\n"
        "**IAM** controla *quién puede hacer qué* en AWS. Sus piezas:\n\n"
        "- **Usuarios**: identidades de personas o aplicaciones.\n"
        "- **Grupos**: conjuntos de usuarios.\n"
        "- **Roles**: identidades **asumibles temporalmente**, ideales para servicios como EC2.\n"
        "- **Políticas**: documentos JSON con `Effect`, `Action`, `Resource`.\n\n"
        "El principio rector es el **mínimo privilegio**: otorga solo los permisos necesarios. "
        "Activa **MFA**, no uses la **cuenta raíz** para tareas diarias y prefiere **roles** sobre "
        "claves de acceso de larga duración.",
        [
            ("q_iam_1", "facil",
             "¿Qué recurso de IAM conviene para dar permisos temporales a una instancia EC2?",
             ["Un usuario con clave de acceso", "Un rol", "La cuenta raíz", "Una contraseña compartida"], 1,
             "Los **roles** otorgan credenciales temporales sin claves de larga duración."),
            ("q_iam_2", "facil", "¿En qué formato se escriben las políticas de IAM?",
             ["YAML", "XML", "JSON", "CSV"], 2, "Las políticas de IAM son documentos **JSON**."),
            ("q_iam_3", "media", "¿Qué describe el principio de mínimo privilegio?",
             ["Dar todos los permisos por comodidad", "Otorgar solo los permisos necesarios",
              "Usar siempre la cuenta raíz", "Desactivar MFA"], 1,
             "Mínimo privilegio = otorgar **solo** los permisos necesarios."),
            ("q_iam_4", "media", "¿Qué se recomienda para la cuenta raíz?",
             ["Usarla a diario", "No usarla para tareas diarias y activar MFA",
              "Compartir su contraseña", "Borrarla"], 1,
             "La cuenta raíz se reserva; protégela con **MFA** y no la uses a diario."),
        ],
    ),
    (
        "seguridad-datos",
        "Cifrado y secretos",
        "# Seguridad de datos\n\n"
        "Protege los datos **en reposo** y **en tránsito**.\n\n"
        "- **KMS** (Key Management Service) administra **llaves de cifrado** y se integra con S3, "
        "EBS y RDS para cifrar en reposo.\n"
        "- **ACM** (Certificate Manager) emite y renueva **certificados TLS** para cifrar en "
        "tránsito (HTTPS en ALB/CloudFront).\n"
        "- **Secrets Manager** guarda y **rota** credenciales (contraseñas de BD, API keys).\n\n"
        "Regla de oro: **nunca** pongas secretos en el código.",
        [
            ("q_seguridad_datos_1", "facil", "¿Qué servicio administra llaves de cifrado en AWS?",
             ["IAM", "KMS", "Route 53", "CloudWatch"], 1, "**KMS** administra las llaves de cifrado."),
            ("q_seguridad_datos_2", "media", "¿Qué servicio emite certificados TLS para HTTPS?",
             ["ACM", "S3", "SQS", "EFS"], 0, "**ACM** emite y renueva certificados TLS/SSL."),
            ("q_seguridad_datos_3", "media",
             "¿Dónde guardar y rotar credenciales de base de datos?",
             ["En el código", "En Secrets Manager", "En una etiqueta de la instancia",
              "En un bucket público"], 1, "**Secrets Manager** guarda y rota credenciales de forma segura."),
            ("q_seguridad_datos_4", "facil", '¿Qué significa cifrar "en tránsito"?',
             ["Proteger los datos guardados en disco", "Proteger los datos mientras viajan por la red",
              "Borrar los datos", "Comprimir los datos"], 1,
             "Cifrar **en tránsito** protege los datos mientras viajan por la red (TLS)."),
        ],
    ),
    (
        "redes-vpc",
        "Redes: VPC",
        "# Redes con VPC\n\n"
        "Una **VPC** es tu red privada virtual en AWS, dividida en **subredes**:\n\n"
        "- **Públicas**: con ruta a un **Internet Gateway**.\n"
        "- **Privadas**: salida a internet vía **NAT Gateway**.\n\n"
        "El control de tráfico tiene dos capas: **Security Groups** (con estado, a nivel de "
        "instancia, solo permiten) y **Network ACL** (sin estado, a nivel de subred, permiten y "
        "deniegan). **Route 53** es el **DNS** de AWS. Para conectar con tu datacenter: **VPN** o "
        "**Direct Connect**.",
        [
            ("q_redes_vpc_1", "media",
             "¿Qué elemento de red es con estado y opera a nivel de instancia?",
             ["Network ACL", "Security Group", "Route Table", "Internet Gateway"], 1,
             "Los **Security Groups** son con estado y operan a nivel de instancia/ENI."),
            ("q_redes_vpc_2", "media", "¿Qué da salida a internet a una subred privada?",
             ["Internet Gateway", "NAT Gateway", "Security Group", "KMS"], 1,
             "El **NAT Gateway** permite salida a internet desde subredes privadas."),
            ("q_redes_vpc_3", "facil", "¿Cuál es el servicio DNS de AWS?",
             ["CloudFront", "Route 53", "VPC", "ACM"], 1, "**Route 53** es el DNS de AWS."),
            ("q_redes_vpc_4", "dificil", "¿Qué diferencia a una NACL de un Security Group?",
             ["La NACL es con estado", "La NACL es sin estado y a nivel de subred",
              "La NACL solo permite tráfico", "No hay diferencia"], 1,
             "La **NACL** es sin estado y filtra a nivel de **subred**; el SG es con estado por instancia."),
        ],
    ),
    (
        "computo",
        "Cómputo: EC2, Auto Scaling, ELB y Lambda",
        "# Cómputo\n\n"
        "- **EC2**: servidores virtuales; eliges el tipo según CPU/memoria.\n"
        "- **Auto Scaling**: añade o quita instancias según la demanda (rendimiento y costo).\n"
        "- **Balanceadores**: **ALB** (capa 7, HTTP/HTTPS) o **NLB** (capa 4, alto rendimiento).\n"
        "- **Lambda**: ejecuta código **sin servidores** que administrar (serverless); pagas por "
        "ejecución, con un máximo de **15 minutos** por invocación.\n\n"
        "Patrón típico: **ALB + Auto Scaling** en varias AZ para escalar y tolerar fallos.",
        [
            ("q_computo_1", "media",
             "¿Qué servicio ajusta el número de instancias EC2 según la demanda?",
             ["Auto Scaling", "Lambda", "Route 53", "KMS"], 0,
             "**Auto Scaling** ajusta la capacidad automáticamente."),
            ("q_computo_2", "media", "¿Qué balanceador opera en capa 7 (HTTP)?",
             ["NLB", "ALB", "Classic TCP", "Route 53"], 1, "El **ALB** trabaja en capa 7 (HTTP/HTTPS)."),
            ("q_computo_3", "media", "¿Cuál es el tiempo máximo de ejecución de una función Lambda?",
             ["60 segundos", "5 minutos", "15 minutos", "1 hora"], 2,
             "El tope de ejecución de Lambda es de **15 minutos**."),
            ("q_computo_4", "facil", "¿Qué caracteriza a AWS Lambda?",
             ["Ejecuta código sin administrar servidores", "Es una base de datos",
              "Es un balanceador de carga", "Es un servicio de DNS"], 0,
             "**Lambda** es serverless: ejecuta código sin administrar servidores."),
        ],
    ),
    (
        "almacenamiento",
        "Almacenamiento: S3, EBS, EFS y Glacier",
        "# Almacenamiento\n\n"
        "- **S3**: objetos en *buckets*, **11 nueves** de durabilidad. Clases por patrón de acceso: "
        "**Standard** (frecuente), **Standard-IA** (poco frecuente) y **Glacier** (archivado, más "
        "barato). Las **reglas de ciclo de vida** mueven objetos a clases más baratas solas.\n"
        "- **EBS**: discos de bloque para **una** instancia EC2.\n"
        "- **EFS**: sistema de archivos **compartido** por muchas instancias.\n\n"
        "Cifra en reposo con **KMS**.",
        [
            ("q_almacenamiento_1", "facil",
             "¿Qué clase de S3 conviene para archivado de acceso muy infrecuente?",
             ["S3 Standard", "S3 Standard-IA", "S3 Glacier", "S3 Express"], 2,
             "**Glacier** es la opción de menor costo para archivado."),
            ("q_almacenamiento_2", "media",
             "¿Qué servicio es un sistema de archivos compartido por varias instancias?",
             ["EBS", "EFS", "S3 Glacier", "DynamoDB"], 1, "**EFS** es un sistema de archivos compartido."),
            ("q_almacenamiento_3", "media",
             "¿Qué mueve objetos de S3 a clases más baratas automáticamente?",
             ["Las reglas de ciclo de vida", "Un Security Group", "Route 53", "Auto Scaling"], 0,
             "Las **reglas de ciclo de vida** automatizan el cambio de clase."),
            ("q_almacenamiento_4", "facil", "¿Qué durabilidad ofrece S3 para los objetos?",
             ["3 nueves", "7 nueves", "11 nueves", "Ninguna garantía"], 2,
             "S3 ofrece **11 nueves** de durabilidad."),
        ],
    ),
    (
        "bases-datos",
        "Bases de datos: RDS, Aurora, DynamoDB y ElastiCache",
        "# Bases de datos\n\n"
        "- **RDS**: base relacional administrada (MySQL, PostgreSQL…). **Multi-AZ** mantiene una "
        "réplica **síncrona** en otra AZ para *failover* automático; las **réplicas de lectura** "
        "escalan lecturas.\n"
        "- **Aurora**: opción de alto rendimiento compatible con MySQL/PostgreSQL.\n"
        "- **DynamoDB**: NoSQL serverless de baja latencia y escala automática.\n"
        "- **ElastiCache** (Redis/Memcached): cachea datos para acelerar y descargar la base.",
        [
            ("q_bases_datos_1", "dificil",
             "¿Qué opción de RDS da failover automático con réplica síncrona en otra AZ?",
             ["Read Replica", "Multi-AZ", "Backups automáticos", "Aurora Serverless"], 1,
             "**Multi-AZ** mantiene una réplica síncrona para failover automático."),
            ("q_bases_datos_2", "media", "¿Qué sirve para escalar las lecturas en RDS?",
             ["Réplicas de lectura", "Multi-AZ", "Un NAT Gateway", "CloudTrail"], 0,
             "Las **réplicas de lectura** distribuyen la carga de lectura."),
            ("q_bases_datos_3", "media",
             "¿Qué servicio es una base NoSQL administrada y serverless?",
             ["RDS", "DynamoDB", "EFS", "Redshift"], 1, "**DynamoDB** es NoSQL serverless."),
            ("q_bases_datos_4", "media", "¿Qué servicio cachea datos en memoria para acelerar la base?",
             ["ElastiCache", "S3", "KMS", "SNS"], 0,
             "**ElastiCache** (Redis/Memcached) cachea en memoria."),
        ],
    ),
    (
        "desacoplamiento",
        "Aplicaciones desacopladas: SQS, SNS, API Gateway y Step Functions",
        "# Aplicaciones desacopladas\n\n"
        "Desacoplar componentes los hace más **resilientes** y **escalables**.\n\n"
        "- **SQS**: **cola** de mensajes; el productor encola y el consumidor procesa a su ritmo "
        "(absorbe picos).\n"
        "- **SNS**: **publicar/suscribir** (un mensaje a muchos suscriptores).\n"
        "- **API Gateway**: expone **APIs** HTTP/REST gestionadas, a menudo frente a Lambda.\n"
        "- **Step Functions**: orquesta flujos de varios pasos como una **máquina de estados**.",
        [
            ("q_desacoplamiento_1", "media",
             "¿Qué servicio es una cola de mensajes para desacoplar productores y consumidores?",
             ["SNS", "SQS", "API Gateway", "Route 53"], 1, "**SQS** es una cola de mensajes."),
            ("q_desacoplamiento_2", "media",
             "¿Qué servicio sigue el patrón publicar/suscribir (uno a muchos)?",
             ["SQS", "SNS", "EBS", "KMS"], 1, "**SNS** es publicar/suscribir."),
            ("q_desacoplamiento_3", "dificil",
             "¿Qué servicio orquesta flujos de varios pasos como máquina de estados?",
             ["Step Functions", "CloudFront", "EFS", "ACM"], 0,
             "**Step Functions** orquesta flujos como una máquina de estados."),
            ("q_desacoplamiento_4", "facil",
             "¿Para qué sirve poner una cola SQS entre dos servicios?",
             ["Para cifrar datos", "Para absorber picos y desacoplar", "Para balancear DNS",
              "Para crear usuarios"], 1, "Una cola **absorbe picos** y **desacopla** productor y consumidor."),
        ],
    ),
    (
        "alta-disponibilidad",
        "Alta disponibilidad y recuperación ante desastres",
        "# Alta disponibilidad y DR\n\n"
        "La **alta disponibilidad** evita puntos únicos de fallo: distribuye en **varias AZ**, usa "
        "**Auto Scaling** y bases **Multi-AZ**. **Route 53** hace *failover* por DNS con *health "
        "checks*; **CloudFront** (CDN) acerca el contenido y mejora la resiliencia.\n\n"
        "Para **recuperación ante desastres (DR)**, de más barato/lento a más caro/rápido: "
        "*backup & restore* → *pilot light* → *warm standby* → *multi-site activo-activo*.",
        [
            ("q_alta_disponibilidad_1", "facil",
             "Para evitar un punto único de fallo, ¿cómo se despliega una app?",
             ["En una sola AZ", "En varias AZ", "En la cuenta raíz", "En una sola instancia"], 1,
             "Distribuir en **varias AZ** evita el punto único de fallo."),
            ("q_alta_disponibilidad_2", "media",
             "¿Qué servicio puede hacer failover por DNS con health checks?",
             ["CloudFront", "Route 53", "SQS", "KMS"], 1,
             "**Route 53** ofrece enrutamiento por failover con health checks."),
            ("q_alta_disponibilidad_3", "facil", "¿Qué es CloudFront?",
             ["Una base de datos", "Una red de entrega de contenido (CDN)", "Un balanceador de capa 4",
              "Un servicio de colas"], 1, "**CloudFront** es la CDN de AWS."),
            ("q_alta_disponibilidad_4", "dificil",
             "¿Qué estrategia de DR es la más rápida de recuperar (menor RTO)?",
             ["Backup & restore", "Pilot light", "Warm standby", "Multi-site activo-activo"], 3,
             "**Multi-site activo-activo** es la de recuperación más rápida (y más cara)."),
        ],
    ),
    (
        "monitoreo",
        "Monitoreo y operación",
        "# Monitoreo y operación\n\n"
        "- **CloudWatch**: recoge **métricas**, **logs** y **alarmas**; puede disparar acciones "
        "(p. ej. escalar).\n"
        "- **CloudTrail**: registra **quién hizo qué** (llamadas a la API) para auditoría.\n"
        "- **AWS Config**: evalúa la **configuración** de los recursos contra reglas de cumplimiento "
        "y guarda su historial.\n"
        "- **Systems Manager**: opera la flota (parches, parámetros, acceso sin SSH).\n\n"
        "Recuerda: **CloudWatch = rendimiento**; **CloudTrail = auditoría**.",
        [
            ("q_monitoreo_1", "facil", "¿Qué servicio recoge métricas, logs y alarmas?",
             ["CloudTrail", "CloudWatch", "AWS Config", "IAM"], 1,
             "**CloudWatch** recoge métricas, logs y alarmas."),
            ("q_monitoreo_2", "media",
             "¿Qué servicio registra las llamadas a la API para auditoría?",
             ["CloudWatch", "CloudTrail", "Route 53", "KMS"], 1,
             "**CloudTrail** registra las llamadas a la API (quién hizo qué)."),
            ("q_monitoreo_3", "dificil",
             "¿Qué servicio evalúa la configuración de recursos contra reglas de cumplimiento?",
             ["AWS Config", "CloudFront", "EFS", "SNS"], 0,
             "**AWS Config** evalúa la configuración contra reglas y guarda su historial."),
            ("q_monitoreo_4", "media", "Para saber QUIÉN cambió un recurso, ¿qué servicio usas?",
             ["CloudWatch", "CloudTrail", "Auto Scaling", "ACM"], 1,
             "**CloudTrail** responde *quién hizo qué*."),
        ],
    ),
    (
        "costos",
        "Costos y optimización",
        "# Costos y optimización\n\n"
        "Paga solo por lo que usas, pero **optimiza**. Modelos de compra de EC2:\n\n"
        "- **On-Demand**: flexible, más caro.\n"
        "- **Savings Plans / Reserved**: compromiso de 1-3 años, **gran descuento**.\n"
        "- **Spot**: hasta ~90% más barato pero **interrumpible** (cargas tolerantes a fallos).\n\n"
        "En S3, usa la clase correcta y ciclos de vida. **Cost Explorer** analiza el gasto, "
        "**Budgets** alerta cuando te pasas y **Trusted Advisor** recomienda ahorros.",
        [
            ("q_costos_1", "media",
             "¿Qué modelo de compra de EC2 da el mayor descuento a cambio de un compromiso?",
             ["On-Demand", "Spot", "Savings Plans / Reserved", "Dedicated Host"], 2,
             "Los **Savings Plans / Reserved** dan el mayor descuento por compromiso."),
            ("q_costos_2", "media", "¿Qué opción de EC2 es la más barata pero puede interrumpirse?",
             ["On-Demand", "Spot", "Reserved", "Dedicated"], 1,
             "Las instancias **Spot** son las más baratas pero interrumpibles."),
            ("q_costos_3", "facil", "¿Qué servicio te alerta cuando tu gasto supera un umbral?",
             ["Cost Explorer", "Budgets", "Trusted Advisor", "CloudTrail"], 1,
             "**Budgets** alerta al superar un umbral de gasto."),
            ("q_costos_4", "media", "¿Qué servicio recomienda ahorros y buenas prácticas?",
             ["Trusted Advisor", "KMS", "EFS", "SQS"], 0,
             "**Trusted Advisor** recomienda ahorros y buenas prácticas."),
        ],
    ),
]

LETRAS = ["a", "b", "c", "d"]


def material(tema: str, titulo: str, md: str) -> dict:
    return {
        "_id": f"m_{tema.replace('-', '_')}",
        "certificacion": CERT,
        "tema": tema,
        "titulo": titulo,
        "formato": "markdown",
        "contenido": md,
        "recursos": ["https://docs.aws.amazon.com/"],
        "creado_en": AHORA,
    }


def pregunta(tema: str, q: tuple) -> dict:
    _id, dif, enun, opts, correcto, expl = q
    opciones = [{"id": LETRAS[i], "texto": t} for i, t in enumerate(opts)]
    return {
        "_id": _id,
        "certificacion": CERT,
        "tema": tema,
        "dificultad": dif,
        "tipo": "opcion_multiple",
        "enunciado": enun,
        "opciones": opciones,
        "respuesta_correcta": [LETRAS[correcto]],
        "explicacion": expl,
        "tags": [tema],
    }


# --- Entrevistas: problemas de código y Q&A (sin cambios de clave) ------------
PLANTILLA_PY = (
    "import sys\n\n\n"
    "def main():\n"
    "    datos = sys.stdin.read().split()\n"
    "    # Escribe tu solución usando 'datos' e imprime el resultado.\n\n\n"
    "main()\n"
)


def caso(entrada: str, salida: str, oculto: bool = False) -> dict:
    return {"entrada": entrada, "salida_esperada": salida, "oculto": oculto, "peso": 1}


def problema(_id, titulo, enunciado, dif, casos, etiquetas) -> dict:
    return {
        "_id": _id, "titulo": titulo, "enunciado": enunciado, "dificultad": dif,
        "area": "algoritmos", "etiquetas": etiquetas, "lenguajes_permitidos": ["python"],
        "plantillas": {"python": PLANTILLA_PY}, "limite_tiempo_ms": 2000,
        "limite_memoria_mb": 128, "casos": casos, "creado_en": AHORA,
    }


def qa(_id, puesto, area, categoria, enunciado, respuesta, claves) -> dict:
    return {
        "_id": _id, "puesto": puesto, "area": area, "categoria": categoria,
        "enunciado": enunciado, "tipo": "conceptual", "respuesta_modelo": respuesta,
        "puntos_clave": claves, "etiquetas": [area], "creado_en": AHORA,
    }


PROBLEMAS = [
    problema("p_suma", "Suma de dos enteros",
             "Lee dos enteros separados por espacio en una línea y escribe su suma.", "facil",
             [caso("2 3", "5"), caso("10 20", "30"), caso("-4 9", "5", oculto=True)], ["matematicas", "io"]),
    problema("p_par", "Par o impar",
             "Lee un entero N y escribe `par` si es par o `impar` si es impar.", "facil",
             [caso("4", "par"), caso("7", "impar"), caso("0", "par", oculto=True)], ["condicionales"]),
    problema("p_max", "Máximo de una lista",
             "La primera línea trae N; la segunda, N enteros separados por espacio. Escribe el mayor.", "media",
             [caso("3\n4 9 2", "9"), caso("5\n-1 -7 -3 -9 -2", "-1"), caso("1\n42", "42", oculto=True)], ["listas"]),
]

QA = [
    qa("qa_idempotencia", "backend", "sistemas", "APIs",
       "¿Qué significa que una operación HTTP sea idempotente y por qué importa?",
       "Una operación es **idempotente** si ejecutarla varias veces produce el mismo efecto que "
       "ejecutarla una vez. `GET`, `PUT` y `DELETE` lo son; `POST` no necesariamente. Importa para "
       "**reintentos seguros** ante fallos de red.",
       ["GET/PUT/DELETE idempotentes", "POST no", "reintentos sin efectos duplicados"]),
    qa("qa_indices", "backend", "bases-de-datos", "rendimiento",
       "¿Cuándo conviene (y cuándo no) añadir un índice a una tabla?",
       "Un índice **acelera lecturas** por esa columna, pero **encarece escrituras** y ocupa espacio. "
       "Conviene en columnas muy consultadas; no en tablas con muchas escrituras y pocas lecturas, o "
       "columnas de baja cardinalidad.",
       ["acelera lecturas", "encarece escrituras", "cardinalidad y selectividad"]),
    qa("qa_concurrencia", "backend", "sistemas", "concurrencia",
       "Explica la diferencia entre concurrencia y paralelismo.",
       "**Concurrencia** es gestionar varias tareas que progresan intercaladas; **paralelismo** es "
       "ejecutarlas a la vez en varios núcleos. Puedes tener concurrencia sin paralelismo.",
       ["intercalado vs simultáneo", "depende del hardware", "Go: goroutines"]),
    qa("qa_rest_grpc", "backend", "sistemas", "APIs",
       "¿Cuándo elegirías gRPC frente a REST/JSON?",
       "**gRPC** (HTTP/2 + protobuf) brilla en comunicación **servicio-a-servicio** de baja latencia "
       "y streaming; **REST/JSON** es más simple y universal para clientes públicos.",
       ["gRPC: interno, binario, streaming", "REST: público, simple", "contrato protobuf"]),
]


def main() -> None:
    db = MongoClient(MONGO_URI)[MONGO_DB]

    materiales, preguntas = [], []
    for tema, titulo, md, qs in SYLLABUS:
        materiales.append(material(tema, titulo, md))
        for q in qs:
            preguntas.append(pregunta(tema, q))

    def upsert(coll: str, docs: list[dict]) -> None:
        c = db[coll]
        for d in docs:
            c.replace_one({"_id": d["_id"]}, d, upsert=True)
        print(f"  {coll}: {len(docs)} documentos")

    print(f"Sembrando en {MONGO_URI}/{MONGO_DB} (certificacion={CERT})")
    upsert("materiales", materiales)
    upsert("preguntas", preguntas)
    upsert("problemas", PROBLEMAS)
    upsert("qa", QA)
    print("Listo.")


if __name__ == "__main__":
    main()
