// Package config carga la configuración del servicio exams desde el entorno.
package config

import (
	"fmt"
	"os"
	"strconv"
	"time"

	platformcfg "github.com/certready/certready/libs/platform/config"
)

// Config es la configuración efectiva del servicio exams.
type Config struct {
	ServiceName     string
	Version         string
	Env             string
	Addr            string
	DatabaseURL     string // Postgres (sesiones e intentos).
	MongoURI        string // MongoDB (banco de preguntas).
	MongoDB         string
	OIDCIssuer      string
	OIDCAudience    string
	AutoMigrate     bool
	DefaultPregntas int // nº de preguntas por simulacro si no se indica.
	ReadTimeout     time.Duration
	WriteTimeout    time.Duration
	IdleTimeout     time.Duration
	ShutdownGrace   time.Duration
}

// Load construye la Config desde el entorno.
//
// Variables: EXAMS_ENV, EXAMS_ADDR (o PORT), EXAMS_VERSION,
// EXAMS_DATABASE_URL (o DATABASE_URL), EXAMS_MONGO_URI (o MONGO_URI),
// EXAMS_MONGO_DB (default "certready"), EXAMS_OIDC_ISSUER (o OIDC_ISSUER),
// EXAMS_OIDC_AUDIENCE (o OIDC_AUDIENCE), EXAMS_AUTO_MIGRATE,
// EXAMS_DEFAULT_PREGUNTAS (default 10) y los timeouts del servidor.
func Load() (Config, error) {
	cfg := Config{
		ServiceName:     "exams",
		Version:         platformcfg.Getenv("EXAMS_VERSION", "dev"),
		Env:             platformcfg.Getenv("EXAMS_ENV", "dev"),
		MongoDB:         platformcfg.Getenv("EXAMS_MONGO_DB", "certready"),
		DefaultPregntas: 10,
		ReadTimeout:     5 * time.Second,
		WriteTimeout:    10 * time.Second,
		IdleTimeout:     60 * time.Second,
		ShutdownGrace:   15 * time.Second,
	}

	if addr := os.Getenv("EXAMS_ADDR"); addr != "" {
		cfg.Addr = addr
	} else {
		cfg.Addr = ":" + platformcfg.Getenv("PORT", "8080")
	}

	cfg.DatabaseURL = platformcfg.Getenv("EXAMS_DATABASE_URL", os.Getenv("DATABASE_URL"))
	if cfg.DatabaseURL == "" {
		return Config{}, fmt.Errorf("falta la cadena de conexión: define EXAMS_DATABASE_URL o DATABASE_URL")
	}
	cfg.MongoURI = platformcfg.Getenv("EXAMS_MONGO_URI", os.Getenv("MONGO_URI"))
	if cfg.MongoURI == "" {
		return Config{}, fmt.Errorf("falta la conexión a MongoDB: define EXAMS_MONGO_URI o MONGO_URI")
	}

	cfg.OIDCIssuer = platformcfg.Getenv("EXAMS_OIDC_ISSUER", os.Getenv("OIDC_ISSUER"))
	cfg.OIDCAudience = platformcfg.Getenv("EXAMS_OIDC_AUDIENCE", os.Getenv("OIDC_AUDIENCE"))

	if v := os.Getenv("EXAMS_AUTO_MIGRATE"); v != "" {
		b, err := strconv.ParseBool(v)
		if err != nil {
			return Config{}, fmt.Errorf("EXAMS_AUTO_MIGRATE: booleano inválido %q: %w", v, err)
		}
		cfg.AutoMigrate = b
	}
	if v := os.Getenv("EXAMS_DEFAULT_PREGUNTAS"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 {
			return Config{}, fmt.Errorf("EXAMS_DEFAULT_PREGUNTAS: entero >= 1 inválido %q", v)
		}
		cfg.DefaultPregntas = n
	}

	var err error
	if cfg.ReadTimeout, err = platformcfg.Duration("EXAMS_READ_TIMEOUT", cfg.ReadTimeout); err != nil {
		return Config{}, err
	}
	if cfg.WriteTimeout, err = platformcfg.Duration("EXAMS_WRITE_TIMEOUT", cfg.WriteTimeout); err != nil {
		return Config{}, err
	}
	if cfg.IdleTimeout, err = platformcfg.Duration("EXAMS_IDLE_TIMEOUT", cfg.IdleTimeout); err != nil {
		return Config{}, err
	}
	if cfg.ShutdownGrace, err = platformcfg.Duration("EXAMS_SHUTDOWN_GRACE", cfg.ShutdownGrace); err != nil {
		return Config{}, err
	}

	return cfg, nil
}
