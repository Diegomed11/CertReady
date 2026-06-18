-- Migración 0004 (down) — revierte la denormalización del área en Q&A.

drop index if exists progress.qa_revisiones_usuario_area_idx;

alter table progress.qa_revisiones
  drop column if exists area;
