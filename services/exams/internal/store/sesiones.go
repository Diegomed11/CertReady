package store

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/certready/certready/libs/platform/postgres"
	"github.com/certready/certready/services/exams/internal/exams"
)

// SesionesStore gestiona sesiones e intentos de examen en PostgreSQL.
type SesionesStore struct {
	pool *pgxpool.Pool
}

// NewSesiones construye el store de sesiones sobre el pool dado.
func NewSesiones(pool *pgxpool.Pool) *SesionesStore { return &SesionesStore{pool: pool} }

// PingPostgres verifica la conectividad con Postgres (sonda de readiness).
func (s *SesionesStore) PingPostgres(ctx context.Context) error { return s.pool.Ping(ctx) }

const sesionCols = `id::text, usuario_id::text, certificacion, modo, estado, puntaje, iniciado_en, finalizado_en`

// CrearSesion crea una sesión en curso con las preguntas (refs) elegidas.
func (s *SesionesStore) CrearSesion(ctx context.Context, usuarioID, certificacion, modo string, refs []string) (exams.Sesion, error) {
	refsJSON, err := json.Marshal(refs)
	if err != nil {
		return exams.Sesion{}, err
	}
	var ses exams.Sesion
	err = postgres.Q(ctx, s.pool).QueryRow(ctx,
		`insert into exams.sesiones (usuario_id, certificacion, modo, preguntas)
		 values ($1, $2, $3, $4::jsonb)
		 returning `+sesionCols,
		usuarioID, certificacion, modo, string(refsJSON),
	).Scan(&ses.ID, &ses.UsuarioID, &ses.Certificacion, &ses.Modo, &ses.Estado, &ses.Puntaje, &ses.IniciadoEn, &ses.FinalizadoEn)
	if err != nil {
		return exams.Sesion{}, err
	}
	return ses, nil
}

// ObtenerSesion devuelve una sesión del usuario indicado junto con sus refs de
// preguntas. Returns ErrNotFound si no existe o no pertenece (defensa BOLA).
func (s *SesionesStore) ObtenerSesion(ctx context.Context, usuarioID, id string) (exams.Sesion, []string, error) {
	var ses exams.Sesion
	var refsRaw []byte
	err := postgres.Q(ctx, s.pool).QueryRow(ctx,
		`select `+sesionCols+`, preguntas from exams.sesiones where id::text = $1 and usuario_id::text = $2`,
		id, usuarioID,
	).Scan(&ses.ID, &ses.UsuarioID, &ses.Certificacion, &ses.Modo, &ses.Estado, &ses.Puntaje, &ses.IniciadoEn, &ses.FinalizadoEn, &refsRaw)
	if errors.Is(err, pgx.ErrNoRows) {
		return exams.Sesion{}, nil, ErrNotFound
	}
	if err != nil {
		return exams.Sesion{}, nil, err
	}
	var refs []string
	if err := json.Unmarshal(refsRaw, &refs); err != nil {
		return exams.Sesion{}, nil, err
	}
	return ses, refs, nil
}

// ListarSesiones devuelve las sesiones del usuario, más recientes primero.
func (s *SesionesStore) ListarSesiones(ctx context.Context, usuarioID string, limit, offset int) ([]exams.Sesion, error) {
	rows, err := postgres.Q(ctx, s.pool).Query(ctx,
		`select `+sesionCols+` from exams.sesiones where usuario_id::text = $1
		 order by iniciado_en desc limit $2 offset $3`,
		usuarioID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []exams.Sesion
	for rows.Next() {
		var ses exams.Sesion
		if err := rows.Scan(&ses.ID, &ses.UsuarioID, &ses.Certificacion, &ses.Modo, &ses.Estado, &ses.Puntaje, &ses.IniciadoEn, &ses.FinalizadoEn); err != nil {
			return nil, err
		}
		out = append(out, ses)
	}
	return out, rows.Err()
}

// ObtenerIntentos devuelve los intentos registrados de una sesión.
func (s *SesionesStore) ObtenerIntentos(ctx context.Context, sesionID string) ([]exams.Intento, error) {
	rows, err := postgres.Q(ctx, s.pool).Query(ctx,
		`select pregunta_ref, correcto, seleccion from exams.intentos where sesion_id::text = $1 order by creado_en`,
		sesionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []exams.Intento
	for rows.Next() {
		var it exams.Intento
		var selRaw []byte
		if err := rows.Scan(&it.PreguntaRef, &it.Correcto, &selRaw); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(selRaw, &it.Seleccion); err != nil {
			return nil, err
		}
		out = append(out, it)
	}
	return out, rows.Err()
}

// Finalizar registra los intentos y cierra la sesión con su puntaje, en una
// transacción. Verifica que la sesión pertenezca al usuario y esté en curso.
//
// Returns ErrNotFound si no existe o no pertenece; ErrYaFinalizada si ya estaba
// cerrada.
func (s *SesionesStore) Finalizar(ctx context.Context, usuarioID, id string, puntaje float64, intentos []exams.Intento) error {
	// Con RLS activo reutiliza la transacción de la petición (que ya fijó el usuario);
	// el commit lo hace el middleware. Sin RLS, abre y cierra su propia transacción.
	if tx, ok := postgres.TxFromContext(ctx); ok {
		return finalizarEnTx(ctx, tx, usuarioID, id, puntaje, intentos)
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if err := finalizarEnTx(ctx, tx, usuarioID, id, puntaje, intentos); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// finalizarEnTx cierra la sesión sobre la transacción dada: verifica pertenencia y
// estado con FOR UPDATE, inserta los intentos y la marca finalizada. NO hace commit:
// lo hace el llamador (o el middleware RLS si es la transacción de la petición).
func finalizarEnTx(ctx context.Context, tx pgx.Tx, usuarioID, id string, puntaje float64, intentos []exams.Intento) error {
	var estado string
	err := tx.QueryRow(ctx,
		`select estado from exams.sesiones where id::text = $1 and usuario_id::text = $2 for update`,
		id, usuarioID,
	).Scan(&estado)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if estado != "en_curso" {
		return ErrYaFinalizada
	}

	for _, it := range intentos {
		selJSON, err := json.Marshal(it.Seleccion)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx,
			`insert into exams.intentos (sesion_id, usuario_id, pregunta_ref, correcto, seleccion, tema, dificultad)
			 values ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
			id, usuarioID, it.PreguntaRef, it.Correcto, string(selJSON), it.Tema, it.Dificultad,
		); err != nil {
			return err
		}
	}

	if _, err := tx.Exec(ctx,
		`update exams.sesiones set estado = 'finalizada', puntaje = $2, finalizado_en = now() where id::text = $1`,
		id, puntaje,
	); err != nil {
		return err
	}

	return nil
}
