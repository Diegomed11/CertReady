// Package config carga la configuración del servicio progress desde el entorno.
package config

import (
	"fmt"
	"os"
	"strconv"
	"time"

	platformcfg "github.com/certready/certready/libs/platform/config"
)

// Config es la configuración efectiva del servicio progress.
type Config struct {
	ServiceName   string
	Version       string
	Env           string
	Addr          string
	DatabaseURL   string
	OIDCIssuer    string
	OIDCAudience  string
	AutoMigrate   bool
	ReadTimeout   time.Duration
	WriteTimeout  time.Duration
	IdleTimeout   time.Duration
	ShutdownGrace time.Duration
}

// Load construye la Config desde el entorno.
//
// Variables: PROGRESS_ENV, PROGRESS_ADDR (o PORT), PROGRESS_VERSION,
// PROGRESS_DATABASE_URL (o DATABASE_URL), PROGRESS_OIDC_ISSUER (o OIDC_ISSUER),
// PROGRESS_OIDC_AUDIENCE (o OIDC_AUDIENCE), PROGRESS_AUTO_MIGRATE y los timeouts
// del servidor.
func Load() (Config, error) {
	cfg := Config{
		ServiceName:   "progress",
		Version:       platformcfg.Getenv("PROGRESS_VERSION", "dev"),
		Env:           platformcfg.Getenv("PROGRESS_ENV", "dev"),
		ReadTimeout:   5 * time.Second,
		WriteTimeout:  10 * time.Second,
		IdleTimeout:   60 * time.Second,
		ShutdownGrace: 15 * time.Second,
	}

	if addr := os.Getenv("PROGRESS_ADDR"); addr != "" {
		cfg.Addr = addr
	} else {
		cfg.Addr = ":" + platformcfg.Getenv("PORT", "8080")
	}

	cfg.DatabaseURL = platformcfg.Getenv("PROGRESS_DATABASE_URL", os.Getenv("DATABASE_URL"))
	if cfg.DatabaseURL == "" {
		return Config{}, fmt.Errorf("falta la cadena de conexión: define PROGRESS_DATABASE_URL o DATABASE_URL")
	}

	cfg.OIDCIssuer = platformcfg.Getenv("PROGRESS_OIDC_ISSUER", os.Getenv("OIDC_ISSUER"))
	cfg.OIDCAudience = platformcfg.Getenv("PROGRESS_OIDC_AUDIENCE", os.Getenv("OIDC_AUDIENCE"))

	if v := os.Getenv("PROGRESS_AUTO_MIGRATE"); v != "" {
		b, err := strconv.ParseBool(v)
		if err != nil {
			return Config{}, fmt.Errorf("PROGRESS_AUTO_MIGRATE: booleano inválido %q: %w", v, err)
		}
		cfg.AutoMigrate = b
	}

	var err error
	if cfg.ReadTimeout, err = platformcfg.Duration("PROGRESS_READ_TIMEOUT", cfg.ReadTimeout); err != nil {
		return Config{}, err
	}
	if cfg.WriteTimeout, err = platformcfg.Duration("PROGRESS_WRITE_TIMEOUT", cfg.WriteTimeout); err != nil {
		return Config{}, err
	}
	if cfg.IdleTimeout, err = platformcfg.Duration("PROGRESS_IDLE_TIMEOUT", cfg.IdleTimeout); err != nil {
		return Config{}, err
	}
	if cfg.ShutdownGrace, err = platformcfg.Duration("PROGRESS_SHUTDOWN_GRACE", cfg.ShutdownGrace); err != nil {
		return Config{}, err
	}

	return cfg, nil
}
