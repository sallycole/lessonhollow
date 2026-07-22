-- Enrollment start date: defaults to the enrollment date, editable by the user.
-- Pacing math reads start_date instead of created_at, so an enrollment dated in
-- the future doesn't immediately show tasks as behind.

-- 1. Add start_date to enrollments, backfill existing rows from created_at
ALTER TABLE enrollments ADD COLUMN start_date DATE NOT NULL DEFAULT CURRENT_DATE;

UPDATE enrollments SET start_date = created_at::date;

-- 2. Enrollment requests can carry a proposed start date
ALTER TABLE enrollment_requests ADD COLUMN start_date DATE;

-- 3. Replace enroll_with_credit to accept an optional start date.
--    Drop the old 9-arg version first to avoid overload ambiguity.
DROP FUNCTION IF EXISTS enroll_with_credit(UUID, UUID, UUID, TEXT, NUMERIC, DATE, INTEGER, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION enroll_with_credit(
  p_guide_user_id        UUID,
  p_player_id            UUID,
  p_curriculum_id        UUID,
  p_enrollment_type      TEXT,
  p_study_days_per_week  NUMERIC,
  p_target_completion_date DATE    DEFAULT NULL,
  p_target_loops         INTEGER  DEFAULT NULL,
  p_description          TEXT     DEFAULT '',
  p_tasks_per_study_day  INTEGER  DEFAULT NULL,
  p_start_date           DATE     DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acct credit_accounts%ROWTYPE;
  player_rec players%ROWTYPE;
  credit_cost INTEGER := 50;  -- $0.50 in cents
  new_enrollment_id UUID;
BEGIN
  -- 1. Lock and read the player row
  SELECT * INTO player_rec FROM players WHERE id = p_player_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PLAYER_NOT_FOUND';
  END IF;

  -- 2. Lock and read the guide's credit account
  SELECT * INTO acct FROM credit_accounts WHERE user_id = p_guide_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_CREDIT_ACCOUNT';
  END IF;

  -- 3. Check: if player already used free enrollment, guide needs balance
  IF player_rec.free_enrollment_used AND acct.balance_cents < credit_cost THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS';
  END IF;

  -- 4. Create the enrollment
  INSERT INTO enrollments (player_id, curriculum_id, enrollment_type, study_days_per_week, target_completion_date, target_loops, tasks_per_study_day, start_date)
  VALUES (p_player_id, p_curriculum_id, p_enrollment_type, p_study_days_per_week, p_target_completion_date, p_target_loops, p_tasks_per_study_day, COALESCE(p_start_date, CURRENT_DATE))
  RETURNING id INTO new_enrollment_id;

  -- 5. Spend: player's free enrollment or guide's balance
  IF NOT player_rec.free_enrollment_used THEN
    UPDATE players
      SET free_enrollment_used = true
      WHERE id = p_player_id;

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
