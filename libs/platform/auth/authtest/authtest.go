// Package authtest provee un emisor de tokens OIDC de prueba (RS256), para que
// los servicios prueben sus rutas protegidas sin un proveedor de identidad real.
//
// No es código de producción: solo se importa desde tests. Genera una clave RSA
// efímera, firma JWT con los claims pedidos y expone el KeySet correspondiente
// para construir un auth.Authenticator de pruebas.
package authtest

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/golang-jwt/jwt/v5"
)

// Signer firma tokens de prueba con una clave RSA generada en memoria.
type Signer struct {
	key    *rsa.PrivateKey
	Issuer string
}

// NewSigner crea un firmador con una clave RSA de 2048 bits para el issuer dado.
func NewSigner(issuer string) (*Signer, error) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return nil, err
	}
	return &Signer{key: key, Issuer: issuer}, nil
}

// KeySet devuelve el conjunto de claves públicas para verificar los tokens que
// firma este Signer (apto para auth.NewWithKeySet).
func (s *Signer) KeySet() oidc.KeySet {
	return &oidc.StaticKeySet{PublicKeys: []crypto.PublicKey{s.key.Public()}}
}

// PublicKey expone la clave RSA pública del firmador, para tests que necesitan
// servir un JWKS HTTP propio (p. ej. simular un emisor OIDC con discovery).
func (s *Signer) PublicKey() *rsa.PublicKey {
	return &s.key.PublicKey
}

// Claims son los datos del token a firmar. Expira se mide desde ahora: 0 usa el
// default de 1 hora; un valor negativo produce un token ya vencido (útil para
// probar el rechazo por expiración).
type Claims struct {
	Subject  string
	Email    string
	Nombre   string
	Groups   []string
	Audience string
	Expira   time.Duration
}

// Token firma y devuelve un JWT RS256 con los claims dados.
func (s *Signer) Token(c Claims) (string, error) {
	exp := c.Expira
	if exp == 0 {
		exp = time.Hour
	}
	now := time.Now()

	claims := jwt.MapClaims{
		"iss": s.Issuer,
		"sub": c.Subject,
		"iat": now.Unix(),
		"exp": now.Add(exp).Unix(),
	}
	if c.Email != "" {
		claims["email"] = c.Email
	}
	if c.Nombre != "" {
		claims["name"] = c.Nombre
	}
	if len(c.Groups) > 0 {
		claims["cognito:groups"] = c.Groups
	}
	if c.Audience != "" {
		claims["aud"] = c.Audience
	}

	return jwt.NewWithClaims(jwt.SigningMethodRS256, claims).SignedString(s.key)
}
