"""Siembra datos de ejemplo en MongoDB para el desarrollo local de CertReady.

Material de estudio y preguntas de **AWS Solutions Architect Associate (SAA-C03)**,
alineados con la guía oficial del examen y sus 4 dominios de contenido (Seguridad,
Resiliencia, Rendimiento, Costos). Una nota de estudio por tema y 4 preguntas por
tema, enfocadas a lo que mide el examen. Idempotente (``replace_one`` con upsert) y
limpia material/preguntas de temas retirados.

La clave de certificación y de tema es el **slug** legible (``aws-saa``, ``iam``,
…), igual que los temas del catálogo. Las lecciones y preguntas son **originales**
(no copian documentación oficial ni preguntas reales de examen).

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
AHORA = datetime(2026, 6, 10, tzinfo=UTC)

# --- Temario SAA-C03: (slug, título, markdown, preguntas) ---------------------
# Cada pregunta: (id, dificultad, enunciado, [4 opciones], índice correcto, explicación).
SYLLABUS = [
    # ===== Dominio 1 — Diseño de arquitecturas seguras (30%) =================
    (
        "fundamentos",
        "Fundamentos de AWS",
        "# Fundamentos de AWS\n\n"
        "## Infraestructura global\n"
        "AWS se organiza en **Regiones** (zonas geográficas, p. ej. `us-east-1`). Cada Región tiene "
        "varias **Zonas de Disponibilidad (AZ)**: centros de datos aislados pero cercanos. Repartir "
        "una carga en **varias AZ** es la base de la **alta disponibilidad**. Las **Edge Locations** "
        "(CloudFront) acercan contenido a los usuarios.\n\n"
        "## Modelo de responsabilidad compartida\n"
        "- **AWS protege _la nube_**: hardware, red física, instalaciones.\n"
        "- **Tú proteges _lo que va en la nube_**: datos, configuración, permisos (IAM), cifrado y "
        "—en EC2— el sistema operativo.\n\n"
        "## Well-Architected Framework\n"
        "Seis pilares: excelencia operativa, **seguridad**, **fiabilidad**, eficiencia del "
        "rendimiento, **optimización de costos** y sostenibilidad. El examen SAA gira en torno a "
        "estos cuatro últimos (los 4 dominios).\n\n"
        "> **En el examen:** *alta disponibilidad* → **multi-AZ**; *latencia global* → **CloudFront/"
        "Edge**; *¿de quién es la seguridad de X?* → modelo de **responsabilidad compartida**.",
        [
            ("q_fundamentos_1", "facil", "¿Qué es una Zona de Disponibilidad (AZ)?",
             ["Una Región completa", "Uno o más centros de datos aislados dentro de una Región",
              "Un tipo de instancia", "Un servicio de DNS"], 1,
             "Una **AZ** es uno o más centros de datos aislados dentro de una Región."),
            ("q_fundamentos_2", "facil",
             "En el modelo de responsabilidad compartida, ¿quién protege los datos del cliente?",
             ["AWS", "El cliente", "Nadie", "El ISP"], 1,
             "AWS protege la nube; el **cliente** protege lo que pone en ella, incluidos sus datos."),
            ("q_fundamentos_3", "media",
             "Para que una aplicación tolere la caída de un centro de datos, ¿cómo se despliega?",
             ["En una sola AZ", "En varias AZ de la Región", "En la cuenta raíz", "En una instancia grande"], 1,
             "Distribuir en **varias AZ** elimina el punto único de fallo."),
            ("q_fundamentos_4", "media",
             "¿Qué acerca contenido a los usuarios para reducir latencia global?",
             ["Una segunda VPC", "Las Edge Locations / CloudFront", "Un NAT Gateway", "Multi-AZ"], 1,
             "Las **Edge Locations** (CloudFront) sirven contenido cacheado cerca del usuario."),
        ],
    ),
    (
        "iam",
        "Acceso seguro: IAM, roles y multicuenta",
        "# Acceso seguro (Dominio 1.1)\n\n"
        "## IAM\n"
        "**IAM** controla *quién* puede hacer *qué*. Piezas: **usuarios**, **grupos**, **roles** y "
        "**políticas** (JSON con `Effect`/`Action`/`Resource`). Aplica **mínimo privilegio**, activa "
        "**MFA** y **no uses la cuenta raíz** para el día a día.\n\n"
        "## Roles y credenciales temporales (STS)\n"
        "Un **rol** se *asume* y entrega **credenciales temporales** vía **AWS STS** (`AssumeRole`). "
        "Es la forma correcta de dar permisos a una **instancia EC2** o **Lambda**, y de hacer "
        "**acceso entre cuentas** (cross-account): la cuenta A define un rol que la cuenta B asume. "
        "Nunca incrustes claves de larga duración en el código.\n\n"
        "## Varias cuentas\n"
        "- **AWS Organizations** agrupa todas tus cuentas.\n"
        "- Las **SCP** (Service Control Policies) fijan el **techo de permisos** de toda una "
        "organización o unidad (no otorgan; limitan).\n"
        "- **Control Tower** despliega una *landing zone* multicuenta segura por defecto.\n\n"
        "## Federación / inicio de sesión único\n"
        "**IAM Identity Center** (antes AWS SSO) federa tu directorio corporativo (o externo) con "
        "roles de IAM para un **login único**.\n\n"
        "> **En el examen:** *permisos a EC2/Lambda* → **rol**; *acceso entre cuentas* → **STS "
        "AssumeRole**; *límite máximo en toda la org* → **SCP**; *SSO corporativo* → **IAM Identity "
        "Center**.",
        [
            ("q_iam_1", "facil",
             "¿Qué se debe usar para dar permisos a una instancia EC2 sin incrustar claves?",
             ["Un usuario con clave de acceso", "Un rol IAM", "La cuenta raíz", "Una contraseña"], 1,
             "Un **rol IAM** otorga credenciales temporales (vía STS) a la instancia."),
            ("q_iam_2", "media",
             "Una cuenta necesita acceder a recursos de otra cuenta de la misma empresa. ¿Qué usas?",
             ["Compartir la contraseña raíz", "Un rol entre cuentas asumido con STS",
              "Hacer públicos los recursos", "Una VPN"], 1,
             "Se define un **rol cross-account** que la otra cuenta **asume con STS**."),
            ("q_iam_3", "dificil",
             "¿Cómo impones un permiso máximo a TODAS las cuentas de una organización?",
             ["Una política de usuario", "Una Service Control Policy (SCP) en Organizations",
              "Un Security Group", "Un rol"], 1,
             "Las **SCP** de Organizations fijan el techo de permisos de las cuentas (no otorgan)."),
            ("q_iam_4", "media",
             "¿Qué servicio da inicio de sesión único federando tu directorio corporativo?",
             ["IAM Identity Center", "KMS", "CloudTrail", "Route 53"], 0,
             "**IAM Identity Center** (ex-SSO) federa el directorio con roles para SSO."),
        ],
    ),
    (
        "redes-vpc",
        "Red y aplicaciones seguras (VPC, WAF, Shield)",
        "# Red y aplicaciones seguras (Dominio 1.2)\n\n"
        "## VPC y segmentación\n"
        "Una **VPC** es tu red privada. Se divide en **subredes**: **públicas** (con ruta a un "
        "**Internet Gateway**) para lo expuesto (un balanceador), y **privadas** (salen vía **NAT "
        "Gateway**) para bases de datos y servidores de aplicación. Dos firewalls:\n\n"
        "- **Security Group**: **con estado**, por instancia, solo reglas de **permitir**.\n"
        "- **Network ACL**: **sin estado**, por subred, permite y **deniega** (p. ej. bloquear una IP).\n\n"
        "## Proteger las aplicaciones\n"
        "- **AWS WAF**: firewall de capa 7; filtra **inyección SQL**, XSS y patrones maliciosos. Se "
        "pone delante de **ALB**, **CloudFront** o API Gateway.\n"
        "- **AWS Shield**: protección contra **DDoS** (Standard gratis; Advanced de pago).\n"
        "- **Secrets Manager**: guarda y **rota** credenciales.\n"
        "- **GuardDuty**: detección inteligente de amenazas; **Macie**: descubre **datos sensibles "
        "(PII)** en S3; **Cognito**: autenticación de los usuarios de tu app.\n\n"
        "## Conexión híbrida segura\n"
        "**VPN** (cifrada, por internet) o **Direct Connect** (enlace **privado dedicado**, estable).\n\n"
        "> **En el examen:** *con estado/instancia* → **SG**; *denegar una IP/subred* → **NACL**; "
        "*filtrar SQL injection* → **WAF**; *DDoS* → **Shield**; *PII en S3* → **Macie**.",
        [
            ("q_redes_vpc_1", "media",
             "¿Qué firewall es con estado y opera a nivel de instancia?",
             ["Network ACL", "Security Group", "Route Table", "Internet Gateway"], 1,
             "Los **Security Groups** son con estado y por instancia."),
            ("q_redes_vpc_2", "media",
             "Una app web sufre intentos de inyección SQL. ¿Qué servicio los filtra?",
             ["Shield", "AWS WAF", "KMS", "NAT Gateway"], 1,
             "**WAF** filtra a nivel de capa 7 (SQL injection, XSS) delante de ALB/CloudFront."),
            ("q_redes_vpc_3", "media",
             "Necesitas descubrir datos personales (PII) almacenados en S3. ¿Qué usas?",
             ["GuardDuty", "Macie", "Cognito", "Inspector"], 1,
             "**Macie** descubre y clasifica datos sensibles (PII) en S3."),
            ("q_redes_vpc_4", "facil",
             "Para un enlace privado y dedicado entre tu centro de datos y AWS, ¿qué eliges?",
             ["VPN por internet", "Direct Connect", "Internet Gateway", "PrivateLink"], 1,
             "**Direct Connect** es un enlace privado y dedicado (más estable que una VPN)."),
        ],
    ),
    (
        "seguridad-datos",
        "Seguridad de datos: cifrado y claves",
        "# Seguridad de datos (Dominio 1.3)\n\n"
        "Protege los datos **en reposo** y **en tránsito**, y gobierna su acceso, retención y "
        "respaldo.\n\n"
        "## Cifrado en reposo: KMS\n"
        "**KMS** crea y administra **llaves de cifrado** e integra con S3, EBS, RDS, DynamoDB, etc. "
        "Defines **políticas de acceso a las claves** (quién puede usarlas) y activas la **rotación** "
        "automática. Para requisitos de hardware dedicado/FIPS: **CloudHSM**.\n\n"
        "## Cifrado en tránsito: ACM/TLS\n"
        "**ACM** emite y **renueva** certificados **TLS** gratis; se asocian a **ALB**/**CloudFront** "
        "para servir por **HTTPS**.\n\n"
        "## Gobernanza, retención y respaldo\n"
        "- **Secrets Manager** guarda y rota credenciales.\n"
        "- **Backups y replicación** garantizan durabilidad (snapshots de EBS/RDS, versionado y "
        "replicación de S3).\n"
        "- **Reglas de ciclo de vida** y **clasificación/retención** controlan cuánto se guardan y "
        "dónde.\n"
        "- **CloudTrail** registra el **uso de las claves** y las llamadas a la API (auditoría).\n\n"
        "> **En el examen:** *cifrar en reposo / administrar llaves* → **KMS**; *HTTPS/cert* → "
        "**ACM**; *rotar credenciales* → **Secrets Manager**; *hardware dedicado FIPS* → **CloudHSM**.",
        [
            ("q_seguridad_datos_1", "facil", "¿Qué servicio administra las llaves de cifrado en reposo?",
             ["IAM", "KMS", "Route 53", "Macie"], 1, "**KMS** administra las llaves de cifrado."),
            ("q_seguridad_datos_2", "media", "¿Qué servicio emite y renueva certificados TLS para HTTPS?",
             ["ACM", "Secrets Manager", "Shield", "EFS"], 0, "**ACM** emite/renueva certificados TLS."),
            ("q_seguridad_datos_3", "media",
             "Un requisito exige un módulo de hardware dedicado para las claves (FIPS 140-2 nivel 3). ¿Qué usas?",
             ["KMS multi-tenant", "CloudHSM", "Secrets Manager", "ACM"], 1,
             "**CloudHSM** ofrece un módulo de hardware dedicado para cumplimiento estricto."),
            ("q_seguridad_datos_4", "facil", '¿Qué significa cifrar "en tránsito"?',
             ["Proteger los datos en disco", "Proteger los datos mientras viajan por la red (TLS)",
              "Comprimir los datos", "Borrar los datos"], 1,
             "Cifrar **en tránsito** protege los datos mientras viajan por la red (TLS)."),
        ],
    ),
    # ===== Dominio 2 — Diseño de arquitecturas resistentes (26%) =============
    (
        "desacoplamiento",
        "Arquitecturas desacopladas y escalables",
        "# Arquitecturas desacopladas y escalables (Dominio 2.1)\n\n"
        "Desacoplar componentes los hace **escalar de forma independiente** y tolerar fallos.\n\n"
        "## Mensajería\n"
        "- **SQS**: **cola**; el productor encola y el consumidor procesa **a su ritmo**; absorbe "
        "picos. Un mensaje → un consumidor.\n"
        "- **SNS**: **publicar/suscribir** (un mensaje a **muchos** suscriptores). El patrón "
        "**SNS+SQS** (fan-out) es muy común.\n"
        "- **API Gateway** expone **APIs** gestionadas, normalmente delante de **Lambda**.\n"
        "- **Step Functions** orquesta flujos de varios pasos.\n\n"
        "## Escalado y estado\n"
        "- **Horizontal** (más instancias, preferido para la nube) vs **vertical** (instancia más "
        "grande).\n"
        "- Las cargas **sin estado (stateless)** escalan mejor: guarda el estado/sesión en "
        "**DynamoDB** o **ElastiCache**, no en la instancia.\n\n"
        "## Contenedores y serverless\n"
        "- **ECS** (orquestador de AWS) y **EKS** (Kubernetes gestionado).\n"
        "- **Fargate**: ejecuta contenedores **sin gestionar servidores** (serverless).\n"
        "- **Lambda** para funciones event-driven; **ALB** reparte el tráfico HTTP.\n\n"
        "> **En el examen:** *absorber picos/desacoplar* → **SQS**; *uno a muchos* → **SNS**; "
        "*contenedores sin servidores* → **Fargate**; *escalar bien* → **stateless** + horizontal.",
        [
            ("q_desacoplamiento_1", "media",
             "¿Qué servicio desacopla productor y consumidor absorbiendo picos de carga?",
             ["SNS", "SQS", "API Gateway", "Route 53"], 1, "**SQS** es una cola que absorbe picos."),
            ("q_desacoplamiento_2", "media",
             "Quieres que un evento llegue a varios suscriptores a la vez. ¿Qué usas?",
             ["SQS", "SNS", "EBS", "KMS"], 1, "**SNS** sigue el patrón publicar/suscribir (fan-out)."),
            ("q_desacoplamiento_3", "media",
             "Quieres correr contenedores sin administrar instancias EC2. ¿Qué eliges?",
             ["EC2 con Docker", "AWS Fargate", "Lambda", "EMR"], 1,
             "**Fargate** ejecuta contenedores de forma serverless (ECS/EKS sin gestionar EC2)."),
            ("q_desacoplamiento_4", "dificil",
             "Para que una app web escale horizontalmente sin problemas, ¿dónde guardas la sesión?",
             ["En el disco de cada instancia", "En DynamoDB o ElastiCache (stateless)",
              "En la cuenta raíz", "En el Security Group"], 1,
             "Una app **stateless** guarda el estado fuera de la instancia (DynamoDB/ElastiCache)."),
        ],
    ),
    (
        "alta-disponibilidad",
        "Alta disponibilidad y recuperación ante desastres",
        "# Alta disponibilidad y DR (Dominio 2.2)\n\n"
        "## Alta disponibilidad (sin punto único de fallo)\n"
        "- Reparte en **varias AZ**.\n"
        "- **Auto Scaling** reemplaza instancias caídas; **ELB** solo envía tráfico a las sanas "
        "(**health checks**).\n"
        "- Bases de datos en **RDS Multi-AZ** (failover automático) y **read replicas** para escalar "
        "lecturas.\n"
        "- **Route 53** enruta por **failover** con health checks; piensa en **durabilidad y "
        "replicación** de los datos. La **infraestructura inmutable** evita cambios manuales frágiles.\n\n"
        "## Visibilidad\n"
        "- **CloudWatch**: métricas, logs y **alarmas** (disparan escalado o notificaciones).\n"
        "- **X-Ray**: **traza** una petición a través de varios microservicios para hallar cuellos "
        "de botella.\n\n"
        "## Recuperación ante desastres (DR)\n"
        "Define **RTO** (tiempo de recuperación) y **RPO** (datos que puedes perder). Cuatro "
        "estrategias, de más barata/lenta a más cara/rápida:\n\n"
        "1. **Backup & restore** · 2. **Pilot light** · 3. **Warm standby** · 4. **Multi-site "
        "activo-activo** (RTO casi 0).\n\n"
        "> **En el examen:** *failover de BD* → **RDS Multi-AZ**; *menor RTO* → **activo-activo**; "
        "*trazar una petición entre microservicios* → **X-Ray**.",
        [
            ("q_alta_disponibilidad_1", "dificil",
             "¿Qué da failover automático de la base de datos con réplica síncrona en otra AZ?",
             ["Read Replica", "RDS Multi-AZ", "Backups", "Aurora Serverless"], 1,
             "**RDS Multi-AZ** mantiene una réplica síncrona para failover automático."),
            ("q_alta_disponibilidad_2", "media",
             "¿Qué servicio puede enrutar a una región sana mediante DNS y health checks?",
             ["CloudFront", "Route 53", "SQS", "KMS"], 1,
             "**Route 53** ofrece enrutamiento por failover con health checks."),
            ("q_alta_disponibilidad_3", "media",
             "Necesitas trazar el recorrido de una petición a través de varios microservicios. ¿Qué usas?",
             ["CloudTrail", "AWS X-Ray", "Config", "Macie"], 1,
             "**X-Ray** traza peticiones distribuidas para hallar cuellos de botella."),
            ("q_alta_disponibilidad_4", "dificil",
             "¿Qué estrategia de DR ofrece el menor RTO (recuperación casi inmediata)?",
             ["Backup & restore", "Pilot light", "Warm standby", "Multi-site activo-activo"], 3,
             "**Multi-site activo-activo** recupera casi al instante (y es la más cara)."),
        ],
    ),
    # ===== Dominio 3 — Diseño de arquitecturas de alto rendimiento (24%) =====
    (
        "computo",
        "Cómputo elástico y de alto rendimiento",
        "# Cómputo de alto rendimiento (Dominio 3.2)\n\n"
        "## EC2 y escalado\n"
        "**EC2** ofrece **familias** de instancia según la carga: *computación-optimizada* (CPU), "
        "*memoria-optimizada* (RAM), *propósito general*, etc. Elegir bien la familia y el tamaño es "
        "clave. **EC2 Auto Scaling** ajusta el número de instancias según métricas.\n\n"
        "## Serverless y contenedores\n"
        "- **Lambda**: funciones **event-driven**, pago por uso, ≤ 15 min. Eliges la **memoria** "
        "(que también define la CPU).\n"
        "- **Fargate**: contenedores serverless.\n"
        "- **ECS / EKS**: orquestación de contenedores (Kubernetes en EKS).\n\n"
        "## Cargas especializadas\n"
        "- **AWS Batch**: trabajos por **lotes** gestionados.\n"
        "- **Amazon EMR**: **big data** (Spark/Hadoop).\n"
        "- Balanceo: **ALB** (capa 7, HTTP) vs **NLB** (capa 4, TCP/UDP, rendimiento extremo).\n\n"
        "> **En el examen:** *carga con mucha RAM* → familia **memoria-optimizada**; *event-driven/"
        "pago por uso* → **Lambda**; *Hadoop/Spark* → **EMR**; *lotes* → **Batch**.",
        [
            ("q_computo_1", "media",
             "Una aplicación analítica consume mucha memoria. ¿Qué eliges?",
             ["Una familia de instancia memoria-optimizada", "Lambda", "Una NACL", "Glacier"], 0,
             "Eliges la **familia** de instancia adecuada (memoria-optimizada) a la carga."),
            ("q_computo_2", "facil", "¿Qué servicio es ideal para cargas event-driven con pago por uso?",
             ["EC2 On-Demand", "AWS Lambda", "EMR", "Batch"], 1,
             "**Lambda** ejecuta código por evento, sin servidores y pagando por uso."),
            ("q_computo_3", "media", "Para procesar big data con Spark/Hadoop, ¿qué servicio usas?",
             ["Amazon EMR", "API Gateway", "Route 53", "ACM"], 0,
             "**EMR** ejecuta frameworks de big data como Spark y Hadoop."),
            ("q_computo_4", "media",
             "Necesitas un balanceador de capa 4 (TCP) con latencia mínima y altísimo rendimiento. ¿Cuál?",
             ["ALB", "NLB", "CloudFront", "NAT Gateway"], 1,
             "El **NLB** opera en capa 4 (TCP/UDP) con rendimiento y latencia óptimos."),
        ],
    ),
    (
        "almacenamiento",
        "Almacenamiento (S3, EBS, EFS, FSx)",
        "# Almacenamiento de alto rendimiento (Dominio 3.1)\n\n"
        "Tres tipos, y el examen pregunta cuál encaja en cada escenario:\n\n"
        "## Objeto — S3\n"
        "**S3** guarda **objetos** en *buckets*, con **11 nueves** de durabilidad y acceso por HTTP. "
        "Clases por patrón de acceso (**Standard**, **IA**, **Glacier**) y **reglas de ciclo de "
        "vida** para abaratar con el tiempo. Para web, data lakes, backups, archivos estáticos.\n\n"
        "## Bloque — EBS\n"
        "**EBS** son discos de bloque para **una** instancia EC2. Tipos:\n"
        "- **SSD** (`gp3`, `io2`): muchas **IOPS**; bases de datos y cargas transaccionales.\n"
        "- **HDD** (`st1`, `sc1`): **throughput** secuencial barato; big data, logs.\n\n"
        "## Archivo compartido — EFS / FSx\n"
        "**EFS** es un sistema de archivos **compartido** por muchas instancias Linux en varias AZ. "
        "**FSx** cubre Windows (FSx for Windows) y HPC (FSx for Lustre).\n\n"
        "> **En el examen:** *un disco para una instancia* → **EBS**; *compartido por muchas* → "
        "**EFS**; *objetos/estáticos por web* → **S3**; *alta IOPS para BD* → **EBS SSD (io2/gp3)**.",
        [
            ("q_almacenamiento_1", "media",
             "Una base de datos en EC2 necesita un disco con muchas IOPS. ¿Qué eliges?",
             ["EBS HDD (st1)", "EBS SSD (io2/gp3)", "S3 Glacier", "EFS"], 1,
             "Para muchas **IOPS** se usa **EBS SSD** (io2/gp3)."),
            ("q_almacenamiento_2", "media",
             "Varias instancias EC2 (Linux) en distintas AZ deben compartir los mismos archivos. ¿Qué usas?",
             ["EBS", "EFS", "S3 Glacier", "Instance Store"], 1,
             "**EFS** es un sistema de archivos compartido por muchas instancias en varias AZ."),
            ("q_almacenamiento_3", "facil",
             "¿Qué clase de S3 conviene para archivado de acceso muy infrecuente?",
             ["S3 Standard", "S3 Standard-IA", "S3 Glacier", "S3 Express"], 2,
             "**Glacier** es la opción más barata para archivado."),
            ("q_almacenamiento_4", "facil",
             "¿Qué tipo de almacenamiento es S3?",
             ["Bloque", "Archivo", "Objeto", "En memoria"], 2,
             "**S3** es almacenamiento de **objetos** (11 nueves de durabilidad)."),
        ],
    ),
    (
        "bases-datos",
        "Bases de datos de alto rendimiento",
        "# Bases de datos de alto rendimiento (Dominio 3.3)\n\n"
        "## Relacional gestionada — RDS y Aurora\n"
        "**RDS** ejecuta motores relacionales (MySQL, PostgreSQL…). Dos conceptos clave:\n"
        "- **Multi-AZ**: réplica **síncrona** para **failover** (alta disponibilidad).\n"
        "- **Read Replicas**: réplicas **asíncronas** para **escalar lecturas**.\n\n"
        "**Aurora** es la opción de alto rendimiento (compatible MySQL/PostgreSQL, almacenamiento "
        "replicado en 3 AZ; **Aurora Serverless** escala sola).\n\n"
        "## NoSQL — DynamoDB\n"
        "**DynamoDB** es **NoSQL serverless** de baja latencia (ms) y escala automática; ideal para "
        "tráfico alto y esquema flexible. **DAX** le añade caché en memoria.\n\n"
        "## Caché y conexiones\n"
        "- **ElastiCache** (Redis/Memcached): caché **en memoria** que acelera y **descarga** la BD.\n"
        "- **RDS Proxy**: agrupa conexiones (*pooling*); muy útil cuando **muchas Lambdas** abren "
        "conexiones a RDS.\n\n"
        "> **En el examen:** *escalar lecturas* → **read replicas**; *failover* → **Multi-AZ**; "
        "*NoSQL serverless* → **DynamoDB**; *acelerar/descargar la BD* → **ElastiCache**; *muchas "
        "conexiones desde Lambda* → **RDS Proxy**.",
        [
            ("q_bases_datos_1", "media",
             "La base de datos recibe demasiadas lecturas. ¿Qué añades para escalarlas?",
             ["Multi-AZ", "Read Replicas", "Un NAT Gateway", "CloudTrail"], 1,
             "Las **read replicas** distribuyen y escalan la carga de lectura."),
            ("q_bases_datos_2", "media", "¿Qué servicio es una base NoSQL serverless de baja latencia?",
             ["RDS", "DynamoDB", "EMR", "Redshift"], 1, "**DynamoDB** es NoSQL serverless."),
            ("q_bases_datos_3", "media",
             "Quieres acelerar las lecturas repetidas y descargar la base de datos. ¿Qué usas?",
             ["ElastiCache", "S3", "KMS", "SNS"], 0,
             "**ElastiCache** (Redis/Memcached) cachea en memoria y descarga la BD."),
            ("q_bases_datos_4", "dificil",
             "Miles de funciones Lambda abren conexiones a RDS y la saturan. ¿Qué lo soluciona?",
             ["RDS Proxy", "Otra read replica", "Un Security Group", "DynamoDB"], 0,
             "**RDS Proxy** agrupa (pool) las conexiones, ideal con Lambda."),
        ],
    ),
    (
        "redes-rendimiento",
        "Redes de alto rendimiento y entrega de contenido",
        "# Redes de alto rendimiento (Dominio 3.4)\n\n"
        "## Entrega cerca del usuario\n"
        "- **CloudFront** (CDN): cachea contenido en las **Edge Locations**, reduciendo latencia y "
        "**descargando el origen**. Ideal para sitios y contenido estático global.\n"
        "- **Global Accelerator**: mejora apps **TCP/UDP** (no solo HTTP) enrutando por la **red "
        "troncal de AWS** con IPs anycast; útil para juegos, VoIP, APIs globales.\n\n"
        "## Conexión privada y entre redes\n"
        "- **PrivateLink**: acceso **privado** a un servicio **sin salir a internet**.\n"
        "- **VPC peering** conecta dos VPCs; **Transit Gateway** conecta **muchas** VPCs y "
        "on-premises como un hub.\n"
        "- **Direct Connect** (privado dedicado) vs **VPN** (por internet).\n\n"
        "## Diseño\n"
        "Reparte con **ALB**, define subredes/rutas y coloca los recursos cerca de los usuarios.\n\n"
        "> **En el examen:** *cachear estáticos globalmente* → **CloudFront**; *acelerar app TCP/UDP "
        "global* → **Global Accelerator**; *acceso privado a un servicio* → **PrivateLink**; *muchas "
        "VPCs en hub* → **Transit Gateway**.",
        [
            ("q_redes_rendimiento_1", "facil",
             "¿Qué acerca contenido estático a usuarios globales cacheándolo en el borde?",
             ["Route 53", "CloudFront", "NAT Gateway", "VPC peering"], 1,
             "**CloudFront** (CDN) cachea contenido cerca del usuario y descarga el origen."),
            ("q_redes_rendimiento_2", "dificil",
             "Una aplicación TCP/UDP global necesita menor latencia usando la red de AWS. ¿Qué usas?",
             ["CloudFront", "Global Accelerator", "Internet Gateway", "WAF"], 1,
             "**Global Accelerator** mejora apps no-HTTP enrutando por la troncal de AWS (anycast)."),
            ("q_redes_rendimiento_3", "media",
             "Quieres acceder a un servicio de forma privada sin pasar por internet. ¿Qué usas?",
             ["Internet Gateway", "AWS PrivateLink", "NAT Gateway", "Direct Connect"], 1,
             "**PrivateLink** da acceso privado a servicios sin exponerlos a internet."),
            ("q_redes_rendimiento_4", "media",
             "Tienes decenas de VPCs y on-premises que conectar como un hub central. ¿Qué eliges?",
             ["VPC peering uno a uno", "Transit Gateway", "Un NAT por VPC", "CloudFront"], 1,
             "**Transit Gateway** conecta muchas VPCs y redes on-premises como un hub."),
        ],
    ),
    (
        "datos",
        "Ingesta y análisis de datos",
        "# Ingesta y análisis de datos (Dominio 3.5)\n\n"
        "El examen incluye un bloque de **datos**: cómo ingerir, transferir, transformar y analizar.\n\n"
        "## Streaming e ingesta\n"
        "- **Amazon Kinesis**: ingesta y procesa **streaming** en **tiempo real** (clics, telemetría, "
        "logs).\n"
        "- **DataSync**: transferencia **masiva** de archivos on-premises ↔ AWS (migraciones de TB/PB).\n"
        "- **Storage Gateway**: almacenamiento **híbrido** (on-prem usa S3 por detrás).\n\n"
        "## Transformación y análisis\n"
        "- **AWS Glue**: **ETL serverless** + catálogo de datos.\n"
        "- **Amazon Athena**: consultas **SQL** directamente sobre datos en **S3**, sin servidores.\n"
        "- **Lake Formation**: construye y gobierna **lagos de datos** sobre S3.\n"
        "- Formatos **columnares** como **Parquet** hacen el análisis más rápido y barato que CSV.\n\n"
        "> **En el examen:** *streaming en tiempo real* → **Kinesis**; *SQL sobre S3 sin servidores* "
        "→ **Athena**; *ETL serverless* → **Glue**; *mover TB on-prem→AWS* → **DataSync**.",
        [
            ("q_datos_1", "media", "¿Qué servicio ingiere y procesa datos en streaming en tiempo real?",
             ["Amazon Kinesis", "Athena", "Glue", "DataSync"], 0,
             "**Kinesis** maneja datos en streaming en tiempo real."),
            ("q_datos_2", "media",
             "Quieres consultar con SQL datos que ya están en S3, sin montar servidores. ¿Qué usas?",
             ["Amazon Athena", "EMR", "RDS", "Redshift en EC2"], 0,
             "**Athena** consulta datos en S3 con SQL, de forma serverless."),
            ("q_datos_3", "media", "Necesitas un proceso ETL serverless con catálogo de datos. ¿Cuál?",
             ["AWS Glue", "Kinesis", "Cognito", "Macie"], 0,
             "**Glue** es ETL serverless con catálogo."),
            ("q_datos_4", "media",
             "Debes migrar varios TB de archivos desde tu centro de datos a AWS. ¿Qué servicio?",
             ["DataSync", "CloudFront", "Step Functions", "Athena"], 0,
             "**DataSync** transfiere grandes volúmenes de archivos on-premises ↔ AWS."),
        ],
    ),
    # ===== Dominio 4 — Diseño con optimización de costos (20%) ===============
    (
        "costos",
        "Optimización de costos",
        "# Optimización de costos (Dominio 4)\n\n"
        "El examen mide si eliges la opción **más barata que cumpla el requisito**.\n\n"
        "## Cómputo\n"
        "- **On-Demand**: sin compromiso, el más caro; cargas impredecibles.\n"
        "- **Savings Plans / Reserved**: compromiso **1-3 años** → **gran descuento**; cargas "
        "estables.\n"
        "- **Spot**: hasta **~90% más barato**, pero **interrumpible**; cargas tolerantes a fallos "
        "(lotes, CI, big data).\n"
        "- **Right-sizing**: ajusta familia/tamaño a lo que realmente necesitas.\n\n"
        "## Almacenamiento\n"
        "Elige la **clase de S3** correcta y usa **ciclos de vida**; **EBS HDD** para throughput "
        "barato; **Glacier** para archivado.\n\n"
        "## Redes (suelen olvidarse)\n"
        "- **NAT Gateway** cuesta: un NAT **compartido** es más barato que **uno por AZ** (a cambio "
        "de menos resiliencia).\n"
        "- La **transferencia de datos** entre **AZ** y entre **Regiones** se cobra: mantén el "
        "tráfico **local** cuando puedas.\n\n"
        "## Herramientas\n"
        "- **Cost Explorer** (analizar), **AWS Budgets** (**alertar** por umbral), **Cost and Usage "
        "Report**, **Trusted Advisor** (recomendaciones) y **etiquetas de asignación de costos**.\n\n"
        "> **En el examen:** *carga estable* → **Savings/Reserved**; *tolerante a fallos y barata* → "
        "**Spot**; *avisar de sobrecostos* → **Budgets**; *bajar costos de red* → tráfico local + 1 NAT.",
        [
            ("q_costos_1", "media",
             "¿Qué modelo de compra de EC2 da el mayor descuento a cambio de un compromiso de 1-3 años?",
             ["On-Demand", "Spot", "Savings Plans / Reserved", "Dedicated Host"], 2,
             "Los **Savings Plans / Reserved** dan el mayor descuento por compromiso."),
            ("q_costos_2", "media",
             "Una carga por lotes puede reanudarse si se interrumpe. ¿Qué opción es la más barata?",
             ["On-Demand", "Instancias Spot", "Reserved", "Dedicated"], 1,
             "Las **Spot** son las más baratas; ideales para cargas tolerantes a interrupciones."),
            ("q_costos_3", "facil", "¿Qué servicio te alerta cuando el gasto supera un umbral?",
             ["Cost Explorer", "AWS Budgets", "Trusted Advisor", "CloudTrail"], 1,
             "**AWS Budgets** alerta al superar un umbral de gasto."),
            ("q_costos_4", "dificil",
             "¿Cómo reduces los costos de transferencia de datos entre componentes?",
             ["Cifrando los datos", "Manteniendo el tráfico en la misma AZ/Región",
              "Usando más NAT Gateways", "Activando versionado en S3"], 1,
             "El tráfico entre AZ/Regiones se cobra; **mantenerlo local** reduce el costo."),
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
    slugs = [tema for tema, *_ in SYLLABUS]

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

    # Limpia material y preguntas de temas retirados (que ya no están en el temario).
    rm_m = db["materiales"].delete_many({"certificacion": CERT, "tema": {"$nin": slugs}}).deleted_count
    rm_q = db["preguntas"].delete_many({"certificacion": CERT, "tema": {"$nin": slugs}}).deleted_count
    if rm_m or rm_q:
        print(f"  limpieza de temas retirados: -{rm_m} materiales, -{rm_q} preguntas")
    print("Listo.")


if __name__ == "__main__":
    main()
