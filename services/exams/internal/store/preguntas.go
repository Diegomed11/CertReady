package store

import (
	"context"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/readpref"

	"github.com/certready/certready/services/exams/internal/exams"
)

// PreguntasStore es el banco de preguntas en MongoDB.
type PreguntasStore struct {
	db *mongo.Database
}

// NewPreguntas construye el store de preguntas sobre la base dada.
func NewPreguntas(db *mongo.Database) *PreguntasStore { return &PreguntasStore{db: db} }

func (s *PreguntasStore) coll() *mongo.Collection { return s.db.Collection("preguntas") }

// PingMongo verifica la conectividad con MongoDB (sonda de readiness).
func (s *PreguntasStore) PingMongo(ctx context.Context) error {
	return s.db.Client().Ping(ctx, readpref.Primary())
}

// Muestrear elige al azar hasta n preguntas de opción múltiple de la
// certificación dada (aleatorización en la base con $sample).
//
// Parameters
//
//	certificacion : certificación a la que pertenecen las preguntas.
//	tema          : si no está vacío, acota el muestreo a ese tema (quiz por tema).
//	n             : número máximo de preguntas a devolver.
func (s *PreguntasStore) Muestrear(ctx context.Context, certificacion, tema string, n int) ([]exams.Pregunta, error) {
	filtro := bson.D{
		{Key: "certificacion", Value: certificacion},
		{Key: "tipo", Value: "opcion_multiple"},
	}
	if tema != "" {
		filtro = append(filtro, bson.E{Key: "tema", Value: tema})
	}
	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: filtro}},
		{{Key: "$sample", Value: bson.D{{Key: "size", Value: n}}}},
	}
	cur, err := s.coll().Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	var out []exams.Pregunta
	if err := cur.All(ctx, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// PorRefs devuelve las preguntas indicadas, indexadas por su ref. Las refs que
// no existan simplemente no aparecen en el mapa.
func (s *PreguntasStore) PorRefs(ctx context.Context, refs []string) (map[string]exams.Pregunta, error) {
	cur, err := s.coll().Find(ctx, bson.M{"_id": bson.M{"$in": refs}})
	if err != nil {
		return nil, err
	}
	var lista []exams.Pregunta
	if err := cur.All(ctx, &lista); err != nil {
		return nil, err
	}
	m := make(map[string]exams.Pregunta, len(lista))
	for _, p := range lista {
		m[p.ID] = p
	}
	return m, nil
}

// CrearPregunta inserta una pregunta nueva en el banco.
//
// Returns ErrConflict si el id ya existe.
func (s *PreguntasStore) CrearPregunta(ctx context.Context, n exams.NuevaPregunta) (exams.Pregunta, error) {
	tags := n.Tags
	if tags == nil {
		tags = []string{}
	}
	p := exams.Pregunta{
		ID:                n.ID,
		Certificacion:     n.Certificacion,
		Tema:              n.Tema,
		Dificultad:        n.Dificultad,
		Tipo:              n.Tipo,
		Enunciado:         n.Enunciado,
		Opciones:          n.Opciones,
		RespuestaCorrecta: n.RespuestaCorrecta,
		Explicacion:       n.Explicacion,
		Tags:              tags,
	}
	if _, err := s.coll().InsertOne(ctx, p); err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return exams.Pregunta{}, ErrConflict
		}
		return exams.Pregunta{}, err
	}
	return p, nil
}
