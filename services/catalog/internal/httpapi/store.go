package httpapi

import (
	"context"

	"github.com/certready/certready/services/catalog/internal/catalog"
	"github.com/certready/certready/services/catalog/internal/store"
)

// CatalogStore es el contrato de persistencia que necesitan los handlers.
//
// Depender de una interfaz (y no del *store.Store concreto) permite probar los
// handlers con un doble en memoria, sin Postgres, y deja el acoplamiento con la
// base de datos en los tests de integración del paquete store.
type CatalogStore interface {
	Ping(ctx context.Context) error

	ListarCertificaciones(ctx context.Context, f store.FiltroCertificaciones) ([]catalog.Certificacion, error)
	ObtenerCertificacion(ctx context.Context, idOrSlug string) (catalog.Certificacion, error)
	CrearCertificacion(ctx context.Context, n catalog.NuevaCertificacion) (catalog.Certificacion, error)

	ListarTemasDeCertificacion(ctx context.Context, certID string) ([]catalog.Tema, error)
	ObtenerTema(ctx context.Context, id string) (catalog.Tema, error)

	ListarPistas(ctx context.Context, f store.FiltroPistas) ([]catalog.Pista, error)
	ObtenerPista(ctx context.Context, idOrSlug string) (catalog.Pista, error)
}
