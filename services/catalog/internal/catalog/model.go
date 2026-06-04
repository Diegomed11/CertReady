// Package catalog define los tipos de dominio del catálogo (certificaciones,
// temas y pistas de entrevista) y las reglas de validación de sus entradas.
//
// Los tipos se usan tanto como modelo de dominio como DTO de la API: las
// etiquetas `json` definen el contrato REST y las `db` el mapeo desde Postgres.
package catalog

import (
	"fmt"
	"strings"
	"time"
)

// Certificacion es una certificación del catálogo (p. ej. "AWS SAA").
type Certificacion struct {
	ID            string    `json:"id" db:"id"`
	Slug          string    `json:"slug" db:"slug"`
	Nombre        string    `json:"nombre" db:"nombre"`
	Proveedor     string    `json:"proveedor" db:"proveedor"`
	Nivel         string    `json:"nivel" db:"nivel"`
	Descripcion   *string   `json:"descripcion,omitempty" db:"descripcion"`
	Activo        bool      `json:"activo" db:"activo"`
	CreadoEn      time.Time `json:"creado_en" db:"creado_en"`
	ActualizadoEn time.Time `json:"actualizado_en" db:"actualizado_en"`
}

// Tema es un tema dentro de una certificación.
type Tema struct {
	ID              string    `json:"id" db:"id"`
	CertificacionID string    `json:"certificacion_id" db:"certificacion_id"`
	Slug            string    `json:"slug" db:"slug"`
	Nombre          string    `json:"nombre" db:"nombre"`
	Dominio         *string   `json:"dominio,omitempty" db:"dominio"`
	Orden           int       `json:"orden" db:"orden"`
	CreadoEn        time.Time `json:"creado_en" db:"creado_en"`
	ActualizadoEn   time.Time `json:"actualizado_en" db:"actualizado_en"`
}

// Pista es una pista de entrevista (puesto/área) del catálogo.
type Pista struct {
	ID            string    `json:"id" db:"id"`
	Slug          string    `json:"slug" db:"slug"`
	Puesto        string    `json:"puesto" db:"puesto"`
	Area          string    `json:"area" db:"area"`
	Nombre        string    `json:"nombre" db:"nombre"`
	Descripcion   *string   `json:"descripcion,omitempty" db:"descripcion"`
	Activo        bool      `json:"activo" db:"activo"`
	CreadoEn      time.Time `json:"creado_en" db:"creado_en"`
	ActualizadoEn time.Time `json:"actualizado_en" db:"actualizado_en"`
}

// NuevaCertificacion son los datos de entrada para crear una certificación.
type NuevaCertificacion struct {
	Slug        string  `json:"slug"`
	Nombre      string  `json:"nombre"`
	Proveedor   string  `json:"proveedor"`
	Nivel       string  `json:"nivel"`
	Descripcion *string `json:"descripcion"`
}

// nivelesValidos restringe el nivel a un conjunto conocido (defensa de entrada).
var nivelesValidos = map[string]bool{
	"foundational": true,
	"associate":    true,
	"professional": true,
	"specialty":    true,
}

// Validar comprueba las reglas de negocio de una certificación nueva.
//
// Returns una lista de mensajes de error (uno por campo inválido); vacía si la
// entrada es válida. Devolver todos los errores juntos mejora la experiencia de
// quien consume la API frente a fallar en el primero.
func (n NuevaCertificacion) Validar() []string {
	var errs []string
	if !esSlugValido(n.Slug) {
		errs = append(errs, "slug: requerido, minúsculas, números y guiones (p. ej. 'aws-saa')")
	}
	if strings.TrimSpace(n.Nombre) == "" {
		errs = append(errs, "nombre: requerido")
	}
	if strings.TrimSpace(n.Proveedor) == "" {
		errs = append(errs, "proveedor: requerido")
	}
	if !nivelesValidos[n.Nivel] {
		errs = append(errs, fmt.Sprintf("nivel: debe ser uno de %s", nivelesPermitidos()))
	}
	return errs
}

// esSlugValido valida que un slug sea no vacío y use solo [a-z0-9-].
func esSlugValido(s string) bool {
	if s == "" || len(s) > 64 {
		return false
	}
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z':
		case r >= '0' && r <= '9':
		case r == '-':
		default:
			return false
		}
	}
	return true
}

func nivelesPermitidos() string {
	out := make([]string, 0, len(nivelesValidos))
	for k := range nivelesValidos {
		out = append(out, k)
	}
	return strings.Join(out, ", ")
}
