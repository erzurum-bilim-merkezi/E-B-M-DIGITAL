-- The schema version the database is on: the timestamp of the newest migration. The Pages deploy
-- reads it and refuses a frontend that is newer than the database (ADR 0019, "deploy order").
-- RULE: every new migration redefines this function with its own timestamp (a DB test checks it).
create or replace function public.schema_version()
returns text
language sql
immutable
set search_path = ''
as $$ select '20260925129900'::text $$;

revoke execute on function public.schema_version() from public;
grant execute on function public.schema_version() to anon, authenticated;
