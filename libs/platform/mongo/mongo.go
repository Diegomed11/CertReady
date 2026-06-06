// Package mongo centraliza la creación del cliente de MongoDB usado por los
// servicios de contenido y preguntas, con valores por defecto razonables.
package mongo

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"go.mongodb.org/mongo-driver/v2/mongo/readpref"
)

// Connect crea y verifica un cliente de MongoDB.
//
// Parameters
//
//	ctx : context que acota el tiempo del ping inicial.
//	uri : cadena de conexión, p. ej. "mongodb://localhost:27017" en dev o la URI
//	      de MongoDB Atlas (con TLS) en el despliegue.
//
// Returns
//
//	*mongo.Client : cliente listo para usar; el llamador debe cerrarlo (Disconnect).
//	error         : si la URI es inválida o no se logra conectar/hacer ping.
func Connect(ctx context.Context, uri string) (*mongo.Client, error) {
	opts := options.Client().
		ApplyURI(uri).
		SetServerSelectionTimeout(5 * time.Second)

	client, err := mongo.Connect(opts)
	if err != nil {
		return nil, fmt.Errorf("configurar cliente de MongoDB: %w", err)
	}

	if err := client.Ping(ctx, readpref.Primary()); err != nil {
		_ = client.Disconnect(context.Background())
		return nil, fmt.Errorf("no se pudo conectar a MongoDB: %w", err)
	}
	return client, nil
}
