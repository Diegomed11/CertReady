// Package httpx ofrece el "kit" HTTP compartido por los servicios: middleware
// transversal, sondas de salud y helpers de respuesta/decodificación JSON.
//
// No conoce el dominio de ningún servicio ni la infraestructura (puertos, TLS):
// solo provee piezas reutilizables para construir un http.Handler consistente.
package httpx

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"log/slog"
	"net/http"
	"time"
)

type ctxKey int

const requestIDKey ctxKey = iota

// RequestIDHeader es el encabezado por el que se propaga el identificador de
// correlación de una petición a través de los servicios.
const RequestIDHeader = "X-Request-ID"

// statusRecorder envuelve un http.ResponseWriter para capturar el código de
// estado escrito, dato que el ResponseWriter estándar no expone tras el envío.
type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

// RequestID asegura que cada petición tenga un identificador de correlación.
//
// Si el cliente (o un proxy aguas arriba) ya envió X-Request-ID, se respeta; si
// no, se genera uno nuevo. El identificador se guarda en el context y se refleja
// en la respuesta, para correlacionar logs de extremo a extremo.
func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		id := req.Header.Get(RequestIDHeader)
		if id == "" {
			id = newRequestID()
		}
		w.Header().Set(RequestIDHeader, id)
		ctx := context.WithValue(req.Context(), requestIDKey, id)
		next.ServeHTTP(w, req.WithContext(ctx))
	})
}

// AccessLog emite una línea de log estructurada por cada petición atendida,
// con método, ruta, estado, duración y request_id.
func AccessLog(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			start := time.Now()
			rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}

			next.ServeHTTP(rec, req)

			logger.LogAttrs(req.Context(), slog.LevelInfo, "http_request",
				slog.String("method", req.Method),
				slog.String("path", req.URL.Path),
				slog.Int("status", rec.status),
				slog.Duration("duration", time.Since(start)),
				slog.String("request_id", RequestIDFromContext(req.Context())),
			)
		})
	}
}

// Recover convierte un panic dentro de un handler en una respuesta 500
// controlada, evitando que un fallo aislado tumbe el proceso del servidor.
func Recover(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			defer func() {
				if v := recover(); v != nil {
					logger.LogAttrs(req.Context(), slog.LevelError, "panic_recuperado",
						slog.Any("panic", v),
						slog.String("request_id", RequestIDFromContext(req.Context())),
					)
					WriteError(w, http.StatusInternalServerError, "error_interno", "error interno")
				}
			}()
			next.ServeHTTP(w, req)
		})
	}
}

// Chain aplica una lista de middlewares a un handler, de fuera hacia dentro: el
// primero de la lista queda como el más externo (envuelve a los siguientes).
func Chain(h http.Handler, middlewares ...func(http.Handler) http.Handler) http.Handler {
	for i := len(middlewares) - 1; i >= 0; i-- {
		h = middlewares[i](h)
	}
	return h
}

// RequestIDFromContext recupera el identificador de correlación asociado al
// context, o cadena vacía si la petición no pasó por RequestID.
func RequestIDFromContext(ctx context.Context) string {
	if id, ok := ctx.Value(requestIDKey).(string); ok {
		return id
	}
	return ""
}

// newRequestID genera un identificador hexadecimal aleatorio de 128 bits.
//
// Ante un fallo (extremadamente improbable) de la fuente de entropía, devuelve
// "unknown": un id de correlación es de mejor esfuerzo y nunca debe impedir
// atender la petición.
func newRequestID() string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "unknown"
	}
	return hex.EncodeToString(b[:])
}
