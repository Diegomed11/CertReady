-- Migración 0002 (up) — autoevaluaciones de preguntas de entrevista (Q&A).
--
-- Una fila por autoevaluación que el usuario registra al revisar una Q&A (tras ver
-- la respuesta modelo): qué tan bien la respondió. Es la fuente operativa de la
-- señal de Q&A para el DSS de "preparación por puesto" (Fase 4). `qa_ref` es una
-- ref lógica a la Q&A en MongoDB (ADR-09); el ETL la enriquece con puesto/área/
-- categoría. Eventos append-only (el ETL es incremental por `creado_en`).

create table if not exists progress.qa_revisiones (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid not null,
  qa_ref     text not null,                         -- ref lógica a la Q&A en MongoDB
  nivel      smallint not null check (nivel between 1 and 3),  -- 1=me costó · 2=regular · 3=bien
  creado_en  timestamptz not null default now()
);

create index if not exists qa_revisiones_usuario_idx on progress.qa_revisiones (usuario_id);
