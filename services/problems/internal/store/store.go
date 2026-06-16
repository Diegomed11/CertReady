// Package store implementa el acceso a MongoDB del servicio problems: el banco de
// problemas de código y el banco de preguntas de Q&A, en dos colecciones.
package store

import (
	"context"
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"go.mongodb.org/mongo-driver/v2/mongo/readpref"

	"github.com/certready/certready/services/problems/internal/problems"
)

// Errores de dominio del repositorio.
var (
	ErrNotFound = errors.New("recurso no encontrado")
	ErrConflict = errors.New("ya existe un recurso con ese id")
)

// Store es el repositorio MongoDB de problemas y preguntas de Q&A.
type Store struct {
	db *mongo.Database
}

// New construye un Store sobre la base de datos dada.
func New(db *mongo.Database) *Store { return &Store{db: db} }

func (s *Store) collProblemas() *mongo.Collection { return s.db.Collection("problemas") }
func (s *Store) collQA() *mongo.Collection        { return s.db.Collection("qa") }

// Ping verifica la conectividad con MongoDB (sonda de readiness).
func (s *Store) Ping(ctx context.Context) error {
	return s.db.Client().Ping(ctx, readpref.Primary())
}

// --- Problemas -------------------------------------------------------------

// FiltroProblemas acota y pagina el listado de problemas.
//
// Areas (si trae varias) filtra por cualquiera de ellas (`$in`); permite elegir
// una especialidad que agrupa varias áreas. Area (una sola) mantiene el filtro
// exacto previo. Si ambas vienen, Areas tiene prioridad.
type FiltroProblemas struct {
	Area       string
	Areas      []string
	Dificultad string
	Etiqueta   string
	Limit      int
	Offset     int
}

// ListarProblemas devuelve la página de problemas que cumple el filtro, más
// recientes primero.
//
// El filtro se construye con un documento BSON (parámetros), nunca concatenando
// entrada del usuario (defensa contra inyección NoSQL). Devuelve los documentos
// completos; la proyección a vista pública es responsabilidad del handler.
func (s *Store) ListarProblemas(ctx context.Context, f FiltroProblemas) ([]problems.Problema, error) {
	filter := bson.M{}
	if len(f.Areas) > 0 {
		filter["area"] = bson.M{"$in": f.Areas}
	} else if f.Area != "" {
		filter["area"] = f.Area
	}
	if f.Dificultad != "" {
		filter["dificultad"] = f.Dificultad
	}
	if f.Etiqueta != "" {
		filter["etiquetas"] = f.Etiqueta
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "creado_en", Value: -1}}).
		SetLimit(int64(f.Limit)).
		SetSkip(int64(f.Offset))

	cur, err := s.collProblemas().Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	var out []problems.Problema
	if err := cur.All(ctx, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// ObtenerProblema devuelve un problema completo por su id (incluye casos ocultos).
//
// Returns ErrNotFound si no existe.
func (s *Store) ObtenerProblema(ctx context.Context, id string) (problems.Problema, error) {
	var p problems.Problema
	err := s.collProblemas().FindOne(ctx, bson.M{"_id": id}).Decode(&p)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return problems.Problema{}, ErrNotFound
	}
	return p, err
}

// CrearProblema inserta un problema nuevo y devuelve el documento creado.
//
// Returns ErrConflict si el id ya existe.
func (s *Store) CrearProblema(ctx context.Context, n problems.NuevoProblema) (problems.Problema, error) {
	p := problems.Problema{
		ID:                  n.ID,
		Titulo:              n.Titulo,
		Enunciado:           n.Enunciado,
		Dificultad:          n.Dificultad,
		Area:                n.Area,
		Etiquetas:           sliceOrEmpty(n.Etiquetas),
		LenguajesPermitidos: sliceOrEmpty(n.LenguajesPermitidos),
		Plantillas:          mapOrEmpty(n.Plantillas),
		LimiteTiempoMs:      conDefecto(n.LimiteTiempoMs, 2000),
		LimiteMemoriaMB:     conDefecto(n.LimiteMemoriaMB, 256),
		Casos:               normalizarCasos(n.Casos),
		CreadoEn:            time.Now().UTC(),
	}
	if _, err := s.collProblemas().InsertOne(ctx, p); err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return problems.Problema{}, ErrConflict
		}
		return problems.Problema{}, err
	}
	return p, nil
}

// --- Q&A -------------------------------------------------------------------

// FiltroQA acota y pagina el listado de preguntas de Q&A.
//
// Areas (si trae varias) filtra por cualquiera de ellas (`$in`): elegir una
// especialidad equivale a sus áreas, que pueden compartirse entre especialidades.
// Area (una sola) mantiene el filtro exacto previo; si ambas vienen, gana Areas.
type FiltroQA struct {
	Puesto    string
	Area      string
	Areas     []string
	Categoria string
	Limit     int
	Offset    int
}

// ListarQA devuelve la página de preguntas de Q&A que cumple el filtro, más
// recientes primero.
func (s *Store) ListarQA(ctx context.Context, f FiltroQA) ([]problems.PreguntaQA, error) {
	filter := bson.M{}
	if f.Puesto != "" {
		filter["puesto"] = f.Puesto
	}
	if len(f.Areas) > 0 {
		filter["area"] = bson.M{"$in": f.Areas}
	} else if f.Area != "" {
		filter["area"] = f.Area
	}
	if f.Categoria != "" {
		filter["categoria"] = f.Categoria
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "creado_en", Value: -1}}).
		SetLimit(int64(f.Limit)).
		SetSkip(int64(f.Offset))

	cur, err := s.collQA().Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	var out []problems.PreguntaQA
	if err := cur.All(ctx, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// ObtenerQA devuelve una pregunta de Q&A por su id. Returns ErrNotFound si no existe.
func (s *Store) ObtenerQA(ctx context.Context, id string) (problems.PreguntaQA, error) {
	var q problems.PreguntaQA
	err := s.collQA().FindOne(ctx, bson.M{"_id": id}).Decode(&q)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return problems.PreguntaQA{}, ErrNotFound
	}
	return q, err
}

// CrearQA inserta una pregunta de Q&A nueva y devuelve el documento creado.
//
// Returns ErrConflict si el id ya existe.
func (s *Store) CrearQA(ctx context.Context, n problems.NuevaPreguntaQA) (problems.PreguntaQA, error) {
	tipo := n.Tipo
	if tipo == "" {
		tipo = "abierta"
	}
	q := problems.PreguntaQA{
		ID:              n.ID,
		Puesto:          n.Puesto,
		Area:            n.Area,
		Categoria:       n.Categoria,
		Enunciado:       n.Enunciado,
		Tipo:            tipo,
		RespuestaModelo: n.RespuestaModelo,
		PuntosClave:     sliceOrEmpty(n.PuntosClave),
		Etiquetas:       sliceOrEmpty(n.Etiquetas),
		CreadoEn:        time.Now().UTC(),
	}
	if _, err := s.collQA().InsertOne(ctx, q); err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return problems.PreguntaQA{}, ErrConflict
		}
		return problems.PreguntaQA{}, err
	}
	return q, nil
}

// --- helpers ---------------------------------------------------------------

func sliceOrEmpty(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}

func mapOrEmpty(m map[string]string) map[string]string {
	if m == nil {
		return map[string]string{}
	}
	return m
}

func conDefecto(v, def int) int {
	if v <= 0 {
		return def
	}
	return v
}

// normalizarCasos asegura un peso >= 1 en cada caso para una calificación estable.
func normalizarCasos(casos []problems.Caso) []problems.Caso {
	out := make([]problems.Caso, len(casos))
	for i, c := range casos {
		if c.Peso <= 0 {
			c.Peso = 1
		}
		out[i] = c
	}
	return out
}
