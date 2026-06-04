// Package store implementa el acceso a Postgres del servicio enrollments.
package store

import (
	"context"
	"io/fs"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/certready/certready/libs/platform/pgmigrate"
)

// Migrate aplica las migraciones embebidas sobre el esquema enrollments.
func Migrate(ctx context.Context, pool *pgxpool.Pool, fsys fs.FS) error {
	return pgmigrate.Run(ctx, pool, fsys, "enrollments")
}
