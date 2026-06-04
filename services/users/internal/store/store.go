package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/certready/certready/services/users/internal/users"
)

// ErrNotFound indica que el recurso solicitado no existe.
var ErrNotFound = errors.New("recurso no encontrado")

const (
	usuarioCols = `id::text as id, email, nombre, rol, creado_en, actualizado_en`
	perfilCols  = `usuario_id::text as usuario_id, bio, pais, avatar_url, actualizado_en`
)

// Store es el repositorio Postgres de identidad.
type Store struct {
	pool *pgxpool.Pool
}

// New construye un Store sobre el pool dado.
func New(pool *pgxpool.Pool) *Store { return &Store{pool: pool} }

// Ping verifica la conectividad con la base (sonda de readiness).
func (s *Store) Ping(ctx context.Context) error { return s.pool.Ping(ctx) }

// ObtenerOProvisionar devuelve el usuario con el id dado, creándolo si no existe
// (provisión "just-in-time" en el primer login a partir de los claims del JWT).
//
// En cada llamada sincroniza email y rol con el token (fuente de verdad de la
// identidad) y conserva el nombre previo si el token no trae uno. Garantiza
// además que exista la fila de perfil 1:1.
func (s *Store) ObtenerOProvisionar(ctx context.Context, id, email string, nombre *string, rol string) (users.Usuario, error) {
	rows, err := s.pool.Query(ctx, `
		insert into users.usuarios (id, email, nombre, rol)
		values ($1, $2, $3, $4)
		on conflict (id) do update set
			email          = excluded.email,
			nombre         = coalesce(excluded.nombre, users.usuarios.nombre),
			rol            = excluded.rol,
			actualizado_en = now()
		returning `+usuarioCols,
		id, email, nombre, rol)
	if err != nil {
		return users.Usuario{}, err
	}
	u, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByNameLax[users.Usuario])
	if err != nil {
		return users.Usuario{}, err
	}

	if _, err := s.pool.Exec(ctx,
		`insert into users.perfiles (usuario_id) values ($1) on conflict do nothing`, id); err != nil {
		return users.Usuario{}, err
	}
	return u, nil
}

// ObtenerPerfil devuelve el perfil del usuario indicado.
func (s *Store) ObtenerPerfil(ctx context.Context, usuarioID string) (users.Perfil, error) {
	rows, err := s.pool.Query(ctx,
		`select `+perfilCols+` from users.perfiles where usuario_id::text = $1`, usuarioID)
	if err != nil {
		return users.Perfil{}, err
	}
	p, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByNameLax[users.Perfil])
	if errors.Is(err, pgx.ErrNoRows) {
		return users.Perfil{}, ErrNotFound
	}
	return p, err
}

// ActualizarCuenta aplica los cambios de perfil del propio usuario en una
// transacción (nombre en `usuarios`; bio/pais/avatar en `perfiles`).
//
// Los campos nil se dejan intactos vía coalesce. Returns ErrNotFound si el
// usuario no existe.
func (s *Store) ActualizarCuenta(ctx context.Context, id string, in users.ActualizarPerfil) (users.Usuario, users.Perfil, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return users.Usuario{}, users.Perfil{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	uRows, err := tx.Query(ctx,
		`update users.usuarios set nombre = coalesce($2, nombre), actualizado_en = now()
		 where id::text = $1 returning `+usuarioCols, id, in.Nombre)
	if err != nil {
		return users.Usuario{}, users.Perfil{}, err
	}
	u, err := pgx.CollectExactlyOneRow(uRows, pgx.RowToStructByNameLax[users.Usuario])
	if errors.Is(err, pgx.ErrNoRows) {
		return users.Usuario{}, users.Perfil{}, ErrNotFound
	}
	if err != nil {
		return users.Usuario{}, users.Perfil{}, err
	}

	pRows, err := tx.Query(ctx,
		`update users.perfiles set bio = coalesce($2, bio), pais = coalesce($3, pais),
		   avatar_url = coalesce($4, avatar_url), actualizado_en = now()
		 where usuario_id::text = $1 returning `+perfilCols,
		id, in.Bio, in.Pais, in.AvatarURL)
	if err != nil {
		return users.Usuario{}, users.Perfil{}, err
	}
	p, err := pgx.CollectExactlyOneRow(pRows, pgx.RowToStructByNameLax[users.Perfil])
	if err != nil {
		return users.Usuario{}, users.Perfil{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return users.Usuario{}, users.Perfil{}, err
	}
	return u, p, nil
}

// ListarUsuarios devuelve una página de usuarios (uso administrativo).
func (s *Store) ListarUsuarios(ctx context.Context, limit, offset int) ([]users.Usuario, error) {
	rows, err := s.pool.Query(ctx,
		`select `+usuarioCols+` from users.usuarios order by creado_en desc limit $1 offset $2`,
		limit, offset)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByNameLax[users.Usuario])
}
