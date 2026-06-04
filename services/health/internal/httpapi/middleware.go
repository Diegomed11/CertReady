// Package httpapi expone la API HTTP del servicio: enrutado, middleware
// transversal y handlers de las sondas de salud.
//
// El paquete no conoce detalles de infraestructura (puertos, TLS, señales): solo
// construye un http.Handler. El ciclo de vida del servidor vive en cmd/server.
package httpapi

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"log/slog"
	"net/http"
	"time"
)

// ctxKey es un tipo privado para claves de context y así evitar colisiones con
// claves de otros paquetes (recomendación de la documentación de context).
type ctxKey int

const requestIDKey ctxKey = iota

// requestIDHeader es el encabezado por el que se propaga el identificador de
// correlación de una petición a través de los servicios.
const requestIDHeader = "X-Request-ID"

// statusRecorder envuelve un http.ResponseWriter para capturar el código de
// estado escrito, dato que el ResponseWriter estándar no expone tras el envío.
type statusRecorder struct {
	http.ResponseWriter
	status int
}

// WriteHeader registra el código de estado y lo delega al ResponseWriter real.
func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

// withRequestID asegura que cada petición tenga un identificador de correlación.
//
// Si el cliente (o un proxy aguas arriba) ya envió X-Request-ID, se respeta; si
// no, se genera uno nuevo. El identificador se guarda en el context y se refleja
// en la respuesta, de modo que un mismo id permita correlacionar logs de
// extremo a extremo.
func withRequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		id := req.Header.Get(requestIDHeader)
		if id == "" {
			id = newRequestID()
		}
		w.Header().Set(requestIDHeader, id)
		ctx := context.WithValue(req.Context(), requestIDKey, id)
		next.ServeHTTP(w, req.WithContext(ctx))
	})
}

// withAccessLog emite una línea de log estructurada por cada petición atendida.
//
// Parameters
//
//	logger : destino de los registros; se enriquece con el id de correlación.
//	next   : handler encadenado al que se delega la atención.
//
// Cada registro incluye método, ruta, estado, duración y request_id, lo que
// alimenta directamente las métricas de latencia y errores 5xx en CloudWatch.
func withAccessLog(logger *slog.Logger, next http.Handler) http.Handler {
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

// withRecover convierte un panic dentro de un handler en una respuesta 500
// controlada, evitando que un fallo aislado tumbe el proceso del servidor.
func withRecover(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		defer func() {
			if v := recover(); v != nil {
				logger.LogAttrs(req.Context(), slog.LevelError, "panic_recuperado",
					slog.Any("panic", v),
					slog.String("request_id", RequestIDFromContext(req.Context())),
				)
				w.Header().Set("Content-Type", "application/json; charset=utf-8")
				w.WriteHeader(http.StatusInternalServerError)
				_, _ = w.Write([]byte(`{"status":"error","detalle":"error interno"}`))
			}
		}()
		next.ServeHTTP(w, req)
	})
}

// RequestIDFromContext recupera el identificador de correlación asociado al
// context, o cadena vacía si la petición no pasó por withRequestID.
func RequestIDFromContext(ctx context.Context) string {
	if id, ok := ctx.Value(requestIDKey).(string); ok {
		return id
	}
	return ""
}

// newRequestID genera un identificador hexadecimal aleatorio de 128 bits.
//
// Ante un fallo (extremadamente improbable) de la fuente de entropía del sistema,
// devuelve "unknown" en lugar de propagar el error: un id de correlación es de
// mejor esfuerzo y nunca debe impedir atender la petición.
func newRequestID() string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "unknown"
	}
	return hex.EncodeToString(b[:])
}
