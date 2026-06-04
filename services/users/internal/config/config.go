// Package config carga la configuración del servicio users desde el entorno.
package config

import (
	"fmt"
	"os"
	"strconv"
	"time"

	platformcfg "github.com/certready/certready/libs/platform/config"
)

// Config es la configuración efectiva del servicio users.
type Config struct {
	ServiceName   string
	Version       string
	Env           string
	Addr          string
	DatabaseURL   string
	OIDCIssuer    string // Emisor OIDC (vacío = rutas protegidas responden 501).
	OIDCAudience  string
	AutoMigrate   bool
	ReadTimeout   time.Duration
	WriteTimeout  time.Duration
	IdleTimeout   time.Duration
	ShutdownGrace time.Duration
}

// Load construye la Config desde el entorno.
//
// Variables: USERS_ENV, USERS_ADDR (o PORT), USERS_VERSION, USERS_DATABASE_URL
// (o DATABASE_URL), USERS_OIDC_ISSUER (o OIDC_ISSUER), USERS_OIDC_AUDIENCE
// (o OIDC_AUDIENCE), USERS_AUTO_MIGRATE y los timeouts USERS_*_TIMEOUT.
func Load() (Config, error) {
	cfg := Config{
		ServiceName:   "users",
		Version:       platformcfg.Getenv("USERS_VERSION", "dev"),
		Env:           platformcfg.Getenv("USERS_ENV", "dev"),
		ReadTimeout:   5 * time.Second,
		WriteTimeout:  10 * time.Second,
		IdleTimeout:   60 * time.Second,
		ShutdownGrace: 15 * time.Second,
	}

	if addr := os.Getenv("USERS_ADDR"); addr != "" {
		cfg.Addr = addr
	} else {
		cfg.Addr = ":" + platformcfg.Getenv("PORT", "8080")
	}

	cfg.DatabaseURL = platformcfg.Getenv("USERS_DATABASE_URL", os.Getenv("DATABASE_URL"))
	if cfg.DatabaseURL == "" {
		return Config{}, fmt.Errorf("falta la cadena de conexión: define USERS_DATABASE_URL o DATABASE_URL")
	}

	cfg.OIDCIssuer = platformcfg.Getenv("USERS_OIDC_ISSUER", os.Getenv("OIDC_ISSUER"))
	cfg.OIDCAudience = platformcfg.Getenv("USERS_OIDC_AUDIENCE", os.Getenv("OIDC_AUDIENCE"))

	if v := os.Getenv("USERS_AUTO_MIGRATE"); v != "" {
		b, err := strconv.ParseBool(v)
		if err != nil {
			return Config{}, fmt.Errorf("USERS_AUTO_MIGRATE: booleano inválido %q: %w", v, err)
		}
		cfg.AutoMigrate = b
	}

	var err error
	if cfg.ReadTimeout, err = platformcfg.Duration("USERS_READ_TIMEOUT", cfg.ReadTimeout); err != nil {
		return Config{}, err
	}
	if cfg.WriteTimeout, err = platformcfg.Duration("USERS_WRITE_TIMEOUT", cfg.WriteTimeout); err != nil {
		return Config{}, err
	}
	if cfg.IdleTimeout, err = platformcfg.Duration("USERS_IDLE_TIMEOUT", cfg.IdleTimeout); err != nil {
		return Config{}, err
	}
	if cfg.ShutdownGrace, err = platformcfg.Duration("USERS_SHUTDOWN_GRACE", cfg.ShutdownGrace); err != nil {
		return Config{}, err
	}

	return cfg, nil
}
