package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/certready/certready/judge/internal/judge"
)

// EjecucionesStore persiste las ejecuciones (calificaciones) en PostgreSQL.
type EjecucionesStore struct {
	pool *pgxpool.Pool
}

// NewEjecuciones construye el store de ejecuciones sobre el pool dado.
func NewEjecuciones(pool *pgxpool.Pool) *EjecucionesStore { return &EjecucionesStore{pool: pool} }

// PingPostgres verifica la conectividad con Postgres (sonda de readiness).
func (s *EjecucionesStore) PingPostgres(ctx context.Context) error { return s.pool.Ping(ctx) }

const ejecucionCols = `id::text, usuario_id::text, problema_ref, lenguaje, veredicto, casos_pasados, casos_total, duracion_ms, creado_en`

// CrearEjecucion registra el resultado de una calificación para un usuario y
// devuelve el registro creado.
//
// area es el área del problema (de MongoDB), denormalizada en la ejecucion para
// calcular "problemas resueltos por área" directo de Postgres (plano operativo).
func (s *EjecucionesStore) CrearEjecucion(ctx context.Context, usuarioID string, envio judge.EnvioCodigo, r judge.Resultado, area string) (judge.Ejecucion, error) {
	var c judge.Ejecucion
	err := s.pool.QueryRow(ctx,
		`insert into judge.ejecuciones
		   (usuario_id, problema_ref, lenguaje, veredicto, casos_pasados, casos_total, duracion_ms, area)
		 values ($1, $2, $3, $4, $5, $6, $7, $8)
		 returning `+ejecucionCols,
		usuarioID, envio.ProblemaRef, envio.Lenguaje, string(r.Veredicto),
		r.CasosPasados, r.CasosTotal, r.DuracionMs, area,
	).Scan(&c.ID, &c.UsuarioID, &c.ProblemaRef, &c.Lenguaje, &c.Veredicto, &c.CasosPasados, &c.CasosTotal, &c.DuracionMs, &c.CreadoEn)
	if err != nil {
		return judge.Ejecucion{}, err
	}
	return c, nil
}

// ObtenerEjecucion devuelve una ejecucion del usuario indicado. Returns ErrNotFound
// si no existe o no le pertenece (defensa BOLA).
func (s *EjecucionesStore) ObtenerEjecucion(ctx context.Context, usuarioID, id string) (judge.Ejecucion, error) {
	var c judge.Ejecucion
	err := s.pool.QueryRow(ctx,
		`select `+ejecucionCols+` from judge.ejecuciones where id::text = $1 and usuario_id::text = $2`,
		id, usuarioID,
	).Scan(&c.ID, &c.UsuarioID, &c.ProblemaRef, &c.Lenguaje, &c.Veredicto, &c.CasosPasados, &c.CasosTotal, &c.DuracionMs, &c.CreadoEn)
	if errors.Is(err, pgx.ErrNoRows) {
		return judge.Ejecucion{}, ErrNotFound
	}
	if err != nil {
		return judge.Ejecucion{}, err
	}
	return c, nil
}

// ListarEjecuciones devuelve las ejecuciones del usuario, más recientes primero.
func (s *EjecucionesStore) ListarEjecuciones(ctx context.Context, usuarioID string, limit, offset int) ([]judge.Ejecucion, error) {
	rows, err := s.pool.Query(ctx,
		`select `+ejecucionCols+` from judge.ejecuciones where usuario_id::text = $1
		 order by creado_en desc limit $2 offset $3`,
		usuarioID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []judge.Ejecucion
	for rows.Next() {
		var c judge.Ejecucion
		if err := rows.Scan(&c.ID, &c.UsuarioID, &c.ProblemaRef, &c.Lenguaje, &c.Veredicto, &c.CasosPasados, &c.CasosTotal, &c.DuracionMs, &c.CreadoEn); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// ResumenCodigoPorArea cuenta, para un usuario, los problemas que intentó y los
// que resolvió en las áreas dadas. Un problema cuenta como resuelto si alguna de
// sus ejecuciones fue 'accepted' (el mejor veredicto manda). Sirve a la analítica
// operativa de "preparación por puesto" (señal de código), directo de Postgres.
//
// Returns (0, 0, nil) si no se dan áreas.
func (s *EjecucionesStore) ResumenCodigoPorArea(ctx context.Context, usuarioID string, areas []string) (problemas, resueltos int, err error) {
	if len(areas) == 0 {
		return 0, 0, nil
	}
	err = s.pool.QueryRow(ctx,
		`select count(*)::int, coalesce(sum(resuelto), 0)::int
		 from (
		   select problema_ref,
		          max(case when veredicto = 'accepted' then 1 else 0 end) as resuelto
		   from judge.ejecuciones
		   where usuario_id::text = $1 and area = any($2)
		   group by problema_ref
		 ) t`,
		usuarioID, areas,
	).Scan(&problemas, &resueltos)
	return problemas, resueltos, err
}
