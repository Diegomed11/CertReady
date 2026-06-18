package store

import (
	"context"

	"github.com/certready/certready/libs/platform/postgres"
	"github.com/certready/certready/services/exams/internal/exams"
)

// AgregadoPorCelda devuelve los intentos del usuario por celda (tema, dificultad)
// en una certificación, ya agregados (aciertos y total).
//
// Une intentos con su sesión para acotar por certificación (el tema/dificultad se
// denormaliza en el intento; ver migración 0003). Es de solo lectura y honra la
// transacción RLS de la petición vía postgres.Q.
func (s *SesionesStore) AgregadoPorCelda(ctx context.Context, usuarioID, certificacion string) ([]exams.CeldaAgg, error) {
	rows, err := postgres.Q(ctx, s.pool).Query(ctx,
		`select i.tema, i.dificultad,
		        sum(case when i.correcto then 1 else 0 end)::int as aciertos,
		        count(*)::int as total
		 from exams.intentos i
		 join exams.sesiones s on s.id = i.sesion_id
		 where i.usuario_id::text = $1 and s.certificacion = $2
		 group by i.tema, i.dificultad
		 order by i.tema, i.dificultad`,
		usuarioID, certificacion)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []exams.CeldaAgg
	for rows.Next() {
		var c exams.CeldaAgg
		if err := rows.Scan(&c.Tema, &c.Dificultad, &c.Aciertos, &c.Total); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// AgregadoPorFecha devuelve la tendencia diaria del usuario en una certificación:
// aciertos y total por día (UTC), ordenado por fecha ascendente.
func (s *SesionesStore) AgregadoPorFecha(ctx context.Context, usuarioID, certificacion string) ([]exams.PuntoFecha, error) {
	rows, err := postgres.Q(ctx, s.pool).Query(ctx,
		`select to_char(i.creado_en::date, 'YYYY-MM-DD') as fecha,
		        sum(case when i.correcto then 1 else 0 end)::int as aciertos,
		        count(*)::int as total
		 from exams.intentos i
		 join exams.sesiones s on s.id = i.sesion_id
		 where i.usuario_id::text = $1 and s.certificacion = $2
		 group by i.creado_en::date
		 order by i.creado_en::date`,
		usuarioID, certificacion)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []exams.PuntoFecha
	for rows.Next() {
		var p exams.PuntoFecha
		if err := rows.Scan(&p.Fecha, &p.Aciertos, &p.Total); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}
