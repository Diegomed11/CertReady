package store

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/certready/certready/libs/platform/postgres"
	"github.com/certready/certready/services/enrollments/internal/enrollments"
)

// Errores de dominio del repositorio. El handler los traduce a códigos HTTP.
var (
	ErrNotFound = errors.New("inscripción no encontrada")
	ErrConflict = errors.New("inscripción duplicada")
)

const cols = `id::text as id, usuario_id::text as usuario_id, tipo_objetivo, objetivo_id::text as objetivo_id, estado, creado_en`

// Store es el repositorio Postgres de inscripciones.
type Store struct {
	pool *pgxpool.Pool
}

// New construye un Store sobre el pool dado.
func New(pool *pgxpool.Pool) *Store { return &Store{pool: pool} }

// Ping verifica la conectividad con la base (sonda de readiness).
func (s *Store) Ping(ctx context.Context) error { return s.pool.Ping(ctx) }

// Crear inserta una inscripción del usuario indicado para el objetivo dado.
//
// Returns ErrConflict si ya existe una inscripción (usuario, tipo, objetivo).
func (s *Store) Crear(ctx context.Context, usuarioID string, n enrollments.NuevaInscripcion) (enrollments.Inscripcion, error) {
	rows, err := postgres.Q(ctx, s.pool).Query(ctx,
		`insert into enrollments.inscripciones (usuario_id, tipo_objetivo, objetivo_id)
		 values ($1, $2, $3)
		 returning `+cols,
		usuarioID, string(n.TipoObjetivo), n.ObjetivoID)
	if err != nil {
		if esViolacionUnicidad(err) {
			return enrollments.Inscripcion{}, ErrConflict
		}
		return enrollments.Inscripcion{}, err
	}
	ins, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByNameLax[enrollments.Inscripcion])
	if esViolacionUnicidad(err) {
		return enrollments.Inscripcion{}, ErrConflict
	}
	return ins, err
}

// FiltroDeUsuario acota y pagina el listado de inscripciones del propio usuario.
type FiltroDeUsuario struct {
	Estado enrollments.Estado // vacío = todas
	Limit  int
	Offset int
}

// ListarDeUsuario devuelve la página de inscripciones del usuario indicado.
//
// El filtro por usuario va SIEMPRE como primer parámetro fijo del WHERE: la capa
// de aplicación pasa aquí el `sub` del token, no permite listar las de otro.
func (s *Store) ListarDeUsuario(ctx context.Context, usuarioID string, f FiltroDeUsuario) ([]enrollments.Inscripcion, error) {
	q := `select ` + cols + ` from enrollments.inscripciones where usuario_id::text = $1`
	args := []any{usuarioID}
	if f.Estado != "" {
		args = append(args, string(f.Estado))
		q += fmt.Sprintf(" and estado = $%d", len(args))
	}
	q += " order by creado_en desc"
	args = append(args, f.Limit)
	q += fmt.Sprintf(" limit $%d", len(args))
	args = append(args, f.Offset)
	q += fmt.Sprintf(" offset $%d", len(args))

	rows, err := postgres.Q(ctx, s.pool).Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByNameLax[enrollments.Inscripcion])
}

// CambiarEstadoDeUsuario cambia el estado de la inscripción solo si pertenece al
// usuario indicado.
//
// Returns ErrNotFound si no existe o no pertenece (no se distingue para no
// filtrar la existencia de IDs ajenos — defensa BOLA).
func (s *Store) CambiarEstadoDeUsuario(ctx context.Context, usuarioID, id string, estado enrollments.Estado) (enrollments.Inscripcion, error) {
	rows, err := postgres.Q(ctx, s.pool).Query(ctx,
		`update enrollments.inscripciones set estado = $3
		 where id::text = $1 and usuario_id::text = $2
		 returning `+cols,
		id, usuarioID, string(estado))
	if err != nil {
		return enrollments.Inscripcion{}, err
	}
	ins, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByNameLax[enrollments.Inscripcion])
	if errors.Is(err, pgx.ErrNoRows) {
		return enrollments.Inscripcion{}, ErrNotFound
	}
	return ins, err
}

// EliminarDeUsuario borra la inscripción solo si pertenece al usuario indicado.
//
// Returns ErrNotFound si no existe o no pertenece (igual que CambiarEstado).
func (s *Store) EliminarDeUsuario(ctx context.Context, usuarioID, id string) error {
	tag, err := postgres.Q(ctx, s.pool).Exec(ctx,
		`delete from enrollments.inscripciones where id::text = $1 and usuario_id::text = $2`,
		id, usuarioID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// esViolacionUnicidad informa si el error es una violación de restricción única
// de Postgres (SQLSTATE 23505).
func esViolacionUnicidad(err error) bool {
	if err == nil {
		return false
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return true
	}
	// pgx puede envolver el error dentro de un CollectExactlyOneRow; el SQLSTATE
	// se queda en el mensaje. Como red de seguridad adicional: detección por código.
	return strings.Contains(err.Error(), "SQLSTATE 23505")
}
