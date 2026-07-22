-- Re-create the add_credits function. Migration 00007 is recorded as applied
-- in the remote migration history, but the function is missing from the prod
-- database (likely dropped manually at some point). The Zaprite webhook
-- handler relies on this RPC to credit balances atomically, so any real
-- top-up payment would fail until this is restored.
--
-- CREATE OR REPLACE makes this idempotent and safe to re-run.

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

-- Grant execute to the same roles as other credit functions
GRANT ALL ON FUNCTION add_credits(UUID, INTEGER) TO anon, authenticated, service_role;
