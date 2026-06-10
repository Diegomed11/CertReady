package httpapi

import (
	"context"

	"github.com/certready/certready/services/exams/internal/exams"
)

// PreguntasStore es el contrato del banco de preguntas (MongoDB).
type PreguntasStore interface {
	PingMongo(ctx context.Context) error
	Muestrear(ctx context.Context, certificacion string, temas []string, n int) ([]exams.Pregunta, error)
	PorRefs(ctx context.Context, refs []string) (map[string]exams.Pregunta, error)
	CrearPregunta(ctx context.Context, n exams.NuevaPregunta) (exams.Pregunta, error)
}

// SesionesStore es el contrato de sesiones e intentos (PostgreSQL).
type SesionesStore interface {
	PingPostgres(ctx context.Context) error
	CrearSesion(ctx context.Context, usuarioID, certificacion, modo string, refs []string) (exams.Sesion, error)
	ObtenerSesion(ctx context.Context, usuarioID, id string) (exams.Sesion, []string, error)
	ListarSesiones(ctx context.Context, usuarioID string, limit, offset int) ([]exams.Sesion, error)
	ObtenerIntentos(ctx context.Context, sesionID string) ([]exams.Intento, error)
	Finalizar(ctx context.Context, usuarioID, id string, puntaje float64, intentos []exams.Intento) error
}
