# Desarrollo local

Cómo levantar el entorno completo de CertReady en una máquina de desarrollo. El
sistema funciona por entero en local: no se necesita una cuenta de AWS.

## Requisitos

| Herramienta | Versión mínima | Uso |
|-------------|----------------|-----|
| Go | 1.25 | Servicios, librería compartida, emisor OIDC de desarrollo. |
| Node.js | 20 | Aplicación web. |
| PostgreSQL | 13 | Base de datos transaccional (la función `gen_random_uuid()` es nativa desde la 13). |
| Terraform | 1.5 | Opcional, solo para validar la infraestructura. |

El proyecto usa un workspace de Go (`go.work` en la raíz). Los comandos `go` se
ejecutan desde la carpeta de cada módulo o desde la raíz; el workspace resuelve
las dependencias internas entre módulos.

## 1. Base de datos

Crea una base para desarrollo y otra para las pruebas de integración:

```bash
createdb certready_dev
createdb certready_test
```

Cada servicio crea su propio esquema (`catalog`, `users`, `enrollments`) al
migrar, de modo que las tres bases lógicas conviven en la misma instancia.

La cadena de conexión se pasa por variable de entorno. En una instalación local
con autenticación de confianza, basta con el usuario `postgres` sin contraseña:

```
postgres://postgres@localhost:5432/certready_dev?sslmode=disable
```

## 2. Emisor OIDC de desarrollo

Las rutas protegidas validan tokens OIDC. En desarrollo no se usa Cognito sino un
emisor local incluido en el repositorio:

```bash
go run ./tools/oidc-mock      # escucha en :9099
```

Expone discovery, JWKS, `/authorize` (auto-aprueba) y `/token` con PKCE. Permite
simular cualquier usuario y rol mediante parámetros de la URL de autorización
(por ejemplo `?email=admin@local&groups=admin`). El `sub` se deriva del email, de
modo que un mismo email produce siempre el mismo usuario. Los detalles están en
[`tools/oidc-mock/README.md`](../tools/oidc-mock/README.md).

## 3. Servicios backend

Cada servicio se migra y se arranca por separado. El patrón es el mismo para los
tres; cambia el prefijo de las variables y el puerto sugerido.

`catalog`:

```bash
cd services/catalog
export CATALOG_DATABASE_URL='postgres://postgres@localhost:5432/certready_dev?sslmode=disable'
export CATALOG_ADDR=':18090'
# Opcional: habilitar administración del catálogo con OIDC
# export CATALOG_OIDC_ISSUER='http://localhost:9099'
go run ./cmd/migrate
go run ./cmd/server
```

`users`:

```bash
cd services/users
export USERS_DATABASE_URL='postgres://postgres@localhost:5432/certready_dev?sslmode=disable'
export USERS_ADDR=':18091'
export USERS_OIDC_ISSUER='http://localhost:9099'   # /v1/me requiere autenticación
go run ./cmd/migrate
go run ./cmd/server
```

`enrollments`:

```bash
cd services/enrollments
export ENROLLMENTS_DATABASE_URL='postgres://postgres@localhost:5432/certready_dev?sslmode=disable'
export ENROLLMENTS_ADDR=':18092'
export ENROLLMENTS_OIDC_ISSUER='http://localhost:9099'
export ENROLLMENTS_CATALOG_URL='http://localhost:18090'   # valida el objetivo contra catalog
go run ./cmd/migrate
go run ./cmd/server
```

Cada servicio documenta todas sus variables de entorno en su propio `README.md`.

## 4. Web (BFF)

```bash
cd web
cp .env.example .env.local
# Editar .env.local:
#   OIDC_ISSUER=http://localhost:9099
#   *_BASE_URL apuntando a los puertos de arriba
#   SESSION_PASSWORD con al menos 32 caracteres aleatorios
npm install
npm run dev      # http://localhost:3000
```

## Tabla de puertos sugeridos

| Componente | Puerto |
|------------|--------|
| Web (Next.js) | 3000 |
| Emisor OIDC de desarrollo | 9099 |
| `catalog` | 18090 |
| `users` | 18091 |
| `enrollments` | 18092 |

Los puertos son configurables; estos son los valores que asumen los ejemplos y
los archivos de entorno de la web.

## Pruebas

```bash
# Pruebas que no requieren base de datos (manejadores, librería)
go test ./...

# Pruebas de integración del repositorio (PostgreSQL de pruebas)
export CATALOG_TEST_DATABASE_URL='postgres://postgres@localhost:5432/certready_test?sslmode=disable'
export USERS_TEST_DATABASE_URL="$CATALOG_TEST_DATABASE_URL"
export ENROLLMENTS_TEST_DATABASE_URL="$CATALOG_TEST_DATABASE_URL"
go test ./services/...

# Web
cd web && npm run check
```

Las pruebas de integración del repositorio se omiten automáticamente si la
variable de conexión de pruebas no está definida, de modo que `go test ./...`
funciona sin base de datos.

## Infraestructura (opcional)

Para validar la infraestructura sin desplegar nada:

```bash
cd infra/environments/dev
terraform init -backend=false
terraform validate
```

El procedimiento de despliegue real está en [`infra/README.md`](../infra/README.md).
