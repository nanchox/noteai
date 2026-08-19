-- ============================================================
-- NoteAI - Supabase Schema
-- ============================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Para búsqueda full-text

-- ============================================================
-- TABLA: profiles (usuarios sincronizados con Auth)
-- ============================================================
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: projects (categorías / grupos de notas)
-- ============================================================
CREATE TABLE projects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',   -- color del proyecto en la UI
  icon TEXT DEFAULT '📁',
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: notes (notas principales)
-- ============================================================
CREATE TABLE notes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Sin título',
  content TEXT DEFAULT '',            -- contenido en markdown
  content_search TSVECTOR,            -- para búsqueda full-text
  is_pinned BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice de búsqueda full-text
CREATE INDEX notes_search_idx ON notes USING GIN(content_search);
CREATE INDEX notes_user_id_idx ON notes(user_id);
CREATE INDEX notes_project_id_idx ON notes(project_id);

-- Trigger para actualizar content_search automáticamente
CREATE OR REPLACE FUNCTION notes_search_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.content_search := to_tsvector('spanish', 
    COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.content, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notes_search_trigger
  BEFORE INSERT OR UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION notes_search_update();

-- ============================================================
-- TABLA: note_images (imágenes adjuntas a notas)
-- ============================================================
CREATE TABLE note_images (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  note_id UUID REFERENCES notes(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  storage_path TEXT NOT NULL,         -- path en Supabase Storage
  public_url TEXT NOT NULL,
  file_name TEXT,
  file_size INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: tasks (tareas / checklist)
-- ============================================================
CREATE TABLE tasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  note_id UUID REFERENCES notes(id) ON DELETE SET NULL,  -- tarea vinculada a una nota (opcional)
  title TEXT NOT NULL,
  description TEXT,
  is_completed BOOLEAN DEFAULT FALSE,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX tasks_user_id_idx ON tasks(user_id);
CREATE INDEX tasks_due_date_idx ON tasks(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX tasks_is_completed_idx ON tasks(is_completed);

-- ============================================================
-- TABLA: chat_messages (historial del asistente IA)
-- ============================================================
CREATE TABLE chat_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  context_note_ids UUID[] DEFAULT '{}',  -- notas usadas como contexto
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX chat_messages_user_id_idx ON chat_messages(user_id);

-- ============================================================
-- TABLA: reminders (recordatorios)
-- ============================================================
CREATE TABLE reminders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  remind_at TIMESTAMPTZ NOT NULL,
  is_sent BOOLEAN DEFAULT FALSE,
  is_dismissed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX reminders_remind_at_idx ON reminders(remind_at) WHERE is_sent = FALSE;

-- ============================================================
-- TRIGGER: auto-crear profile cuando se registra un usuario
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- TRIGGER: updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON notes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

-- Profiles: solo el propio usuario
CREATE POLICY "profiles_own" ON profiles FOR ALL USING (auth.uid() = id);

-- Projects: solo el propio usuario
CREATE POLICY "projects_own" ON projects FOR ALL USING (auth.uid() = user_id);

-- Notes: solo el propio usuario
CREATE POLICY "notes_own" ON notes FOR ALL USING (auth.uid() = user_id);

-- Note images: solo el propio usuario
CREATE POLICY "note_images_own" ON note_images FOR ALL USING (auth.uid() = user_id);

-- Tasks: solo el propio usuario
CREATE POLICY "tasks_own" ON tasks FOR ALL USING (auth.uid() = user_id);

-- Chat: solo el propio usuario
CREATE POLICY "chat_own" ON chat_messages FOR ALL USING (auth.uid() = user_id);

-- Reminders: solo el propio usuario
CREATE POLICY "reminders_own" ON reminders FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- STORAGE BUCKET para imágenes
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('note-images', 'note-images', true);

CREATE POLICY "note_images_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'note-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "note_images_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'note-images');

CREATE POLICY "note_images_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'note-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
