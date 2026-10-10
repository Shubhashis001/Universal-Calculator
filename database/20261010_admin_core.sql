-- ADDITIVE MIGRATION. Run after launch_admin.sql (new installations), or
-- after 20261009_security_hardening.sql (existing installations).
-- No browser/API key can bootstrap Owner. Review on a staging copy first.
begin;

-- Existing analyst becomes read-only viewer; keep known owners.
alter table public.admin_accounts drop constraint if exists admin_accounts_role_check;
update public.admin_accounts set role='viewer' where role='analyst';
alter table public.admin_accounts add constraint admin_accounts_role_check
  check (role in ('owner','admin','editor','viewer'));
create index if not exists admin_accounts_role_idx on public.admin_accounts(role);

-- AAL2 alone is not proof of RECENT reauthentication. Supabase JWT amr stores
-- the timestamp of the actual TOTP event, not the access-token refresh time.
create or replace function private.recent_totp(p_minutes integer) returns boolean
language sql stable set search_path='' as $$
 select p_minutes between 1 and 30 and coalesce((
   select max((entry->>'timestamp')::bigint)
   from jsonb_array_elements(coalesce((select auth.jwt())->'amr','[]'::jsonb)) entry
   where entry->>'method'='totp'
 ),0) >= extract(epoch from now()-make_interval(mins=>p_minutes));
$$;
revoke all on function private.recent_totp(integer) from public,anon,authenticated;
grant execute on function private.recent_totp(integer) to authenticated;

-- Use a static permission allowlist. Never accept arbitrary user-supplied permission names.
create or replace function private.can(p_permission text) returns boolean
language sql stable security definer set search_path='' as $$
  select p_permission = any(array[
    'analytics.read','users.read','users.export','finance.read','finance.write',
    'finance.export','settings.read','settings.write','team.read','team.manage','audit.read'
  ]::text[])
  and (select auth.uid()) is not null
  and (select auth.jwt()->>'aal') = 'aal2'
  and exists (select 1 from jsonb_array_elements(coalesce((select auth.jwt())->'amr','[]'::jsonb)) m
    where m->>'method'='totp')
  and exists (
    select 1 from auth.mfa_factors f
    where f.user_id=(select auth.uid()) and f.factor_type='totp' and f.status='verified'
  )
  and exists (
    select 1 from auth.sessions s
    where s.id = nullif((select auth.jwt()->>'session_id'),'')::uuid
      and s.user_id=(select auth.uid())
  )
  and (p_permission not in ('team.manage','settings.write','finance.write')
      or (select private.recent_totp(case when p_permission='team.manage' then 5 else 10 end)))
  and exists (
    select 1 from public.admin_accounts a
    where a.user_id=(select auth.uid())
      and (
        a.role='owner'
        or (a.role='admin' and p_permission = any(array[
          'analytics.read','users.read','users.export','finance.read','finance.write',
          'finance.export','settings.read','settings.write','team.read','audit.read']))
        or (a.role='editor' and p_permission = any(array[
          'analytics.read','finance.read','finance.write','settings.read','settings.write']))
        or (a.role='viewer' and p_permission = any(array[
          'analytics.read','finance.read','settings.read']))
      )
  );
$$;
revoke all on function private.can(text) from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.can(text) to authenticated;

-- Existing helper still called from the legacy overview RPC; deny AAL1 for all roles.
create or replace function private.has_admin_role(allowed_roles text[] default array['owner','admin','editor','viewer'])
returns boolean language sql stable security definer set search_path='' as $$
 select (select private.can('analytics.read')) and exists
 (select 1 from public.admin_accounts where user_id=(select auth.uid()) and role=any(allowed_roles));
$$;
revoke all on function private.has_admin_role(text[]) from public,anon,authenticated;
grant execute on function private.has_admin_role(text[]) to authenticated;

-- Replace every permissive legacy policy, including read policies.
drop policy if exists "profile own or admin read" on public.user_profiles;
create policy "profile own or authorized read" on public.user_profiles for select to authenticated
 using (id=(select auth.uid()) or (select private.can('users.read')));
drop policy if exists "sessions admin read" on public.visitor_sessions;
create policy "authorized session read" on public.visitor_sessions for select to authenticated
 using ((select private.can('analytics.read')));
drop policy if exists "tool usage admin read" on public.tool_usage;
create policy "authorized usage read" on public.tool_usage for select to authenticated
 using ((select private.can('analytics.read')));
drop policy if exists "finance admin read" on public.finance_entries;
create policy "authorized finance read" on public.finance_entries for select to authenticated
 using ((select private.can('finance.read')));
drop policy if exists "finance owner insert" on public.finance_entries;
drop policy if exists "finance owner update" on public.finance_entries;
drop policy if exists "finance owner delete" on public.finance_entries;
revoke insert,update,delete on public.finance_entries from anon,authenticated;

-- Audit rows are immutable to API callers, and their payload excludes credentials.
create table if not exists public.admin_audit (
 id bigint generated always as identity primary key,
 actor uuid references auth.users(id) on delete set null,
 actor_snapshot uuid not null,
 action text not null check(length(action) between 3 and 80),
 entity text not null check(length(entity) between 1 and 80),
 entity_id text not null check(length(entity_id) between 1 and 128),
 detail jsonb not null default '{}'::jsonb,
 occurred_at timestamptz not null default now()
);
create index if not exists admin_audit_time_idx on public.admin_audit(occurred_at desc);
alter table public.admin_audit enable row level security;
revoke all on public.admin_audit from public,anon,authenticated;
grant select on public.admin_audit to authenticated;
create policy "audit readers" on public.admin_audit for select to authenticated
 using ((select private.can('audit.read')));

create or replace function private.log_admin(p_action text,p_entity text,p_entity_id text,p_detail jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path='' as $$
begin
 if (select auth.uid()) is null then raise exception 'Unauthorized' using errcode='42501'; end if;
 insert into public.admin_audit(actor,actor_snapshot,action,entity,entity_id,detail)
 values(auth.uid(),auth.uid(),p_action,p_entity,p_entity_id,p_detail);
end $$;
revoke all on function private.log_admin(text,text,text,jsonb) from public,anon,authenticated;
-- No client EXECUTE grant: definer RPCs call this helper with their own rights.

alter table public.finance_entries add column if not exists row_version integer not null default 1;
alter table public.finance_entries add column if not exists archived_at timestamptz;
alter table public.finance_entries add column if not exists edited_at timestamptz;
create index if not exists finance_entries_recent_active_idx on public.finance_entries(entry_date desc,id)
 where archived_at is null;

create or replace function public.write_finance_entry(
 p_id uuid, p_expected_version integer, p_kind text, p_category text,
 p_description text, p_amount_paise bigint, p_entry_date date, p_archive boolean default false
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.finance_entries%rowtype;
begin
 if not private.can('finance.write') then raise exception 'Access denied' using errcode='42501'; end if;
 if p_id is null and p_archive then raise exception 'Invalid operation' using errcode='22023'; end if;
 if (p_kind not in ('revenue','expense') or p_kind is null or p_category is null or p_entry_date is null
     or length(btrim(p_category)) not between 1 and 64 or p_category ~ '[[:cntrl:]]'
     or p_description is null or length(p_description)>300 or p_description ~ '[[:cntrl:]]'
     or p_amount_paise is null or p_amount_paise not between 1 and 999999999999
     or p_entry_date not between date '2000-01-01' and date '2100-12-31')
 then raise exception 'Invalid ledger fields' using errcode='22023'; end if;
 if p_id is null then
   insert into public.finance_entries(kind,category,description,amount_paise,entry_date,created_by)
   values(p_kind,btrim(p_category),p_description,p_amount_paise,p_entry_date,auth.uid()) returning * into v;
   perform private.log_admin('finance.create','finance_entries',v.id::text,jsonb_build_object('version',v.row_version));
 else
   if p_expected_version is null or p_expected_version<1 then raise exception 'Expected version required' using errcode='22023'; end if;
   update public.finance_entries set kind=p_kind, category=btrim(p_category),description=p_description,
     amount_paise=p_amount_paise,entry_date=p_entry_date,archived_at=case when p_archive then now() else null end,
     edited_at=now(),row_version=row_version+1
   where id=p_id and row_version=p_expected_version returning * into v;
   if not found then raise exception 'Conflict: entry changed or was removed; refresh and retry' using errcode='40001'; end if;
   perform private.log_admin(case when p_archive then 'finance.archive' else 'finance.update' end,
      'finance_entries',v.id::text,jsonb_build_object('version',v.row_version));
 end if;
 return jsonb_build_object('id',v.id,'version',v.row_version);
end $$;
revoke all on function public.write_finance_entry(uuid,integer,text,text,text,bigint,date,boolean) from public,anon;
grant execute on function public.write_finance_entry(uuid,integer,text,text,text,bigint,date,boolean) to authenticated;

-- One row, schema-constrained safe content; NEVER accepts HTML/scripts or secrets.
create table if not exists public.utility_settings (
 id smallint primary key default 1 check(id=1),
 title text not null default 'Universal Utility Hub' check(length(btrim(title)) between 2 and 60 and title !~ '[[:cntrl:]<>]'),
 tagline text not null default 'All-in-one toolkit' check(length(tagline) <= 120 and tagline !~ '[[:cntrl:]<>]'),
 enabled_tools text[] not null default array[
 'calculator','converter','currency','datetime','math','finance','health',
 'programming','text','qr','science','productivity','random','formulas']::text[],
 row_version integer not null default 1 check(row_version>=1),
 updated_at timestamptz not null default now(),
 constraint utility_tool_allowlist check(cardinality(enabled_tools) between 1 and 14 and
 enabled_tools <@ array['calculator','converter','currency','datetime','math','finance','health',
 'programming','text','qr','science','productivity','random','formulas']::text[])
);
insert into public.utility_settings(id) values(1) on conflict(id) do nothing;
alter table public.utility_settings enable row level security;
revoke all on public.utility_settings from public,anon,authenticated;
-- Narrow public projection: no table access granted to anonymous clients.
create or replace function public.get_public_utility_settings() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('title',title,'tagline',tagline,'enabled_tools',enabled_tools)
 from public.utility_settings where id=1;
$$;
revoke all on function public.get_public_utility_settings() from public;
grant execute on function public.get_public_utility_settings() to anon,authenticated;
create or replace function public.get_admin_utility_settings() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v jsonb;
begin
 if not private.can('settings.read') then raise exception 'Forbidden' using errcode='42501'; end if;
 select to_jsonb(s) into v from public.utility_settings s where id=1;
 return v;
end $$;
revoke all on function public.get_admin_utility_settings() from public,anon;
grant execute on function public.get_admin_utility_settings() to authenticated;
-- Version snapshots for safe site-settings rollback; no Auth data or secrets.
create table if not exists public.utility_settings_history(
 id bigint generated always as identity primary key,
 prior_version integer not null,
 snapshot jsonb not null,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now()
);
create index if not exists utility_settings_history_recent_idx on public.utility_settings_history(created_at desc);
alter table public.utility_settings_history enable row level security;
revoke all on public.utility_settings_history from public,anon,authenticated;

create or replace function public.update_utility_settings(
 p_version integer,p_title text,p_tagline text,p_tools text[]
) returns integer language plpgsql security definer set search_path='' as $$
declare v integer; old_settings public.utility_settings%rowtype;
begin
 if not private.can('settings.write') then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_version is null or p_title is null or p_tagline is null or p_tools is null
   or array_length(p_tools,1) <> (select count(distinct t) from unnest(p_tools) as t)
 then raise exception 'Invalid settings' using errcode='22023'; end if;
 select * into old_settings from public.utility_settings where id=1 for update;
 if not found or old_settings.row_version<>p_version then
   raise exception 'Conflict: settings changed; refresh to review' using errcode='40001'; end if;
 update public.utility_settings set title=btrim(p_title),tagline=btrim(p_tagline),enabled_tools=p_tools,
 row_version=row_version+1,updated_at=now() where id=1 and row_version=p_version
 returning row_version into v;
 if not found then raise exception 'Conflict: settings changed; refresh to review' using errcode='40001'; end if;
 insert into public.utility_settings_history(prior_version,snapshot,created_by)
 values(old_settings.row_version, jsonb_build_object('title',old_settings.title,'tagline',old_settings.tagline,
   'enabled_tools',old_settings.enabled_tools),auth.uid());
 perform private.log_admin('settings.update','utility_settings','1',jsonb_build_object('version',v));
 return v;
end $$;
revoke all on function public.update_utility_settings(integer,text,text,text[]) from public,anon;
grant execute on function public.update_utility_settings(integer,text,text,text[]) to authenticated;

create or replace function public.list_utility_settings_history() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.can('settings.read') then raise exception 'Forbidden' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(h) order by h.created_at desc),'[]'::jsonb) into result
 from (select id,prior_version,snapshot,created_at from public.utility_settings_history
 order by created_at desc limit 20) h;
 return result;
end $$;
revoke all on function public.list_utility_settings_history() from public,anon;
grant execute on function public.list_utility_settings_history() to authenticated;
create or replace function public.restore_utility_settings(p_history_id bigint,p_expected_version integer)
returns integer language plpgsql security definer set search_path='' as $$
declare snapshot jsonb; v integer;
begin
 if not private.can('team.manage') then raise exception 'Owner and recent MFA required' using errcode='42501'; end if;
 select h.snapshot into snapshot from public.utility_settings_history h where h.id=p_history_id;
 if not found then raise exception 'Revision not found' using errcode='22023'; end if;
 v:=public.update_utility_settings(p_expected_version,snapshot->>'title',snapshot->>'tagline',
     array(select jsonb_array_elements_text(snapshot->'enabled_tools')));
 perform private.log_admin('settings.restore','utility_settings',p_history_id::text,jsonb_build_object('new_version',v));
 return v;
end $$;
revoke all on function public.restore_utility_settings(bigint,integer) from public,anon;
grant execute on function public.restore_utility_settings(bigint,integer) to authenticated;

-- Team invitations target authenticated UUIDs only (not editable emails/metadata).
create table if not exists public.admin_invites(
 id uuid primary key default gen_random_uuid(),
 invited_user_id uuid not null references auth.users(id),
 role text not null check(role in ('owner','admin','editor','viewer')),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default(now()+interval '7 days'),
 accepted_at timestamptz,
 revoked_at timestamptz
);
create index if not exists admin_invites_target_idx on public.admin_invites(invited_user_id,expires_at);
alter table public.admin_invites enable row level security;
revoke all on public.admin_invites from public,anon,authenticated;
create policy "invited self or owner" on public.admin_invites for select to authenticated
 using(invited_user_id=(select auth.uid()) or (select private.can('team.read')));
grant select on public.admin_invites to authenticated;

create or replace function public.invite_admin(p_user_id uuid,p_role text)
returns uuid language plpgsql security definer set search_path='' as $$
declare invite_id uuid;
begin
 if not private.can('team.manage') then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_role is null or p_role not in ('owner','admin','editor','viewer') or p_user_id is null
    or p_user_id=auth.uid() then raise exception 'Invalid invitation' using errcode='22023'; end if;
 if not exists(select 1 from auth.users where id=p_user_id) or
    exists(select 1 from public.admin_accounts where user_id=p_user_id) then
    raise exception 'Account not eligible' using errcode='22023'; end if;
 insert into public.admin_invites(invited_user_id,role,created_by)
 values(p_user_id,p_role,auth.uid()) returning id into invite_id;
 perform private.log_admin('team.invite','admin_invites',invite_id::text,jsonb_build_object('role',p_role));
 return invite_id;
end $$;
revoke all on function public.invite_admin(uuid,text) from public,anon;
grant execute on function public.invite_admin(uuid,text) to authenticated;

create or replace function public.accept_admin_invite(p_invite_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare v public.admin_invites%rowtype;
begin
 if auth.uid() is null or p_invite_id is null then raise exception 'Unauthorized' using errcode='42501'; end if;
 select * into v from public.admin_invites where id=p_invite_id and invited_user_id=auth.uid()
 and accepted_at is null and revoked_at is null and expires_at>now() for update;
 if not found then raise exception 'Invitation expired or not found' using errcode='22023'; end if;
 insert into public.admin_accounts(user_id,role) values(auth.uid(),v.role);
 update public.admin_invites set accepted_at=now() where id=v.id;
 perform private.log_admin('team.accept','admin_accounts',auth.uid()::text,jsonb_build_object('role',v.role));
 return true;
end $$;
revoke all on function public.accept_admin_invite(uuid) from public,anon;
grant execute on function public.accept_admin_invite(uuid) to authenticated;

create or replace function public.set_admin_role(p_user_id uuid,p_role text)
returns void language plpgsql security definer set search_path='' as $$
declare old_role text;
begin
 if not private.can('team.manage') then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_user_id is null or p_role not in ('owner','admin','editor','viewer') and p_role is not null
 then raise exception 'Invalid role' using errcode='22023'; end if;
 -- Serialize role transitions and protect the last Owner from removal/downgrade.
 perform pg_advisory_xact_lock(20261010);
 select role into old_role from public.admin_accounts where user_id=p_user_id for update;
 if old_role is null then raise exception 'Membership not found' using errcode='22023'; end if;
 if old_role='owner' and (p_role is null or p_role<>'owner') and
    (select count(*) from public.admin_accounts where role='owner')<=1 then
    raise exception 'Cannot remove the last Owner' using errcode='42501'; end if;
 if p_role is null then delete from public.admin_accounts where user_id=p_user_id;
 else update public.admin_accounts set role=p_role where user_id=p_user_id; end if;
 perform private.log_admin('team.change','admin_accounts',p_user_id::text,
   jsonb_build_object('from',old_role,'to',p_role));
end $$;
revoke all on function public.set_admin_role(uuid,text) from public,anon;
grant execute on function public.set_admin_role(uuid,text) to authenticated;

create or replace function public.list_admin_team() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.can('team.read') then raise exception 'Forbidden' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('user_id',a.user_id,'role',a.role,'added_at',a.added_at)
 order by a.added_at),'[]'::jsonb) into result from public.admin_accounts a;
 return result;
end $$;
revoke all on function public.list_admin_team() from public,anon;
grant execute on function public.list_admin_team() to authenticated;

-- Reuse existing dashboard with archived financial rows excluded; gate at AAL2.
create or replace function public.get_utility_overview(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare since_at timestamptz; since_date date; result jsonb;
begin
  if not private.can('analytics.read') then raise exception 'Admin access required' using errcode = '42501'; end if;
  if p_days not in (7,30,90) then raise exception 'Invalid range'; end if;
  since_date := (now() at time zone 'utc')::date - (p_days - 1);
  since_at := since_date::timestamp at time zone 'utc';
  select jsonb_build_object(
    'sessions', (select count(*) from public.visitor_sessions where started_at >= since_at),
    'visitors', (select count(distinct visitor_id) from public.visitor_sessions where started_at >= since_at),
    'active_now', (select count(*) from public.visitor_sessions where last_seen_at >= now() - interval '2 minutes'),
    'active_seconds', (select coalesce(sum(active_seconds),0) from public.visitor_sessions where started_at >= since_at),
    'tool_uses', (select count(*) from public.tool_usage where occurred_at >= since_at),
    'total_users', (select count(*) from public.user_profiles),
    'new_users', (select count(*) from public.user_profiles where created_at >= since_at),
    'revenue_paise', (select coalesce(sum(amount_paise),0) from public.finance_entries where archived_at is null and kind='revenue' and entry_date >= since_date),
    'expense_paise', (select coalesce(sum(amount_paise),0) from public.finance_entries where archived_at is null and kind='expense' and entry_date >= since_date),
    'daily_sessions', (select coalesce(jsonb_agg(jsonb_build_object('date',dates.day::date,'sessions',coalesce(s.cnt,0)) order by dates.day),'[]'::jsonb)
      from generate_series(since_date::timestamp, (now() at time zone 'utc')::date::timestamp, '1 day'::interval) as dates(day)
      left join (select (started_at at time zone 'utc')::date d, count(*) cnt from public.visitor_sessions where started_at >= since_at group by 1) s on s.d=dates.day::date),
    'daily_finance', (select coalesce(jsonb_agg(jsonb_build_object('date',entry_date,'revenue',revenue,'expense',expense) order by entry_date),'[]'::jsonb)
      from (select entry_date,coalesce(sum(amount_paise) filter(where kind='revenue'),0) revenue,
                   coalesce(sum(amount_paise) filter(where kind='expense'),0) expense
            from public.finance_entries where archived_at is null and entry_date >= since_date group by entry_date) d),
    'top_tools', (select coalesce(jsonb_agg(jsonb_build_object('tool',tool_id,'uses',cnt)),'[]'::jsonb)
      from (select tool_id,count(*) cnt from public.tool_usage where occurred_at >= since_at group by tool_id order by cnt desc limit 8) t)
  ) into result;
  return result;
end $$;
revoke all on function public.get_utility_overview(integer) from public, anon;
grant execute on function public.get_utility_overview(integer) to authenticated;
-- Only a DB operator can run the one-time owner bootstrap in bootstrap_owner.sql.
commit;
