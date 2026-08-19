-- Sprint 2: agregar campo kanban_status a tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS kanban_status TEXT DEFAULT NULL;

-- Índice para kanban
CREATE INDEX IF NOT EXISTS tasks_kanban_idx ON tasks(kanban_status) WHERE kanban_status IS NOT NULL;
