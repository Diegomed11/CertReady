package exams

import "strings"

// NuevaPregunta son los datos para crear una pregunta en el banco (admin).
type NuevaPregunta struct {
	ID                string   `json:"id"`
	Certificacion     string   `json:"certificacion"`
	Tema              string   `json:"tema"`
	Dificultad        string   `json:"dificultad"`
	Tipo              string   `json:"tipo"`
	Enunciado         string   `json:"enunciado"`
	Opciones          []Opcion `json:"opciones"`
	RespuestaCorrecta []string `json:"respuesta_correcta"`
	Explicacion       string   `json:"explicacion"`
	Tags              []string `json:"tags"`
}

// Validar comprueba las reglas de una pregunta de opción múltiple.
//
// Returns la lista de errores por campo; vacía si la entrada es válida.
func (n NuevaPregunta) Validar() []string {
	var errs []string
	if !esIDValido(n.ID) {
		errs = append(errs, "id: requerido, minúsculas, números, guion y guion bajo")
	}
	if strings.TrimSpace(n.Certificacion) == "" {
		errs = append(errs, "certificacion: requerida")
	}
	if n.Tipo != "opcion_multiple" {
		errs = append(errs, "tipo: solo se admite 'opcion_multiple' en esta fase")
	}
	if strings.TrimSpace(n.Enunciado) == "" {
		errs = append(errs, "enunciado: requerido")
	}
	if len(n.Opciones) < 2 {
		errs = append(errs, "opciones: se requieren al menos 2")
	}
	if len(n.RespuestaCorrecta) == 0 {
		errs = append(errs, "respuesta_correcta: requerida")
	}
	// La respuesta correcta debe referir ids de opciones existentes.
	ids := make(map[string]struct{}, len(n.Opciones))
	for _, o := range n.Opciones {
		ids[o.ID] = struct{}{}
	}
	for _, r := range n.RespuestaCorrecta {
		if _, ok := ids[r]; !ok {
			errs = append(errs, "respuesta_correcta: contiene una opción inexistente ("+r+")")
		}
	}
	return errs
}

// CrearSesion son los parámetros para iniciar un simulacro.
type CrearSesion struct {
	Certificacion string `json:"certificacion"`
	NumPreguntas  int    `json:"num_preguntas"`
	Modo          string `json:"modo"`
}

// RespuestaEntrada es una respuesta del estudiante a una pregunta.
type RespuestaEntrada struct {
	Ref       string   `json:"ref"`
	Seleccion []string `json:"seleccion"`
}

// EnviarRespuestas es el cuerpo para entregar un examen.
type EnviarRespuestas struct {
	Respuestas []RespuestaEntrada `json:"respuestas"`
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
