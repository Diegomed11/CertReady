package store

import (
	"context"
	"errors"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/readpref"

	"github.com/certready/certready/judge/internal/judge"
)

// ProblemasStore lee problemas (con sus casos ocultos) de MongoDB.
//
// Es de solo lectura: el dueño de la escritura es el servicio problems. El juez
// solo consulta el problema completo para calificar del lado del servidor.
type ProblemasStore struct {
	db *mongo.Database
}

// NewProblemas construye el store de problemas sobre la base dada.
func NewProblemas(db *mongo.Database) *ProblemasStore { return &ProblemasStore{db: db} }

func (s *ProblemasStore) coll() *mongo.Collection { return s.db.Collection("problemas") }

// PingMongo verifica la conectividad con MongoDB (sonda de readiness).
func (s *ProblemasStore) PingMongo(ctx context.Context) error {
	return s.db.Client().Ping(ctx, readpref.Primary())
}

// ObtenerProblema devuelve el problema completo (incluidos casos ocultos y
// límites) por su id. Returns ErrNotFound si no existe.
func (s *ProblemasStore) ObtenerProblema(ctx context.Context, id string) (judge.Problema, error) {
	var p judge.Problema
	err := s.coll().FindOne(ctx, bson.M{"_id": id}).Decode(&p)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return judge.Problema{}, ErrNotFound
	}
	return p, err
}
