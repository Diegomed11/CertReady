// Package puestos carga el catálogo curado de puestos/especialidades (señales,
// pesos, certificaciones y áreas) usado por la "preparación por puesto".
//
// El catálogo se embebe (puestos.json) y se valida una vez al iniciar; antes vivía
// en el DSS (Python), pero la preparación por puesto pasó a ser operativa (Go).
package puestos

import (
	_ "embed"
	"encoding/json"
	"fmt"
)

//go:embed puestos.json
var raw []byte

// Senal es una de las tres componentes de la preparación (exámenes, código, Q&A):
// su peso relativo y las claves de contenido (certificaciones o áreas) que la nutren.
type Senal struct {
	Peso            float64  `json:"peso"`
	Certificaciones []string `json:"certificaciones,omitempty"`
	Areas           []string `json:"areas,omitempty"`
}

// Senales agrupa las tres señales de un puesto.
type Senales struct {
	Examenes Senal `json:"examenes"`
	Codigo   Senal `json:"codigo"`
	Qa       Senal `json:"qa"`
}

// Puesto es una especialidad del catálogo, con sus señales.
type Puesto struct {
	Slug        string  `json:"slug"`
	Nombre      string  `json:"nombre"`
	Descripcion string  `json:"descripcion"`
	Senales     Senales `json:"senales"`
}

// Resumen es la vista pública del catálogo (sin pesos): lo que consumen el
// selector de "preparación por puesto" y los chips de especialidad de Entrevistas.
type Resumen struct {
	Slug        string   `json:"slug"`
	Nombre      string   `json:"nombre"`
	Descripcion string   `json:"descripcion"`
	QaAreas     []string `json:"qa_areas"`
	CodeAreas   []string `json:"code_areas"`
}

var lista []Puesto

func init() {
	var doc struct {
		Puestos []Puesto `json:"puestos"`
	}
	if err := json.Unmarshal(raw, &doc); err != nil {
		panic(fmt.Sprintf("puestos.json inválido: %v", err))
	}
	lista = doc.Puestos
}

// Todos devuelve el catálogo completo (con pesos), para el agregador de readiness.
func Todos() []Puesto { return lista }

// Por busca un puesto por slug. Returns (Puesto{}, false) si no existe.
func Por(slug string) (Puesto, bool) {
	for _, p := range lista {
		if p.Slug == slug {
			return p, true
		}
	}
	return Puesto{}, false
}

// Resumenes devuelve la vista pública del catálogo (slices nunca nil para el JSON).
func Resumenes() []Resumen {
	out := make([]Resumen, 0, len(lista))
	for _, p := range lista {
		qa := p.Senales.Qa.Areas
		if qa == nil {
			qa = []string{}
		}
		code := p.Senales.Codigo.Areas
		if code == nil {
			code = []string{}
		}
		out = append(out, Resumen{
			Slug:        p.Slug,
			Nombre:      p.Nombre,
			Descripcion: p.Descripcion,
			QaAreas:     qa,
			CodeAreas:   code,
		})
	}
	return out
}
