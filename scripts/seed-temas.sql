-- Temario real de AWS Solutions Architect Associate (cert slug 'aws-saa').
-- Inserta los temas ordenados en catalog.temas. Idempotente: no duplica
-- (unique (certificacion_id, slug)). Requiere que la certificación 'aws-saa' ya
-- exista (la siembra dev-up.ps1 antes de este script).
--
-- Cada `dominio` apunta al dominio oficial del examen (Secure / Resilient /
-- High-Performing / Cost-Optimized), en español para mostrarlo en la ruta.

-- Normaliza: elimina temas de 'aws-saa' que no son del temario actual (p. ej.
-- datos de pruebas viejas), para que la ruta quede exactamente con estos 11.
delete from catalog.temas t
using catalog.certificaciones c
where t.certificacion_id = c.id and c.slug = 'aws-saa'
  and t.slug not in (
    'fundamentos', 'iam', 'seguridad-datos', 'redes-vpc', 'computo', 'almacenamiento',
    'bases-datos', 'desacoplamiento', 'alta-disponibilidad', 'monitoreo', 'costos'
  );

with c as (
  select id from catalog.certificaciones where slug = 'aws-saa'
)
insert into catalog.temas (certificacion_id, slug, nombre, dominio, orden)
select c.id, t.slug, t.nombre, t.dominio, t.orden
from c, (values
  ('fundamentos',         'Fundamentos de AWS',                               'Fundamentos',  1),
  ('iam',                 'Identidad y acceso (IAM)',                         'Seguridad',    2),
  ('seguridad-datos',     'Cifrado y secretos',                               'Seguridad',    3),
  ('redes-vpc',           'Redes: VPC',                                       'Seguridad',    4),
  ('computo',             'Cómputo: EC2, Auto Scaling, ELB y Lambda',         'Rendimiento',  5),
  ('almacenamiento',      'Almacenamiento: S3, EBS, EFS y Glacier',           'Costos',       6),
  ('bases-datos',         'Bases de datos: RDS, Aurora, DynamoDB',            'Rendimiento',  7),
  ('desacoplamiento',     'Aplicaciones desacopladas: SQS, SNS, API Gateway', 'Resiliencia',  8),
  ('alta-disponibilidad', 'Alta disponibilidad y recuperación ante desastres','Resiliencia',  9),
  ('monitoreo',           'Monitoreo y operación',                            'Operación',   10),
  ('costos',              'Costos y optimización',                            'Costos',      11)
) as t(slug, nombre, dominio, orden)
on conflict (certificacion_id, slug) do nothing;
