// Package migrations embebe los archivos SQL de migración del servicio users.
package migrations

import "embed"

// FS contiene los archivos *.sql de migración.
//
//go:embed *.sql
var FS embed.FS
