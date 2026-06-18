package exams

// CeldaAgg agrega los intentos de un usuario por celda (tema, dificultad) dentro
// de una certificación. Es la base operativa de la analítica por-usuario: se
// calcula en vivo desde Postgres (sin OLAP).
type CeldaAgg struct {
	Tema       string
	Dificultad string
	Aciertos   int
	Total      int
}

// PuntoFecha agrega los intentos de un usuario por día (tendencia diaria).
type PuntoFecha struct {
	Fecha    string // YYYY-MM-DD
	Aciertos int
	Total    int
}
