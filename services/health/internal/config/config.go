// Package config carga la configuración del servicio desde el entorno (12-factor).
//
// La configuración nunca se lee de archivos versionados ni contiene secretos: en
// producción las variables las inyecta la plataforma (ECS task definition →
// Secrets Manager). Todos los valores tienen un default seguro para desarrollo
// local, de modo que el servicio arranca sin configuración explícita.
package config

import (
	"fmt"
	"os"
	"time"
)

// Config es la configuración efectiva del servicio, ya resuelta desde el entorno.
//
// Los campos de timeout acotan el tiempo de vida de una conexión HTTP y protegen
// al servidor frente a clientes lentos (Slowloris). Addr es la dirección de
// escucha en formato "host:puerto".
type Config struct {
	ServiceName   string        // Nombre lógico del servicio; aparece en logs y respuestas.
	Version       string        // Versión/imagen desplegada; inyectada en build/deploy.
	Env           string        // Entorno de ejecución: "dev" | "staging" | "prod".
	Addr          string        // Dirección de escucha "host:puerto".
	ReadTimeout   time.Duration // Tiempo máximo para leer la petición completa.
	WriteTimeout  time.Duration // Tiempo máximo para escribir la respuesta.
	IdleTimeout   time.Duration // Tiempo máximo de una conexión keep-alive inactiva.
	ShutdownGrace time.Duration // Margen para drenar conexiones en un apagado ordenado.
}

// Load construye la Config a partir de las variables de entorno.
//
// Returns
//
//	Config : configuración resuelta; los valores ausentes toman su default.
//	error  : si alguna variable presente tiene un formato inválido (p. ej. un
//	         puerto o una duración no parseables).
//
// Variables reconocidas: HEALTH_ENV, HEALTH_ADDR (o PORT), HEALTH_VERSION,
// HEALTH_READ_TIMEOUT, HEALTH_WRITE_TIMEOUT, HEALTH_IDLE_TIMEOUT,
// HEALTH_SHUTDOWN_GRACE.
func Load() (Config, error) {
	cfg := Config{
		ServiceName:   "health",
		Version:       getenv("HEALTH_VERSION", "dev"),
		Env:           getenv("HEALTH_ENV", "dev"),
		ReadTimeout:   5 * time.Second,
		WriteTimeout:  10 * time.Second,
		IdleTimeout:   60 * time.Second,
		ShutdownGrace: 15 * time.Second,
	}

	// Dirección de escucha: HEALTH_ADDR tiene prioridad; si no, se compone desde
	// PORT (convención de varias plataformas); si tampoco, default :8080.
	if addr := os.Getenv("HEALTH_ADDR"); addr != "" {
		cfg.Addr = addr
	} else {
		cfg.Addr = ":" + getenv("PORT", "8080")
	}

	var err error
	if cfg.ReadTimeout, err = durationEnv("HEALTH_READ_TIMEOUT", cfg.ReadTimeout); err != nil {
		return Config{}, err
	}
	if cfg.WriteTimeout, err = durationEnv("HEALTH_WRITE_TIMEOUT", cfg.WriteTimeout); err != nil {
		return Config{}, err
	}
	if cfg.IdleTimeout, err = durationEnv("HEALTH_IDLE_TIMEOUT", cfg.IdleTimeout); err != nil {
		return Config{}, err
	}
	if cfg.ShutdownGrace, err = durationEnv("HEALTH_SHUTDOWN_GRACE", cfg.ShutdownGrace); err != nil {
		return Config{}, err
	}

	return cfg, nil
}

// getenv devuelve el valor de la variable key o fallback si está vacía o ausente.
func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// durationEnv parsea una duración (formato time.ParseDuration, p. ej. "5s")
// desde la variable key, devolviendo fallback si está ausente.
//
// Returns un error envuelto con el nombre de la variable si el valor presente no
// es una duración válida, para que el fallo de configuración sea diagnosticable.
func durationEnv(key string, fallback time.Duration) (time.Duration, error) {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback, nil
	}
	d, err := time.ParseDuration(raw)
	if err != nil {
		return 0, fmt.Errorf("%s: duración inválida %q: %w", key, raw, err)
	}
	return d, nil
}
