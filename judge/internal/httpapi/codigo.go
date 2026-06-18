package httpapi

import (
	"math"
	"net/http"
	"strings"

	"github.com/certready/certready/libs/platform/auth"
	"github.com/certready/certready/libs/platform/httpx"
)

// resumenCodigo devuelve, para el usuario autenticado, cuántos problemas intentó y
// resolvió en las áreas dadas (parámetro `areas`, separadas por coma). Es la señal
// de código de la "preparación por puesto", calculada en vivo desde Postgres
// (reemplaza el cálculo que hacía el DSS sobre ClickHouse).
func (a *API) resumenCodigo(w http.ResponseWriter, r *http.Request) {
	identidad, ok := auth.IdentityFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "no_autenticado", "se requiere autenticación")
		return
	}

	areas := parseAreas(r.URL.Query().Get("areas"))
	problemas, resueltos, err := a.corridas.ResumenCodigoPorArea(r.Context(), identidad.Subject, areas)
	if err != nil {
		a.errorInterno(w, r, "resumen de código por área", err)
		return
	}

	pct := 0.0
	if problemas > 0 {
		pct = math.Round(1000.0*float64(resueltos)/float64(problemas)) / 10.0
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"areas":     areas,
		"problemas": problemas,
		"resueltos": resueltos,
		"pct":       pct,
	})
}

// parseAreas separa una lista de áreas "a,b,c" en slugs limpios (sin vacíos).
func parseAreas(s string) []string {
	out := []string{}
	for _, a := range strings.Split(s, ",") {
		if a = strings.TrimSpace(a); a != "" {
			out = append(out, a)
		}
	}
	return out
}
