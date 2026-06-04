// Package migrations embebe los archivos SQL de migración del servicio catalog
// en el binario, para que el despliegue no dependa de archivos externos.
package migrations

import "embed"

// FS contiene los archivos *.sql de migración. El runner (internal/store) aplica
// los *.up.sql en orden por su prefijo numérico.
//
//go:embed *.sql
var FS embed.FS
