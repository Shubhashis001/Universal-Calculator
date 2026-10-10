-- ADDITIVE privacy hardening after 20261010_admin_core.sql.
-- Separate aggregate dashboard metrics from raw visitor/session identifier access.
-- Owners/Admins need pseudonymous session rows for operations; Editors/Viewers
-- can still view aggregate usage through the authorized overview RPC.
begin;

create or replace function private.can(p_permission text) returns boolean
language sql stable security definer set search_path='' as $$
  select p_permission = any(array[
    'analytics.read','analytics.sessions.read','users.read','users.export','finance.read','finance.write',
    'finance.export','settings.read','settings.write','team.read','team.manage','audit.read'
  ]::text[])
  and (select auth.uid()) is not null
  and (select auth.jwt()->>'aal') = 'aal2'
  and exists (select 1 from jsonb_array_elements(coalesce((select auth.jwt())->'amr','[]'::jsonb)) m
    where m->>'method'='totp')
  and exists (select 1 from auth.mfa_factors f
    where f.user_id=(select auth.uid()) and f.factor_type='totp' and f.status='verified')
  and exists (select 1 from auth.sessions s
    where s.id=nullif((select auth.jwt()->>'session_id'),'')::uuid
      and s.user_id=(select auth.uid()))
  and (p_permission not in ('team.manage','settings.write','finance.write')
    or (select private.recent_totp(case when p_permission='team.manage' then 5 else 10 end)))
  and exists (select 1 from public.admin_accounts a
    where a.user_id=(select auth.uid())
      and (
        a.role='owner'
        or (a.role='admin' and p_permission=any(array[
          'analytics.read','analytics.sessions.read','users.read','users.export','finance.read',
          'finance.write','finance.export','settings.read','settings.write','team.read','audit.read']))
        or (a.role='editor' and p_permission=any(array[
          'analytics.read','finance.read','finance.write','settings.read','settings.write']))
        or (a.role='viewer' and p_permission=any(array[
          'analytics.read','finance.read','settings.read']))
      )
  );
$$;
revoke all on function private.can(text) from public,anon,authenticated;
grant execute on function private.can(text) to authenticated;

drop policy if exists "authorized session read" on public.visitor_sessions;
create policy "authorized session read" on public.visitor_sessions for select to authenticated
  using ((select private.can('analytics.sessions.read')));
drop policy if exists "authorized usage read" on public.tool_usage;
create policy "authorized usage read" on public.tool_usage for select to authenticated
  using ((select private.can('analytics.sessions.read')));

commit;
