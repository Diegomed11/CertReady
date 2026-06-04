// Package store implementa el acceso a Postgres del servicio catalog: el
// repositorio de consultas y la aplicación de migraciones.
package store

import (
	"context"
	"io/fs"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/certready/certready/libs/platform/pgmigrate"
)

// Migrate aplica las migraciones embebidas del servicio sobre el esquema catalog,
// delegando en el runner compartido libs/platform/pgmigrate.
func Migrate(ctx context.Context, pool *pgxpool.Pool, fsys fs.FS) error {
	return pgmigrate.Run(ctx, pool, fsys, "catalog")
}
