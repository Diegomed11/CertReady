# Makefile del servicio progress.
# Uso: make <objetivo>. `make help` lista los disponibles.

SERVICE := progress
IMAGE   := certready/$(SERVICE)
VERSION ?= dev

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
test: ## Tests. Para los de integración del store: export PROGRESS_TEST_DATABASE_URL.
	go test -cover ./...

.PHONY: migrate
migrate: ## Aplica las migraciones pendientes (requiere PROGRESS_DATABASE_URL o DATABASE_URL).
	go run ./cmd/migrate

.PHONY: run
run: ## Arranca el servicio localmente (requiere DATABASE_URL).
	go run ./cmd/server

.PHONY: check
check: fmt vet test ## Verificación completa previa a commit.
