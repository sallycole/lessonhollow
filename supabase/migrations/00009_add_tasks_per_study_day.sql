-- Add tasks_per_study_day column to enrollments
ALTER TABLE enrollments ADD COLUMN tasks_per_study_day INTEGER;

-- Update the enroll_with_credit RPC to accept the new parameter
CREATE OR REPLACE FUNCTION enroll_with_credit(
  p_guide_user_id        UUID,
  p_player_id            UUID,
  p_curriculum_id        UUID,
  p_enrollment_type      TEXT,
  p_study_days_per_week  NUMERIC,
  p_target_completion_date DATE    DEFAULT NULL,
  p_target_loops         INTEGER  DEFAULT NULL,
  p_description          TEXT     DEFAULT '',
  p_tasks_per_study_day  INTEGER  DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
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
  INSERT INTO enrollments (player_id, curriculum_id, enrollment_type, study_days_per_week, target_completion_date, target_loops, tasks_per_study_day)
  VALUES (p_player_id, p_curriculum_id, p_enrollment_type, p_study_days_per_week, p_target_completion_date, p_target_loops, p_tasks_per_study_day)
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
