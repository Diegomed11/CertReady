package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/certready/certready/judge/internal/judge"
)

// CorridasStore persiste las corridas (calificaciones) en PostgreSQL.
type CorridasStore struct {
	pool *pgxpool.Pool
}

// NewCorridas construye el store de corridas sobre el pool dado.
func NewCorridas(pool *pgxpool.Pool) *CorridasStore { return &CorridasStore{pool: pool} }

// PingPostgres verifica la conectividad con Postgres (sonda de readiness).
func (s *CorridasStore) PingPostgres(ctx context.Context) error { return s.pool.Ping(ctx) }

const corridaCols = `id::text, usuario_id::text, problema_ref, lenguaje, veredicto, casos_pasados, casos_total, duracion_ms, creado_en`

// CrearCorrida registra el resultado de una calificación para un usuario y
// devuelve el registro creado.
//
// area es el área del problema (de MongoDB), denormalizada en la corrida para
// calcular "problemas resueltos por área" directo de Postgres (plano operativo).
func (s *CorridasStore) CrearCorrida(ctx context.Context, usuarioID string, envio judge.EnvioCodigo, r judge.Resultado, area string) (judge.Corrida, error) {
	var c judge.Corrida
	err := s.pool.QueryRow(ctx,
		`insert into judge.corridas
		   (usuario_id, problema_ref, lenguaje, veredicto, casos_pasados, casos_total, duracion_ms, area)
		 values ($1, $2, $3, $4, $5, $6, $7, $8)
		 returning `+corridaCols,
		usuarioID, envio.ProblemaRef, envio.Lenguaje, string(r.Veredicto),
		r.CasosPasados, r.CasosTotal, r.DuracionMs, area,
	).Scan(&c.ID, &c.UsuarioID, &c.ProblemaRef, &c.Lenguaje, &c.Veredicto, &c.CasosPasados, &c.CasosTotal, &c.DuracionMs, &c.CreadoEn)
	if err != nil {
		return judge.Corrida{}, err
	}
	return c, nil
}

// ObtenerCorrida devuelve una corrida del usuario indicado. Returns ErrNotFound
// si no existe o no le pertenece (defensa BOLA).
func (s *CorridasStore) ObtenerCorrida(ctx context.Context, usuarioID, id string) (judge.Corrida, error) {
	var c judge.Corrida
	err := s.pool.QueryRow(ctx,
		`select `+corridaCols+` from judge.corridas where id::text = $1 and usuario_id::text = $2`,
		id, usuarioID,
	).Scan(&c.ID, &c.UsuarioID, &c.ProblemaRef, &c.Lenguaje, &c.Veredicto, &c.CasosPasados, &c.CasosTotal, &c.DuracionMs, &c.CreadoEn)
	if errors.Is(err, pgx.ErrNoRows) {
		return judge.Corrida{}, ErrNotFound
	}
	if err != nil {
		return judge.Corrida{}, err
	}
	return c, nil
}

// ListarCorridas devuelve las corridas del usuario, más recientes primero.
func (s *CorridasStore) ListarCorridas(ctx context.Context, usuarioID string, limit, offset int) ([]judge.Corrida, error) {
	rows, err := s.pool.Query(ctx,
		`select `+corridaCols+` from judge.corridas where usuario_id::text = $1
		 order by creado_en desc limit $2 offset $3`,
		usuarioID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []judge.Corrida
	for rows.Next() {
		var c judge.Corrida
		if err := rows.Scan(&c.ID, &c.UsuarioID, &c.ProblemaRef, &c.Lenguaje, &c.Veredicto, &c.CasosPasados, &c.CasosTotal, &c.DuracionMs, &c.CreadoEn); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}
