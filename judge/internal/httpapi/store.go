package httpapi

import (
	"context"

	"github.com/certready/certready/judge/internal/judge"
)

// ProblemasStore lee problemas (con casos ocultos) para calificar.
type ProblemasStore interface {
	PingMongo(ctx context.Context) error
	ObtenerProblema(ctx context.Context, id string) (judge.Problema, error)
}

// EjecucionesStore persiste y consulta las ejecuciones del estudiante.
type EjecucionesStore interface {
	PingPostgres(ctx context.Context) error
	CrearEjecucion(ctx context.Context, usuarioID string, envio judge.EnvioCodigo, r judge.Resultado, area string) (judge.Ejecucion, error)
	ObtenerEjecucion(ctx context.Context, usuarioID, id string) (judge.Ejecucion, error)
	ListarEjecuciones(ctx context.Context, usuarioID string, limit, offset int) ([]judge.Ejecucion, error)
	ResumenCodigoPorArea(ctx context.Context, usuarioID string, areas []string) (problemas, resueltos int, err error)
}
