package exams

// SesionConPreguntas es la respuesta al crear una sesión: la sesión más las
// preguntas en su forma pública (sin respuestas correctas).
type SesionConPreguntas struct {
	Sesion
	Preguntas []PreguntaPublica `json:"preguntas"`
}

// RevisionSesion es la respuesta al consultar una sesión. Si está en curso, trae
// las preguntas públicas; si está finalizada, trae el resultado con respuestas
// correctas y explicaciones.
type RevisionSesion struct {
	Sesion
	Preguntas []PreguntaPublica `json:"preguntas,omitempty"`
	Resultado *Resultado        `json:"resultado,omitempty"`
}
