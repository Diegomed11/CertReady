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

import json
import os
from datetime import UTC, datetime
from pathlib import Path

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
            (
                "q_fundamentos_1",
                "facil",
                "¿Qué es una Zona de Disponibilidad (AZ)?",
                [
                    "Una Región completa",
                    "Uno o más centros de datos aislados dentro de una Región",
                    "Un tipo de instancia",
                    "Un servicio de DNS",
                ],
                1,
                "Una **AZ** es uno o más centros de datos aislados dentro de una Región.",
            ),
            (
                "q_fundamentos_2",
                "facil",
                "En el modelo de responsabilidad compartida, ¿quién protege los datos del cliente?",
                ["AWS", "El cliente", "Nadie", "El ISP"],
                1,
                "AWS protege la nube; el **cliente** protege lo que pone en ella, incluidos sus datos.",
            ),
            (
                "q_fundamentos_3",
                "media",
                "Para que una aplicación tolere la caída de un centro de datos, ¿cómo se despliega?",
                [
                    "En una sola AZ",
                    "En varias AZ de la Región",
                    "En la cuenta raíz",
                    "En una instancia grande",
                ],
                1,
                "Distribuir en **varias AZ** elimina el punto único de fallo.",
            ),
            (
                "q_fundamentos_4",
                "media",
                "¿Qué acerca contenido a los usuarios para reducir latencia global?",
                [
                    "Una segunda VPC",
                    "Las Edge Locations / CloudFront",
                    "Un NAT Gateway",
                    "Multi-AZ",
                ],
                1,
                "Las **Edge Locations** (CloudFront) sirven contenido cacheado cerca del usuario.",
            ),
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
            (
                "q_iam_1",
                "facil",
                "¿Qué se debe usar para dar permisos a una instancia EC2 sin incrustar claves?",
                [
                    "Un usuario con clave de acceso",
                    "Un rol IAM",
                    "La cuenta raíz",
                    "Una contraseña",
                ],
                1,
                "Un **rol IAM** otorga credenciales temporales (vía STS) a la instancia.",
            ),
            (
                "q_iam_2",
                "media",
                "Una cuenta necesita acceder a recursos de otra cuenta de la misma empresa. ¿Qué usas?",
                [
                    "Compartir la contraseña raíz",
                    "Un rol entre cuentas asumido con STS",
                    "Hacer públicos los recursos",
                    "Una VPN",
                ],
                1,
                "Se define un **rol cross-account** que la otra cuenta **asume con STS**.",
            ),
            (
                "q_iam_3",
                "dificil",
                "¿Cómo impones un permiso máximo a TODAS las cuentas de una organización?",
                [
                    "Una política de usuario",
                    "Una Service Control Policy (SCP) en Organizations",
                    "Un Security Group",
                    "Un rol",
                ],
                1,
                "Las **SCP** de Organizations fijan el techo de permisos de las cuentas (no otorgan).",
            ),
            (
                "q_iam_4",
                "media",
                "¿Qué servicio da inicio de sesión único federando tu directorio corporativo?",
                ["IAM Identity Center", "KMS", "CloudTrail", "Route 53"],
                0,
                "**IAM Identity Center** (ex-SSO) federa el directorio con roles para SSO.",
            ),
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
            (
                "q_redes_vpc_1",
                "media",
                "¿Qué firewall es con estado y opera a nivel de instancia?",
                ["Network ACL", "Security Group", "Route Table", "Internet Gateway"],
                1,
                "Los **Security Groups** son con estado y por instancia.",
            ),
            (
                "q_redes_vpc_2",
                "media",
                "Una app web sufre intentos de inyección SQL. ¿Qué servicio los filtra?",
                ["Shield", "AWS WAF", "KMS", "NAT Gateway"],
                1,
                "**WAF** filtra a nivel de capa 7 (SQL injection, XSS) delante de ALB/CloudFront.",
            ),
            (
                "q_redes_vpc_3",
                "media",
                "Necesitas descubrir datos personales (PII) almacenados en S3. ¿Qué usas?",
                ["GuardDuty", "Macie", "Cognito", "Inspector"],
                1,
                "**Macie** descubre y clasifica datos sensibles (PII) en S3.",
            ),
            (
                "q_redes_vpc_4",
                "facil",
                "Para un enlace privado y dedicado entre tu centro de datos y AWS, ¿qué eliges?",
                [
                    "VPN por internet",
                    "Direct Connect",
                    "Internet Gateway",
                    "PrivateLink",
                ],
                1,
                "**Direct Connect** es un enlace privado y dedicado (más estable que una VPN).",
            ),
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
            (
                "q_seguridad_datos_1",
                "facil",
                "¿Qué servicio administra las llaves de cifrado en reposo?",
                ["IAM", "KMS", "Route 53", "Macie"],
                1,
                "**KMS** administra las llaves de cifrado.",
            ),
            (
                "q_seguridad_datos_2",
                "media",
                "¿Qué servicio emite y renueva certificados TLS para HTTPS?",
                ["ACM", "Secrets Manager", "Shield", "EFS"],
                0,
                "**ACM** emite/renueva certificados TLS.",
            ),
            (
                "q_seguridad_datos_3",
                "media",
                "Un requisito exige un módulo de hardware dedicado para las claves (FIPS 140-2 nivel 3). ¿Qué usas?",
                ["KMS multi-tenant", "CloudHSM", "Secrets Manager", "ACM"],
                1,
                "**CloudHSM** ofrece un módulo de hardware dedicado para cumplimiento estricto.",
            ),
            (
                "q_seguridad_datos_4",
                "facil",
                '¿Qué significa cifrar "en tránsito"?',
                [
                    "Proteger los datos en disco",
                    "Proteger los datos mientras viajan por la red (TLS)",
                    "Comprimir los datos",
                    "Borrar los datos",
                ],
                1,
                "Cifrar **en tránsito** protege los datos mientras viajan por la red (TLS).",
            ),
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
            (
                "q_desacoplamiento_1",
                "media",
                "¿Qué servicio desacopla productor y consumidor absorbiendo picos de carga?",
                ["SNS", "SQS", "API Gateway", "Route 53"],
                1,
                "**SQS** es una cola que absorbe picos.",
            ),
            (
                "q_desacoplamiento_2",
                "media",
                "Quieres que un evento llegue a varios suscriptores a la vez. ¿Qué usas?",
                ["SQS", "SNS", "EBS", "KMS"],
                1,
                "**SNS** sigue el patrón publicar/suscribir (fan-out).",
            ),
            (
                "q_desacoplamiento_3",
                "media",
                "Quieres correr contenedores sin administrar instancias EC2. ¿Qué eliges?",
                ["EC2 con Docker", "AWS Fargate", "Lambda", "EMR"],
                1,
                "**Fargate** ejecuta contenedores de forma serverless (ECS/EKS sin gestionar EC2).",
            ),
            (
                "q_desacoplamiento_4",
                "dificil",
                "Para que una app web escale horizontalmente sin problemas, ¿dónde guardas la sesión?",
                [
                    "En el disco de cada instancia",
                    "En DynamoDB o ElastiCache (stateless)",
                    "En la cuenta raíz",
                    "En el Security Group",
                ],
                1,
                "Una app **stateless** guarda el estado fuera de la instancia (DynamoDB/ElastiCache).",
            ),
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
            (
                "q_alta_disponibilidad_1",
                "dificil",
                "¿Qué da failover automático de la base de datos con réplica síncrona en otra AZ?",
                ["Read Replica", "RDS Multi-AZ", "Backups", "Aurora Serverless"],
                1,
                "**RDS Multi-AZ** mantiene una réplica síncrona para failover automático.",
            ),
            (
                "q_alta_disponibilidad_2",
                "media",
                "¿Qué servicio puede enrutar a una región sana mediante DNS y health checks?",
                ["CloudFront", "Route 53", "SQS", "KMS"],
                1,
                "**Route 53** ofrece enrutamiento por failover con health checks.",
            ),
            (
                "q_alta_disponibilidad_3",
                "media",
                "Necesitas trazar el recorrido de una petición a través de varios microservicios. ¿Qué usas?",
                ["CloudTrail", "AWS X-Ray", "Config", "Macie"],
                1,
                "**X-Ray** traza peticiones distribuidas para hallar cuellos de botella.",
            ),
            (
                "q_alta_disponibilidad_4",
                "dificil",
                "¿Qué estrategia de DR ofrece el menor RTO (recuperación casi inmediata)?",
                [
                    "Backup & restore",
                    "Pilot light",
                    "Warm standby",
                    "Multi-site activo-activo",
                ],
                3,
                "**Multi-site activo-activo** recupera casi al instante (y es la más cara).",
            ),
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
            (
                "q_computo_1",
                "media",
                "Una aplicación analítica consume mucha memoria. ¿Qué eliges?",
                [
                    "Una familia de instancia memoria-optimizada",
                    "Lambda",
                    "Una NACL",
                    "Glacier",
                ],
                0,
                "Eliges la **familia** de instancia adecuada (memoria-optimizada) a la carga.",
            ),
            (
                "q_computo_2",
                "facil",
                "¿Qué servicio es ideal para cargas event-driven con pago por uso?",
                ["EC2 On-Demand", "AWS Lambda", "EMR", "Batch"],
                1,
                "**Lambda** ejecuta código por evento, sin servidores y pagando por uso.",
            ),
            (
                "q_computo_3",
                "media",
                "Para procesar big data con Spark/Hadoop, ¿qué servicio usas?",
                ["Amazon EMR", "API Gateway", "Route 53", "ACM"],
                0,
                "**EMR** ejecuta frameworks de big data como Spark y Hadoop.",
            ),
            (
                "q_computo_4",
                "media",
                "Necesitas un balanceador de capa 4 (TCP) con latencia mínima y altísimo rendimiento. ¿Cuál?",
                ["ALB", "NLB", "CloudFront", "NAT Gateway"],
                1,
                "El **NLB** opera en capa 4 (TCP/UDP) con rendimiento y latencia óptimos.",
            ),
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
            (
                "q_almacenamiento_1",
                "media",
                "Una base de datos en EC2 necesita un disco con muchas IOPS. ¿Qué eliges?",
                ["EBS HDD (st1)", "EBS SSD (io2/gp3)", "S3 Glacier", "EFS"],
                1,
                "Para muchas **IOPS** se usa **EBS SSD** (io2/gp3).",
            ),
            (
                "q_almacenamiento_2",
                "media",
                "Varias instancias EC2 (Linux) en distintas AZ deben compartir los mismos archivos. ¿Qué usas?",
                ["EBS", "EFS", "S3 Glacier", "Instance Store"],
                1,
                "**EFS** es un sistema de archivos compartido por muchas instancias en varias AZ.",
            ),
            (
                "q_almacenamiento_3",
                "facil",
                "¿Qué clase de S3 conviene para archivado de acceso muy infrecuente?",
                ["S3 Standard", "S3 Standard-IA", "S3 Glacier", "S3 Express"],
                2,
                "**Glacier** es la opción más barata para archivado.",
            ),
            (
                "q_almacenamiento_4",
                "facil",
                "¿Qué tipo de almacenamiento es S3?",
                ["Bloque", "Archivo", "Objeto", "En memoria"],
                2,
                "**S3** es almacenamiento de **objetos** (11 nueves de durabilidad).",
            ),
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
            (
                "q_bases_datos_1",
                "media",
                "La base de datos recibe demasiadas lecturas. ¿Qué añades para escalarlas?",
                ["Multi-AZ", "Read Replicas", "Un NAT Gateway", "CloudTrail"],
                1,
                "Las **read replicas** distribuyen y escalan la carga de lectura.",
            ),
            (
                "q_bases_datos_2",
                "media",
                "¿Qué servicio es una base NoSQL serverless de baja latencia?",
                ["RDS", "DynamoDB", "EMR", "Redshift"],
                1,
                "**DynamoDB** es NoSQL serverless.",
            ),
            (
                "q_bases_datos_3",
                "media",
                "Quieres acelerar las lecturas repetidas y descargar la base de datos. ¿Qué usas?",
                ["ElastiCache", "S3", "KMS", "SNS"],
                0,
                "**ElastiCache** (Redis/Memcached) cachea en memoria y descarga la BD.",
            ),
            (
                "q_bases_datos_4",
                "dificil",
                "Miles de funciones Lambda abren conexiones a RDS y la saturan. ¿Qué lo soluciona?",
                ["RDS Proxy", "Otra read replica", "Un Security Group", "DynamoDB"],
                0,
                "**RDS Proxy** agrupa (pool) las conexiones, ideal con Lambda.",
            ),
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
            (
                "q_redes_rendimiento_1",
                "facil",
                "¿Qué acerca contenido estático a usuarios globales cacheándolo en el borde?",
                ["Route 53", "CloudFront", "NAT Gateway", "VPC peering"],
                1,
                "**CloudFront** (CDN) cachea contenido cerca del usuario y descarga el origen.",
            ),
            (
                "q_redes_rendimiento_2",
                "dificil",
                "Una aplicación TCP/UDP global necesita menor latencia usando la red de AWS. ¿Qué usas?",
                ["CloudFront", "Global Accelerator", "Internet Gateway", "WAF"],
                1,
                "**Global Accelerator** mejora apps no-HTTP enrutando por la troncal de AWS (anycast).",
            ),
            (
                "q_redes_rendimiento_3",
                "media",
                "Quieres acceder a un servicio de forma privada sin pasar por internet. ¿Qué usas?",
                [
                    "Internet Gateway",
                    "AWS PrivateLink",
                    "NAT Gateway",
                    "Direct Connect",
                ],
                1,
                "**PrivateLink** da acceso privado a servicios sin exponerlos a internet.",
            ),
            (
                "q_redes_rendimiento_4",
                "media",
                "Tienes decenas de VPCs y on-premises que conectar como un hub central. ¿Qué eliges?",
                [
                    "VPC peering uno a uno",
                    "Transit Gateway",
                    "Un NAT por VPC",
                    "CloudFront",
                ],
                1,
                "**Transit Gateway** conecta muchas VPCs y redes on-premises como un hub.",
            ),
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
            (
                "q_datos_1",
                "media",
                "¿Qué servicio ingiere y procesa datos en streaming en tiempo real?",
                ["Amazon Kinesis", "Athena", "Glue", "DataSync"],
                0,
                "**Kinesis** maneja datos en streaming en tiempo real.",
            ),
            (
                "q_datos_2",
                "media",
                "Quieres consultar con SQL datos que ya están en S3, sin montar servidores. ¿Qué usas?",
                ["Amazon Athena", "EMR", "RDS", "Redshift en EC2"],
                0,
                "**Athena** consulta datos en S3 con SQL, de forma serverless.",
            ),
            (
                "q_datos_3",
                "media",
                "Necesitas un proceso ETL serverless con catálogo de datos. ¿Cuál?",
                ["AWS Glue", "Kinesis", "Cognito", "Macie"],
                0,
                "**Glue** es ETL serverless con catálogo.",
            ),
            (
                "q_datos_4",
                "media",
                "Debes migrar varios TB de archivos desde tu centro de datos a AWS. ¿Qué servicio?",
                ["DataSync", "CloudFront", "Step Functions", "Athena"],
                0,
                "**DataSync** transfiere grandes volúmenes de archivos on-premises ↔ AWS.",
            ),
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
            (
                "q_costos_1",
                "media",
                "¿Qué modelo de compra de EC2 da el mayor descuento a cambio de un compromiso de 1-3 años?",
                ["On-Demand", "Spot", "Savings Plans / Reserved", "Dedicated Host"],
                2,
                "Los **Savings Plans / Reserved** dan el mayor descuento por compromiso.",
            ),
            (
                "q_costos_2",
                "media",
                "Una carga por lotes puede reanudarse si se interrumpe. ¿Qué opción es la más barata?",
                ["On-Demand", "Instancias Spot", "Reserved", "Dedicated"],
                1,
                "Las **Spot** son las más baratas; ideales para cargas tolerantes a interrupciones.",
            ),
            (
                "q_costos_3",
                "facil",
                "¿Qué servicio te alerta cuando el gasto supera un umbral?",
                ["Cost Explorer", "AWS Budgets", "Trusted Advisor", "CloudTrail"],
                1,
                "**AWS Budgets** alerta al superar un umbral de gasto.",
            ),
            (
                "q_costos_4",
                "dificil",
                "¿Cómo reduces los costos de transferencia de datos entre componentes?",
                [
                    "Cifrando los datos",
                    "Manteniendo el tráfico en la misma AZ/Región",
                    "Usando más NAT Gateways",
                    "Activando versionado en S3",
                ],
                1,
                "El tráfico entre AZ/Regiones se cobra; **mantenerlo local** reduce el costo.",
            ),
        ],
    ),
]

LETRAS = ["a", "b", "c", "d", "e"]

# Preguntas adicionales para un simulacro completo (incluye respuesta múltiple).
# (tema, id, tipo, dificultad, enunciado, [opciones], [índices correctos], explicación).
EXTRA = [
    (
        "fundamentos",
        "q_fundamentos_5",
        "opcion_multiple",
        "media",
        "¿Qué servicio agrupa y factura varias cuentas de AWS de forma centralizada?",
        ["AWS Organizations", "Una VPC", "Una Región", "Un grupo de IAM"],
        [0],
        "**AWS Organizations** agrupa cuentas y centraliza facturación y gobierno.",
    ),
    (
        "fundamentos",
        "q_fundamentos_6",
        "respuesta_multiple",
        "dificil",
        "¿Cuáles son pilares del Well-Architected Framework? (elige 2)",
        [
            "Seguridad",
            "Optimización de costos",
            "Velocidad de internet",
            "Marketing",
            "Color de marca",
        ],
        [0, 1],
        "Dos de los 6 pilares son **seguridad** y **optimización de costos**.",
    ),
    (
        "iam",
        "q_iam_5",
        "opcion_multiple",
        "media",
        "Para impedir que cualquier cuenta de la organización use una Región concreta, ¿qué usas?",
        ["Una SCP en Organizations", "Un Security Group", "Una NACL", "MFA"],
        [0],
        "Una **SCP** fija el techo de permisos de toda la organización.",
    ),
    (
        "iam",
        "q_iam_6",
        "respuesta_multiple",
        "dificil",
        "¿Qué prácticas mejoran la seguridad de la cuenta? (elige 2)",
        [
            "Activar MFA",
            "Usar la cuenta raíz a diario",
            "Aplicar mínimo privilegio",
            "Compartir claves de acceso",
            "Desactivar CloudTrail",
        ],
        [0, 2],
        "**MFA** y **mínimo privilegio** refuerzan la seguridad; lo demás la debilita.",
    ),
    (
        "redes-vpc",
        "q_redes_vpc_5",
        "opcion_multiple",
        "media",
        "¿Qué permite que instancias en subred privada salgan a internet sin ser accesibles desde fuera?",
        ["Internet Gateway", "NAT Gateway", "VPC peering", "WAF"],
        [1],
        "El **NAT Gateway** da salida a internet a subredes privadas (no entrada).",
    ),
    (
        "redes-vpc",
        "q_redes_vpc_6",
        "respuesta_multiple",
        "dificil",
        "¿Qué servicios ayudan a proteger una aplicación web pública? (elige 2)",
        ["AWS WAF", "AWS Shield", "Amazon EFS", "Amazon EMR", "Amazon Athena"],
        [0, 1],
        "**WAF** (capa 7) y **Shield** (DDoS) protegen apps web públicas.",
    ),
    (
        "seguridad-datos",
        "q_seguridad_datos_5",
        "opcion_multiple",
        "media",
        "¿Qué servicio cifra/descifra objetos de S3 con una llave gestionada y auditada?",
        ["KMS", "Cognito", "Route 53", "Glue"],
        [0],
        "**KMS** gestiona las llaves de cifrado e integra con S3.",
    ),
    (
        "seguridad-datos",
        "q_seguridad_datos_6",
        "respuesta_multiple",
        "dificil",
        "¿Qué cubre la protección de datos en una arquitectura? (elige 2)",
        [
            "Cifrado en reposo",
            "Cifrado en tránsito",
            "Aumentar la latencia",
            "Borrar los logs",
            "Deshabilitar backups",
        ],
        [0, 1],
        "Proteger datos = cifrado **en reposo** y **en tránsito** (entre otros).",
    ),
    (
        "desacoplamiento",
        "q_desacoplamiento_5",
        "opcion_multiple",
        "media",
        "Una API serverless necesita un punto de entrada gestionado con autenticación y límites de tasa. ¿Qué usas?",
        ["API Gateway", "NAT Gateway", "EFS", "KMS"],
        [0],
        "**API Gateway** gestiona las APIs (auth, throttling) frente a Lambda.",
    ),
    (
        "desacoplamiento",
        "q_desacoplamiento_6",
        "respuesta_multiple",
        "dificil",
        "¿Qué opciones permiten ejecutar contenedores en AWS? (elige 2)",
        ["Amazon ECS", "Amazon EKS", "Amazon S3", "Amazon Route 53", "AWS KMS"],
        [0, 1],
        "**ECS** y **EKS** orquestan contenedores (Fargate los ejecuta sin servidores).",
    ),
    (
        "alta-disponibilidad",
        "q_alta_disponibilidad_5",
        "opcion_multiple",
        "media",
        "¿Qué métrica define cuántos datos puedes permitirte perder en un desastre?",
        ["RPO", "RTO", "IOPS", "TPS"],
        [0],
        "El **RPO** (Recovery Point Objective) define la pérdida de datos aceptable.",
    ),
    (
        "alta-disponibilidad",
        "q_alta_disponibilidad_6",
        "respuesta_multiple",
        "dificil",
        "¿Qué elementos mejoran la alta disponibilidad? (elige 2)",
        [
            "Despliegue multi-AZ",
            "Auto Scaling",
            "Una sola instancia grande",
            "Cuenta raíz compartida",
            "Desactivar los health checks",
        ],
        [0, 1],
        "**Multi-AZ** y **Auto Scaling** eliminan puntos únicos de fallo.",
    ),
    (
        "computo",
        "q_computo_5",
        "opcion_multiple",
        "media",
        "¿Qué servicio ejecuta contenedores sin que administres instancias EC2?",
        ["AWS Fargate", "Amazon EMR", "Amazon Athena", "AWS Glue"],
        [0],
        "**Fargate** ejecuta contenedores de forma serverless.",
    ),
    (
        "computo",
        "q_computo_6",
        "respuesta_multiple",
        "dificil",
        "¿Qué opciones de cómputo son serverless? (elige 2)",
        [
            "AWS Lambda",
            "AWS Fargate",
            "Amazon EC2 dedicada",
            "Amazon EBS",
            "Amazon VPC",
        ],
        [0, 1],
        "**Lambda** y **Fargate** son cómputo serverless.",
    ),
    (
        "almacenamiento",
        "q_almacenamiento_5",
        "opcion_multiple",
        "media",
        "Para throughput secuencial barato (logs, big data), ¿qué tipo de volumen EBS eliges?",
        ["SSD io2", "HDD st1", "SSD gp3", "Instance Store"],
        [1],
        "Los volúmenes **HDD (st1)** dan throughput secuencial barato.",
    ),
    (
        "almacenamiento",
        "q_almacenamiento_6",
        "respuesta_multiple",
        "dificil",
        "¿Qué afirmaciones sobre Amazon S3 son correctas? (elige 2)",
        [
            "Almacena objetos",
            "Ofrece 11 nueves de durabilidad",
            "Es un disco para una sola instancia",
            "Solo permite acceso por SSH",
            "Requiere una instancia EC2",
        ],
        [0, 1],
        "S3 almacena **objetos** con **11 nueves** de durabilidad.",
    ),
    (
        "bases-datos",
        "q_bases_datos_5",
        "opcion_multiple",
        "media",
        "¿Qué servicio agrupa conexiones a RDS, útil con muchas funciones Lambda?",
        ["RDS Proxy", "DynamoDB", "ElastiCache", "EFS"],
        [0],
        "**RDS Proxy** hace pooling de conexiones, ideal con Lambda.",
    ),
    (
        "bases-datos",
        "q_bases_datos_6",
        "respuesta_multiple",
        "dificil",
        "¿Qué opciones escalan o aceleran las lecturas de una base de datos? (elige 2)",
        [
            "Read replicas",
            "ElastiCache",
            "Multi-AZ síncrono",
            "Un NAT Gateway",
            "Apagar la base",
        ],
        [0, 1],
        "**Read replicas** escalan lecturas y **ElastiCache** las acelera con caché.",
    ),
    (
        "redes-rendimiento",
        "q_redes_rendimiento_5",
        "opcion_multiple",
        "media",
        "¿Qué servicio mejora la latencia global de apps TCP/UDP usando la red troncal de AWS?",
        ["AWS Global Accelerator", "CloudTrail", "Amazon EFS", "Amazon Athena"],
        [0],
        "**Global Accelerator** mejora apps no-HTTP por la red troncal (anycast).",
    ),
    (
        "redes-rendimiento",
        "q_redes_rendimiento_6",
        "respuesta_multiple",
        "dificil",
        "¿Qué servicios acercan o aceleran la entrega de contenido/tráfico? (elige 2)",
        [
            "Amazon CloudFront",
            "AWS Global Accelerator",
            "Amazon SQS",
            "AWS KMS",
            "Amazon Macie",
        ],
        [0, 1],
        "**CloudFront** (CDN) y **Global Accelerator** mejoran la entrega/latencia.",
    ),
    (
        "datos",
        "q_datos_5",
        "opcion_multiple",
        "media",
        "¿Qué servicio construye y gobierna lagos de datos sobre S3?",
        ["AWS Lake Formation", "Amazon Cognito", "AWS Shield", "Amazon Route 53"],
        [0],
        "**Lake Formation** construye y gobierna lagos de datos sobre S3.",
    ),
    (
        "datos",
        "q_datos_6",
        "respuesta_multiple",
        "dificil",
        "¿Qué servicios sirven para analizar o transformar datos? (elige 2)",
        ["Amazon Athena", "AWS Glue", "Amazon SQS", "AWS WAF", "Amazon Cognito"],
        [0, 1],
        "**Athena** consulta S3 con SQL y **Glue** hace ETL serverless.",
    ),
    (
        "costos",
        "q_costos_5",
        "opcion_multiple",
        "media",
        "¿Qué herramienta visualiza y analiza el gasto histórico de AWS?",
        ["Cost Explorer", "AWS Budgets", "GuardDuty", "X-Ray"],
        [0],
        "**Cost Explorer** visualiza y analiza el gasto histórico.",
    ),
    (
        "costos",
        "q_costos_6",
        "respuesta_multiple",
        "dificil",
        "¿Qué decisiones reducen costos en una arquitectura? (elige 2)",
        [
            "Usar Spot para cargas tolerantes a fallos",
            "Aplicar ciclos de vida en S3",
            "Crear más NAT Gateways de los necesarios",
            "Transferir datos entre regiones sin necesidad",
            "Sobredimensionar las instancias",
        ],
        [0, 1],
        "**Spot** (cargas tolerantes) y **ciclos de vida en S3** reducen costos.",
    ),
]


# Segundo lote: más preguntas en los dominios con pocas (Costos, Resiliencia) para
# que el examen ponderado rote (no salgan siempre las mismas).
EXTRA2 = [
    # --- Costos (Dominio 4) ---
    (
        "costos",
        "q_costos_7",
        "opcion_multiple",
        "media",
        "¿Qué tipo de volumen EBS es el más barato para datos a los que casi no accedes?",
        ["gp3 (SSD)", "io2 (SSD)", "sc1 (Cold HDD)", "Instance Store"],
        [2],
        "**sc1 (Cold HDD)** es el de menor costo para acceso muy infrecuente.",
    ),
    (
        "costos",
        "q_costos_8",
        "opcion_multiple",
        "media",
        "Para reducir el costo de transferencia saliente al servir imágenes a usuarios globales, ¿qué usas?",
        ["CloudFront", "NAT Gateway", "Direct Connect", "EBS"],
        [0],
        "**CloudFront** cachea en el borde y reduce el egreso desde el origen.",
    ),
    (
        "costos",
        "q_costos_9",
        "opcion_multiple",
        "media",
        "¿Qué clase de S3 mueve objetos entre niveles automáticamente según el acceso, sin penalización?",
        ["S3 Intelligent-Tiering", "S3 Standard", "S3 One Zone-IA", "S3 Glacier"],
        [0],
        "**S3 Intelligent-Tiering** optimiza el costo moviendo objetos entre niveles solo.",
    ),
    (
        "costos",
        "q_costos_10",
        "opcion_multiple",
        "media",
        "Para una base de datos con tráfico impredecible, ¿qué evita pagar capacidad fija?",
        [
            "Aurora Serverless o DynamoDB on-demand",
            "RDS reservada",
            "EC2 dedicada",
            "Redshift fijo",
        ],
        [0],
        "Las opciones **serverless / on-demand** cobran por uso, ideales para tráfico variable.",
    ),
    (
        "costos",
        "q_costos_11",
        "opcion_multiple",
        "dificil",
        "Si la resiliencia no es crítica, ¿qué reduce el costo de NAT en una VPC con varias AZ?",
        [
            "Un único NAT Gateway compartido",
            "Un NAT Gateway por subred",
            "Un IGW por AZ",
            "Más VPNs",
        ],
        [0],
        "Un **NAT compartido** es más barato que uno por AZ (a cambio de menos resiliencia).",
    ),
    (
        "costos",
        "q_costos_12",
        "opcion_multiple",
        "media",
        "¿Qué herramienta entrega el reporte más detallado y desglosado de costo y uso?",
        ["Cost and Usage Report (CUR)", "GuardDuty", "X-Ray", "AWS Config"],
        [0],
        "El **CUR** es el informe de costo y uso más granular.",
    ),
    (
        "costos",
        "q_costos_13",
        "opcion_multiple",
        "facil",
        "¿Qué ayuda a atribuir costos por proyecto, equipo o entorno?",
        [
            "Etiquetas de asignación de costos",
            "Security Groups",
            "NACLs",
            "Llaves de KMS",
        ],
        [0],
        "Las **etiquetas de asignación de costos** permiten desglosar el gasto.",
    ),
    (
        "costos",
        "q_costos_14",
        "opcion_multiple",
        "media",
        "Para cómputo estable 24/7 durante un año, la opción más rentable es:",
        ["Spot", "On-Demand", "Savings Plans / Reserved", "Dedicated Host"],
        [2],
        "Para carga estable, **Savings Plans / Reserved** dan el mayor ahorro.",
    ),
    (
        "costos",
        "q_costos_15",
        "opcion_multiple",
        "media",
        "Para archivar logs que casi nunca se consultan, al menor costo, ¿qué usas?",
        ["S3 Glacier Deep Archive", "S3 Standard", "EBS gp3", "EFS"],
        [0],
        "**Glacier Deep Archive** es la opción más barata para archivado profundo.",
    ),
    (
        "costos",
        "q_costos_16",
        "respuesta_multiple",
        "dificil",
        "¿Qué prácticas reducen los costos de cómputo? (elige 2)",
        [
            "Apagar recursos sin uso",
            "Hacer right-sizing de instancias",
            "Sobredimensionar por si acaso",
            "Usar siempre On-Demand",
            "Duplicar todo en otra Región",
        ],
        [0, 1],
        "**Apagar lo ocioso** y **ajustar el tamaño** (right-sizing) reducen el gasto.",
    ),
    (
        "costos",
        "q_costos_17",
        "opcion_multiple",
        "media",
        "Mantener el tráfico entre servicios dentro de la misma AZ (en vez de entre AZ) principalmente:",
        [
            "Reduce los costos de transferencia",
            "Aumenta la latencia",
            "Mejora el cifrado",
            "No tiene ningún efecto",
        ],
        [0],
        "La transferencia entre AZ se cobra; mantenerla **local** ahorra.",
    ),
    (
        "costos",
        "q_costos_18",
        "opcion_multiple",
        "media",
        "Para migrar petabytes a AWS con poco ancho de banda de red, ¿qué es más rentable?",
        ["AWS Snowball", "CloudFront", "Route 53", "Internet Gateway"],
        [0],
        "**Snowball** transfiere grandes volúmenes físicamente, sin saturar la red.",
    ),
    # --- Resiliencia: desacoplamiento (Dominio 2) ---
    (
        "desacoplamiento",
        "q_desacoplamiento_7",
        "opcion_multiple",
        "dificil",
        "Para procesar mensajes en orden y exactamente una vez, ¿qué tipo de cola SQS usas?",
        ["SQS FIFO", "SQS estándar", "SNS", "Una llamada síncrona"],
        [0],
        "**SQS FIFO** garantiza orden y entrega exactamente una vez.",
    ),
    (
        "desacoplamiento",
        "q_desacoplamiento_8",
        "opcion_multiple",
        "media",
        "¿Qué servicio enruta eventos entre servicios mediante reglas (bus de eventos)?",
        ["Amazon EventBridge", "Amazon EBS", "Amazon EFS", "AWS KMS"],
        [0],
        "**EventBridge** es un bus de eventos que enruta por reglas.",
    ),
    (
        "desacoplamiento",
        "q_desacoplamiento_9",
        "opcion_multiple",
        "facil",
        "Un consumidor lento no debe perder mensajes en los picos. ¿Qué patrón aplicas?",
        [
            "Una cola SQS entre productor y consumidor",
            "Llamada síncrona directa",
            "Subir el tamaño de la instancia",
            "Quitar el balanceador",
        ],
        [0],
        "Una **cola** absorbe los picos y desacopla al consumidor.",
    ),
    (
        "desacoplamiento",
        "q_desacoplamiento_10",
        "opcion_multiple",
        "media",
        "¿Qué servicio orquesta una serie de pasos con reintentos y manejo de errores?",
        ["AWS Step Functions", "Amazon SQS", "NAT Gateway", "ACM"],
        [0],
        "**Step Functions** orquesta flujos con reintentos y ramas.",
    ),
    (
        "desacoplamiento",
        "q_desacoplamiento_11",
        "respuesta_multiple",
        "dificil",
        "¿Qué hace que una aplicación escale mejor de forma horizontal? (elige 2)",
        [
            "Ser stateless",
            "Guardar la sesión en DynamoDB/ElastiCache",
            "Guardar el estado en el disco local",
            "Usar una sola instancia",
            "Forzar sesiones pegajosas siempre",
        ],
        [0, 1],
        "Una app **stateless** con el estado **fuera** de la instancia escala mejor.",
    ),
    (
        "desacoplamiento",
        "q_desacoplamiento_12",
        "opcion_multiple",
        "facil",
        "¿Qué expone una API REST gestionada (auth, throttling) delante de Lambda?",
        ["Amazon API Gateway", "Amazon CloudFront", "Amazon Route 53", "Amazon EFS"],
        [0],
        "**API Gateway** gestiona las APIs frente a Lambda.",
    ),
    # --- Resiliencia: alta disponibilidad (Dominio 2) ---
    (
        "alta-disponibilidad",
        "q_alta_disponibilidad_7",
        "opcion_multiple",
        "facil",
        "Para repartir tráfico entre instancias de varias AZ y excluir las no sanas, ¿qué usas?",
        [
            "Un Elastic Load Balancer con health checks",
            "Un NAT Gateway",
            "KMS",
            "Athena",
        ],
        [0],
        "Un **ELB** con health checks reparte solo a instancias sanas.",
    ),
    (
        "alta-disponibilidad",
        "q_alta_disponibilidad_8",
        "opcion_multiple",
        "dificil",
        "¿Qué estrategia de DR mantiene una copia reducida siempre encendida y la escala al fallar?",
        ["Warm standby", "Backup & restore", "Pilot light", "Multi-site activo-activo"],
        [0],
        "**Warm standby** mantiene una versión reducida lista para escalar.",
    ),
    (
        "alta-disponibilidad",
        "q_alta_disponibilidad_9",
        "opcion_multiple",
        "media",
        "¿Qué política de enrutamiento de Route 53 envía al usuario a la Región de menor latencia?",
        ["Latency-based", "Failover", "Ponderada (weighted)", "Simple"],
        [0],
        "El enrutamiento **basado en latencia** elige la Región más rápida para el usuario.",
    ),
    (
        "alta-disponibilidad",
        "q_alta_disponibilidad_10",
        "opcion_multiple",
        "media",
        "¿Qué mejora la fiabilidad evitando configurar servidores a mano tras un fallo?",
        [
            "Infraestructura inmutable (reemplazar, no parchear)",
            "Acceso por SSH manual",
            "Editar en producción",
            "Desplegar en una sola AZ",
        ],
        [0],
        "La **infraestructura inmutable** reemplaza recursos en vez de modificarlos a mano.",
    ),
    (
        "alta-disponibilidad",
        "q_alta_disponibilidad_11",
        "respuesta_multiple",
        "media",
        "¿Qué dos métricas definen una estrategia de recuperación ante desastres? (elige 2)",
        ["RTO", "RPO", "IOPS", "QPS", "TLS"],
        [0, 1],
        "**RTO** (tiempo de recuperación) y **RPO** (pérdida de datos) definen el DR.",
    ),
    (
        "alta-disponibilidad",
        "q_alta_disponibilidad_12",
        "opcion_multiple",
        "dificil",
        "Para que los objetos de S3 sobrevivan a la caída de una Región, ¿qué activas?",
        [
            "Replicación entre Regiones (CRR)",
            "Solo versionado local",
            "Una sola AZ",
            "Acceso público",
        ],
        [0],
        "La **replicación entre Regiones (CRR)** copia los objetos a otra Región.",
    ),
    # --- Seguridad (Dominio 1): refuerzo ---
    (
        "fundamentos",
        "q_fundamentos_7",
        "opcion_multiple",
        "media",
        "En el modelo de responsabilidad compartida, ¿qué es responsabilidad del CLIENTE?",
        [
            "La seguridad física de los data centers",
            "Configurar los permisos IAM y el cifrado",
            "El mantenimiento del hardware",
            "La capa de virtualización",
        ],
        [1],
        "El **cliente** configura IAM, cifrado y su software; AWS protege la infraestructura.",
    ),
    (
        "iam",
        "q_iam_7",
        "opcion_multiple",
        "media",
        "¿Qué adjuntas a un recurso (p. ej. un bucket S3) para definir quién puede accederlo?",
        [
            "Una política de recurso (resource policy)",
            "Un Security Group",
            "Una NACL",
            "Un rol de instancia",
        ],
        [0],
        "Las **políticas de recurso** se adjuntan al recurso y definen el acceso.",
    ),
    (
        "redes-vpc",
        "q_redes_vpc_7",
        "opcion_multiple",
        "media",
        "¿Qué servicio autentica y gestiona a los usuarios finales de tu app web/móvil?",
        ["Amazon Cognito", "Usuarios de IAM", "AWS KMS", "Amazon Macie"],
        [0],
        "**Cognito** gestiona la autenticación de los usuarios de la aplicación.",
    ),
    (
        "seguridad-datos",
        "q_seguridad_datos_7",
        "opcion_multiple",
        "facil",
        "¿Qué debes hacer periódicamente con las llaves de cifrado y los certificados?",
        ["Rotarlos / renovarlos", "Publicarlos", "Borrarlos", "Enviarlos por correo"],
        [0],
        "Las llaves se **rotan** y los certificados se **renovan** periódicamente.",
    ),
]


def pregunta_ex(item: tuple) -> dict:
    tema, _id, tipo, dif, enun, opts, correctos, expl = item
    opciones = [{"id": LETRAS[i], "texto": t} for i, t in enumerate(opts)]
    return {
        "_id": _id,
        "certificacion": CERT,
        "tema": tema,
        "dificultad": dif,
        "tipo": tipo,
        "enunciado": enun,
        "opciones": opciones,
        "respuesta_correcta": [LETRAS[i] for i in correctos],
        "explicacion": expl,
        "tags": [tema],
    }


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


# --- Contenido extendido: hojas y preguntas generadas (scripts/content/) ------
CONTENIDO_DIR = Path(__file__).resolve().parent / "content"


def material_pagina(tema: str, n: int, titulo: str, md: str) -> dict:
    """Hoja adicional (n>=2) de un tema; la hoja 1 la crea ``material``."""
    return {
        "_id": f"m_{tema.replace('-', '_')}_{n}",
        "certificacion": CERT,
        "tema": tema,
        "titulo": titulo,
        "formato": "markdown",
        "contenido": md,
        "recursos": [],
        "creado_en": AHORA,
    }


def _pregunta_json(tema: str, n: int, q: dict) -> dict | None:
    """Convierte una pregunta del JSON generado al documento de Mongo, o None si es inválida."""
    tipo = q.get("tipo")
    if tipo not in ("opcion_multiple", "respuesta_multiple"):
        return None
    opts = q.get("opciones") or []
    correctos = q.get("correctas") or []
    if not 2 <= len(opts) <= len(LETRAS):
        return None
    if not correctos or any(
        not isinstance(i, int) or i < 0 or i >= len(opts) for i in correctos
    ):
        return None
    return {
        "_id": f"q_{tema.replace('-', '_')}_w{n}",
        "certificacion": CERT,
        "tema": tema,
        "dificultad": q.get("dificultad", "media"),
        "tipo": tipo,
        "enunciado": (q.get("enunciado") or "").strip(),
        "opciones": [{"id": LETRAS[i], "texto": t} for i, t in enumerate(opts)],
        "respuesta_correcta": [LETRAS[i] for i in correctos],
        "explicacion": (q.get("explicacion") or "").strip(),
        "tags": [tema],
    }


def cargar_contenido_extra(slugs: list[str]) -> tuple[list[dict], list[dict]]:
    """Carga hojas y preguntas adicionales de ``scripts/content/<slug>.json``.

    Forma del archivo: ``{"slug", "pages":[{"titulo","markdown"}], "questions":[...]}``.
    Se omite en silencio lo que falte o no parsee: el seed base sigue funcionando aunque
    no se haya generado el contenido extendido.
    """
    materiales: list[dict] = []
    preguntas: list[dict] = []
    if not CONTENIDO_DIR.is_dir():
        return materiales, preguntas
    for slug in slugs:
        ruta = CONTENIDO_DIR / f"{slug}.json"
        if not ruta.is_file():
            continue
        try:
            data = json.loads(ruta.read_text(encoding="utf-8"))
        except (ValueError, OSError) as e:
            print(f"  [aviso] {ruta.name}: no se pudo leer ({e}); se omite")
            continue
        for i, page in enumerate(data.get("pages") or []):
            titulo = (page.get("titulo") or "").strip()
            md = (page.get("markdown") or "").strip()
            if titulo and md:
                materiales.append(material_pagina(slug, i + 2, titulo, md))
        for j, q in enumerate(data.get("questions") or []):
            pq = _pregunta_json(slug, j + 1, q)
            if pq:
                preguntas.append(pq)
    return materiales, preguntas


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


def problema(_id, titulo, enunciado, dif, casos, etiquetas, area="algoritmos") -> dict:
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


def qa(_id, puesto, area, categoria, enunciado, respuesta, claves) -> dict:
    return {
        "_id": _id,
        "puesto": puesto,
        "area": area,
        "categoria": categoria,
        "enunciado": enunciado,
        "tipo": "conceptual",
        "respuesta_modelo": respuesta,
        "puntos_clave": claves,
        "etiquetas": [area],
        "creado_en": AHORA,
    }


PROBLEMAS = [
    # --- matemáticas ---------------------------------------------------------
    problema(
        "p_suma",
        "Suma de dos enteros",
        "Lee dos enteros separados por espacio en una línea y escribe su suma.",
        "facil",
        [caso("2 3", "5"), caso("10 20", "30"), caso("-4 9", "5", oculto=True)],
        ["matematicas", "io"],
        area="matematicas",
    ),
    problema(
        "p_par",
        "Par o impar",
        "Lee un entero N y escribe `par` si es par o `impar` si es impar.",
        "facil",
        [caso("4", "par"), caso("7", "impar"), caso("0", "par", oculto=True)],
        ["condicionales"],
        area="matematicas",
    ),
    problema(
        "p_factorial",
        "Factorial",
        "Lee un entero N (0 ≤ N ≤ 20) y escribe N! (el factorial de N).",
        "facil",
        [caso("5", "120"), caso("0", "1"), caso("6", "720", oculto=True)],
        ["matematicas"],
        area="matematicas",
    ),
    problema(
        "p_gcd",
        "Máximo común divisor",
        "Lee dos enteros positivos separados por espacio y escribe su máximo común divisor.",
        "media",
        [caso("12 18", "6"), caso("7 13", "1"), caso("48 36", "12", oculto=True)],
        ["matematicas"],
        area="matematicas",
    ),
    problema(
        "p_suma_digitos",
        "Suma de dígitos",
        "Lee un entero no negativo N y escribe la suma de sus dígitos.",
        "facil",
        [caso("123", "6"), caso("9", "9"), caso("1009", "10", oculto=True)],
        ["matematicas"],
        area="matematicas",
    ),
    # --- algoritmos ----------------------------------------------------------
    problema(
        "p_max",
        "Máximo de una lista",
        "La primera línea trae N; la segunda, N enteros separados por espacio. Escribe el mayor.",
        "media",
        [
            caso("3\n4 9 2", "9"),
            caso("5\n-1 -7 -3 -9 -2", "-1"),
            caso("1\n42", "42", oculto=True),
        ],
        ["listas"],
        area="algoritmos",
    ),
    problema(
        "p_fib",
        "N-ésimo Fibonacci",
        "Lee un entero N (N ≥ 1) y escribe el N-ésimo número de Fibonacci (F1=1, F2=1).",
        "media",
        [caso("1", "1"), caso("7", "13"), caso("10", "55", oculto=True)],
        ["recursion", "dp"],
        area="algoritmos",
    ),
    # --- cadenas -------------------------------------------------------------
    problema(
        "p_invertir",
        "Invertir cadena",
        "Lee una palabra (sin espacios) y escríbela al revés.",
        "facil",
        [caso("hola", "aloh"), caso("abc", "cba"), caso("nivel", "levin", oculto=True)],
        ["cadenas"],
        area="cadenas",
    ),
    problema(
        "p_vocales",
        "Contar vocales",
        "Lee una palabra en minúsculas y escribe cuántas vocales (a, e, i, o, u) tiene.",
        "facil",
        [caso("murcielago", "5"), caso("ritmo", "2"), caso("bcd", "0", oculto=True)],
        ["cadenas"],
        area="cadenas",
    ),
    problema(
        "p_palindromo",
        "¿Palíndromo?",
        "Lee una palabra (minúsculas, sin espacios) y escribe `si` si se lee igual al "
        "derecho y al revés, o `no` si no.",
        "media",
        [caso("ana", "si"), caso("hola", "no"), caso("reconocer", "si", oculto=True)],
        ["cadenas"],
        area="cadenas",
    ),
    # --- ordenamiento --------------------------------------------------------
    problema(
        "p_ordenar",
        "Ordenar ascendente",
        "La primera línea trae N; la segunda, N enteros. Escríbelos ordenados de menor a "
        "mayor, separados por espacio.",
        "media",
        [
            caso("3\n3 1 2", "1 2 3"),
            caso("1\n5", "5"),
            caso("4\n9 -1 0 2", "-1 0 2 9", oculto=True),
        ],
        ["ordenamiento"],
        area="ordenamiento",
    ),
    problema(
        "p_segundo_mayor",
        "Segundo mayor distinto",
        "La primera línea trae N; la segunda, N enteros. Escribe el segundo valor más "
        "grande **distinto** (se garantiza que existe).",
        "media",
        [
            caso("4\n3 1 4 1", "3"),
            caso("3\n5 5 2", "2"),
            caso("5\n1 2 3 4 5", "4", oculto=True),
        ],
        ["ordenamiento"],
        area="ordenamiento",
    ),
    # --- estructuras de datos ------------------------------------------------
    problema(
        "p_unicos",
        "Valores distintos",
        "La primera línea trae N; la segunda, N enteros. Escribe cuántos valores **distintos** hay.",
        "facil",
        [
            caso("5\n1 1 2 3 3", "3"),
            caso("1\n9", "1"),
            caso("4\n5 5 5 5", "1", oculto=True),
        ],
        ["conjuntos"],
        area="estructuras-datos",
    ),
    problema(
        "p_conteo",
        "Valor más frecuente",
        "La primera línea trae N; la segunda, N enteros. Escribe el valor que más se "
        "repite; si hay empate, el **menor** de ellos.",
        "media",
        [
            caso("5\n1 2 2 3 3", "2"),
            caso("3\n7 7 7", "7"),
            caso("4\n4 4 1 1", "1", oculto=True),
        ],
        ["mapas", "conteo"],
        area="estructuras-datos",
    ),
]

QA = [
    # --- sistemas (backend / cloud-devops / full-stack) ----------------------
    qa(
        "qa_idempotencia",
        "backend",
        "sistemas",
        "APIs",
        "¿Qué significa que una operación HTTP sea idempotente y por qué importa?",
        "Una operación es **idempotente** si ejecutarla varias veces produce el mismo efecto que "
        "ejecutarla una vez. `GET`, `PUT` y `DELETE` lo son; `POST` no necesariamente. Importa para "
        "**reintentos seguros** ante fallos de red.",
        ["GET/PUT/DELETE idempotentes", "POST no", "reintentos sin efectos duplicados"],
    ),
    qa(
        "qa_concurrencia",
        "backend",
        "sistemas",
        "concurrencia",
        "Explica la diferencia entre concurrencia y paralelismo.",
        "**Concurrencia** es gestionar varias tareas que progresan intercaladas; **paralelismo** es "
        "ejecutarlas a la vez en varios núcleos. Puedes tener concurrencia sin paralelismo.",
        ["intercalado vs simultáneo", "depende del hardware", "Go: goroutines"],
    ),
    qa(
        "qa_rest_grpc",
        "backend",
        "sistemas",
        "APIs",
        "¿Cuándo elegirías gRPC frente a REST/JSON?",
        "**gRPC** (HTTP/2 + protobuf) brilla en comunicación **servicio-a-servicio** de baja latencia "
        "y streaming; **REST/JSON** es más simple y universal para clientes públicos.",
        [
            "gRPC: interno, binario, streaming",
            "REST: público, simple",
            "contrato protobuf",
        ],
    ),
    qa(
        "qa_cache",
        "backend",
        "sistemas",
        "rendimiento",
        "¿Cuándo conviene cachear y qué riesgos trae?",
        "Cachear acelera lecturas frecuentes y descarga el origen. El riesgo principal es servir "
        "datos **obsoletos**: hay que definir invalidación/expiración (TTL) y decidir consistencia. "
        "La frase clásica: lo difícil es **invalidar** la caché.",
        ["acelera lecturas", "riesgo de datos viejos", "TTL / invalidación"],
    ),
    qa(
        "qa_cap",
        "backend",
        "sistemas",
        "distribuidos",
        "¿Qué dice el teorema CAP?",
        "En un sistema distribuido, ante una **partición de red (P)** debes elegir entre "
        "**consistencia (C)** y **disponibilidad (A)**: no puedes garantizar ambas a la vez. Sin "
        "partición, puedes tener C y A.",
        [
            "Consistencia/Disponibilidad/Partición",
            "ante partición eliges C o A",
            "trade-off de diseño",
        ],
    ),
    # --- bases-de-datos (backend / ingeniero-datos / data-scientist) ---------
    qa(
        "qa_indices",
        "backend",
        "bases-de-datos",
        "rendimiento",
        "¿Cuándo conviene (y cuándo no) añadir un índice a una tabla?",
        "Un índice **acelera lecturas** por esa columna, pero **encarece escrituras** y ocupa espacio. "
        "Conviene en columnas muy consultadas; no en tablas con muchas escrituras y pocas lecturas, o "
        "columnas de baja cardinalidad.",
        ["acelera lecturas", "encarece escrituras", "cardinalidad y selectividad"],
    ),
    qa(
        "qa_acid",
        "ingeniero-datos",
        "bases-de-datos",
        "transacciones",
        "¿Qué son las propiedades ACID de una transacción?",
        "**Atomicidad** (todo o nada), **Consistencia** (deja la BD en estado válido), **Aislamiento** "
        "(transacciones concurrentes no se pisan) y **Durabilidad** (lo confirmado persiste aunque "
        "falle el sistema).",
        ["Atomicidad", "Consistencia", "Aislamiento", "Durabilidad"],
    ),
    qa(
        "qa_normalizacion",
        "ingeniero-datos",
        "bases-de-datos",
        "modelado",
        "¿Qué es normalizar y cuándo conviene desnormalizar?",
        "**Normalizar** elimina redundancia repartiendo datos en tablas relacionadas (menos "
        "anomalías de actualización). **Desnormalizar** duplica a propósito para **acelerar "
        "lecturas**; útil en analítica/reportes donde priman las consultas sobre las escrituras.",
        [
            "normalizar = menos redundancia",
            "desnormalizar = lecturas rápidas",
            "OLTP vs OLAP",
        ],
    ),
    qa(
        "qa_sql_nosql",
        "data-scientist",
        "bases-de-datos",
        "modelado",
        "¿SQL vs NoSQL: cuándo cada uno?",
        "**SQL** (relacional) brilla con esquema estable, relaciones y transacciones ACID. **NoSQL** "
        "(documentos, clave-valor, columnar) brilla con esquema flexible, escala horizontal y "
        "patrones de acceso conocidos. La pregunta clave es **cómo vas a consultar** los datos.",
        [
            "SQL: relaciones + ACID",
            "NoSQL: flexible + escala",
            "decide por patrón de acceso",
        ],
    ),
    # --- pipelines-datos (ingeniero-datos / data-scientist) ------------------
    qa(
        "qa_etl_elt",
        "ingeniero-datos",
        "pipelines-datos",
        "ingesta",
        "¿Diferencia entre ETL y ELT?",
        "En **ETL** transformas **antes** de cargar (Extract-Transform-Load); en **ELT** cargas crudo "
        "y transformas **dentro** del almacén (Extract-Load-Transform), aprovechando su cómputo. ELT "
        "es común en data warehouses modernos.",
        [
            "ETL: transforma antes",
            "ELT: transforma en el almacén",
            "ELT aprovecha el warehouse",
        ],
    ),
    qa(
        "qa_idempotencia_pipeline",
        "ingeniero-datos",
        "pipelines-datos",
        "confiabilidad",
        "¿Por qué un pipeline de datos debe ser idempotente?",
        "Porque los reintentos y reprocesos son inevitables. Si correrlo dos veces **duplica** o "
        "corrompe datos, no es confiable. Se logra con claves naturales, *upserts*/*merge* y "
        "marcas de avance (*watermark*) para no reprocesar lo ya hecho.",
        ["reejecutar no duplica", "upsert / merge por clave", "watermark incremental"],
    ),
    qa(
        "qa_particionado",
        "ingeniero-datos",
        "pipelines-datos",
        "rendimiento",
        "¿Qué es particionar datos y por qué ayuda?",
        "Es dividir una tabla grande por una clave (p. ej. **fecha**) en segmentos. Las consultas "
        "leen solo las particiones relevantes (*partition pruning*), reduciendo I/O y costo, y "
        "facilitan borrar/recargar rangos.",
        ["divide por clave (fecha)", "lee menos datos", "pruning = menos I/O"],
    ),
    # --- machine-learning (data-scientist) -----------------------------------
    qa(
        "qa_overfitting",
        "data-scientist",
        "machine-learning",
        "modelado",
        "¿Qué es el overfitting y cómo se mitiga?",
        "**Overfitting** es cuando el modelo memoriza el ruido del entrenamiento y generaliza mal a "
        "datos nuevos (gran brecha train vs test). Se mitiga con más datos, **regularización**, "
        "modelos más simples, *early stopping* y validación cruzada.",
        ["memoriza el ruido", "brecha train/test", "regularización + más datos"],
    ),
    qa(
        "qa_train_test",
        "data-scientist",
        "machine-learning",
        "evaluacion",
        "¿Por qué separar train / validation / test?",
        "**Train** ajusta el modelo, **validation** elige hiperparámetros, y **test** estima el "
        "desempeño real con datos nunca vistos. Evaluar sobre datos de entrenamiento da una "
        "estimación **optimista y engañosa**.",
        ["train ajusta", "validation tunea", "test = estimación honesta"],
    ),
    qa(
        "qa_clasif_regresion",
        "data-scientist",
        "machine-learning",
        "fundamentos",
        "¿Diferencia entre clasificación y regresión?",
        "**Clasificación** predice una **categoría** (spam/no spam); **regresión** predice un "
        "**número continuo** (precio). Cambian la salida, la función de pérdida y las métricas "
        "(exactitud/F1 vs error cuadrático).",
        ["clasificación = categoría", "regresión = número", "métricas distintas"],
    ),
    # --- estadistica (data-scientist) ----------------------------------------
    qa(
        "qa_media_mediana",
        "data-scientist",
        "estadistica",
        "descriptiva",
        "¿Cuándo usar la mediana en vez de la media?",
        "La **media** se distorsiona con valores atípicos y distribuciones sesgadas; la **mediana** "
        "(el valor central) es **robusta** a esos extremos. Para ingresos o tiempos de respuesta "
        "suele describir mejor el caso típico.",
        ["media sensible a outliers", "mediana robusta", "datos sesgados → mediana"],
    ),
    qa(
        "qa_pvalor",
        "data-scientist",
        "estadistica",
        "inferencia",
        "¿Qué es un p-valor, en términos simples?",
        "Es la probabilidad de observar un resultado **al menos tan extremo** como el tuyo **si la "
        "hipótesis nula fuera cierta**. Un p-valor bajo sugiere que el dato es poco compatible con "
        "el azar. No es la probabilidad de que la hipótesis sea cierta.",
        [
            "prob. del dato bajo H0",
            "bajo = poco compatible con azar",
            "no es P(hipótesis)",
        ],
    ),
    # --- frontend (frontend / full-stack) ------------------------------------
    qa(
        "qa_dom_virtual",
        "frontend",
        "frontend",
        "render",
        "¿Qué es el DOM virtual y qué problema resuelve?",
        "Es una representación en memoria de la UI. Al cambiar el estado, la librería **compara** "
        "(diff) el árbol nuevo con el anterior y aplica solo las diferencias mínimas al DOM real, "
        "que es costoso de tocar. Mejora el rendimiento y simplifica el código declarativo.",
        ["UI en memoria", "diff y aplica mínimo", "evita tocar el DOM de más"],
    ),
    qa(
        "qa_estado_props",
        "frontend",
        "frontend",
        "componentes",
        "¿Diferencia entre estado (state) y props?",
        "Las **props** las recibe un componente de su padre y son de **solo lectura**; el **estado** "
        "es interno y **mutable** (re-renderiza al cambiar). Props comunican hacia abajo; el estado "
        "vive dentro del componente.",
        [
            "props: de fuera, inmutables",
            "state: interno, mutable",
            "cambio de state re-renderiza",
        ],
    ),
    qa(
        "qa_lazy_loading",
        "frontend",
        "web-performance",
        "carga",
        "¿Qué es lazy loading y cuándo aplicarlo?",
        "Es **diferir** la carga de recursos hasta que se necesiten (imágenes fuera de pantalla, "
        "rutas, componentes pesados). Reduce el *bundle* inicial y acelera la primera carga. Cuidado "
        "con diferir lo que el usuario ve de inmediato.",
        ["cargar bajo demanda", "menor bundle inicial", "no diferir lo visible"],
    ),
    qa(
        "qa_aria",
        "frontend",
        "accesibilidad",
        "semantica",
        "¿Qué es ARIA y cuándo conviene (o no) usarlo?",
        "**ARIA** añade roles/estados para tecnologías de asistencia cuando el HTML semántico no "
        "alcanza. Regla de oro: **prefiere HTML nativo** (`button`, `nav`) antes que ARIA; un ARIA "
        "mal puesto empeora la accesibilidad.",
        [
            "complementa HTML semántico",
            "primero HTML nativo",
            "ARIA mal puesto estorba",
        ],
    ),
    qa(
        "qa_contraste",
        "frontend",
        "accesibilidad",
        "visual",
        "¿Por qué importa el contraste de color (WCAG)?",
        "Un contraste suficiente entre texto y fondo permite leer a personas con baja visión o bajo "
        "sol. WCAG pide un mínimo (≈4.5:1 para texto normal). No basta con que se vea bonito: tiene "
        "que ser **legible** para todos.",
        ["legibilidad para baja visión", "mínimo ~4.5:1", "no solo estética"],
    ),
    # --- seguridad-app (seguridad) -------------------------------------------
    qa(
        "qa_sql_injection",
        "seguridad",
        "seguridad-app",
        "vulnerabilidades",
        "¿Qué es la inyección SQL y cómo se previene?",
        "Es cuando una entrada del usuario se concatena en una consulta y altera su lógica, "
        "permitiendo leer o borrar datos. Se previene con **consultas parametrizadas** (prepared "
        "statements), validación de entrada y mínimo privilegio en la BD.",
        ["entrada altera la query", "consultas parametrizadas", "mínimo privilegio"],
    ),
    qa(
        "qa_xss",
        "seguridad",
        "seguridad-app",
        "vulnerabilidades",
        "¿Qué es XSS y cómo se mitiga?",
        "**Cross-Site Scripting** inyecta JavaScript malicioso que se ejecuta en el navegador de "
        "otros usuarios. Se mitiga **escapando/codificando** la salida según el contexto, con "
        "*Content-Security-Policy* y no insertando HTML del usuario sin sanear.",
        ["JS inyectado en el cliente", "escapar la salida", "CSP + sanitización"],
    ),
    qa(
        "qa_authz_authn",
        "seguridad",
        "seguridad-app",
        "identidad",
        "¿Diferencia entre autenticación y autorización?",
        "**Autenticación** verifica **quién eres** (login, credenciales, MFA). **Autorización** "
        "decide **qué puedes hacer** (permisos, roles). Primero autenticas, luego autorizas cada "
        "acción sobre cada recurso.",
        ["authn = quién eres", "authz = qué puedes", "primero authn, luego authz"],
    ),
    # --- criptografia (seguridad) --------------------------------------------
    qa(
        "qa_hash_cifrado",
        "seguridad",
        "criptografia",
        "fundamentos",
        "¿Diferencia entre hashing y cifrado?",
        "El **hashing** es **unidireccional** (no se revierte): se usa para contraseñas (con *salt*) "
        "e integridad. El **cifrado** es **reversible** con una llave: protege datos que luego hay "
        "que recuperar. No guardes contraseñas cifradas: **hashéalas**.",
        [
            "hash: irreversible",
            "cifrado: reversible con llave",
            "contraseñas → hash + salt",
        ],
    ),
    qa(
        "qa_simetrico_asimetrico",
        "seguridad",
        "criptografia",
        "llaves",
        "¿Cifrado simétrico vs asimétrico?",
        "**Simétrico** usa la **misma** llave para cifrar y descifrar (rápido, ideal para volúmenes; "
        "reto: compartir la llave). **Asimétrico** usa par **pública/privada** (resuelve el "
        "intercambio y permite firmas, pero es más lento). TLS combina ambos.",
        [
            "simétrico: una llave, rápido",
            "asimétrico: par pública/privada",
            "TLS usa los dos",
        ],
    ),
    # --- redes (seguridad / cloud-devops) ------------------------------------
    qa(
        "qa_tls",
        "seguridad",
        "redes",
        "transporte",
        "¿Qué garantiza TLS/HTTPS?",
        "**Confidencialidad** (cifra el tráfico), **integridad** (detecta manipulación) y "
        "**autenticidad** del servidor (vía su certificado). Hace el *handshake* con criptografía "
        "asimétrica y luego cifra los datos con una llave de sesión simétrica.",
        [
            "cifra + integridad + identidad",
            "handshake asimétrico",
            "datos con llave de sesión",
        ],
    ),
    qa(
        "qa_dns",
        "cloud-devops",
        "redes",
        "resolucion",
        "¿Cómo funciona DNS a grandes rasgos?",
        "Traduce nombres (`ejemplo.com`) a direcciones IP consultando una jerarquía de servidores "
        "(raíz → TLD → autoritativo), con **caché** y **TTL** para no repetir el trabajo. Es la "
        "agenda de contactos de internet.",
        ["nombre → IP", "jerarquía raíz/TLD/autoritativo", "caché + TTL"],
    ),
    # --- contenedores (cloud-devops) -----------------------------------------
    qa(
        "qa_contenedor_vm",
        "cloud-devops",
        "contenedores",
        "fundamentos",
        "¿Diferencia entre un contenedor y una máquina virtual?",
        "Una **VM** virtualiza el hardware y trae su propio sistema operativo (pesada, lenta de "
        "arrancar). Un **contenedor** comparte el kernel del host y empaqueta solo la app y sus "
        "dependencias (ligero, arranca en segundos, mayor densidad).",
        ["VM: SO completo", "contenedor: comparte kernel", "más ligero y rápido"],
    ),
    # --- observabilidad (cloud-devops) ---------------------------------------
    qa(
        "qa_logs_metrics_traces",
        "cloud-devops",
        "observabilidad",
        "pilares",
        "Logs, métricas y trazas: ¿para qué sirve cada uno?",
        "**Logs**: eventos detallados (qué pasó). **Métricas**: números agregados en el tiempo "
        "(cuánto/cuántos, ideales para alertas). **Trazas**: el recorrido de una petición entre "
        "servicios (dónde está el cuello de botella). Juntos dan observabilidad.",
        [
            "logs = qué pasó",
            "métricas = tendencias/alertas",
            "trazas = recorrido distribuido",
        ],
    ),
    qa(
        "qa_slo_sli",
        "cloud-devops",
        "observabilidad",
        "sre",
        "¿Qué son SLI, SLO y el error budget?",
        "Un **SLI** es una medida de calidad (p. ej. % de peticiones < 300 ms). Un **SLO** es la "
        "**meta** para ese SLI (p. ej. 99.9%). El **error budget** es lo que puedes fallar sin "
        "incumplir el SLO; si se agota, priorizas confiabilidad sobre features.",
        ["SLI: medida", "SLO: objetivo", "error budget guía decisiones"],
    ),
    # --- ci-cd (cloud-devops) ------------------------------------------------
    qa(
        "qa_ci_cd",
        "cloud-devops",
        "ci-cd",
        "fundamentos",
        "¿Qué diferencia hay entre CI y CD?",
        "**CI** (integración continua) fusiona y **prueba** cada cambio automáticamente para detectar "
        "errores pronto. **CD** (entrega/despliegue continuo) automatiza llevar ese cambio probado a "
        "producción (o dejarlo listo con un clic).",
        [
            "CI: integrar + probar",
            "CD: entregar/desplegar",
            "automatización del cambio",
        ],
    ),
    qa(
        "qa_blue_green",
        "cloud-devops",
        "ci-cd",
        "despliegue",
        "¿Qué es un despliegue blue-green o canary?",
        "**Blue-green** mantiene dos entornos y cambia el tráfico de golpe al nuevo (rollback "
        "instantáneo). **Canary** envía el cambio a un **pequeño %** de usuarios y lo amplía si las "
        "métricas están sanas. Ambos reducen el riesgo de un despliegue.",
        ["blue-green: dos entornos", "canary: % gradual", "reducen riesgo + rollback"],
    ),
]


def main() -> None:
    db = MongoClient(MONGO_URI)[MONGO_DB]
    slugs = [tema for tema, *_ in SYLLABUS]

    materiales, preguntas = [], []
    for tema, titulo, md, qs in SYLLABUS:
        materiales.append(material(tema, titulo, md))
        for q in qs:
            preguntas.append(pregunta(tema, q))
    preguntas.extend(pregunta_ex(e) for e in EXTRA)
    preguntas.extend(pregunta_ex(e) for e in EXTRA2)

    # Hojas y preguntas adicionales generadas (profundizan cada tema).
    extra_m, extra_q = cargar_contenido_extra(slugs)
    materiales.extend(extra_m)
    preguntas.extend(extra_q)
    if extra_m or extra_q:
        print(
            f"  contenido extendido: +{len(extra_m)} hojas, +{len(extra_q)} preguntas"
        )

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
    rm_m = (
        db["materiales"]
        .delete_many({"certificacion": CERT, "tema": {"$nin": slugs}})
        .deleted_count
    )
    rm_q = (
        db["preguntas"]
        .delete_many({"certificacion": CERT, "tema": {"$nin": slugs}})
        .deleted_count
    )
    if rm_m or rm_q:
        print(f"  limpieza de temas retirados: -{rm_m} materiales, -{rm_q} preguntas")
    print("Listo.")


if __name__ == "__main__":
    main()
