// Package store implementa el acceso a Postgres del servicio progress.
package store

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/certready/certready/libs/platform/postgres"
	"github.com/certready/certready/services/progress/internal/progress"
)

// Store es el repositorio Postgres del progreso de estudio.
type Store struct {
	pool *pgxpool.Pool
}

// New construye un Store sobre el pool dado.
func New(pool *pgxpool.Pool) *Store { return &Store{pool: pool} }

// Ping verifica la conectividad con la base (sonda de readiness).
func (s *Store) Ping(ctx context.Context) error { return s.pool.Ping(ctx) }

// MarcarLeccion registra una lección como leída por el usuario. Es idempotente:
// marcar dos veces la misma lección no falla ni duplica.
func (s *Store) MarcarLeccion(ctx context.Context, usuarioID string, n progress.NuevaLeccion) error {
	_, err := postgres.Q(ctx, s.pool).Exec(ctx,
		`insert into progress.lecciones (usuario_id, certificacion, tema, material_id)
		 values ($1, $2, $3, $4)
		 on conflict (usuario_id, material_id) do nothing`,
		usuarioID, n.Certificacion, n.Tema, n.MaterialID)
	return err
}

// GuardarRevisionQA registra una autoevaluación de una pregunta de entrevista
// (evento append-only; alimenta la señal de Q&A del DSS vía el ETL).
func (s *Store) GuardarRevisionQA(ctx context.Context, usuarioID string, n progress.NuevaRevisionQA) error {
	area := n.Area
	if area == "" {
		area = "desconocido"
	}
	_, err := postgres.Q(ctx, s.pool).Exec(ctx,
		`insert into progress.qa_revisiones (usuario_id, qa_ref, nivel, area)
		 values ($1, $2, $3, $4)`,
		usuarioID, n.QaRef, n.Nivel, area)
	return err
}

// ResumenQAPorArea agrega la autoevaluación de Q&A del usuario en las áreas dadas.
//
// Por cada pregunta toma su mejor nivel (max), lo mapea a un score {1,2,3} ->
// {0, 0.5, 1} y promedia sobre las preguntas distintas. Es la señal de Q&A de la
// "preparación por puesto", calculada directo de Postgres.
//
// Returns la cobertura (nº de preguntas con datos) y el score promedio en [0,1];
// (0, 0, nil) si no se dan áreas.
func (s *Store) ResumenQAPorArea(ctx context.Context, usuarioID string, areas []string) (cobertura int, score float64, err error) {
	if len(areas) == 0 {
		return 0, 0, nil
	}
	err = postgres.Q(ctx, s.pool).QueryRow(ctx,
		`select count(*)::int, coalesce(avg(score), 0)::float8
		 from (
		   select qa_ref, (max(nivel) - 1) / 2.0 as score
		   from progress.qa_revisiones
		   where usuario_id::text = $1 and area = any($2)
		   group by qa_ref
		 ) t`,
		usuarioID, areas,
	).Scan(&cobertura, &score)
	return cobertura, score, err
}

// GuardarQuiz registra el resultado del quiz de un tema y devuelve el estado
// resultante. Conserva el mejor puntaje y deja el tema aprobado de forma pegajosa
// (una vez aprobado, sigue aprobado).
func (s *Store) GuardarQuiz(ctx context.Context, usuarioID string, n progress.NuevoQuiz, aprobado bool) (progress.TemaProgreso, error) {
	rows, err := postgres.Q(ctx, s.pool).Query(ctx,
		`insert into progress.temas (usuario_id, certificacion, tema, quiz_puntaje, quiz_aprobado)
		 values ($1, $2, $3, $4, $5)
		 on conflict (usuario_id, certificacion, tema) do update
		   set quiz_puntaje   = greatest(temas.quiz_puntaje, excluded.quiz_puntaje),
		       quiz_aprobado  = temas.quiz_aprobado or excluded.quiz_aprobado,
		       actualizado_en = now()
		 returning tema, quiz_puntaje, quiz_aprobado`,
		usuarioID, n.Certificacion, n.Tema, n.Puntaje, aprobado)
	if err != nil {
		return progress.TemaProgreso{}, err
	}
	return pgx.CollectExactlyOneRow(rows, pgx.RowToStructByNameLax[progress.TemaProgreso])
}

// ObtenerDeUsuario devuelve el progreso del usuario en una certificación: las
// lecciones leídas y el estado del quiz de cada tema.
func (s *Store) ObtenerDeUsuario(ctx context.Context, usuarioID, certificacion string) (progress.ProgresoCert, error) {
	out := progress.ProgresoCert{Lecciones: []progress.LeccionCompletada{}, Temas: []progress.TemaProgreso{}}

	rowsL, err := postgres.Q(ctx, s.pool).Query(ctx,
		`select tema, material_id, creado_en
		 from progress.lecciones
		 where usuario_id::text = $1 and certificacion = $2
		 order by creado_en`,
		usuarioID, certificacion)
	if err != nil {
		return progress.ProgresoCert{}, err
	}
	lecciones, err := pgx.CollectRows(rowsL, pgx.RowToStructByNameLax[progress.LeccionCompletada])
	if err != nil {
		return progress.ProgresoCert{}, err
	}
	if lecciones != nil {
		out.Lecciones = lecciones
	}

	rowsT, err := postgres.Q(ctx, s.pool).Query(ctx,
		`select tema, quiz_puntaje, quiz_aprobado
		 from progress.temas
		 where usuario_id::text = $1 and certificacion = $2`,
		usuarioID, certificacion)
	if err != nil {
		return progress.ProgresoCert{}, err
	}
	temas, err := pgx.CollectRows(rowsT, pgx.RowToStructByNameLax[progress.TemaProgreso])
	if err != nil {
		return progress.ProgresoCert{}, err
	}
	if temas != nil {
		out.Temas = temas
	}

	return out, nil
}
