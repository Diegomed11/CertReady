// Package config ofrece utilidades para leer configuración desde el entorno
// (12-factor), compartidas por todos los servicios del monorepo.
//
// No define la estructura de configuración de ningún servicio: cada servicio
// compone la suya con estos ayudantes. Así se evita un "config de talla única".
package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

// Getenv devuelve el valor de la variable key, o fallback si está vacía o ausente.
func Getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// MustGetenv devuelve el valor de la variable key o un error si no está definida.
//
// Se usa para configuración obligatoria sin default seguro (p. ej. DATABASE_URL),
// donde arrancar con un valor inventado sería peor que fallar al arranque.
func MustGetenv(key string) (string, error) {
	v := os.Getenv(key)
	if v == "" {
		return "", fmt.Errorf("falta la variable de entorno obligatoria %s", key)
	}
	return v, nil
}

// Duration parsea una duración (formato time.ParseDuration, p. ej. "5s") desde
// la variable key, devolviendo fallback si está ausente.
//
// Returns un error envuelto con el nombre de la variable si el valor presente no
// es una duración válida, para que el fallo de configuración sea diagnosticable.
func Duration(key string, fallback time.Duration) (time.Duration, error) {
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

// Int parsea un entero desde la variable key, devolviendo fallback si está ausente.
func Int(key string, fallback int) (int, error) {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback, nil
	}
	n, err := strconv.Atoi(raw)
	if err != nil {
		return 0, fmt.Errorf("%s: entero inválido %q: %w", key, raw, err)
	}
	return n, nil
}
