// Package store implementa el acceso a datos del servicio exams: el banco de
// preguntas en MongoDB y las sesiones e intentos en PostgreSQL.
package store

import "errors"

// Errores de dominio del repositorio, traducidos por el handler a códigos HTTP.
var (
	ErrNotFound     = errors.New("recurso no encontrado")
	ErrConflict     = errors.New("el recurso ya existe")
	ErrYaFinalizada = errors.New("la sesión ya está finalizada")
)
