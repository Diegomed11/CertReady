// Package store implementa el acceso a MongoDB del servicio content.
package store

import (
	"context"
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"go.mongodb.org/mongo-driver/v2/mongo/readpref"

	"github.com/certready/certready/services/content/internal/content"
)

// Errores de dominio del repositorio.
var (
	ErrNotFound = errors.New("material no encontrado")
	ErrConflict = errors.New("ya existe material con ese id")
)

// Store es el repositorio MongoDB del material de estudio.
type Store struct {
	db *mongo.Database
}

// New construye un Store sobre la base de datos dada.
func New(db *mongo.Database) *Store { return &Store{db: db} }

func (s *Store) coll() *mongo.Collection { return s.db.Collection("materiales") }

// Ping verifica la conectividad con MongoDB (sonda de readiness).
func (s *Store) Ping(ctx context.Context) error {
	return s.db.Client().Ping(ctx, readpref.Primary())
}

// Filtro acota y pagina el listado de material.
type Filtro struct {
	Certificacion string
	Tema          string
	Limit         int
	Offset        int
}

// Listar devuelve la página de material que cumple el filtro, más reciente primero.
//
// El filtro se construye con un documento BSON (parámetros), nunca concatenando
// entrada del usuario (defensa contra inyección NoSQL).
func (s *Store) Listar(ctx context.Context, f Filtro) ([]content.Material, error) {
	filter := bson.M{}
	if f.Certificacion != "" {
		filter["certificacion"] = f.Certificacion
	}
	if f.Tema != "" {
		filter["tema"] = f.Tema
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "creado_en", Value: -1}}).
		SetLimit(int64(f.Limit)).
		SetSkip(int64(f.Offset))

	cur, err := s.coll().Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	var out []content.Material
	if err := cur.All(ctx, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// Obtener devuelve un material por su id.
func (s *Store) Obtener(ctx context.Context, id string) (content.Material, error) {
	var m content.Material
	err := s.coll().FindOne(ctx, bson.M{"_id": id}).Decode(&m)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return content.Material{}, ErrNotFound
	}
	return m, err
}

// Crear inserta material nuevo y devuelve el documento creado.
//
// Returns ErrConflict si el id ya existe.
func (s *Store) Crear(ctx context.Context, n content.NuevoMaterial) (content.Material, error) {
	formato := n.Formato
	if formato == "" {
		formato = "markdown"
	}
	recursos := n.Recursos
	if recursos == nil {
		recursos = []string{}
	}

	m := content.Material{
		ID:            n.ID,
		Certificacion: n.Certificacion,
		Tema:          n.Tema,
		Titulo:        n.Titulo,
		Formato:       formato,
		Contenido:     n.Contenido,
		Recursos:      recursos,
		CreadoEn:      time.Now().UTC(),
	}

	if _, err := s.coll().InsertOne(ctx, m); err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return content.Material{}, ErrConflict
		}
		return content.Material{}, err
	}
	return m, nil
}
