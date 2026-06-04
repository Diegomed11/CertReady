package httpx

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
)

// maxBodyBytes acota el tamaño del cuerpo de una petición JSON para evitar que
// un cliente agote la memoria del servicio (defensa básica de disponibilidad).
const maxBodyBytes = 1 << 20 // 1 MiB

// ErrorBody es la envoltura JSON de error que devuelven todos los servicios.
type ErrorBody struct {
	Error ErrorDetail `json:"error"`
}

// ErrorDetail describe un error de forma legible y programable.
//
// Code es un identificador estable (snake_case) para que el cliente ramifique
// sin parsear el mensaje; Message es texto humano; Details lleva contexto extra
// (p. ej. campos inválidos).
type ErrorDetail struct {
	Code    string   `json:"code"`
	Message string   `json:"message"`
	Details []string `json:"details,omitempty"`
}

// WriteJSON serializa v como JSON y lo escribe con el código de estado indicado.
//
// Un error de codificación se ignora deliberadamente: la cabecera ya se envió y
// no hay forma de corregir la respuesta a medio camino.
func WriteJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// WriteError escribe una respuesta de error con la envoltura estándar.
func WriteError(w http.ResponseWriter, status int, code, message string, details ...string) {
	WriteJSON(w, status, ErrorBody{Error: ErrorDetail{
		Code:    code,
		Message: message,
		Details: details,
	}})
}

// DecodeJSON decodifica el cuerpo de la petición en dst con defensas de borde:
// limita el tamaño y rechaza campos desconocidos (evita que entren datos no
// previstos, parte de la validación anti-inyección por diseño).
//
// Returns un error legible si el cuerpo no es JSON válido, está vacío, excede el
// límite o trae campos no esperados; nil si decodifica correctamente.
func DecodeJSON(w http.ResponseWriter, r *http.Request, dst any) error {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()

	if err := dec.Decode(dst); err != nil {
		var maxErr *http.MaxBytesError
		switch {
		case errors.Is(err, io.EOF):
			return fmt.Errorf("el cuerpo de la petición está vacío")
		case errors.As(err, &maxErr):
			return fmt.Errorf("el cuerpo excede el máximo de %d bytes", maxErr.Limit)
		default:
			return fmt.Errorf("cuerpo JSON inválido: %w", err)
		}
	}

	// Un segundo token indica más de un valor JSON en el cuerpo: lo rechazamos.
	if dec.More() {
		return fmt.Errorf("el cuerpo debe contener un único objeto JSON")
	}
	return nil
}
