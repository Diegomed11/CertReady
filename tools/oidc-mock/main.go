// Command oidc-mock es un emisor OIDC mínimo para desarrollo local de CertReady.
//
// Sirve un proveedor OIDC con discovery, JWKS, authorize (auto-aprueba) y token
// (Authorization Code + PKCE), firmando JWT con una clave RSA generada al
// arranque. No es código de producción: en producción se usa Amazon Cognito
// (ADR-06). El validador del backend (libs/platform/auth) es el mismo en ambos
// casos — solo cambia la fuente del JWKS.
//
// Uso:
//
//	go run ./tools/oidc-mock                       # :9099, sub "dev-user"
//	OIDC_MOCK_ADDR=:9100 go run ./tools/oidc-mock  # otro puerto
//
// Parámetros del /authorize (todos opcionales):
//
//	email      identifica al "usuario" simulado (default OIDC_MOCK_DEFAULT_EMAIL)
//	name       nombre legible (claim `name`)
//	groups     CSV de grupos → claim `cognito:groups` (p. ej. "admin,estudiante")
//	sub        sub explícito (UUID); si falta, se deriva del email
//
// El sub se DERIVA determinísticamente del email (UUIDv5-like) para que un mismo
// email produzca siempre el mismo sub entre logins (no rompe los upserts JIT del
// servicio users).
package main

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha1"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	defaultAddr  = ":9099"
	defaultEmail = "dev@local"
	tokenTTL     = time.Hour
	codeTTL      = 5 * time.Minute
)

// pendingCode es un "authorization code" pendiente de canjear: guarda los datos
// del usuario y el challenge PKCE asociado, con vencimiento.
type pendingCode struct {
	subject       string
	email         string
	name          string
	groups        []string
	nonce         string
	codeChallenge string
	method        string // "S256" o "plain"
	expira        time.Time
}

// server agrupa el estado mutable y la clave de firma.
type server struct {
	mu       sync.Mutex
	issuer   string
	priv     *rsa.PrivateKey
	kid      string
	codes    map[string]pendingCode
	defEmail string
}

func main() {
	addr := getenv("OIDC_MOCK_ADDR", defaultAddr)
	defEmail := getenv("OIDC_MOCK_DEFAULT_EMAIL", defaultEmail)

	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		log.Fatalf("generar clave RSA: %v", err)
	}

	// Issuer = scheme + host visto desde fuera. En dev local: http://localhost:<port>.
	port := strings.TrimPrefix(addr, ":")
	issuer := "http://localhost:" + port

	s := &server{
		issuer:   issuer,
		priv:     priv,
		kid:      thumbprint(&priv.PublicKey),
		codes:    map[string]pendingCode{},
		defEmail: defEmail,
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /.well-known/openid-configuration", s.discovery)
	mux.HandleFunc("GET /jwks", s.jwks)
	mux.HandleFunc("GET /authorize", s.authorize)
	mux.HandleFunc("POST /token", s.token)
	mux.HandleFunc("GET /userinfo", s.userinfo)
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("ok"))
	})

	log.Printf("oidc-mock escuchando en %s (issuer %s)", addr, issuer)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}

// discovery sirve /.well-known/openid-configuration con el conjunto mínimo de
// campos que requiere openid-client (Node) y go-oidc.
func (s *server) discovery(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"issuer":                                s.issuer,
		"authorization_endpoint":                s.issuer + "/authorize",
		"token_endpoint":                        s.issuer + "/token",
		"userinfo_endpoint":                     s.issuer + "/userinfo",
		"jwks_uri":                              s.issuer + "/jwks",
		"response_types_supported":              []string{"code"},
		"subject_types_supported":               []string{"public"},
		"id_token_signing_alg_values_supported": []string{"RS256"},
		"scopes_supported":                      []string{"openid", "email", "profile"},
		"token_endpoint_auth_methods_supported": []string{"none"},
		"code_challenge_methods_supported":      []string{"S256", "plain"},
	})
}

// jwks expone la clave pública en formato JWKS (RFC 7517).
func (s *server) jwks(w http.ResponseWriter, _ *http.Request) {
	pub := &s.priv.PublicKey
	writeJSON(w, http.StatusOK, map[string]any{
		"keys": []map[string]any{
			{
				"kty": "RSA",
				"alg": "RS256",
				"use": "sig",
				"kid": s.kid,
				"n":   base64.RawURLEncoding.EncodeToString(pub.N.Bytes()),
				"e":   base64.RawURLEncoding.EncodeToString(big.NewInt(int64(pub.E)).Bytes()),
			},
		},
	})
}

// authorize emite un code y redirige al callback. No pide credenciales: lee la
// identidad simulada de los query params (o de los defaults) para que el
// desarrollador pueda "iniciar sesión" como cualquier usuario en cualquier rol.
func (s *server) authorize(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	redirectURI := q.Get("redirect_uri")
	state := q.Get("state")
	if redirectURI == "" {
		http.Error(w, "falta redirect_uri", http.StatusBadRequest)
		return
	}

	email := first(q.Get("email"), s.defEmail)
	name := first(q.Get("name"), "Dev User")
	subject := first(q.Get("sub"), subFromEmail(email))
	var groups []string
	if g := q.Get("groups"); g != "" {
		groups = splitCSV(g)
	}

	codeBytes := make([]byte, 24)
	_, _ = rand.Read(codeBytes)
	code := base64.RawURLEncoding.EncodeToString(codeBytes)

	method := q.Get("code_challenge_method")
	if method == "" {
		method = "plain"
	}

	s.mu.Lock()
	s.codes[code] = pendingCode{
		subject:       subject,
		email:         email,
		name:          name,
		groups:        groups,
		nonce:         q.Get("nonce"),
		codeChallenge: q.Get("code_challenge"),
		method:        method,
		expira:        time.Now().Add(codeTTL),
	}
	s.mu.Unlock()

	u, err := url.Parse(redirectURI)
	if err != nil {
		http.Error(w, "redirect_uri inválido", http.StatusBadRequest)
		return
	}
	v := u.Query()
	v.Set("code", code)
	if state != "" {
		v.Set("state", state)
	}
	u.RawQuery = v.Encode()
	http.Redirect(w, r, u.String(), http.StatusFound)
}

// token canjea un code por un id_token (y un access_token equivalente, simplificación).
// Verifica PKCE si el authorize registró un challenge.
func (s *server) token(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, "form inválido", http.StatusBadRequest)
		return
	}

	switch r.Form.Get("grant_type") {
	case "authorization_code":
		s.tokenAuthCode(w, r)
	case "refresh_token":
		s.tokenRefresh(w, r)
	default:
		http.Error(w, "grant_type no soportado", http.StatusBadRequest)
	}
}

func (s *server) tokenAuthCode(w http.ResponseWriter, r *http.Request) {
	code := r.Form.Get("code")
	verifier := r.Form.Get("code_verifier")

	s.mu.Lock()
	pc, ok := s.codes[code]
	if ok {
		delete(s.codes, code) // un code se canjea una sola vez (OAuth 2.1).
	}
	s.mu.Unlock()

	if !ok || time.Now().After(pc.expira) {
		http.Error(w, "code inválido o expirado", http.StatusBadRequest)
		return
	}
	if pc.codeChallenge != "" {
		if !pkceOK(pc.method, pc.codeChallenge, verifier) {
			http.Error(w, "PKCE inválido", http.StatusBadRequest)
			return
		}
	}

	clientID := r.Form.Get("client_id")
	idToken, err := s.firmar(pc, clientID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"access_token":  idToken,
		"id_token":      idToken,
		"refresh_token": "rt:" + pc.subject, // refresh determinístico simplificado
		"token_type":    "Bearer",
		"expires_in":    int(tokenTTL.Seconds()),
	})
}

// tokenRefresh re-emite tokens a partir del subject codificado en el refresh.
// No persiste estado: cualquier refresh con un sub válido funciona en dev.
func (s *server) tokenRefresh(w http.ResponseWriter, r *http.Request) {
	rt := r.Form.Get("refresh_token")
	if !strings.HasPrefix(rt, "rt:") {
		http.Error(w, "refresh_token inválido", http.StatusBadRequest)
		return
	}
	pc := pendingCode{
		subject: strings.TrimPrefix(rt, "rt:"),
		email:   s.defEmail,
		name:    "Dev User",
	}
	clientID := r.Form.Get("client_id")
	idToken, err := s.firmar(pc, clientID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"access_token": idToken,
		"id_token":     idToken,
		"token_type":   "Bearer",
		"expires_in":   int(tokenTTL.Seconds()),
	})
}

// userinfo devuelve los claims básicos del bearer. Útil si el cliente OIDC
// prefiere consultarlo en vez de leer el id_token.
func (s *server) userinfo(w http.ResponseWriter, r *http.Request) {
	raw := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	if raw == "" {
		http.Error(w, "falta bearer", http.StatusUnauthorized)
		return
	}
	tok, err := jwt.Parse(raw, func(*jwt.Token) (any, error) { return &s.priv.PublicKey, nil })
	if err != nil || !tok.Valid {
		http.Error(w, "token inválido", http.StatusUnauthorized)
		return
	}
	claims, _ := tok.Claims.(jwt.MapClaims)
	writeJSON(w, http.StatusOK, claims)
}

// firmar produce un JWT RS256 con los claims OIDC estándar más los grupos.
func (s *server) firmar(pc pendingCode, clientID string) (string, error) {
	now := time.Now()
	claims := jwt.MapClaims{
		"iss":   s.issuer,
		"sub":   pc.subject,
		"iat":   now.Unix(),
		"exp":   now.Add(tokenTTL).Unix(),
		"email": pc.email,
	}
	if pc.name != "" {
		claims["name"] = pc.name
	}
	if pc.nonce != "" {
		claims["nonce"] = pc.nonce
	}
	if len(pc.groups) > 0 {
		claims["cognito:groups"] = pc.groups
	}
	if clientID != "" {
		claims["aud"] = clientID
	}

	t := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	t.Header["kid"] = s.kid
	return t.SignedString(s.priv)
}

// --- helpers ---------------------------------------------------------------

func pkceOK(method, challenge, verifier string) bool {
	switch method {
	case "S256":
		sum := sha256.Sum256([]byte(verifier))
		return base64.RawURLEncoding.EncodeToString(sum[:]) == challenge
	case "plain":
		return verifier == challenge
	default:
		return false
	}
}

// subFromEmail deriva un UUID-like determinístico (12345678-1234-1234-1234-123456789012)
// del SHA-1 del email. No es un UUIDv5 oficial, pero es estable y suficiente para dev.
func subFromEmail(email string) string {
	sum := sha1.Sum([]byte(email))
	h := hex.EncodeToString(sum[:])
	return fmt.Sprintf("%s-%s-%s-%s-%s", h[0:8], h[8:12], h[12:16], h[16:20], h[20:32])
}

// thumbprint genera un `kid` estable a partir de la clave pública.
func thumbprint(pub *rsa.PublicKey) string {
	sum := sha256.Sum256(pub.N.Bytes())
	return base64.RawURLEncoding.EncodeToString(sum[:8])
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func getenv(k, fallback string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return fallback
}

func first(a, b string) string {
	if a != "" {
		return a
	}
	return b
}

func splitCSV(s string) []string {
	out := []string{}
	for _, p := range strings.Split(s, ",") {
		if t := strings.TrimSpace(p); t != "" {
			out = append(out, t)
		}
	}
	return out
}
