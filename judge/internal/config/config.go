// Package config carga la configuración del servicio judge desde el entorno.
package config

import (
	"fmt"
	"os"
	"strconv"
	"time"

	platformcfg "github.com/certready/certready/libs/platform/config"
)

// Config es la configuración efectiva del servicio judge.
type Config struct {
	ServiceName   string
	Version       string
	Env           string
	Addr          string
	DatabaseURL   string // Postgres (corridas).
	MongoURI      string // MongoDB (problemas, solo lectura).
	MongoDB       string
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
// Variables: JUDGE_ENV, JUDGE_ADDR (o PORT), JUDGE_VERSION,
// JUDGE_DATABASE_URL (o DATABASE_URL), JUDGE_MONGO_URI (o MONGO_URI),
// JUDGE_MONGO_DB (default "certready"), JUDGE_OIDC_ISSUER (o OIDC_ISSUER),
// JUDGE_OIDC_AUDIENCE (o OIDC_AUDIENCE), JUDGE_AUTO_MIGRATE y los timeouts.
//
// El runner Docker lee aparte JUDGE_PYTHON_IMAGE y JUDGE_DOCKER_BIN.
//
// WriteTimeout es holgado porque la calificación ejecuta código en el sandbox y
// puede tardar varios segundos.
func Load() (Config, error) {
	cfg := Config{
		ServiceName:   "judge",
		Version:       platformcfg.Getenv("JUDGE_VERSION", "dev"),
		Env:           platformcfg.Getenv("JUDGE_ENV", "dev"),
		MongoDB:       platformcfg.Getenv("JUDGE_MONGO_DB", "certready"),
		ReadTimeout:   5 * time.Second,
		WriteTimeout:  60 * time.Second,
		IdleTimeout:   60 * time.Second,
		ShutdownGrace: 15 * time.Second,
	}

	if addr := os.Getenv("JUDGE_ADDR"); addr != "" {
		cfg.Addr = addr
	} else {
		cfg.Addr = ":" + platformcfg.Getenv("PORT", "8080")
	}

	cfg.DatabaseURL = platformcfg.Getenv("JUDGE_DATABASE_URL", os.Getenv("DATABASE_URL"))
	if cfg.DatabaseURL == "" {
		return Config{}, fmt.Errorf("falta la cadena de conexión: define JUDGE_DATABASE_URL o DATABASE_URL")
	}
	cfg.MongoURI = platformcfg.Getenv("JUDGE_MONGO_URI", os.Getenv("MONGO_URI"))
	if cfg.MongoURI == "" {
		return Config{}, fmt.Errorf("falta la conexión a MongoDB: define JUDGE_MONGO_URI o MONGO_URI")
	}

	cfg.OIDCIssuer = platformcfg.Getenv("JUDGE_OIDC_ISSUER", os.Getenv("OIDC_ISSUER"))
	cfg.OIDCAudience = platformcfg.Getenv("JUDGE_OIDC_AUDIENCE", os.Getenv("OIDC_AUDIENCE"))

	if v := os.Getenv("JUDGE_AUTO_MIGRATE"); v != "" {
		b, err := strconv.ParseBool(v)
		if err != nil {
			return Config{}, fmt.Errorf("JUDGE_AUTO_MIGRATE: booleano inválido %q: %w", v, err)
		}
		cfg.AutoMigrate = b
	}

	var err error
	if cfg.ReadTimeout, err = platformcfg.Duration("JUDGE_READ_TIMEOUT", cfg.ReadTimeout); err != nil {
		return Config{}, err
	}
	if cfg.WriteTimeout, err = platformcfg.Duration("JUDGE_WRITE_TIMEOUT", cfg.WriteTimeout); err != nil {
		return Config{}, err
	}
	if cfg.IdleTimeout, err = platformcfg.Duration("JUDGE_IDLE_TIMEOUT", cfg.IdleTimeout); err != nil {
		return Config{}, err
	}
	if cfg.ShutdownGrace, err = platformcfg.Duration("JUDGE_SHUTDOWN_GRACE", cfg.ShutdownGrace); err != nil {
		return Config{}, err
	}

	return cfg, nil
}
