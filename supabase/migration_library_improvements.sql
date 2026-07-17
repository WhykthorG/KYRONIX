-- Migração: Melhorias no módulo de Biblioteca — KYRONIX S.E.N.O
-- Whykthor GSV

BEGIN;

-- ── Tabela de reservas de biblioteca ─────────────────────────
CREATE TABLE IF NOT EXISTS library_reservations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       UUID NOT NULL REFERENCES library_items(id) ON DELETE CASCADE,
  borrower_id   UUID NOT NULL,
  borrower_type TEXT NOT NULL DEFAULT 'aluno'
                CHECK (borrower_type IN ('aluno','professor','funcionario')),
  reservation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  preferred_date   DATE,
  status        TEXT NOT NULL DEFAULT 'pendente'
                CHECK (status IN ('pendente','atendida','cancelada','expirada')),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabela de multas da biblioteca ───────────────────────────
CREATE TABLE IF NOT EXISTS library_fines (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id       UUID NOT NULL REFERENCES library_loans(id) ON DELETE CASCADE,
  borrower_id   UUID NOT NULL,
  borrower_type TEXT NOT NULL DEFAULT 'aluno'
                CHECK (borrower_type IN ('aluno','professor','funcionario')),
  amount        NUMERIC(8,2) NOT NULL DEFAULT 0,
  reason        TEXT NOT NULL,
  days_overdue  INTEGER DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'pendente'
                CHECK (status IN ('pendente','pago','isento')),
  paid_date     DATE,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Adicionar colunas na tabela library_loans ────────────────
DO $$ BEGIN
  ALTER TABLE library_loans ADD COLUMN IF NOT EXISTS renewal_requested BOOLEAN DEFAULT FALSE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE library_loans ADD COLUMN IF NOT EXISTS renewal_count INTEGER DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ── Índices ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_library_reservations_item ON library_reservations(item_id);
CREATE INDEX IF NOT EXISTS idx_library_reservations_borrower ON library_reservations(borrower_id);
CREATE INDEX IF NOT EXISTS idx_library_reservations_status ON library_reservations(status);
CREATE INDEX IF NOT EXISTS idx_library_fines_loan ON library_fines(loan_id);
CREATE INDEX IF NOT EXISTS idx_library_fines_borrower ON library_fines(borrower_id);
CREATE INDEX IF NOT EXISTS idx_library_fines_status ON library_fines(status);

-- ── Triggers updated_at ──────────────────────────────────────
DROP TRIGGER IF EXISTS trg_library_reservations_updated_at ON library_reservations;
CREATE TRIGGER trg_library_reservations_updated_at
  BEFORE UPDATE ON library_reservations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_library_fines_updated_at ON library_fines;
CREATE TRIGGER trg_library_fines_updated_at
  BEFORE UPDATE ON library_fines
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS: Habilitar ───────────────────────────────────────────
ALTER TABLE library_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_fines ENABLE ROW LEVEL SECURITY;

-- ── RLS: Políticas para library_reservations ─────────────────
DROP POLICY IF EXISTS "staff read library_reservations" ON library_reservations;
CREATE POLICY "staff read library_reservations" ON library_reservations
  FOR SELECT USING (
    auth_profile_type() IN ('administrador','coordenador','secretario','professor')
  );

DROP POLICY IF EXISTS "staff write library_reservations" ON library_reservations;
CREATE POLICY "staff write library_reservations" ON library_reservations
  FOR ALL USING (
    auth_has_permission('library.write')
  )
  WITH CHECK (
    auth_has_permission('library.write')
  );

DROP POLICY IF EXISTS "student read own library_reservations" ON library_reservations;
CREATE POLICY "student read own library_reservations" ON library_reservations
  FOR SELECT USING (
    borrower_id IN (SELECT id FROM students WHERE email = auth.jwt() ->> 'email')
  );

DROP POLICY IF EXISTS "student create library_reservations" ON library_reservations;
CREATE POLICY "student create library_reservations" ON library_reservations
  FOR INSERT WITH CHECK (
    borrower_id IN (SELECT id FROM students WHERE email = auth.jwt() ->> 'email')
  );

-- ── RLS: Políticas para library_fines ────────────────────────
DROP POLICY IF EXISTS "staff read library_fines" ON library_fines;
CREATE POLICY "staff read library_fines" ON library_fines
  FOR SELECT USING (
    auth_profile_type() IN ('administrador','coordenador','secretario','professor')
  );

DROP POLICY IF EXISTS "staff write library_fines" ON library_fines;
CREATE POLICY "staff write library_fines" ON library_fines
  FOR ALL USING (
    auth_has_permission('library.write')
  )
  WITH CHECK (
    auth_has_permission('library.write')
  );

DROP POLICY IF EXISTS "student read own library_fines" ON library_fines;
CREATE POLICY "student read own library_fines" ON library_fines
  FOR SELECT USING (
    borrower_id IN (SELECT id FROM students WHERE email = auth.jwt() ->> 'email')
  );

-- ── Função para calcular multa automaticamente ───────────────
CREATE OR REPLACE FUNCTION calculate_library_fine(p_loan_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_loan RECORD;
  v_days_overdue INTEGER;
  v_fine_per_day NUMERIC := 1.00;
  v_max_fine NUMERIC := 50.00;
BEGIN
  SELECT * INTO v_loan FROM library_loans WHERE id = p_loan_id;
  
  IF v_loan IS NULL OR v_loan.return_date IS NOT NULL THEN
    RETURN 0;
  END IF;
  
  v_days_overdue := GREATEST(0, CURRENT_DATE - v_loan.due_date);
  
  IF v_days_overdue = 0 THEN
    RETURN 0;
  END IF;
  
  RETURN LEAST(v_days_overdue * v_fine_per_day, v_max_fine);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Função para processar devolução com multa ────────────────
CREATE OR REPLACE FUNCTION process_library_return(
  p_loan_id UUID,
  p_return_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB AS $$
DECLARE
  v_loan RECORD;
  v_fine_amount NUMERIC;
  v_fine_id UUID;
BEGIN
  SELECT * INTO v_loan FROM library_loans WHERE id = p_loan_id FOR UPDATE;
  
  IF v_loan IS NULL THEN
    RAISE EXCEPTION 'Empréstimo não encontrado.';
  END IF;
  
  IF v_loan.status = 'devolvido' THEN
    RAISE EXCEPTION 'Empréstimo já foi devolvido.';
  END IF;
  
  v_fine_amount := calculate_library_fine(p_loan_id);
  
  UPDATE library_loans
  SET 
    return_date = p_return_date,
    status = 'devolvido',
    fine_amount = v_fine_amount
  WHERE id = p_loan_id;
  
  UPDATE library_items
  SET available_copies = available_copies + 1
  WHERE id = v_loan.item_id;
  
  IF v_fine_amount > 0 THEN
    INSERT INTO library_fines (loan_id, borrower_id, borrower_type, amount, reason, days_overdue, status)
    VALUES (
      p_loan_id,
      v_loan.borrower_id,
      v_loan.borrower_type,
      v_fine_amount,
      'Atraso na devolução',
      GREATEST(0, p_return_date - v_loan.due_date),
      'pendente'
    )
    RETURNING id INTO v_fine_id;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'fine_amount', v_fine_amount,
    'fine_id', v_fine_id,
    'days_overdue', GREATEST(0, p_return_date - v_loan.due_date)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── RLS: Políticas para funções RPC ──────────────────────────
REVOKE ALL ON FUNCTION calculate_library_fine(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION calculate_library_fine(UUID) TO authenticated;

REVOKE ALL ON FUNCTION process_library_return(UUID, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION process_library_return(UUID, DATE) TO authenticated;

COMMIT;
