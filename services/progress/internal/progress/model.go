// Package progress define los tipos de dominio del progreso de estudio de un
// usuario (lecciones leídas y resultado del quiz por tema) y la validación de sus
// entradas. El grano es (usuario, certificación, tema); las claves de certificación
// y tema son slugs legibles, no UUIDs.
package progress

import (
	"strings"
	"time"
)

// UmbralAprobado es el puntaje mínimo [0,100] para dar un quiz de tema por aprobado.
const UmbralAprobado = 70.0

// LeccionCompletada es una lección (material) marcada como leída por el usuario.
type LeccionCompletada struct {
	Tema       string    `json:"tema" db:"tema"`
	MaterialID string    `json:"material_id" db:"material_id"`
	CreadoEn   time.Time `json:"creado_en" db:"creado_en"`
}

// TemaProgreso es el mejor resultado del quiz de un tema para el usuario.
type TemaProgreso struct {
	Tema         string  `json:"tema" db:"tema"`
	QuizPuntaje  float64 `json:"quiz_puntaje" db:"quiz_puntaje"`
	QuizAprobado bool    `json:"quiz_aprobado" db:"quiz_aprobado"`
}

// ProgresoCert es el progreso del usuario en una certificación: lecciones leídas y
// estado del quiz por tema. Con esto el cliente decide qué temas están completados
// y cuál desbloquear.
type ProgresoCert struct {
	Lecciones []LeccionCompletada `json:"lecciones"`
	Temas     []TemaProgreso      `json:"temas"`
}

// NuevaLeccion marca una lección como leída. El usuario lo fija el handler a partir
// del token (nunca el body): defensa anti-IDOR.
type NuevaLeccion struct {
	Certificacion string `json:"certificacion"`
	Tema          string `json:"tema"`
	MaterialID    string `json:"material_id"`
}

// Validar comprueba las reglas básicas de la entrada.
//
// Returns la lista de errores por campo; vacía si la entrada es válida.
func (n NuevaLeccion) Validar() []string {
	var errs []string
	if strings.TrimSpace(n.Certificacion) == "" {
		errs = append(errs, "certificacion: requerida")
	}
	if strings.TrimSpace(n.Tema) == "" {
		errs = append(errs, "tema: requerido")
	}
	if strings.TrimSpace(n.MaterialID) == "" {
		errs = append(errs, "material_id: requerido")
	}
	return errs
}

// NuevaRevisionQA registra la autoevaluación de una pregunta de entrevista (Q&A):
// qué tan bien la respondió el usuario tras ver la respuesta modelo. El usuario lo
// fija el handler a partir del token (nunca el body). nivel ∈ {1,2,3}.
type NuevaRevisionQA struct {
	QaRef string `json:"qa_ref"`
	Nivel int    `json:"nivel"` // 1=me costó · 2=regular · 3=bien
}

// Validar comprueba las reglas básicas de la entrada.
//
// Returns la lista de errores por campo; vacía si la entrada es válida.
func (n NuevaRevisionQA) Validar() []string {
	var errs []string
	if strings.TrimSpace(n.QaRef) == "" {
		errs = append(errs, "qa_ref: requerido")
	}
	if n.Nivel < 1 || n.Nivel > 3 {
		errs = append(errs, "nivel: debe ser 1, 2 o 3")
	}
	return errs
}

// NuevoQuiz registra el resultado de un quiz de tema. El usuario lo fija el handler
// a partir del token.
type NuevoQuiz struct {
	Certificacion string  `json:"certificacion"`
	Tema          string  `json:"tema"`
	Puntaje       float64 `json:"puntaje"`
}

// Validar comprueba las reglas básicas de la entrada.
//
// Returns la lista de errores por campo; vacía si la entrada es válida.
func (n NuevoQuiz) Validar() []string {
	var errs []string
	if strings.TrimSpace(n.Certificacion) == "" {
		errs = append(errs, "certificacion: requerida")
	}
	if strings.TrimSpace(n.Tema) == "" {
		errs = append(errs, "tema: requerido")
	}
	if n.Puntaje < 0 || n.Puntaje > 100 {
		errs = append(errs, "puntaje: debe estar en [0, 100]")
	}
	return errs
}
