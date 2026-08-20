-- Sprint 4: campo repeat en reminders
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS repeat TEXT DEFAULT NULL;
-- Valores válidos: 'daily', 'weekly', 'monthly'

-- Campo para vincular cuenta de Telegram
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_id TEXT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS profiles_telegram_idx ON profiles(telegram_id) WHERE telegram_id IS NOT NULL;

-- Historial de conversación de Telegram por usuario
CREATE TABLE IF NOT EXISTS telegram_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS telegram_history_user_idx ON telegram_history(user_id, created_at);
