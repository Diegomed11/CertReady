// Package auth valida tokens OIDC (JWT) de forma agnóstica al emisor.
//
// En producción el emisor es Amazon Cognito (ADR-06); en desarrollo y tests, un
// emisor local. El código de validación es el mismo: se configura por `issuer` y
// `audience`. La verificación cubre firma RS256, `iss`, `aud` y `exp`, y rechaza
// algoritmos no esperados (incluido `alg=none`) — superficie de pentest de
// "manipulación de JWT" cubierta por diseño.
package auth

import (
	"context"
	"fmt"

	"github.com/coreos/go-oidc/v3/oidc"
)

// Identity es la identidad autenticada extraída de un token válido.
type Identity struct {
	Subject string   // claim `sub`: identificador estable del usuario.
	Email   string   // claim `email`.
	Nombre  string   // claim `name`.
	Roles   []string // unión de `cognito:groups` y el claim `role`.
}

// HasRole informa si la identidad posee el rol indicado.
func (i Identity) HasRole(role string) bool {
	for _, r := range i.Roles {
		if r == role {
			return true
		}
	}
	return false
}

// Config son los parámetros de validación de tokens.
//
// Audience vacío desactiva la comprobación de `aud` (útil en dev); en prod debe
// fijarse al client id / audience esperado.
type Config struct {
	Issuer   string
	Audience string
}

// Authenticator valida tokens contra un emisor OIDC.
type Authenticator struct {
	verifier *oidc.IDTokenVerifier
}

// New construye un Authenticator descubriendo el emisor OIDC por su issuer
// (lee /.well-known/openid-configuration y su JWKS). Es la ruta de producción.
func New(ctx context.Context, cfg Config) (*Authenticator, error) {
	provider, err := oidc.NewProvider(ctx, cfg.Issuer)
	if err != nil {
		return nil, fmt.Errorf("descubrir proveedor OIDC %q: %w", cfg.Issuer, err)
	}
	return &Authenticator{verifier: provider.Verifier(oidcConfig(cfg))}, nil
}

// NewWithKeySet construye un Authenticator contra un conjunto de claves dado, sin
// descubrimiento remoto. Se usa en tests (StaticKeySet) o cuando el JWKS se
// provee fuera de banda.
func NewWithKeySet(keySet oidc.KeySet, cfg Config) *Authenticator {
	return &Authenticator{verifier: oidc.NewVerifier(cfg.Issuer, keySet, oidcConfig(cfg))}
}

func oidcConfig(cfg Config) *oidc.Config {
	c := &oidc.Config{ClientID: cfg.Audience}
	if cfg.Audience == "" {
		c.SkipClientIDCheck = true
	}
	return c
}

// Verify valida el token crudo y devuelve la identidad que representa.
//
// Returns un error si la firma, el emisor, la audiencia o la expiración no son
// válidos. Los roles se toman de `cognito:groups` (grupos de Cognito) y/o del
// claim `role`, unidos.
func (a *Authenticator) Verify(ctx context.Context, rawToken string) (Identity, error) {
	tok, err := a.verifier.Verify(ctx, rawToken)
	if err != nil {
		return Identity{}, err
	}

	var claims struct {
		Email  string   `json:"email"`
		Nombre string   `json:"name"`
		Groups []string `json:"cognito:groups"`
		Role   string   `json:"role"`
	}
	if err := tok.Claims(&claims); err != nil {
		return Identity{}, fmt.Errorf("leer claims: %w", err)
	}

	roles := claims.Groups
	if claims.Role != "" {
		roles = append(roles, claims.Role)
	}
	return Identity{Subject: tok.Subject, Email: claims.Email, Nombre: claims.Nombre, Roles: roles}, nil
}
