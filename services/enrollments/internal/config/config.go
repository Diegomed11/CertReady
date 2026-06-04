// Package config carga la configuración del servicio enrollments desde el entorno.
package config

import (
	"fmt"
	"os"
	"strconv"
	"time"

	platformcfg "github.com/certready/certready/libs/platform/config"
)

// Config es la configuración efectiva del servicio enrollments.
type Config struct {
	ServiceName    string
	Version        string
	Env            string
	Addr           string
	DatabaseURL    string
	OIDCIssuer     string
	OIDCAudience   string
	CatalogBaseURL string        // URL raíz del servicio catalog (validación de objetivo).
	CatalogTimeout time.Duration // Timeout total de las llamadas a catalog.
	AutoMigrate    bool
	ReadTimeout    time.Duration
	WriteTimeout   time.Duration
	IdleTimeout    time.Duration
	ShutdownGrace  time.Duration
}

// Load construye la Config desde el entorno.
//
// Variables: ENROLLMENTS_ENV, ENROLLMENTS_ADDR (o PORT), ENROLLMENTS_VERSION,
// ENROLLMENTS_DATABASE_URL (o DATABASE_URL), ENROLLMENTS_OIDC_ISSUER
// (o OIDC_ISSUER), ENROLLMENTS_OIDC_AUDIENCE (o OIDC_AUDIENCE),
// ENROLLMENTS_CATALOG_URL (obligatorio salvo en tests),
// ENROLLMENTS_CATALOG_TIMEOUT, ENROLLMENTS_AUTO_MIGRATE y los timeouts del servidor.
func Load() (Config, error) {
	cfg := Config{
		ServiceName:    "enrollments",
		Version:        platformcfg.Getenv("ENROLLMENTS_VERSION", "dev"),
		Env:            platformcfg.Getenv("ENROLLMENTS_ENV", "dev"),
		ReadTimeout:    5 * time.Second,
		WriteTimeout:   10 * time.Second,
		IdleTimeout:    60 * time.Second,
		ShutdownGrace:  15 * time.Second,
		CatalogTimeout: 5 * time.Second,
	}

	if addr := os.Getenv("ENROLLMENTS_ADDR"); addr != "" {
		cfg.Addr = addr
	} else {
		cfg.Addr = ":" + platformcfg.Getenv("PORT", "8080")
	}

	cfg.DatabaseURL = platformcfg.Getenv("ENROLLMENTS_DATABASE_URL", os.Getenv("DATABASE_URL"))
	if cfg.DatabaseURL == "" {
		return Config{}, fmt.Errorf("falta la cadena de conexión: define ENROLLMENTS_DATABASE_URL o DATABASE_URL")
	}

	cfg.OIDCIssuer = platformcfg.Getenv("ENROLLMENTS_OIDC_ISSUER", os.Getenv("OIDC_ISSUER"))
	cfg.OIDCAudience = platformcfg.Getenv("ENROLLMENTS_OIDC_AUDIENCE", os.Getenv("OIDC_AUDIENCE"))

	cfg.CatalogBaseURL = os.Getenv("ENROLLMENTS_CATALOG_URL")
	if cfg.CatalogBaseURL == "" {
		return Config{}, fmt.Errorf("falta ENROLLMENTS_CATALOG_URL (URL del servicio catalog)")
	}

	if v := os.Getenv("ENROLLMENTS_AUTO_MIGRATE"); v != "" {
		b, err := strconv.ParseBool(v)
		if err != nil {
			return Config{}, fmt.Errorf("ENROLLMENTS_AUTO_MIGRATE: booleano inválido %q: %w", v, err)
		}
		cfg.AutoMigrate = b
	}

	var err error
	if cfg.CatalogTimeout, err = platformcfg.Duration("ENROLLMENTS_CATALOG_TIMEOUT", cfg.CatalogTimeout); err != nil {
		return Config{}, err
	}
	if cfg.ReadTimeout, err = platformcfg.Duration("ENROLLMENTS_READ_TIMEOUT", cfg.ReadTimeout); err != nil {
		return Config{}, err
	}
	if cfg.WriteTimeout, err = platformcfg.Duration("ENROLLMENTS_WRITE_TIMEOUT", cfg.WriteTimeout); err != nil {
		return Config{}, err
	}
	if cfg.IdleTimeout, err = platformcfg.Duration("ENROLLMENTS_IDLE_TIMEOUT", cfg.IdleTimeout); err != nil {
		return Config{}, err
	}
	if cfg.ShutdownGrace, err = platformcfg.Duration("ENROLLMENTS_SHUTDOWN_GRACE", cfg.ShutdownGrace); err != nil {
		return Config{}, err
	}

	return cfg, nil
}
