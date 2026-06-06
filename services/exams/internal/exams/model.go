// Package exams define los tipos de dominio de preguntas, sesiones e intentos, y
// la lógica de calificación. Las preguntas viven en MongoDB; las sesiones e
// intentos, en PostgreSQL.
package exams

import (
	"sort"
	"strings"
	"time"
)

// Opcion es una opción de respuesta de una pregunta de opción múltiple.
type Opcion struct {
	ID    string `json:"id" bson:"id"`
	Texto string `json:"texto" bson:"texto"`
}

// Pregunta es una pregunta del banco (MongoDB). RespuestaCorrecta y Explicacion
// no se exponen al estudiante durante el examen (ver Publica).
type Pregunta struct {
	ID                string   `json:"id" bson:"_id"`
	Certificacion     string   `json:"certificacion" bson:"certificacion"`
	Tema              string   `json:"tema" bson:"tema"`
	Dificultad        string   `json:"dificultad" bson:"dificultad"`
	Tipo              string   `json:"tipo" bson:"tipo"`
	Enunciado         string   `json:"enunciado" bson:"enunciado"`
	Opciones          []Opcion `json:"opciones" bson:"opciones"`
	RespuestaCorrecta []string `json:"respuesta_correcta" bson:"respuesta_correcta"`
	Explicacion       string   `json:"explicacion" bson:"explicacion"`
	Tags              []string `json:"tags" bson:"tags"`
}

// PreguntaPublica es la vista de una pregunta SIN la respuesta correcta ni la
// explicación: lo que se entrega al estudiante mientras resuelve el examen.
type PreguntaPublica struct {
	Ref        string   `json:"ref"`
	Tema       string   `json:"tema"`
	Dificultad string   `json:"dificultad"`
	Tipo       string   `json:"tipo"`
	Enunciado  string   `json:"enunciado"`
	Opciones   []Opcion `json:"opciones"`
}

// Publica deriva la vista pública de una pregunta.
func Publica(p Pregunta) PreguntaPublica {
	return PreguntaPublica{
		Ref: p.ID, Tema: p.Tema, Dificultad: p.Dificultad,
		Tipo: p.Tipo, Enunciado: p.Enunciado, Opciones: p.Opciones,
	}
}

// Sesion es una sesión de examen (PostgreSQL).
type Sesion struct {
	ID            string     `json:"id"`
	UsuarioID     string     `json:"usuario_id"`
	Certificacion string     `json:"certificacion"`
	Modo          string     `json:"modo"`
	Estado        string     `json:"estado"`
	Puntaje       *float64   `json:"puntaje"`
	IniciadoEn    time.Time  `json:"iniciado_en"`
	FinalizadoEn  *time.Time `json:"finalizado_en"`
}

// Intento es la respuesta registrada a una pregunta dentro de una sesión.
type Intento struct {
	PreguntaRef string   `json:"pregunta_ref"`
	Correcto    bool     `json:"correcto"`
	Seleccion   []string `json:"seleccion"`
}

// ResultadoPregunta es el detalle por pregunta tras calificar (incluye la
// respuesta correcta y la explicación, para el repaso).
type ResultadoPregunta struct {
	Ref               string   `json:"ref"`
	Correcto          bool     `json:"correcto"`
	Seleccion         []string `json:"seleccion"`
	RespuestaCorrecta []string `json:"respuesta_correcta"`
	Explicacion       string   `json:"explicacion"`
}

// Resultado es el resultado completo de calificar una sesión.
type Resultado struct {
	SesionID   string              `json:"sesion_id"`
	Puntaje    float64             `json:"puntaje"`
	Correctas  int                 `json:"correctas"`
	Total      int                 `json:"total"`
	Resultados []ResultadoPregunta `json:"resultados"`
}

// Calificar evalúa las respuestas del estudiante contra las preguntas de la
// sesión y devuelve el resultado completo.
//
// Parameters
//
//	refs       : orden de las preguntas de la sesión (define el total y el orden).
//	preguntas  : preguntas por ref (las que existen en el banco).
//	respuestas : selección del estudiante por ref (puede faltar alguna → incorrecta).
//
// Returns el Resultado con el puntaje normalizado [0,100]. Una pregunta sin
// respuesta o cuya selección no coincide exactamente con la correcta cuenta como
// incorrecta. La comparación es por conjuntos (sin importar el orden).
func Calificar(sesionID string, refs []string, preguntas map[string]Pregunta, respuestas map[string][]string) Resultado {
	res := Resultado{SesionID: sesionID, Total: len(refs)}
	for _, ref := range refs {
		p, ok := preguntas[ref]
		seleccion := respuestas[ref]
		if seleccion == nil {
			seleccion = []string{}
		}
		correcto := ok && conjuntosIguales(seleccion, p.RespuestaCorrecta)
		if correcto {
			res.Correctas++
		}
		res.Resultados = append(res.Resultados, ResultadoPregunta{
			Ref:               ref,
			Correcto:          correcto,
			Seleccion:         seleccion,
			RespuestaCorrecta: p.RespuestaCorrecta,
			Explicacion:       p.Explicacion,
		})
	}
	if res.Total > 0 {
		res.Puntaje = float64(res.Correctas) / float64(res.Total) * 100
	}
	return res
}

// conjuntosIguales compara dos listas como conjuntos (sin orden ni duplicados).
func conjuntosIguales(a, b []string) bool {
	na := normalizar(a)
	nb := normalizar(b)
	if len(na) != len(nb) {
		return false
	}
	for i := range na {
		if na[i] != nb[i] {
			return false
		}
	}
	return true
}

func normalizar(s []string) []string {
	set := make(map[string]struct{}, len(s))
	for _, v := range s {
		set[strings.TrimSpace(v)] = struct{}{}
	}
	out := make([]string, 0, len(set))
	for k := range set {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}
