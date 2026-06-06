package judge

import (
	"strings"
	"time"
)

// maxFuenteBytes acota el tamaño del código enviado (defensa de disponibilidad).
const maxFuenteBytes = 64 * 1024

// Veredicto es el desenlace global de una corrida.
type Veredicto string

const (
	Accepted     Veredicto = "accepted"
	WrongAnswer  Veredicto = "wrong_answer"
	TimeLimit    Veredicto = "time_limit_exceeded"
	MemLimit     Veredicto = "memory_limit_exceeded"
	RuntimeError Veredicto = "runtime_error"
	CompileError Veredicto = "compile_error"
)

// EnvioCodigo es la solicitud de evaluación del estudiante.
type EnvioCodigo struct {
	ProblemaRef string `json:"problema_ref"`
	Lenguaje    string `json:"lenguaje"`
	Fuente      string `json:"fuente"`
}

// Validar comprueba las reglas básicas del envío.
//
// Returns la lista de errores por campo; vacía si la entrada es válida.
func (e EnvioCodigo) Validar() []string {
	var errs []string
	if strings.TrimSpace(e.ProblemaRef) == "" {
		errs = append(errs, "problema_ref: requerido")
	}
	if strings.TrimSpace(e.Lenguaje) == "" {
		errs = append(errs, "lenguaje: requerido")
	}
	if strings.TrimSpace(e.Fuente) == "" {
		errs = append(errs, "fuente: requerida")
	}
	if len(e.Fuente) > maxFuenteBytes {
		errs = append(errs, "fuente: excede el máximo permitido")
	}
	return errs
}

// ResultadoCaso es el resultado de un caso de prueba.
//
// Anti-fuga: para casos ocultos solo se reporta el estado; la entrada, la salida
// esperada y la obtenida quedan vacías (omitidas en JSON).
type ResultadoCaso struct {
	Indice         int    `json:"indice"`
	Oculto         bool   `json:"oculto"`
	Estado         string `json:"estado"` // passed | wrong | tle | mle | re | ce
	Entrada        string `json:"entrada,omitempty"`
	SalidaEsperada string `json:"salida_esperada,omitempty"`
	SalidaObtenida string `json:"salida_obtenida,omitempty"`
}

// Resultado es el desenlace completo de una calificación.
type Resultado struct {
	Veredicto    Veredicto       `json:"veredicto"`
	CasosTotal   int             `json:"casos_total"`
	CasosPasados int             `json:"casos_pasados"`
	DuracionMs   int             `json:"duracion_ms"`
	Casos        []ResultadoCaso `json:"casos"`
}

// Corrida es el registro persistido (PostgreSQL) de una calificación. Alimenta el
// historial del estudiante y, más adelante, la capa analítica (Fase 4).
type Corrida struct {
	ID           string    `json:"id"`
	UsuarioID    string    `json:"usuario_id"`
	ProblemaRef  string    `json:"problema_ref"`
	Lenguaje     string    `json:"lenguaje"`
	Veredicto    string    `json:"veredicto"`
	CasosPasados int       `json:"casos_pasados"`
	CasosTotal   int       `json:"casos_total"`
	DuracionMs   int       `json:"duracion_ms"`
	CreadoEn     time.Time `json:"creado_en"`
}
