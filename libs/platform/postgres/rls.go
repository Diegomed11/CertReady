package postgres

import (
	"context"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/certready/certready/libs/platform/httpx"
)

// Querier es la interfaz común de *pgxpool.Pool y pgx.Tx que usan los stores, para
// poder ejecutar las consultas de una petición dentro de una transacción con el
// usuario fijado (RLS) o, en su defecto, directamente sobre el pool.
type Querier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

type rlsTxKey struct{}

// ContextWithTx asocia una transacción de petición al context (la usa RLSTx).
func ContextWithTx(ctx context.Context, tx pgx.Tx) context.Context {
	return context.WithValue(ctx, rlsTxKey{}, tx)
}

// TxFromContext devuelve la transacción de la petición (RLS activo) si existe.
//
// La usan los stores que necesitan abrir su propia transacción (varias sentencias
// atómicas): si ya hay una de petición con el usuario fijado, deben reutilizarla en
// vez de abrir otra (que iría sin el `app.usuario_id` y fallaría bajo RLS).
func TxFromContext(ctx context.Context) (pgx.Tx, bool) {
	tx, ok := ctx.Value(rlsTxKey{}).(pgx.Tx)
	return tx, ok && tx != nil
}

// Q devuelve el ejecutor de queries para esta petición.
//
// Si RLSTx colocó una transacción en el context (RLS activo), la devuelve para que
// las consultas hereden el `app.usuario_id` fijado; si no, devuelve el pool, con lo
// que el comportamiento es idéntico al de usar el pool directamente (RLS apagado).
func Q(ctx context.Context, pool *pgxpool.Pool) Querier {
	if tx, ok := ctx.Value(rlsTxKey{}).(pgx.Tx); ok && tx != nil {
		return tx
	}
	return pool
}

// rlsStatusRecorder captura el código de estado para decidir commit/rollback.
type rlsStatusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *rlsStatusRecorder) WriteHeader(s int) {
	r.status = s
	r.ResponseWriter.WriteHeader(s)
}

// RLSTx envuelve la petición en una transacción con `SET LOCAL app.usuario_id` para
// activar las políticas Row Level Security de PostgreSQL.
//
// Es un **interruptor**: con enabled=false (o sin sub) es un no-op y los stores usan
// el pool tal cual (comportamiento actual). Con enabled=true abre una transacción,
// fija el usuario, ejecuta el handler dentro de ella y hace commit si la respuesta
// fue exitosa (< 400) o rollback en caso contrario o de pánico.
//
// Debe componerse **por dentro** del middleware de auth (que coloca la identidad en
// el context); `subOf` extrae el `sub` de ahí.
//
// Parameters
//
//	pool    : pool de Postgres del servicio.
//	enabled : interruptor (p. ej. ENROLLMENTS_RLS_ENABLED).
//	subOf   : extrae el `sub` del usuario autenticado desde el context.
func RLSTx(
	pool *pgxpool.Pool,
	enabled bool,
	subOf func(context.Context) string,
) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		if !enabled {
			return next
		}
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			sub := subOf(r.Context())
			if sub == "" {
				next.ServeHTTP(w, r)
				return
			}
			ctx := r.Context()
			tx, err := pool.Begin(ctx)
			if err != nil {
				httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "error interno")
				return
			}
			committed := false
			defer func() {
				if !committed {
					_ = tx.Rollback(context.Background())
				}
			}()
			// SET LOCAL acotado a la transacción: se descarta al cerrarla.
			if _, err := tx.Exec(ctx, "select set_config('app.usuario_id', $1, true)", sub); err != nil {
				httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "error interno")
				return
			}
			rec := &rlsStatusRecorder{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(rec, r.WithContext(ContextWithTx(ctx, tx)))
			if rec.status < http.StatusBadRequest {
				if err := tx.Commit(ctx); err == nil {
					committed = true
				}
			}
		})
	}
}
