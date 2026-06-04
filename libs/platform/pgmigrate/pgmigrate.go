// Package pgmigrate aplica migraciones SQL embebidas sobre PostgreSQL.
//
// Es un runner mínimo y sin dependencias externas (solo pgx): aplica en orden
// los archivos *.up.sql que aún no se han ejecutado, registrando cada versión en
// la tabla <schema>.schema_migrations. Cada migración corre en su propia
// transacción y es idempotente entre ejecuciones.
package pgmigrate

import (
	"context"
	"fmt"
	"io/fs"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Run aplica las migraciones *.up.sql de fsys cuyo prefijo de versión aún no
// figura en <schema>.schema_migrations.
//
// Parameters
//
//	ctx    : context de la operación.
//	pool   : pool de conexiones a Postgres.
//	fsys   : sistema de archivos con las migraciones (un embed.FS por servicio).
//	schema : esquema donde vive la tabla de control (p. ej. "catalog", "users").
//
// Returns un error si falla la preparación de la tabla de control o la aplicación
// de alguna migración (que se revierte, deteniendo el proceso).
//
// schema debe ser un identificador SQL simple (lo provee el servicio, no el
// usuario); se cita con pgx.Identifier para máxima seguridad.
func Run(ctx context.Context, pool *pgxpool.Pool, fsys fs.FS, schema string) error {
	if !esIdentificadorSimple(schema) {
		return fmt.Errorf("nombre de esquema inválido: %q", schema)
	}
	qSchema := pgx.Identifier{schema}.Sanitize()

	if _, err := pool.Exec(ctx, "create schema if not exists "+qSchema); err != nil {
		return fmt.Errorf("crear esquema %s: %w", schema, err)
	}
	if _, err := pool.Exec(ctx, "create table if not exists "+qSchema+`.schema_migrations (
		version     text primary key,
		aplicado_en timestamptz not null default now()
	)`); err != nil {
		return fmt.Errorf("crear tabla de control en %s: %w", schema, err)
	}

	ups, err := migracionesUp(fsys)
	if err != nil {
		return err
	}

	for _, name := range ups {
		version := strings.TrimSuffix(name, ".up.sql")

		var aplicada bool
		if err := pool.QueryRow(ctx,
			"select exists (select 1 from "+qSchema+".schema_migrations where version = $1)", version,
		).Scan(&aplicada); err != nil {
			return fmt.Errorf("consultar migración %s: %w", version, err)
		}
		if aplicada {
			continue
		}

		sqlBytes, err := fs.ReadFile(fsys, name)
		if err != nil {
			return fmt.Errorf("leer %s: %w", name, err)
		}
		if err := aplicar(ctx, pool, qSchema, version, string(sqlBytes)); err != nil {
			return err
		}
	}
	return nil
}

// migracionesUp devuelve los nombres de archivo *.up.sql ordenados por versión.
func migracionesUp(fsys fs.FS) ([]string, error) {
	entries, err := fs.ReadDir(fsys, ".")
	if err != nil {
		return nil, fmt.Errorf("leer migraciones: %w", err)
	}
	ups := make([]string, 0, len(entries))
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".up.sql") {
			ups = append(ups, e.Name())
		}
	}
	sort.Strings(ups) // orden lexicográfico = orden por prefijo numérico.
	return ups, nil
}

// aplicar ejecuta una migración y registra su versión en una transacción. Usa el
// protocolo simple para permitir varias sentencias SQL en un único Exec.
func aplicar(ctx context.Context, pool *pgxpool.Pool, qSchema, version, sqlText string) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin %s: %w", version, err)
	}
	defer func() { _ = tx.Rollback(ctx) }() // no-op tras commit.

	if _, err := tx.Exec(ctx, sqlText, pgx.QueryExecModeSimpleProtocol); err != nil {
		return fmt.Errorf("aplicar %s: %w", version, err)
	}
	if _, err := tx.Exec(ctx,
		"insert into "+qSchema+".schema_migrations (version) values ($1)", version,
	); err != nil {
		return fmt.Errorf("registrar %s: %w", version, err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit %s: %w", version, err)
	}
	return nil
}

// esIdentificadorSimple valida que s sea un identificador SQL conservador:
// empieza por letra y solo contiene letras minúsculas, dígitos y guion bajo.
func esIdentificadorSimple(s string) bool {
	if s == "" || s[0] < 'a' || s[0] > 'z' {
		return false
	}
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z':
		case r >= '0' && r <= '9':
		case r == '_':
		default:
			return false
		}
	}
	return true
}
