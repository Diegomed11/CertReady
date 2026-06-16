-- Migración 0002 (down) — revierte qa_revisiones.
drop index if exists progress.qa_revisiones_usuario_idx;
drop table if exists progress.qa_revisiones;
