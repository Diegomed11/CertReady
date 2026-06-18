package httpapi

import (
	"net/http"

	"github.com/certready/certready/libs/platform/httpx"
	"github.com/certready/certready/services/progress/internal/puestos"
)

// listarPuestos devuelve el catálogo público de puestos/especialidades (sin pesos):
// lo consumen el selector de "preparación por puesto" y los chips de Entrevistas.
// Es estático (catálogo embebido) y no requiere autenticación.
func (a *API) listarPuestos(w http.ResponseWriter, _ *http.Request) {
	httpx.WriteJSON(w, http.StatusOK, puestos.Resumenes())
}
