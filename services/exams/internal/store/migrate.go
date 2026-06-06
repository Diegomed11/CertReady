package store

import (
	"context"
	"io/fs"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/certready/certready/libs/platform/pgmigrate"
)

// Migrate aplica las migraciones embebidas sobre el esquema exams (Postgres).
func Migrate(ctx context.Context, pool *pgxpool.Pool, fsys fs.FS) error {
	return pgmigrate.Run(ctx, pool, fsys, "exams")
}
