package config

import (
	"testing"
	"time"
)

// TestLoadDefaults comprueba que, sin variables de entorno, Load produce una
// configuración válida de desarrollo.
func TestLoadDefaults(t *testing.T) {
	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error inesperado: %v", err)
	}
	if cfg.Addr != ":8080" {
		t.Errorf("Addr = %q; quería %q", cfg.Addr, ":8080")
	}
	if cfg.Env != "dev" {
		t.Errorf("Env = %q; quería %q", cfg.Env, "dev")
	}
	if cfg.ServiceName != "health" {
		t.Errorf("ServiceName = %q; quería %q", cfg.ServiceName, "health")
	}
}

// TestLoadDesdeEntorno verifica la precedencia y el parseo de las variables.
func TestLoadDesdeEntorno(t *testing.T) {
	t.Setenv("HEALTH_ADDR", "127.0.0.1:9000")
	t.Setenv("HEALTH_ENV", "prod")
	t.Setenv("HEALTH_READ_TIMEOUT", "3s")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error inesperado: %v", err)
	}
	if cfg.Addr != "127.0.0.1:9000" {
		t.Errorf("Addr = %q; quería %q", cfg.Addr, "127.0.0.1:9000")
	}
	if cfg.Env != "prod" {
		t.Errorf("Env = %q; quería %q", cfg.Env, "prod")
	}
	if cfg.ReadTimeout != 3*time.Second {
		t.Errorf("ReadTimeout = %v; quería %v", cfg.ReadTimeout, 3*time.Second)
	}
}

// TestPortComponeAddr verifica que PORT compone la dirección cuando HEALTH_ADDR
// está ausente (convención de plataformas que inyectan PORT).
func TestPortComponeAddr(t *testing.T) {
	t.Setenv("PORT", "8081")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error inesperado: %v", err)
	}
	if cfg.Addr != ":8081" {
		t.Errorf("Addr = %q; quería %q", cfg.Addr, ":8081")
	}
}

// TestLoadRechazaDuracionInvalida comprueba que un valor mal formado produce un
// error diagnosticable en lugar de un default silencioso.
func TestLoadRechazaDuracionInvalida(t *testing.T) {
	t.Setenv("HEALTH_READ_TIMEOUT", "no-es-duracion")

	if _, err := Load(); err == nil {
		t.Fatal("se esperaba error por duración inválida, se obtuvo nil")
	}
}
