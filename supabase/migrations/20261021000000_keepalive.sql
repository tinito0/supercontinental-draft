-- Keep-alive for the Free plan: Supabase pauses a project after 7 days without database activity, and this project
-- only uses Storage and Edge Functions (match-feed writes to Firestore). The GitHub workflow
-- .github/workflows/supabase-keepalive.yml calls this every 2 days. It reads no data.
create or replace function public.keepalive()
returns timestamptz
language sql
stable
security invoker
set search_path = ''
as $$ select now() $$;

revoke all on function public.keepalive() from public;
grant execute on function public.keepalive() to anon, authenticated;
