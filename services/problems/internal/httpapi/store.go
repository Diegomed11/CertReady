package httpapi

import (
	"context"

	"github.com/certready/certready/services/problems/internal/problems"
	"github.com/certready/certready/services/problems/internal/store"
)

// ProblemsStore es el contrato de persistencia que necesitan los handlers.
type ProblemsStore interface {
	Ping(ctx context.Context) error

	ListarProblemas(ctx context.Context, f store.FiltroProblemas) ([]problems.Problema, error)
	ObtenerProblema(ctx context.Context, id string) (problems.Problema, error)
	CrearProblema(ctx context.Context, n problems.NuevoProblema) (problems.Problema, error)

	ListarQA(ctx context.Context, f store.FiltroQA) ([]problems.PreguntaQA, error)
	ObtenerQA(ctx context.Context, id string) (problems.PreguntaQA, error)
	CrearQA(ctx context.Context, n problems.NuevaPreguntaQA) (problems.PreguntaQA, error)
}
