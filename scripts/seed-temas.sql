-- Temario real de AWS Solutions Architect Associate (cert slug 'aws-saa'),
-- alineado con la guía oficial del examen SAA-C03 y sus 4 dominios de contenido:
--   Seguridad (30%) · Resiliencia (26%) · Rendimiento (24%) · Costos (20%).
--
-- Inserta/actualiza los temas ordenados en catalog.temas. Idempotente: vuelve a
-- ejecutarse sin duplicar y ACTUALIZA nombre/dominio/orden si cambian. Requiere
-- que la certificación 'aws-saa' ya exista (la siembra dev-up.ps1 antes).

-- Normaliza: elimina temas de 'aws-saa' que ya no son del temario (renombrados o
-- retirados), para que la ruta quede exactamente con estos 12.
delete from catalog.temas t
using catalog.certificaciones c
where t.certificacion_id = c.id and c.slug = 'aws-saa'
  and t.slug not in (
    'fundamentos', 'iam', 'redes-vpc', 'seguridad-datos', 'desacoplamiento',
    'alta-disponibilidad', 'computo', 'almacenamiento', 'bases-datos',
    'redes-rendimiento', 'datos', 'costos'
  );

with c as (
  select id from catalog.certificaciones where slug = 'aws-saa'
)
insert into catalog.temas (certificacion_id, slug, nombre, dominio, orden)
select c.id, t.slug, t.nombre, t.dominio, t.orden
from c, (values
  -- Dominio 1 — Diseño de arquitecturas seguras (30%)
  ('fundamentos',         'Fundamentos de AWS',                                 'Seguridad',    1),
  ('iam',                 'Acceso seguro: IAM, roles y multicuenta',            'Seguridad',    2),
  ('redes-vpc',           'Red y aplicaciones seguras (VPC, WAF, Shield)',      'Seguridad',    3),
  ('seguridad-datos',     'Seguridad de datos: cifrado y claves',               'Seguridad',    4),
  -- Dominio 2 — Diseño de arquitecturas resistentes (26%)
  ('desacoplamiento',     'Arquitecturas desacopladas y escalables',            'Resiliencia',  5),
  ('alta-disponibilidad', 'Alta disponibilidad y recuperación ante desastres',  'Resiliencia',  6),
  -- Dominio 3 — Diseño de arquitecturas de alto rendimiento (24%)
  ('computo',             'Cómputo elástico y de alto rendimiento',             'Rendimiento',  7),
  ('almacenamiento',      'Almacenamiento (S3, EBS, EFS, FSx)',                 'Rendimiento',  8),
  ('bases-datos',         'Bases de datos de alto rendimiento',                 'Rendimiento',  9),
  ('redes-rendimiento',   'Redes de alto rendimiento y entrega de contenido',   'Rendimiento', 10),
  ('datos',               'Ingesta y análisis de datos',                        'Rendimiento', 11),
  -- Dominio 4 — Diseño de arquitecturas con optimización de costos (20%)
  ('costos',              'Optimización de costos',                             'Costos',      12)
) as t(slug, nombre, dominio, orden)
on conflict (certificacion_id, slug) do update
  set nombre  = excluded.nombre,
      dominio = excluded.dominio,
      orden   = excluded.orden;
