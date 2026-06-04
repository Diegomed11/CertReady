// Package users define los tipos de dominio de identidad: usuario, perfil y la
// cuenta (su composición) que devuelve la API.
package users

import (
	"strings"
	"time"
)

// Usuario es la identidad de aplicación. id es el `sub` del JWT; rol gobierna el
// RBAC (estudiante | admin).
type Usuario struct {
	ID            string    `json:"id" db:"id"`
	Email         string    `json:"email" db:"email"`
	Nombre        *string   `json:"nombre" db:"nombre"`
	Rol           string    `json:"rol" db:"rol"`
	CreadoEn      time.Time `json:"creado_en" db:"creado_en"`
	ActualizadoEn time.Time `json:"actualizado_en" db:"actualizado_en"`
}

// Perfil son los datos extendidos opcionales del usuario (1:1 con Usuario).
type Perfil struct {
	UsuarioID     string    `json:"-" db:"usuario_id"`
	Bio           *string   `json:"bio" db:"bio"`
	Pais          *string   `json:"pais" db:"pais"`
	AvatarURL     *string   `json:"avatar_url" db:"avatar_url"`
	ActualizadoEn time.Time `json:"actualizado_en" db:"actualizado_en"`
}

// Cuenta es la vista combinada de identidad + perfil que devuelve GET /v1/me.
type Cuenta struct {
	Usuario
	Perfil Perfil `json:"perfil"`
}

// ActualizarPerfil son los campos editables del propio usuario (PATCH /v1/me).
// Los punteros nil significan "no cambiar"; los no nil reemplazan el valor.
type ActualizarPerfil struct {
	Nombre    *string `json:"nombre"`
	Bio       *string `json:"bio"`
	Pais      *string `json:"pais"`
	AvatarURL *string `json:"avatar_url"`
}

// Validar comprueba límites razonables de los campos editables.
//
// Returns la lista de errores por campo; vacía si la entrada es válida.
func (a ActualizarPerfil) Validar() []string {
	var errs []string
	if a.Nombre != nil && len(strings.TrimSpace(*a.Nombre)) == 0 {
		errs = append(errs, "nombre: no puede ser vacío si se envía")
	}
	if a.Nombre != nil && len(*a.Nombre) > 120 {
		errs = append(errs, "nombre: máximo 120 caracteres")
	}
	if a.Bio != nil && len(*a.Bio) > 2000 {
		errs = append(errs, "bio: máximo 2000 caracteres")
	}
	if a.Pais != nil && len(*a.Pais) > 56 {
		errs = append(errs, "pais: máximo 56 caracteres")
	}
	if a.AvatarURL != nil && len(*a.AvatarURL) > 512 {
		errs = append(errs, "avatar_url: máximo 512 caracteres")
	}
	return errs
}
