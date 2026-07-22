-- Migration: Atomic add_credits function to prevent race conditions
-- Related: BUG #27 — concurrent Zaprite webhooks can cause lost credits

CREATE OR REPLACE FUNCTION add_credits(
  p_user_id      UUID,
  p_amount_cents INTEGER
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE credit_accounts
    SET balance_cents = balance_cents + p_amount_cents,
        updated_at = NOW()
    WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_CREDIT_ACCOUNT';
  END IF;
END;
$$;
