package auth

import (
	"context"
	"net/http"
	"strings"

	"github.com/certready/certready/libs/platform/httpx"
)

type ctxKey int

const identityKey ctxKey = iota

// Middleware autentica la petición: extrae el token Bearer, lo valida y guarda
// la Identity en el context. Responde 401 si falta o es inválido.
//
// Se aplica a las rutas que requieren autenticación; para exigir además un rol,
// se compone con RequireRole por dentro de este middleware.
func (a *Authenticator) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, ok := bearerToken(r)
		if !ok {
			httpx.WriteError(w, http.StatusUnauthorized, "no_autenticado", "falta el token Bearer")
			return
		}
		id, err := a.Verify(r.Context(), raw)
		if err != nil {
			httpx.WriteError(w, http.StatusUnauthorized, "token_invalido", "token inválido o expirado")
			return
		}
		ctx := context.WithValue(r.Context(), identityKey, id)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RequireRole exige que la identidad autenticada posea el rol indicado.
//
// Debe aplicarse por dentro de Middleware (que es quien coloca la Identity en el
// context). Responde 401 si no hay identidad y 403 si la hay pero sin el rol.
func RequireRole(role string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			id, ok := IdentityFromContext(r.Context())
			if !ok {
				httpx.WriteError(w, http.StatusUnauthorized, "no_autenticado", "se requiere autenticación")
				return
			}
			if !id.HasRole(role) {
				httpx.WriteError(w, http.StatusForbidden, "prohibido", "permisos insuficientes")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// IdentityFromContext recupera la identidad autenticada del context.
//
// Returns (Identity, true) si la petición pasó por Middleware; (zero, false) en
// caso contrario.
func IdentityFromContext(ctx context.Context) (Identity, bool) {
	id, ok := ctx.Value(identityKey).(Identity)
	return id, ok
}

// bearerToken extrae el token del encabezado "Authorization: Bearer <token>".
func bearerToken(r *http.Request) (string, bool) {
	const prefix = "Bearer "
	h := r.Header.Get("Authorization")
	if len(h) > len(prefix) && strings.EqualFold(h[:len(prefix)], prefix) {
		token := strings.TrimSpace(h[len(prefix):])
		return token, token != ""
	}
	return "", false
}
