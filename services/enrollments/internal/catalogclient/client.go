// Package catalogclient ofrece un cliente HTTP mínimo para consultar al servicio
// catalog desde enrollments, validando que un objetivo de inscripción exista
// antes de persistirla.
//
// Las referencias entre servicios son lógicas, no FKs (ADR-09); esta validación
// la hace la capa de aplicación al inscribir, no la base de datos.
package catalogclient

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"
)

// ErrCatalogoNoDisponible se devuelve cuando el servicio catalog responde con un
// error 5xx, no responde a tiempo o no es alcanzable.
var ErrCatalogoNoDisponible = errors.New("servicio catalog no disponible")

// Client es la abstracción que necesita el handler para verificar objetivos.
//
// Depender de una interfaz (y no de la implementación HTTP) permite probar el
// handler con un doble en memoria sin levantar el servicio catalog.
type Client interface {
	CertificacionExiste(ctx context.Context, id string) (bool, error)
	PistaExiste(ctx context.Context, id string) (bool, error)
}

// HTTPClient implementa Client llamando al servicio catalog vía HTTP.
type HTTPClient struct {
	baseURL string
	http    *http.Client
}

// New construye el cliente HTTP. baseURL es la URL raíz del servicio catalog
// (p. ej. "http://localhost:8090" en local; la Function URL en deploy).
//
// El timeout total de la request acota la latencia que enrollments puede
// transferir a sus clientes si catalog se degrada.
func New(baseURL string, timeout time.Duration) *HTTPClient {
	if timeout <= 0 {
		timeout = 5 * time.Second
	}
	return &HTTPClient{
		baseURL: baseURL,
		http:    &http.Client{Timeout: timeout},
	}
}

// CertificacionExiste informa si existe una certificación con ese id.
//
// Returns (true, nil) si responde 200; (false, nil) si responde 404;
// (false, ErrCatalogoNoDisponible) si hay error de red o 5xx; (false, error) si
// responde otro código inesperado.
func (c *HTTPClient) CertificacionExiste(ctx context.Context, id string) (bool, error) {
	return c.cabeza(ctx, "/v1/certifications/"+id)
}

// PistaExiste informa si existe una pista con ese id.
func (c *HTTPClient) PistaExiste(ctx context.Context, id string) (bool, error) {
	return c.cabeza(ctx, "/v1/tracks/"+id)
}

// cabeza consulta el recurso con un GET ligero (catalog no implementa HEAD).
// Se podría optimizar más adelante si el volumen lo justifica.
func (c *HTTPClient) cabeza(ctx context.Context, path string) (bool, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return false, fmt.Errorf("preparar request a catalog: %w", err)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return false, fmt.Errorf("%w: %v", ErrCatalogoNoDisponible, err)
	}
	defer resp.Body.Close()

	switch {
	case resp.StatusCode == http.StatusOK:
		return true, nil
	case resp.StatusCode == http.StatusNotFound:
		return false, nil
	case resp.StatusCode >= 500:
		return false, fmt.Errorf("%w: catalog respondió %d", ErrCatalogoNoDisponible, resp.StatusCode)
	default:
		return false, fmt.Errorf("catalog respondió código inesperado %d", resp.StatusCode)
	}
}
