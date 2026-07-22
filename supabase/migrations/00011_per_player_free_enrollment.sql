-- Migration: Move free enrollment tracking from guide-level to player-level
-- Each player gets one free enrollment; credits remain guide-level.

-- 1. Add free_enrollment_used column to players
ALTER TABLE players ADD COLUMN free_enrollment_used BOOLEAN NOT NULL DEFAULT false;

-- 2. Backfill: mark the player who received each guide's free enrollment
--    (identified by the 0-cent "Free enrollment:" transaction)
UPDATE players SET free_enrollment_used = true
WHERE id IN (
  SELECT DISTINCT e.player_id
  FROM credit_transactions ct
  JOIN enrollments e ON e.id = ct.enrollment_id
  WHERE ct.type = 'spend'
    AND ct.amount_cents = 0
    AND ct.description LIKE 'Free enrollment:%'
);

-- Safety net: if a guide's flag is true but no matching transaction found,
-- mark the guide's oldest player to avoid granting extra free enrollments
UPDATE players SET free_enrollment_used = true
WHERE id IN (
  SELECT DISTINCT ON (p.guide_id) p.id
  FROM players p
  JOIN credit_accounts ca ON ca.user_id = p.guide_id
  WHERE ca.free_enrollment_used = true
    AND p.free_enrollment_used = false
  ORDER BY p.guide_id, p.created_at ASC
)
AND NOT free_enrollment_used;

-- 3. Replace enroll_with_credit to check player's free enrollment flag
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
  INSERT INTO enrollments (player_id, curriculum_id, enrollment_type, study_days_per_week, target_completion_date, target_loops, tasks_per_study_day)
  VALUES (p_player_id, p_curriculum_id, p_enrollment_type, p_study_days_per_week, p_target_completion_date, p_target_loops, p_tasks_per_study_day)
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

-- 4. Replace spend_enrollment_credit with player-aware version
--    Drop old 3-arg version first to avoid overload ambiguity
DROP FUNCTION IF EXISTS spend_enrollment_credit(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION spend_enrollment_credit(
  p_user_id       UUID,
  p_player_id     UUID,
  p_enrollment_id UUID,
  p_description   TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  acct credit_accounts%ROWTYPE;
  player_rec players%ROWTYPE;
  credit_cost INTEGER := 50;
BEGIN
  SELECT * INTO player_rec FROM players WHERE id = p_player_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PLAYER_NOT_FOUND';
  END IF;

  SELECT * INTO acct FROM credit_accounts WHERE user_id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_CREDIT_ACCOUNT';
  END IF;

  IF NOT player_rec.free_enrollment_used THEN
    UPDATE players
      SET free_enrollment_used = true
      WHERE id = p_player_id;

    INSERT INTO credit_transactions
      (user_id, type, amount_cents, description, enrollment_id)
    VALUES
      (p_user_id, 'spend', 0, 'Free enrollment: ' || p_description, p_enrollment_id);

    RETURN;
  END IF;

  IF acct.balance_cents < credit_cost THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS';
  END IF;

  UPDATE credit_accounts
    SET balance_cents = balance_cents - credit_cost, updated_at = NOW()
    WHERE user_id = p_user_id;

  INSERT INTO credit_transactions
    (user_id, type, amount_cents, description, enrollment_id)
  VALUES
    (p_user_id, 'spend', -credit_cost, p_description, p_enrollment_id);
END;
$$;
