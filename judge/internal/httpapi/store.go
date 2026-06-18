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

// CorridasStore persiste y consulta las corridas del estudiante.
type CorridasStore interface {
	PingPostgres(ctx context.Context) error
	CrearCorrida(ctx context.Context, usuarioID string, envio judge.EnvioCodigo, r judge.Resultado, area string) (judge.Corrida, error)
	ObtenerCorrida(ctx context.Context, usuarioID, id string) (judge.Corrida, error)
	ListarCorridas(ctx context.Context, usuarioID string, limit, offset int) ([]judge.Corrida, error)
}
