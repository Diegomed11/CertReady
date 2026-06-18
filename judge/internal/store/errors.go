// Package store implementa el acceso a datos del juez: lectura de problemas en
// MongoDB (con sus casos ocultos) y persistencia de ejecuciones en PostgreSQL.
package store

import "errors"

// ErrNotFound indica que el recurso solicitado no existe o no pertenece al
// usuario (este último caso es una defensa BOLA: no se distingue de "no existe").
var ErrNotFound = errors.New("recurso no encontrado")
