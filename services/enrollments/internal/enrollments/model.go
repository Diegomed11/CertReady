// Package enrollments define los tipos de dominio del vínculo estudiante-objetivo
// y las reglas de validación de sus entradas.
package enrollments

import "time"

// TipoObjetivo discrimina la tabla del catálogo a la que apunta una inscripción.
type TipoObjetivo string

const (
	TipoCertificacion TipoObjetivo = "certificacion"
	TipoPista         TipoObjetivo = "pista"
)

// Estado del ciclo de vida de una inscripción.
type Estado string

const (
	EstadoActiva     Estado = "activa"
	EstadoPausada    Estado = "pausada"
	EstadoCompletada Estado = "completada"
	EstadoArchivada  Estado = "archivada"
)

// Inscripcion es el vínculo entre un usuario y un objetivo (certificación o pista).
type Inscripcion struct {
	ID           string       `json:"id" db:"id"`
	UsuarioID    string       `json:"usuario_id" db:"usuario_id"`
	TipoObjetivo TipoObjetivo `json:"tipo_objetivo" db:"tipo_objetivo"`
	ObjetivoID   string       `json:"objetivo_id" db:"objetivo_id"`
	Estado       Estado       `json:"estado" db:"estado"`
	CreadoEn     time.Time    `json:"creado_en" db:"creado_en"`
}

// NuevaInscripcion es la entrada para inscribirse a un objetivo.
//
// Importante: el usuario destino NO se acepta en el body. Lo coloca el handler a
// partir del `sub` del JWT (defensa anti-IDOR/BOLA): por diseño es imposible que
// un cliente inscriba a otra cuenta.
type NuevaInscripcion struct {
	TipoObjetivo TipoObjetivo `json:"tipo_objetivo"`
	ObjetivoID   string       `json:"objetivo_id"`
}

// Validar comprueba que la entrada cumpla las reglas básicas (tipo conocido y
// objetivo_id con forma de UUID).
//
// Returns la lista de errores por campo; vacía si la entrada es válida.
func (n NuevaInscripcion) Validar() []string {
	var errs []string
	if n.TipoObjetivo != TipoCertificacion && n.TipoObjetivo != TipoPista {
		errs = append(errs, "tipo_objetivo: debe ser 'certificacion' o 'pista'")
	}
	if !esUUID(n.ObjetivoID) {
		errs = append(errs, "objetivo_id: requerido, formato UUID")
	}
	return errs
}

// CambioEstado es la entrada para cambiar el estado de una inscripción propia.
type CambioEstado struct {
	Estado Estado `json:"estado"`
}

// Validar comprueba que el nuevo estado sea uno de los permitidos.
func (c CambioEstado) Validar() []string {
	switch c.Estado {
	case EstadoActiva, EstadoPausada, EstadoCompletada, EstadoArchivada:
		return nil
	default:
		return []string{"estado: debe ser activa | pausada | completada | archivada"}
	}
}

// esUUID hace una validación de forma básica: 36 caracteres con guiones en las
// posiciones canónicas. El servidor de base de datos hace la validación final.
func esUUID(s string) bool {
	if len(s) != 36 {
		return false
	}
	for i, r := range s {
		switch i {
		case 8, 13, 18, 23:
			if r != '-' {
				return false
			}
		default:
			if !((r >= '0' && r <= '9') || (r >= 'a' && r <= 'f') || (r >= 'A' && r <= 'F')) {
				return false
			}
		}
	}
	return true
}
