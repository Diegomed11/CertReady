package httpx

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

// Defaults de rate-limit por IP. Generosos: son defensa en profundidad por
// instancia (anti fuerza bruta / abuso), no el límite fino de producción (ese lo
// aplica el WAF de forma distribuida).
//
// Estos servicios son internos: solo los llama el BFF (nunca el navegador
// directo), así que todas las peticiones llegan desde una sola IP y comparten un
// único bucket. Un render del BFF puede abanicar decenas de llamadas legítimas en
// una ráfaga (p. ej. una página de catálogo + el prefetch de sus enlaces), de modo
// que el cupo debe absorberlas sin pegar 429; un límite bajo solo estrangularía al
// propio BFF, nunca a un atacante (que no alcanza estos servicios).
const (
	DefaultRPS   = 200.0
	DefaultBurst = 400
)

const (
	rlSweepEvery = 5 * time.Minute
	rlIdleEvict  = 10 * time.Minute
)

// RateLimit limita la tasa de peticiones por IP con un token-bucket en memoria.
//
// Excedido el cupo responde 429 con Retry-After. Las sondas /v1/health y /v1/ready
// quedan **exentas** para no tumbar los health-checks del balanceador (vienen de una
// sola IP a alta frecuencia). Detrás de un proxy de confianza usa el primer salto de
// X-Forwarded-For; si no, la dirección remota.
//
// Parameters
//
//	rps   : tokens repuestos por segundo (tasa sostenida por IP).
//	burst : capacidad del bucket (ráfaga máxima por IP).
func RateLimit(rps float64, burst int) func(http.Handler) http.Handler {
	lim := newIPLimiter(rps, float64(burst))
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/v1/health" || r.URL.Path == "/v1/ready" {
				next.ServeHTTP(w, r)
				return
			}
			if !lim.allow(clientIP(r)) {
				w.Header().Set("Retry-After", "1")
				WriteError(w, http.StatusTooManyRequests, "rate_limited",
					"demasiadas peticiones; intenta de nuevo en un momento")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

type tokenBucket struct {
	tokens float64
	last   time.Time
}

type ipLimiter struct {
	mu        sync.Mutex
	buckets   map[string]*tokenBucket
	rps       float64
	burst     float64
	lastSweep time.Time
}

func newIPLimiter(rps, burst float64) *ipLimiter {
	return &ipLimiter{
		buckets:   make(map[string]*tokenBucket),
		rps:       rps,
		burst:     burst,
		lastSweep: time.Now(),
	}
}

// allow descuenta un token del bucket de la IP y dice si la petición procede.
func (l *ipLimiter) allow(ip string) bool {
	now := time.Now()
	l.mu.Lock()
	defer l.mu.Unlock()

	l.sweep(now)

	b := l.buckets[ip]
	if b == nil {
		b = &tokenBucket{tokens: l.burst, last: now}
		l.buckets[ip] = b
	} else {
		b.tokens += now.Sub(b.last).Seconds() * l.rps
		if b.tokens > l.burst {
			b.tokens = l.burst
		}
		b.last = now
	}
	if b.tokens >= 1 {
		b.tokens--
		return true
	}
	return false
}

// sweep elimina buckets inactivos para acotar la memoria (a lo sumo cada rlSweepEvery).
func (l *ipLimiter) sweep(now time.Time) {
	if now.Sub(l.lastSweep) < rlSweepEvery {
		return
	}
	for ip, b := range l.buckets {
		if now.Sub(b.last) > rlIdleEvict {
			delete(l.buckets, ip)
		}
	}
	l.lastSweep = now
}

// clientIP devuelve la IP del cliente: primer salto de X-Forwarded-For si viene de
// un proxy de confianza, o el host de RemoteAddr en su defecto.
func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		if i := strings.IndexByte(xff, ','); i >= 0 {
			return strings.TrimSpace(xff[:i])
		}
		return strings.TrimSpace(xff)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
