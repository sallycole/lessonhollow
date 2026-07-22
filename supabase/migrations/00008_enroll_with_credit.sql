-- Migration: Atomic enrollment + credit spend
-- Related: BUG #28 — Enrollment created before credit check
--
-- Combines enrollment creation and credit spend into a single transaction
-- so orphan enrollment rows cannot occur if the credit check fails.

CREATE OR REPLACE FUNCTION enroll_with_credit(
  p_guide_user_id        UUID,
  p_player_id            UUID,
  p_curriculum_id        UUID,
  p_enrollment_type      TEXT,
  p_study_days_per_week  NUMERIC,
  p_target_completion_date DATE    DEFAULT NULL,
  p_target_loops         INTEGER  DEFAULT NULL,
  p_description          TEXT     DEFAULT ''
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  acct credit_accounts%ROWTYPE;
  credit_cost INTEGER := 50;  -- $0.50 in cents
  new_enrollment_id UUID;
BEGIN
  -- 1. Lock and check credit account
  SELECT * INTO acct FROM credit_accounts WHERE user_id = p_guide_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_CREDIT_ACCOUNT';
  END IF;

  IF acct.free_enrollment_used AND acct.balance_cents < credit_cost THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS';
  END IF;

  -- 2. Create the enrollment
  INSERT INTO enrollments (player_id, curriculum_id, enrollment_type, study_days_per_week, target_completion_date, target_loops)
  VALUES (p_player_id, p_curriculum_id, p_enrollment_type, p_study_days_per_week, p_target_completion_date, p_target_loops)
  RETURNING id INTO new_enrollment_id;

  -- 3. Spend the credit
  IF NOT acct.free_enrollment_used THEN
    UPDATE credit_accounts
      SET free_enrollment_used = true, updated_at = NOW()
      WHERE user_id = p_guide_user_id;

    INSERT INTO credit_transactions
      (user_id, type, amount_cents, description, enrollment_id)
    VALUES
      (p_guide_user_id, 'spend', 0, 'Free enrollment: ' || p_description, new_enrollment_id);
  ELSE
    UPDATE credit_accounts
      SET balance_cents = balance_cents - credit_cost, updated_at = NOW()
      WHERE user_id = p_guide_user_id;

    INSERT INTO credit_transactions
      (user_id, type, amount_cents, description, enrollment_id)
    VALUES
      (p_guide_user_id, 'spend', -credit_cost, p_description, new_enrollment_id);
  END IF;

  RETURN new_enrollment_id;
END;
$$;
