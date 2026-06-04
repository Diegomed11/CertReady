package catalogclient_test

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/certready/certready/services/enrollments/internal/catalogclient"
)

const objID = "33333333-3333-3333-3333-333333333333"

// nuevoServidorMock arma un servidor de prueba que responde según el código
// indicado por el test.
func nuevoServidorMock(t *testing.T, codigo int) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(codigo)
	}))
	t.Cleanup(srv.Close)
	return srv
}

func TestClienteExiste(t *testing.T) {
	tests := []struct {
		name       string
		codigo     int
		wantExiste bool
		wantErr    error
	}{
		{"200 existe", http.StatusOK, true, nil},
		{"404 no existe", http.StatusNotFound, false, nil},
		{"500 catalog caído", http.StatusInternalServerError, false, catalogclient.ErrCatalogoNoDisponible},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			srv := nuevoServidorMock(t, tt.codigo)
			c := catalogclient.New(srv.URL, 2*time.Second)

			existe, err := c.CertificacionExiste(context.Background(), objID)
			if existe != tt.wantExiste {
				t.Errorf("existe = %v; quería %v", existe, tt.wantExiste)
			}
			if tt.wantErr == nil && err != nil {
				t.Errorf("err = %v; quería nil", err)
			}
			if tt.wantErr != nil && !errors.Is(err, tt.wantErr) {
				t.Errorf("err = %v; quería %v", err, tt.wantErr)
			}
		})
	}
}

func TestClienteCodigoInesperado(t *testing.T) {
	srv := nuevoServidorMock(t, http.StatusForbidden)
	c := catalogclient.New(srv.URL, 2*time.Second)

	_, err := c.PistaExiste(context.Background(), objID)
	if err == nil {
		t.Fatal("se esperaba error por código inesperado, se obtuvo nil")
	}
	if errors.Is(err, catalogclient.ErrCatalogoNoDisponible) {
		t.Errorf("403 no debería clasificarse como 'no disponible': %v", err)
	}
}
