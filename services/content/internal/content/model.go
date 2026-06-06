// Package content define los tipos de dominio del material de estudio y la
// validación de sus entradas. El material es heterogéneo y se almacena en
// MongoDB (ver §8 del documento de arquitectura).
package content

import (
	"strings"
	"time"
)

// Material es una pieza de material de estudio (p. ej. una lección en markdown).
type Material struct {
	ID            string    `json:"id" bson:"_id"`
	Certificacion string    `json:"certificacion" bson:"certificacion"`
	Tema          string    `json:"tema" bson:"tema"`
	Titulo        string    `json:"titulo" bson:"titulo"`
	Formato       string    `json:"formato" bson:"formato"` // markdown | html | ...
	Contenido     string    `json:"contenido" bson:"contenido"`
	Recursos      []string  `json:"recursos" bson:"recursos"`
	CreadoEn      time.Time `json:"creado_en" bson:"creado_en"`
}

// NuevoMaterial son los datos de entrada para crear material de estudio.
//
// El id es un identificador legible provisto por quien crea (p. ej.
// "c_aws_vpc_intro"), no autogenerado, para que el contenido tenga referencias
// estables.
type NuevoMaterial struct {
	ID            string   `json:"id"`
	Certificacion string   `json:"certificacion"`
	Tema          string   `json:"tema"`
	Titulo        string   `json:"titulo"`
	Formato       string   `json:"formato"`
	Contenido     string   `json:"contenido"`
	Recursos      []string `json:"recursos"`
}

var formatosValidos = map[string]bool{"markdown": true, "html": true, "texto": true}

// Validar comprueba las reglas básicas del material nuevo.
//
// Returns la lista de errores por campo; vacía si la entrada es válida.
func (n NuevoMaterial) Validar() []string {
	var errs []string
	if !esIDValido(n.ID) {
		errs = append(errs, "id: requerido, minúsculas, números, guion y guion bajo")
	}
	if strings.TrimSpace(n.Certificacion) == "" {
		errs = append(errs, "certificacion: requerida")
	}
	if strings.TrimSpace(n.Titulo) == "" {
		errs = append(errs, "titulo: requerido")
	}
	if strings.TrimSpace(n.Contenido) == "" {
		errs = append(errs, "contenido: requerido")
	}
	if n.Formato != "" && !formatosValidos[n.Formato] {
		errs = append(errs, "formato: debe ser markdown, html o texto")
	}
	return errs
}

// esIDValido valida un identificador legible: [a-z0-9_-], no vacío, <= 128.
func esIDValido(s string) bool {
	if s == "" || len(s) > 128 {
		return false
	}
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z':
		case r >= '0' && r <= '9':
		case r == '_' || r == '-':
		default:
			return false
		}
	}
	return true
}
