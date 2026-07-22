-- Migration: Credit ledger and payment history schema
-- Related: REQ-PAYMENTS-DB (#180)

-- =============================================================================
-- credit_accounts — One row per guide, created at signup
-- =============================================================================

CREATE TABLE credit_accounts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_cents         INTEGER NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
  free_enrollment_used  BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX credit_accounts_user_id_idx ON credit_accounts(user_id);

ALTER TABLE credit_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guides_read_own_credit_account" ON credit_accounts
  FOR SELECT USING (auth.uid() = user_id);

CREATE TRIGGER credit_accounts_updated_at
  BEFORE UPDATE ON credit_accounts
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- =============================================================================
-- credit_transactions — Immutable append-only ledger of deposits and spends
-- =============================================================================

CREATE TABLE credit_transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type             TEXT NOT NULL CHECK (type IN ('deposit', 'spend', 'refund')),
  amount_cents     INTEGER NOT NULL,
  description      TEXT NOT NULL,
  enrollment_id    UUID REFERENCES enrollments(id) ON DELETE SET NULL,
  zaprite_order_id TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guides_read_own_transactions" ON credit_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- =============================================================================
-- payments — Record of all Zaprite orders paid
-- =============================================================================

CREATE TABLE payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  zaprite_order_id    TEXT NOT NULL UNIQUE,
  amount_cents        INTEGER NOT NULL,
  currency            TEXT NOT NULL DEFAULT 'USD',
  payment_method      TEXT,
  credits_added       INTEGER NOT NULL,
  paid_at             TIMESTAMPTZ NOT NULL,
  zaprite_metadata    JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guides_read_own_payments" ON payments
  FOR SELECT USING (auth.uid() = user_id);

-- =============================================================================
-- Auto-create credit_account on auth.users insert
-- =============================================================================

CREATE OR REPLACE FUNCTION handle_new_user_credits()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO credit_accounts (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_credits
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user_credits();

-- =============================================================================
-- spend_enrollment_credit — Atomic free-enrollment or deduct
-- =============================================================================

CREATE OR REPLACE FUNCTION spend_enrollment_credit(
  p_user_id       UUID,
  p_enrollment_id UUID,
  p_description   TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  acct credit_accounts%ROWTYPE;
  credit_cost INTEGER := 50;  -- $0.50 in cents
BEGIN
  SELECT * INTO acct FROM credit_accounts WHERE user_id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_CREDIT_ACCOUNT';
  END IF;

  -- Use free enrollment if available
  IF NOT acct.free_enrollment_used THEN
    UPDATE credit_accounts
      SET free_enrollment_used = true, updated_at = NOW()
      WHERE user_id = p_user_id;

    INSERT INTO credit_transactions
      (user_id, type, amount_cents, description, enrollment_id)
    VALUES
      (p_user_id, 'spend', 0, 'Free enrollment: ' || p_description, p_enrollment_id);

    RETURN;
  END IF;

  -- Check balance
  IF acct.balance_cents < credit_cost THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS';
  END IF;

  -- Deduct credit
  UPDATE credit_accounts
    SET balance_cents = balance_cents - credit_cost, updated_at = NOW()
    WHERE user_id = p_user_id;

  INSERT INTO credit_transactions
    (user_id, type, amount_cents, description, enrollment_id)
  VALUES
    (p_user_id, 'spend', -credit_cost, p_description, p_enrollment_id);
END;
$$;
