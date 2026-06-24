-- handle_new_user() is a SECURITY DEFINER trigger function and must not be
-- callable directly via the REST/RPC API. Triggers still run it regardless of
-- EXECUTE grants, so revoking these privileges does not affect signups.
revoke execute on function public.handle_new_user() from anon, authenticated, public;
