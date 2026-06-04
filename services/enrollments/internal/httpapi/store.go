package httpapi

import (
	"context"

	"github.com/certready/certready/services/enrollments/internal/enrollments"
	"github.com/certready/certready/services/enrollments/internal/store"
)

// EnrollmentStore es el contrato de persistencia que necesitan los handlers.
//
// Depender de una interfaz permite probar los handlers con un doble en memoria,
// sin Postgres.
type EnrollmentStore interface {
	Ping(ctx context.Context) error
	Crear(ctx context.Context, usuarioID string, n enrollments.NuevaInscripcion) (enrollments.Inscripcion, error)
	ListarDeUsuario(ctx context.Context, usuarioID string, f store.FiltroDeUsuario) ([]enrollments.Inscripcion, error)
	CambiarEstadoDeUsuario(ctx context.Context, usuarioID, id string, estado enrollments.Estado) (enrollments.Inscripcion, error)
	EliminarDeUsuario(ctx context.Context, usuarioID, id string) error
}
