// Package postgres centraliza la creación del pool de conexiones a PostgreSQL
// usado por los servicios, con valores por defecto razonables.
package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Connect crea y verifica un pool de conexiones a PostgreSQL.
//
// Parameters
//
//	ctx : context que acota el tiempo de establecer el pool y el ping inicial.
//	dsn : cadena de conexión (DATABASE_URL), p. ej.
//	      "postgres://user:pass@host:5432/db?sslmode=require&search_path=catalog".
//
// Returns
//
//	*pgxpool.Pool : pool listo para usar; el llamador debe cerrarlo (Close).
//	error         : si la DSN es inválida o no se logra conectar/hacer ping.
//
// El pool aplica un tiempo de vida máximo por conexión para reciclarlas (útil
// con bases gestionadas como Neon, que pueden cerrar conexiones ociosas).
func Connect(ctx context.Context, dsn string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("DSN de Postgres inválida: %w", err)
	}

	cfg.MaxConns = 10
	cfg.MinConns = 0
	cfg.MaxConnLifetime = 30 * time.Minute
	cfg.MaxConnIdleTime = 5 * time.Minute
	cfg.HealthCheckPeriod = 1 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("no se pudo crear el pool de Postgres: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("no se pudo conectar a Postgres: %w", err)
	}
	return pool, nil
}
