// Package problems define los tipos de dominio de la preparación de entrevistas:
// problemas de código (tipo LeetCode, evaluados por el juez) y preguntas de Q&A
// por puesto/área (material de autoestudio). Ambos se almacenan en MongoDB por la
// naturaleza heterogénea del contenido (ver §8 del documento de arquitectura).
package problems

import (
	"strings"
	"time"
)

// dificultadesValidas acota el campo dificultad de un problema.
var dificultadesValidas = map[string]bool{"facil": true, "media": true, "dificil": true}

// lenguajesValidos son los lenguajes que el juez de código sabe ejecutar. La
// primera ronda solo soporta Python; el conjunto crece al añadir runners.
var lenguajesValidos = map[string]bool{"python": true}

// tiposQAValidos acota el campo tipo de una pregunta de Q&A.
var tiposQAValidos = map[string]bool{"abierta": true, "conceptual": true}

// Caso es un caso de prueba de un problema de código: una entrada por stdin y la
// salida esperada por stdout. Los casos marcados oculto no se exponen nunca al
// cliente; los visibles sirven de ejemplo en el enunciado.
type Caso struct {
	Entrada        string `json:"entrada" bson:"entrada"`
	SalidaEsperada string `json:"salida_esperada" bson:"salida_esperada"`
	Oculto         bool   `json:"oculto" bson:"oculto"`
	Peso           int    `json:"peso" bson:"peso"`
}

// Problema es un ejercicio de código evaluado automáticamente por el juez.
//
// El documento almacenado incluye los casos ocultos y sus salidas esperadas, que
// el juez usa para calificar del lado del servidor. La lectura pública pasa
// siempre por VistaPublica, que elimina esos casos (defensa anti-fuga).
type Problema struct {
	ID                  string            `json:"id" bson:"_id"`
	Titulo              string            `json:"titulo" bson:"titulo"`
	Enunciado           string            `json:"enunciado" bson:"enunciado"`
	Dificultad          string            `json:"dificultad" bson:"dificultad"` // facil | media | dificil
	Area                string            `json:"area" bson:"area"`
	Etiquetas           []string          `json:"etiquetas" bson:"etiquetas"`
	LenguajesPermitidos []string          `json:"lenguajes_permitidos" bson:"lenguajes_permitidos"`
	Plantillas          map[string]string `json:"plantillas" bson:"plantillas"` // código inicial por lenguaje
	LimiteTiempoMs      int               `json:"limite_tiempo_ms" bson:"limite_tiempo_ms"`
	LimiteMemoriaMB     int               `json:"limite_memoria_mb" bson:"limite_memoria_mb"`
	Casos               []Caso            `json:"casos" bson:"casos"`
	CreadoEn            time.Time         `json:"creado_en" bson:"creado_en"`
}

// VistaPublica devuelve una copia del problema apta para exponer al cliente.
//
// Elimina por completo los casos oculto:true (no se filtra ni su entrada ni su
// salida esperada). Los casos de ejemplo (no ocultos) se conservan tal cual, ya
// que forman parte del enunciado. Returns la copia saneada; el receptor original
// no se modifica.
func (p Problema) VistaPublica() Problema {
	publico := p
	publico.Casos = make([]Caso, 0, len(p.Casos))
	for _, c := range p.Casos {
		if !c.Oculto {
			publico.Casos = append(publico.Casos, c)
		}
	}
	return publico
}

// NuevoProblema son los datos de entrada para crear un problema de código. El id
// es un identificador legible y estable provisto por quien crea (p. ej.
// "p_two_sum"), no autogenerado.
type NuevoProblema struct {
	ID                  string            `json:"id"`
	Titulo              string            `json:"titulo"`
	Enunciado           string            `json:"enunciado"`
	Dificultad          string            `json:"dificultad"`
	Area                string            `json:"area"`
	Etiquetas           []string          `json:"etiquetas"`
	LenguajesPermitidos []string          `json:"lenguajes_permitidos"`
	Plantillas          map[string]string `json:"plantillas"`
	LimiteTiempoMs      int               `json:"limite_tiempo_ms"`
	LimiteMemoriaMB     int               `json:"limite_memoria_mb"`
	Casos               []Caso            `json:"casos"`
}

// Validar comprueba las reglas básicas del problema nuevo.
//
// Returns la lista de errores por campo; vacía si la entrada es válida. Exige al
// menos un caso con salida esperada y al menos un caso visible (de ejemplo), y
// que todos los lenguajes permitidos los sepa ejecutar el juez.
func (n NuevoProblema) Validar() []string {
	var errs []string
	if !esIDValido(n.ID) {
		errs = append(errs, "id: requerido, minúsculas, números, guion y guion bajo")
	}
	if strings.TrimSpace(n.Titulo) == "" {
		errs = append(errs, "titulo: requerido")
	}
	if strings.TrimSpace(n.Enunciado) == "" {
		errs = append(errs, "enunciado: requerido")
	}
	if !dificultadesValidas[n.Dificultad] {
		errs = append(errs, "dificultad: debe ser facil, media o dificil")
	}
	if strings.TrimSpace(n.Area) == "" {
		errs = append(errs, "area: requerida")
	}
	if len(n.LenguajesPermitidos) == 0 {
		errs = append(errs, "lenguajes_permitidos: al menos uno")
	}
	for _, l := range n.LenguajesPermitidos {
		if !lenguajesValidos[l] {
			errs = append(errs, "lenguajes_permitidos: lenguaje no soportado: "+l)
		}
	}
	if len(n.Casos) == 0 {
		errs = append(errs, "casos: al menos uno")
	}
	visibles := 0
	for i, c := range n.Casos {
		if strings.TrimSpace(c.SalidaEsperada) == "" {
			errs = append(errs, "casos: la salida_esperada es requerida (caso "+itoa(i)+")")
		}
		if !c.Oculto {
			visibles++
		}
	}
	if len(n.Casos) > 0 && visibles == 0 {
		errs = append(errs, "casos: al menos un caso visible (de ejemplo)")
	}
	return errs
}

// PreguntaQA es una pregunta de entrevista por puesto/área (Q&A). Es material de
// autoestudio: la respuesta modelo y los puntos clave se exponen al cliente, no
// se autocalifican.
type PreguntaQA struct {
	ID              string    `json:"id" bson:"_id"`
	Puesto          string    `json:"puesto" bson:"puesto"`
	Area            string    `json:"area" bson:"area"`
	Categoria       string    `json:"categoria" bson:"categoria"`
	Enunciado       string    `json:"enunciado" bson:"enunciado"`
	Tipo            string    `json:"tipo" bson:"tipo"` // abierta | conceptual
	RespuestaModelo string    `json:"respuesta_modelo" bson:"respuesta_modelo"`
	PuntosClave     []string  `json:"puntos_clave" bson:"puntos_clave"`
	Etiquetas       []string  `json:"etiquetas" bson:"etiquetas"`
	CreadoEn        time.Time `json:"creado_en" bson:"creado_en"`
}

// NuevaPreguntaQA son los datos de entrada para crear una pregunta de Q&A.
type NuevaPreguntaQA struct {
	ID              string   `json:"id"`
	Puesto          string   `json:"puesto"`
	Area            string   `json:"area"`
	Categoria       string   `json:"categoria"`
	Enunciado       string   `json:"enunciado"`
	Tipo            string   `json:"tipo"`
	RespuestaModelo string   `json:"respuesta_modelo"`
	PuntosClave     []string `json:"puntos_clave"`
	Etiquetas       []string `json:"etiquetas"`
}

// Validar comprueba las reglas básicas de la pregunta de Q&A nueva.
//
// Returns la lista de errores por campo; vacía si la entrada es válida.
func (n NuevaPreguntaQA) Validar() []string {
	var errs []string
	if !esIDValido(n.ID) {
		errs = append(errs, "id: requerido, minúsculas, números, guion y guion bajo")
	}
	if strings.TrimSpace(n.Area) == "" {
		errs = append(errs, "area: requerida")
	}
	if strings.TrimSpace(n.Enunciado) == "" {
		errs = append(errs, "enunciado: requerido")
	}
	if n.Tipo != "" && !tiposQAValidos[n.Tipo] {
		errs = append(errs, "tipo: debe ser abierta o conceptual")
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

// itoa convierte un índice pequeño no negativo a su texto decimal, sin pasar por
// strconv (se usa solo para componer mensajes de validación).
func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var b [20]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	return string(b[i:])
}
