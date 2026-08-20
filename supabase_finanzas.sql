-- ============================================================
-- HaIA Finanzas - Schema
-- ============================================================

-- Familia compartida (Hernán + Angie)
CREATE TABLE IF NOT EXISTS families (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Familia',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vincular profiles a una familia
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES families(id);

-- Categorías de gastos
CREATE TABLE IF NOT EXISTS expense_categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '💰',
  color TEXT DEFAULT '#6366f1',
  is_default BOOLEAN DEFAULT FALSE
);

-- Ingresos mensuales
CREATE TABLE IF NOT EXISTS incomes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  family_id UUID REFERENCES families(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  description TEXT,
  month SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year SMALLINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Gastos fijos mensuales (arriendo, servicios, etc.)
CREATE TABLE IF NOT EXISTS fixed_expenses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  family_id UUID REFERENCES families(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  category_id UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
  day_of_month SMALLINT DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Gastos registrados
CREATE TABLE IF NOT EXISTS expenses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  family_id UUID REFERENCES families(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  description TEXT NOT NULL,
  place TEXT,
  category_id UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
  payment_method TEXT DEFAULT 'efectivo' CHECK (payment_method IN ('efectivo','debito','credito','transferencia','otro')),
  expense_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  is_fixed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS expenses_family_date_idx ON expenses(family_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS expenses_category_idx ON expenses(category_id);

-- Presupuestos por categoría y mes
CREATE TABLE IF NOT EXISTS budgets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  family_id UUID REFERENCES families(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES expense_categories(id) ON DELETE CASCADE NOT NULL,
  monthly_limit DECIMAL(15,2) NOT NULL,
  month SMALLINT NOT NULL,
  year SMALLINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(family_id, category_id, month, year)
);

-- Ahorros e inversiones
CREATE TABLE IF NOT EXISTS savings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  family_id UUID REFERENCES families(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'ahorro' CHECK (type IN ('ahorro','inversion','fondo_emergencia','meta')),
  current_amount DECIMAL(15,2) DEFAULT 0,
  target_amount DECIMAL(15,2),
  description TEXT,
  color TEXT DEFAULT '#22c55e',
  icon TEXT DEFAULT '🏦',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Movimientos de ahorros/inversiones
CREATE TABLE IF NOT EXISTS savings_movements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  saving_id UUID REFERENCES savings(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,  -- positivo = depósito, negativo = retiro
  note TEXT,
  movement_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE families          ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE incomes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_expenses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets            ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_movements  ENABLE ROW LEVEL SECURITY;

-- Políticas: acceso por family_id del perfil del usuario
CREATE POLICY "family_access_families"          ON families          FOR ALL USING (id = (SELECT family_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "family_access_categories"        ON expense_categories FOR ALL USING (family_id = (SELECT family_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "family_access_incomes"           ON incomes           FOR ALL USING (family_id = (SELECT family_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "family_access_fixed_expenses"    ON fixed_expenses    FOR ALL USING (family_id = (SELECT family_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "family_access_expenses"          ON expenses          FOR ALL USING (family_id = (SELECT family_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "family_access_budgets"           ON budgets           FOR ALL USING (family_id = (SELECT family_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "family_access_savings"           ON savings           FOR ALL USING (family_id = (SELECT family_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "family_access_savings_movements" ON savings_movements FOR ALL USING (saving_id IN (SELECT id FROM savings WHERE family_id = (SELECT family_id FROM profiles WHERE id = auth.uid())));

-- Categorías por defecto (se insertan al crear familia)
-- Se crean vía el endpoint /api/finanzas/setup
