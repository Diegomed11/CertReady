// Package config carga la configuración del servicio catalog desde el entorno.
package config

import (
	"fmt"
	"os"
	"strconv"
	"time"

	platformcfg "github.com/certready/certready/libs/platform/config"
)

// Config es la configuración efectiva del servicio catalog.
type Config struct {
	ServiceName   string
	Version       string
	Env           string
	Addr          string
	DatabaseURL   string        // DSN de Postgres (CATALOG_DATABASE_URL o DATABASE_URL).
	OIDCIssuer    string        // Emisor OIDC para validar JWT de admin (vacío = rutas admin gated 501).
	OIDCAudience  string        // Audiencia esperada del token (vacío = no se valida aud).
	AutoMigrate   bool          // Si true, aplica migraciones pendientes al arrancar.
	ReadTimeout   time.Duration // Tiempo máximo para leer la petición completa.
	WriteTimeout  time.Duration // Tiempo máximo para escribir la respuesta.
	IdleTimeout   time.Duration // Tiempo máximo de una conexión keep-alive inactiva.
	ShutdownGrace time.Duration // Margen para drenar conexiones en un apagado ordenado.
}

// Load construye la Config desde las variables de entorno.
//
// Returns un error si falta la cadena de conexión obligatoria o si alguna
// duración tiene formato inválido. La DSN no tiene default: arrancar sin base
// configurada sería un fallo silencioso.
//
// Variables: CATALOG_ENV, CATALOG_ADDR (o PORT), CATALOG_VERSION,
// CATALOG_DATABASE_URL (o DATABASE_URL), CATALOG_AUTO_MIGRATE, y los timeouts
// CATALOG_READ_TIMEOUT / _WRITE_TIMEOUT / _IDLE_TIMEOUT / _SHUTDOWN_GRACE.
func Load() (Config, error) {
	cfg := Config{
		ServiceName:   "catalog",
		Version:       platformcfg.Getenv("CATALOG_VERSION", "dev"),
		Env:           platformcfg.Getenv("CATALOG_ENV", "dev"),
		ReadTimeout:   5 * time.Second,
		WriteTimeout:  10 * time.Second,
		IdleTimeout:   60 * time.Second,
		ShutdownGrace: 15 * time.Second,
	}

	if addr := os.Getenv("CATALOG_ADDR"); addr != "" {
		cfg.Addr = addr
	} else {
		cfg.Addr = ":" + platformcfg.Getenv("PORT", "8080")
	}

	cfg.DatabaseURL = platformcfg.Getenv("CATALOG_DATABASE_URL", os.Getenv("DATABASE_URL"))
	if cfg.DatabaseURL == "" {
		return Config{}, fmt.Errorf("falta la cadena de conexión: define CATALOG_DATABASE_URL o DATABASE_URL")
	}

	cfg.OIDCIssuer = platformcfg.Getenv("CATALOG_OIDC_ISSUER", os.Getenv("OIDC_ISSUER"))
	cfg.OIDCAudience = platformcfg.Getenv("CATALOG_OIDC_AUDIENCE", os.Getenv("OIDC_AUDIENCE"))

	if v := os.Getenv("CATALOG_AUTO_MIGRATE"); v != "" {
		b, err := strconv.ParseBool(v)
		if err != nil {
			return Config{}, fmt.Errorf("CATALOG_AUTO_MIGRATE: booleano inválido %q: %w", v, err)
		}
		cfg.AutoMigrate = b
	}

	var err error
	if cfg.ReadTimeout, err = platformcfg.Duration("CATALOG_READ_TIMEOUT", cfg.ReadTimeout); err != nil {
		return Config{}, err
	}
	if cfg.WriteTimeout, err = platformcfg.Duration("CATALOG_WRITE_TIMEOUT", cfg.WriteTimeout); err != nil {
		return Config{}, err
	}
	if cfg.IdleTimeout, err = platformcfg.Duration("CATALOG_IDLE_TIMEOUT", cfg.IdleTimeout); err != nil {
		return Config{}, err
	}
	if cfg.ShutdownGrace, err = platformcfg.Duration("CATALOG_SHUTDOWN_GRACE", cfg.ShutdownGrace); err != nil {
		return Config{}, err
	}

	return cfg, nil
}
