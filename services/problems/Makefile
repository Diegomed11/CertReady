# Makefile del servicio problems.
SERVICE     := problems
IMAGE       := certready/$(SERVICE)
VERSION     ?= dev
LAMBDA_ARCH ?= arm64
LAMBDA_ZIP  := build/$(SERVICE)-lambda.zip

.DEFAULT_GOAL := help

.PHONY: help
help: ## Lista los objetivos disponibles.
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

.PHONY: fmt
fmt: ## Formatea el código con gofmt.
	gofmt -w .

.PHONY: vet
vet: ## Análisis estático estándar.
	go vet ./...

.PHONY: test
test: ## Tests. Para los de integración del store: export PROBLEMS_TEST_MONGO_URI.
	go test -cover ./...

.PHONY: run
run: ## Arranca el servicio localmente (requiere MONGO_URI).
	go run ./cmd/server

.PHONY: build-lambda
build-lambda: ## Compila el binario bootstrap para AWS Lambda (provided.al2023).
	CGO_ENABLED=0 GOOS=linux GOARCH=$(LAMBDA_ARCH) \
		go build -trimpath -ldflags="-s -w" -o build/bootstrap ./cmd/lambda

.PHONY: package-lambda
package-lambda: build-lambda ## Empaqueta el zip de despliegue de Lambda.
	cd build && zip -q -j $(SERVICE)-lambda.zip bootstrap
	@echo "paquete: $(LAMBDA_ZIP)"

.PHONY: check
check: fmt vet test ## Verificación completa previa a commit.
