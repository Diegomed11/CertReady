package httpapi

import (
	"context"

	"github.com/certready/certready/services/progress/internal/progress"
)

// ProgresoStore es el contrato de persistencia que necesitan los handlers.
//
// Depender de una interfaz permite probar los handlers con un doble en memoria,
// sin Postgres.
type ProgresoStore interface {
	Ping(ctx context.Context) error
	MarcarLeccion(ctx context.Context, usuarioID string, n progress.NuevaLeccion) error
	GuardarQuiz(ctx context.Context, usuarioID string, n progress.NuevoQuiz, aprobado bool) (progress.TemaProgreso, error)
	GuardarRevisionQA(ctx context.Context, usuarioID string, n progress.NuevaRevisionQA) error
	ObtenerDeUsuario(ctx context.Context, usuarioID, certificacion string) (progress.ProgresoCert, error)
}
