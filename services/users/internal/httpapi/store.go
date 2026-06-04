package httpapi

import (
	"context"

	"github.com/certready/certready/services/users/internal/users"
)

// UserStore es el contrato de persistencia que necesitan los handlers. Depender
// de una interfaz permite probar los handlers con un doble en memoria.
type UserStore interface {
	Ping(ctx context.Context) error
	ObtenerOProvisionar(ctx context.Context, id, email string, nombre *string, rol string) (users.Usuario, error)
	ObtenerPerfil(ctx context.Context, usuarioID string) (users.Perfil, error)
	ActualizarCuenta(ctx context.Context, id string, in users.ActualizarPerfil) (users.Usuario, users.Perfil, error)
	ListarUsuarios(ctx context.Context, limit, offset int) ([]users.Usuario, error)
}
