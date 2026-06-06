// Package config carga la configuración del servicio problems desde el entorno.
package config

import (
	"fmt"
	"os"
	"time"

	platformcfg "github.com/certready/certready/libs/platform/config"
)

// Config es la configuración efectiva del servicio problems.
type Config struct {
	ServiceName   string
	Version       string
	Env           string
	Addr          string
	MongoURI      string // Cadena de conexión a MongoDB (PROBLEMS_MONGO_URI o MONGO_URI).
	MongoDB       string // Nombre de la base de datos en MongoDB.
	OIDCIssuer    string // Emisor OIDC (vacío = rutas admin gated 501).
	OIDCAudience  string
	ReadTimeout   time.Duration
	WriteTimeout  time.Duration
	IdleTimeout   time.Duration
	ShutdownGrace time.Duration
}

// Load construye la Config desde el entorno.
//
// Variables: PROBLEMS_ENV, PROBLEMS_ADDR (o PORT), PROBLEMS_VERSION,
// PROBLEMS_MONGO_URI (o MONGO_URI), PROBLEMS_MONGO_DB (default "certready"),
// PROBLEMS_OIDC_ISSUER (o OIDC_ISSUER), PROBLEMS_OIDC_AUDIENCE (o OIDC_AUDIENCE)
// y los timeouts del servidor.
func Load() (Config, error) {
	cfg := Config{
		ServiceName:   "problems",
		Version:       platformcfg.Getenv("PROBLEMS_VERSION", "dev"),
		Env:           platformcfg.Getenv("PROBLEMS_ENV", "dev"),
		MongoDB:       platformcfg.Getenv("PROBLEMS_MONGO_DB", "certready"),
		ReadTimeout:   5 * time.Second,
		WriteTimeout:  10 * time.Second,
		IdleTimeout:   60 * time.Second,
		ShutdownGrace: 15 * time.Second,
	}

	if addr := os.Getenv("PROBLEMS_ADDR"); addr != "" {
		cfg.Addr = addr
	} else {
		cfg.Addr = ":" + platformcfg.Getenv("PORT", "8080")
	}

	cfg.MongoURI = platformcfg.Getenv("PROBLEMS_MONGO_URI", os.Getenv("MONGO_URI"))
	if cfg.MongoURI == "" {
		return Config{}, fmt.Errorf("falta la cadena de conexión: define PROBLEMS_MONGO_URI o MONGO_URI")
	}

	cfg.OIDCIssuer = platformcfg.Getenv("PROBLEMS_OIDC_ISSUER", os.Getenv("OIDC_ISSUER"))
	cfg.OIDCAudience = platformcfg.Getenv("PROBLEMS_OIDC_AUDIENCE", os.Getenv("OIDC_AUDIENCE"))

	var err error
	if cfg.ReadTimeout, err = platformcfg.Duration("PROBLEMS_READ_TIMEOUT", cfg.ReadTimeout); err != nil {
		return Config{}, err
	}
	if cfg.WriteTimeout, err = platformcfg.Duration("PROBLEMS_WRITE_TIMEOUT", cfg.WriteTimeout); err != nil {
		return Config{}, err
	}
	if cfg.IdleTimeout, err = platformcfg.Duration("PROBLEMS_IDLE_TIMEOUT", cfg.IdleTimeout); err != nil {
		return Config{}, err
	}
	if cfg.ShutdownGrace, err = platformcfg.Duration("PROBLEMS_SHUTDOWN_GRACE", cfg.ShutdownGrace); err != nil {
		return Config{}, err
	}

	return cfg, nil
}
