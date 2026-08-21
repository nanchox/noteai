-- Sprint 5: Editor de bloques
-- Agregar columna blocks a notes (el campo content existente se mantiene por compatibilidad)
ALTER TABLE notes ADD COLUMN IF NOT EXISTS blocks JSONB DEFAULT '[]'::jsonb;

-- Índice para búsqueda en bloques
CREATE INDEX IF NOT EXISTS notes_blocks_idx ON notes USING GIN(blocks);
