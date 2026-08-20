-- Sprint 4: campo repeat en reminders
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS repeat TEXT DEFAULT NULL;
-- Valores válidos: 'daily', 'weekly', 'monthly'

-- Campo para vincular cuenta de Telegram
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_id TEXT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS profiles_telegram_idx ON profiles(telegram_id) WHERE telegram_id IS NOT NULL;
