package httpx

import "net/http"

// DefaultMaxBodyBytes es el tamaño máximo por defecto del cuerpo de una petición
// a un servicio (1 MiB). Los servicios reciben JSON pequeño; el CV (5 MB) lo maneja
// el DSS aparte, con su propia lectura acotada.
const DefaultMaxBodyBytes int64 = 1 << 20

// MaxBytes limita el tamaño del cuerpo de la petición (defensa anti-DoS por payload
// grande). Envuelve `r.Body` con http.MaxBytesReader: si el handler intenta leer más
// de n bytes, la lectura falla y el decodificador responde 400/413. Las peticiones
// sin cuerpo (GET de salud, etc.) no se ven afectadas.
func MaxBytes(n int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Body != nil {
				r.Body = http.MaxBytesReader(w, r.Body, n)
			}
			next.ServeHTTP(w, r)
		})
	}
}
