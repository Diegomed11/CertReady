// Package judge contiene el dominio del juez de código: la vista del problema que
// necesita para calificar, el modelo de veredictos y la lógica de calificación.
package judge

// Límites por defecto si el problema no los especifica.
const (
	defTiempoMs  = 2000
	defMemoriaMB = 256
)

// Caso replica un caso de prueba almacenado en MongoDB (lectura).
type Caso struct {
	Entrada        string `bson:"entrada"`
	SalidaEsperada string `bson:"salida_esperada"`
	Oculto         bool   `bson:"oculto"`
	Peso           int    `bson:"peso"`
}

// Problema es la vista de solo lectura del problema que el juez necesita para
// calificar: incluye los casos ocultos y los límites de ejecución.
//
// Espeja el documento que escribe el servicio problems en la colección
// "problemas", sin importar su módulo (evita acoplamiento). Los casos ocultos
// solo viven aquí, del lado del servidor; nunca se exponen al cliente.
type Problema struct {
	ID                  string   `bson:"_id"`
	Area                string   `bson:"area"` // se denormaliza en la ejecucion (analítica por área, plano operativo)
	LenguajesPermitidos []string `bson:"lenguajes_permitidos"`
	LimiteTiempoMs      int      `bson:"limite_tiempo_ms"`
	LimiteMemoriaMB     int      `bson:"limite_memoria_mb"`
	Casos               []Caso   `bson:"casos"`
}

// PermiteLenguaje informa si el problema admite el lenguaje dado.
func (p Problema) PermiteLenguaje(lenguaje string) bool {
	for _, l := range p.LenguajesPermitidos {
		if l == lenguaje {
			return true
		}
	}
	return false
}

// TiempoMs devuelve el límite de tiempo efectivo (con default si no está fijado).
func (p Problema) TiempoMs() int {
	if p.LimiteTiempoMs <= 0 {
		return defTiempoMs
	}
	return p.LimiteTiempoMs
}

// MemoriaMB devuelve el límite de memoria efectivo (con default si no está fijado).
func (p Problema) MemoriaMB() int {
	if p.LimiteMemoriaMB <= 0 {
		return defMemoriaMB
	}
	return p.LimiteMemoriaMB
}
