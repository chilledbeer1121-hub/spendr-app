
-- Convert user-callable RPCs to SECURITY INVOKER so RLS on underlying tables
-- enforces access, and they no longer appear as public-executable definer fns.
ALTER FUNCTION public.recompute_savings(uuid) SECURITY INVOKER;
ALTER FUNCTION public.materialize_recurring_expenses(uuid) SECURITY INVOKER;
ALTER FUNCTION public.set_month_bonus(uuid, date, numeric) SECURITY INVOKER;

-- Restrict execution: anon must not call these RPCs; authenticated can.
REVOKE ALL ON FUNCTION public.recompute_savings(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.materialize_recurring_expenses(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_month_bonus(uuid, date, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recompute_savings(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.materialize_recurring_expenses(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_month_bonus(uuid, date, numeric) TO authenticated;

-- Trigger-only SECURITY DEFINER functions: only the trigger machinery needs to
-- invoke them. Revoke EXECUTE so anon/authenticated cannot call them via the
-- Data API. Triggers still fire regardless of EXECUTE grants.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
