# Makefile del servicio judge (juez de código).
SERVICE      := judge
IMAGE        := certready/$(SERVICE)
PYTHON_IMAGE := certready/judge-python:latest
VERSION      ?= dev

.DEFAULT_GOAL := help

.PHONY: help
help: ## Lista los objetivos disponibles.
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

.PHONY: fmt
fmt: ## Formatea el código con gofmt.
	gofmt -w .

.PHONY: vet
vet: ## Análisis estático estándar.
	go vet ./...

.PHONY: test
test: ## Tests. Integración: export JUDGE_TEST_DATABASE_URL y, para el sandbox, JUDGE_DOCKER_TESTS=1.
	go test -cover ./...

.PHONY: runner-image
runner-image: ## Construye la imagen del sandbox de Python (requiere Docker).
	docker build -t $(PYTHON_IMAGE) runners/python

.PHONY: migrate
migrate: ## Aplica las migraciones de Postgres (requiere JUDGE_DATABASE_URL o DATABASE_URL).
	go run ./cmd/migrate

.PHONY: run
run: ## Arranca el servicio localmente (requiere Postgres, Mongo y Docker).
	go run ./cmd/server

.PHONY: check
check: fmt vet test ## Verificación completa previa a commit.
