// Package migrations embebe los archivos SQL de migración del servicio exams.
package migrations

import "embed"

// FS contiene los archivos *.sql de migración (lado Postgres).
//
//go:embed *.sql
var FS embed.FS
