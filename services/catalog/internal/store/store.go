package store

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/certready/certready/services/catalog/internal/catalog"
)

// Errores de dominio del repositorio. El handler HTTP los traduce a códigos de
// estado (ErrNotFound → 404, ErrConflict → 409).
var (
	ErrNotFound = errors.New("recurso no encontrado")
	ErrConflict = errors.New("el recurso ya existe")
)

// Listas de columnas. Los UUID se proyectan como texto (`id::text`) para que el
// mapeo a campos `string` sea inequívoco, sin depender del códec binario de pgx.
const (
	certCols  = `id::text as id, slug, nombre, proveedor, nivel, descripcion, activo, creado_en, actualizado_en`
	temaCols  = `id::text as id, certificacion_id::text as certificacion_id, slug, nombre, dominio, orden, creado_en, actualizado_en`
	pistaCols = `id::text as id, slug, puesto, area, nombre, descripcion, activo, creado_en, actualizado_en`
)

// Store es el repositorio Postgres del catálogo.
type Store struct {
	pool *pgxpool.Pool
}

// New construye un Store sobre el pool de conexiones dado.
func New(pool *pgxpool.Pool) *Store { return &Store{pool: pool} }

// Ping verifica la conectividad con la base; se usa como sonda de readiness.
func (s *Store) Ping(ctx context.Context) error { return s.pool.Ping(ctx) }

// ---------------------------------------------------------------------------
// Certificaciones
// ---------------------------------------------------------------------------

// FiltroCertificaciones acota y pagina el listado de certificaciones.
type FiltroCertificaciones struct {
	Proveedor string
	Nivel     string
	Activo    *bool // nil = sin filtrar por estado.
	Limit     int
	Offset    int
}

// ListarCertificaciones devuelve la página de certificaciones que cumple el filtro.
//
// Todas las condiciones se aplican con parámetros ($1, $2, …): no se concatena
// entrada del usuario en el SQL (defensa contra inyección).
func (s *Store) ListarCertificaciones(ctx context.Context, f FiltroCertificaciones) ([]catalog.Certificacion, error) {
	q := `select ` + certCols + ` from catalog.certificaciones`
	var conds []string
	var args []any

	if f.Proveedor != "" {
		args = append(args, f.Proveedor)
		conds = append(conds, fmt.Sprintf("proveedor = $%d", len(args)))
	}
	if f.Nivel != "" {
		args = append(args, f.Nivel)
		conds = append(conds, fmt.Sprintf("nivel = $%d", len(args)))
	}
	if f.Activo != nil {
		args = append(args, *f.Activo)
		conds = append(conds, fmt.Sprintf("activo = $%d", len(args)))
	}
	if len(conds) > 0 {
		q += " where " + strings.Join(conds, " and ")
	}
	q += " order by proveedor, nombre"
	args = append(args, f.Limit)
	q += fmt.Sprintf(" limit $%d", len(args))
	args = append(args, f.Offset)
	q += fmt.Sprintf(" offset $%d", len(args))

	rows, err := s.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByNameLax[catalog.Certificacion])
}

// ObtenerCertificacion devuelve una certificación por su id (UUID) o su slug.
func (s *Store) ObtenerCertificacion(ctx context.Context, idOrSlug string) (catalog.Certificacion, error) {
	rows, err := s.pool.Query(ctx,
		`select `+certCols+` from catalog.certificaciones where id::text = $1 or slug = $1`, idOrSlug)
	if err != nil {
		return catalog.Certificacion{}, err
	}
	c, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByNameLax[catalog.Certificacion])
	if errors.Is(err, pgx.ErrNoRows) {
		return catalog.Certificacion{}, ErrNotFound
	}
	return c, err
}

// CrearCertificacion inserta una certificación y devuelve la fila creada.
//
// Returns ErrConflict si el slug ya existe (violación de unicidad).
func (s *Store) CrearCertificacion(ctx context.Context, n catalog.NuevaCertificacion) (catalog.Certificacion, error) {
	rows, err := s.pool.Query(ctx,
		`insert into catalog.certificaciones (slug, nombre, proveedor, nivel, descripcion)
		 values ($1, $2, $3, $4, $5)
		 returning `+certCols,
		n.Slug, n.Nombre, n.Proveedor, n.Nivel, n.Descripcion)
	if err != nil {
		return catalog.Certificacion{}, err
	}
	c, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByNameLax[catalog.Certificacion])
	if esViolacionUnicidad(err) {
		return catalog.Certificacion{}, ErrConflict
	}
	return c, err
}

// ---------------------------------------------------------------------------
// Temas
// ---------------------------------------------------------------------------

// ListarTemasDeCertificacion devuelve los temas de una certificación, ordenados.
func (s *Store) ListarTemasDeCertificacion(ctx context.Context, certID string) ([]catalog.Tema, error) {
	rows, err := s.pool.Query(ctx,
		`select `+temaCols+` from catalog.temas where certificacion_id::text = $1 order by orden, nombre`, certID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByNameLax[catalog.Tema])
}

// ObtenerTema devuelve un tema por su id.
func (s *Store) ObtenerTema(ctx context.Context, id string) (catalog.Tema, error) {
	rows, err := s.pool.Query(ctx,
		`select `+temaCols+` from catalog.temas where id::text = $1`, id)
	if err != nil {
		return catalog.Tema{}, err
	}
	t, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByNameLax[catalog.Tema])
	if errors.Is(err, pgx.ErrNoRows) {
		return catalog.Tema{}, ErrNotFound
	}
	return t, err
}

// ---------------------------------------------------------------------------
// Pistas de entrevista
// ---------------------------------------------------------------------------

// FiltroPistas acota y pagina el listado de pistas de entrevista.
type FiltroPistas struct {
	Puesto string
	Area   string
	Activo *bool
	Limit  int
	Offset int
}

// ListarPistas devuelve la página de pistas que cumple el filtro.
func (s *Store) ListarPistas(ctx context.Context, f FiltroPistas) ([]catalog.Pista, error) {
	q := `select ` + pistaCols + ` from catalog.pistas_entrevista`
	var conds []string
	var args []any

	if f.Puesto != "" {
		args = append(args, f.Puesto)
		conds = append(conds, fmt.Sprintf("puesto = $%d", len(args)))
	}
	if f.Area != "" {
		args = append(args, f.Area)
		conds = append(conds, fmt.Sprintf("area = $%d", len(args)))
	}
	if f.Activo != nil {
		args = append(args, *f.Activo)
		conds = append(conds, fmt.Sprintf("activo = $%d", len(args)))
	}
	if len(conds) > 0 {
		q += " where " + strings.Join(conds, " and ")
	}
	q += " order by puesto, area, nombre"
	args = append(args, f.Limit)
	q += fmt.Sprintf(" limit $%d", len(args))
	args = append(args, f.Offset)
	q += fmt.Sprintf(" offset $%d", len(args))

	rows, err := s.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByNameLax[catalog.Pista])
}

// ObtenerPista devuelve una pista por su id (UUID) o su slug.
func (s *Store) ObtenerPista(ctx context.Context, idOrSlug string) (catalog.Pista, error) {
	rows, err := s.pool.Query(ctx,
		`select `+pistaCols+` from catalog.pistas_entrevista where id::text = $1 or slug = $1`, idOrSlug)
	if err != nil {
		return catalog.Pista{}, err
	}
	p, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByNameLax[catalog.Pista])
	if errors.Is(err, pgx.ErrNoRows) {
		return catalog.Pista{}, ErrNotFound
	}
	return p, err
}

// esViolacionUnicidad informa si el error es una violación de restricción única
// de Postgres (SQLSTATE 23505).
func esViolacionUnicidad(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
