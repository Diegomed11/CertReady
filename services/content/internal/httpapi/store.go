package httpapi

import (
	"context"

	"github.com/certready/certready/services/content/internal/content"
	"github.com/certready/certready/services/content/internal/store"
)

// ContentStore es el contrato de persistencia que necesitan los handlers.
type ContentStore interface {
	Ping(ctx context.Context) error
	Listar(ctx context.Context, f store.Filtro) ([]content.Material, error)
	Obtener(ctx context.Context, id string) (content.Material, error)
	Crear(ctx context.Context, n content.NuevoMaterial) (content.Material, error)
}
