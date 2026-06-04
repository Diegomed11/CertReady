# Makefile del servicio health. Objetivos uniformes para todos los servicios Go.
# Uso: make <objetivo>. `make help` lista los disponibles.

SERVICE     := health
IMAGE       := certready/$(SERVICE)
VERSION     ?= dev
LAMBDA_ARCH ?= arm64
LAMBDA_ZIP  := build/$(SERVICE)-lambda.zip

.DEFAULT_GOAL := help

.PHONY: help
help: ## Lista los objetivos disponibles.
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

.PHONY: fmt
fmt: ## Formatea el código con gofmt.
	gofmt -w .

.PHONY: vet
vet: ## Análisis estático estándar.
	go vet ./...

.PHONY: lint
lint: ## Linter (requiere golangci-lint instalado).
	golangci-lint run ./...

.PHONY: test
test: ## Corre los tests con carrera de datos y cobertura.
	go test -race -cover ./...

.PHONY: build
build: ## Compila el binario en ./bin.
	CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o bin/$(SERVICE) ./cmd/server

.PHONY: run
run: ## Arranca el servicio localmente.
	go run ./cmd/server

.PHONY: docker
docker: ## Construye la imagen de contenedor (ruta Fargate, parqueada).
	docker build --build-arg VERSION=$(VERSION) -t $(IMAGE):$(VERSION) .

.PHONY: build-lambda
build-lambda: ## Compila el binario bootstrap para AWS Lambda (provided.al2023).
	CGO_ENABLED=0 GOOS=linux GOARCH=$(LAMBDA_ARCH) \
		go build -trimpath -ldflags="-s -w" -o build/bootstrap ./cmd/lambda

.PHONY: package-lambda
package-lambda: build-lambda ## Empaqueta el zip de despliegue de Lambda (build/health-lambda.zip).
	cd build && zip -q -j $(SERVICE)-lambda.zip bootstrap
	@echo "paquete: $(LAMBDA_ZIP)"

.PHONY: check
check: fmt vet test ## Verificación completa previa a commit.
