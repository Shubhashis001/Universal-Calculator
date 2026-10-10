-- Universal Utility Hub launch analytics schema (Supabase/Postgres 15+).
-- Run once in a NEW Supabase project via SQL Editor. Review before re-running.
-- No service-role key belongs in the browser. No input contents are collected.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.admin_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'analyst')),
  added_at timestamptz not null default now()
);
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now(),
  last_sign_in_at timestamptz
);
create table if not exists public.visitor_sessions (
  session_id uuid primary key,
  visitor_id uuid not null,
  user_id uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  active_seconds integer not null default 0 check (active_seconds between 0 and 86400),
  last_tool text,
  tool_events integer not null default 0 check (tool_events >= 0)
);
create table if not exists public.tool_usage (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.visitor_sessions(session_id) on delete cascade,
  tool_id text not null check (length(tool_id) between 1 and 40),
  occurred_at timestamptz not null default now()
);
create table if not exists public.finance_entries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('revenue','expense')),
  category text not null check (length(btrim(category)) between 1 and 64 and category !~ '[[:cntrl:]]'),
  description text not null default '' check (length(description) <= 300 and description !~ '[[:cntrl:]]'),
  amount_paise bigint not null check (amount_paise > 0 and amount_paise < 1000000000000),
  entry_date date not null default current_date check (entry_date between DATE '2000-01-01' and DATE '2100-12-31'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists visitor_sessions_last_seen_idx on public.visitor_sessions(last_seen_at desc);
create index if not exists visitor_sessions_started_idx on public.visitor_sessions(started_at desc);
create index if not exists visitor_sessions_visitor_idx on public.visitor_sessions(visitor_id);
create index if not exists tool_usage_occurred_idx on public.tool_usage(occurred_at desc);
create index if not exists tool_usage_tool_date_idx on public.tool_usage(tool_id, occurred_at desc);
create index if not exists finance_entries_date_idx on public.finance_entries(entry_date desc);

-- Private abuse counter: clients have NO direct access to this table.
-- Limits a single pseudonymous visitor UUID to 120 events/hour. An attacker can
-- rotate identifiers; upstream IP/device throttling remains a launch requirement.
create table if not exists private.telemetry_quota (
  visitor_id uuid primary key,
  window_started timestamptz not null default now(),
  requests integer not null default 0 check (requests >= 0)
);
revoke all on private.telemetry_quota from public, anon, authenticated;
alter table private.telemetry_quota enable row level security;

alter table public.admin_accounts enable row level security;
alter table public.user_profiles enable row level security;
alter table public.visitor_sessions enable row level security;
alter table public.tool_usage enable row level security;
alter table public.finance_entries enable row level security;

-- These helpers are in a NON-exposed schema. The SQL owner can inspect roles;
-- public API callers cannot invoke them directly.
create or replace function private.has_admin_role(allowed_roles text[] default array['owner','analyst'])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.admin_accounts a
  where a.user_id = (select auth.uid()) and a.role = any(allowed_roles));
$$;
revoke all on function private.has_admin_role(text[]) from public, anon, authenticated;
-- Needed for RLS evaluation; private schema is NOT exposed in PostgREST.
grant usage on schema private to authenticated;
grant execute on function private.has_admin_role(text[]) to authenticated;

drop policy if exists "admin self read" on public.admin_accounts;
create policy "admin self read" on public.admin_accounts for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "profile own or admin read" on public.user_profiles;
create policy "profile own or admin read" on public.user_profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.has_admin_role()));

drop policy if exists "sessions admin read" on public.visitor_sessions;
create policy "sessions admin read" on public.visitor_sessions for select to authenticated
  using ((select private.has_admin_role()));

drop policy if exists "tool usage admin read" on public.tool_usage;
create policy "tool usage admin read" on public.tool_usage for select to authenticated
  using ((select private.has_admin_role()));

drop policy if exists "finance admin read" on public.finance_entries;
create policy "finance admin read" on public.finance_entries for select to authenticated
  using ((select private.has_admin_role()));

drop policy if exists "finance owner insert" on public.finance_entries;
create policy "finance owner insert" on public.finance_entries for insert to authenticated
  with check ((select private.has_admin_role(array['owner'])) and created_by = (select auth.uid()));

drop policy if exists "finance owner update" on public.finance_entries;
create policy "finance owner update" on public.finance_entries for update to authenticated
  using ((select private.has_admin_role(array['owner'])))
  with check ((select private.has_admin_role(array['owner'])) and created_by = (select auth.uid()));

drop policy if exists "finance owner delete" on public.finance_entries;
create policy "finance owner delete" on public.finance_entries for delete to authenticated
  using ((select private.has_admin_role(array['owner'])));

-- Keep a minimal sign-up directory without exposing auth.users to the browser.
create or replace function private.sync_user_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.user_profiles(id,email,created_at,last_sign_in_at)
  values(new.id,new.email,new.created_at,new.last_sign_in_at)
  on conflict (id) do update set email=excluded.email, last_sign_in_at=excluded.last_sign_in_at;
  return new;
end $$;
revoke all on function private.sync_user_profile() from public, anon, authenticated;
drop trigger if exists sync_utility_profile on auth.users;
create trigger sync_utility_profile after insert or update of last_sign_in_at,email on auth.users
  for each row execute function private.sync_user_profile();
insert into public.user_profiles (id,email,created_at,last_sign_in_at)
select id,email,created_at,last_sign_in_at from auth.users
on conflict(id) do update set email=excluded.email,last_sign_in_at=excluded.last_sign_in_at;

-- Intentional anonymous telemetry entry point: only narrow metrics, no user input.
-- Reject malformed submissions, cap one update/5 seconds/session and at most
-- 60 newly credited seconds per accepted heartbeat. For high-traffic public
-- launches add IP-based throttling in an Edge Function/WAF before this RPC.
create or replace function public.record_utility_activity(
 p_session_id uuid, p_visitor_id uuid, p_event text, p_tool_id text default null, p_active_seconds integer default 0
) returns boolean language plpgsql security definer set search_path = '' as $$
declare accepted uuid; allowed_requests integer;
begin
  if p_session_id is null or p_visitor_id is null
     or p_event not in ('start','tool','heartbeat')
     or p_active_seconds < 0 or p_active_seconds > 60
     or (p_tool_id is not null and p_tool_id !~ '^[a-z0-9-]{1,40}$') then
    return false;
  end if;
  if p_event = 'tool' and p_tool_id is null then return false; end if;
  if p_tool_id is not null and p_tool_id <> all (array[
    'calculator','converter','currency','datetime','math','finance','health',
    'programming','text','qr','science','productivity','random','formulas'
  ]) then return false; end if;

  -- Atomic per-visitor hourly ceiling, including first-time sessions.
  insert into private.telemetry_quota(visitor_id, window_started, requests)
  values (p_visitor_id, now(), 1)
  on conflict (visitor_id) do update set
    window_started = case when private.telemetry_quota.window_started < now() - interval '1 hour'
      then now() else private.telemetry_quota.window_started end,
    requests = case when private.telemetry_quota.window_started < now() - interval '1 hour'
      then 1 else least(121, private.telemetry_quota.requests + 1) end
  returning requests into allowed_requests;
  if allowed_requests > 120 then return false; end if;

  -- Also prevent one visitor UUID from creating unlimited sessions each day.
  if not exists (select 1 from public.visitor_sessions where session_id=p_session_id) and
     (select count(*) from public.visitor_sessions
        where visitor_id=p_visitor_id and started_at >= now() - interval '1 day') >= 12
  then return false; end if;

  insert into public.visitor_sessions(session_id,visitor_id,user_id,last_tool)
    values (p_session_id,p_visitor_id,auth.uid(),p_tool_id)
  on conflict(session_id) do update set
    last_seen_at = now(),
    active_seconds = least(86400, public.visitor_sessions.active_seconds + p_active_seconds),
    last_tool = coalesce(p_tool_id, public.visitor_sessions.last_tool),
    user_id = coalesce(public.visitor_sessions.user_id,auth.uid()),
    tool_events = public.visitor_sessions.tool_events + (case when p_event = 'tool' then 1 else 0 end)
  where public.visitor_sessions.visitor_id = excluded.visitor_id
    and public.visitor_sessions.started_at > now() - interval '1 day'
    and public.visitor_sessions.last_seen_at <= now() - interval '5 seconds'
    and public.visitor_sessions.tool_events < 200
  returning session_id into accepted;
  if accepted is null then return false; end if;

  if p_event = 'tool' then
    insert into public.tool_usage(session_id,tool_id) values(accepted,p_tool_id);
  end if;
  return true;
end $$;
revoke all on function public.record_utility_activity(uuid,uuid,text,text,integer) from public;
grant execute on function public.record_utility_activity(uuid,uuid,text,text,integer) to anon, authenticated;

-- One restricted read endpoint returns aggregates, never raw anonymous identifiers.
create or replace function public.get_utility_overview(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare since_at timestamptz; since_date date; result jsonb;
begin
  if not private.has_admin_role() then raise exception 'Admin access required' using errcode = '42501'; end if;
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
    'revenue_paise', (select coalesce(sum(amount_paise),0) from public.finance_entries where kind='revenue' and entry_date >= since_date),
    'expense_paise', (select coalesce(sum(amount_paise),0) from public.finance_entries where kind='expense' and entry_date >= since_date),
    'daily_sessions', (select coalesce(jsonb_agg(jsonb_build_object('date',dates.day::date,'sessions',coalesce(s.cnt,0)) order by dates.day),'[]'::jsonb)
      from generate_series(since_date::timestamp, (now() at time zone 'utc')::date::timestamp, '1 day'::interval) as dates(day)
      left join (select (started_at at time zone 'utc')::date d, count(*) cnt from public.visitor_sessions where started_at >= since_at group by 1) s on s.d=dates.day::date),
    'daily_finance', (select coalesce(jsonb_agg(jsonb_build_object('date',entry_date,'revenue',revenue,'expense',expense) order by entry_date),'[]'::jsonb)
      from (select entry_date,coalesce(sum(amount_paise) filter(where kind='revenue'),0) revenue,
                   coalesce(sum(amount_paise) filter(where kind='expense'),0) expense
            from public.finance_entries where entry_date >= since_date group by entry_date) d),
    'top_tools', (select coalesce(jsonb_agg(jsonb_build_object('tool',tool_id,'uses',cnt)),'[]'::jsonb)
      from (select tool_id,count(*) cnt from public.tool_usage where occurred_at >= since_at group by tool_id order by cnt desc limit 8) t)
  ) into result;
  return result;
end $$;
revoke all on function public.get_utility_overview(integer) from public, anon;
grant execute on function public.get_utility_overview(integer) to authenticated;

-- Explicit minimum API privileges in addition to RLS.
revoke all on public.admin_accounts,public.user_profiles,public.visitor_sessions,public.tool_usage,public.finance_entries from anon, authenticated;
grant select on public.admin_accounts, public.user_profiles, public.visitor_sessions, public.tool_usage, public.finance_entries to authenticated;
grant insert, update, delete on public.finance_entries to authenticated;
-- No direct client writes to visit tables or account role tables.

-- HISTORICAL ONLY: with the 20261010 admin migration, DO NOT use this old unaudited Owner example.
-- Use database/bootstrap_owner.sql after verified TOTP, executed by a trusted DB operator.
-- Legacy example (NOT for current deployment):
-- INSERT INTO public.admin_accounts(user_id,role) VALUES ('YOUR-USER-UUID','owner');
-- Never auto-assign admins using email domains or user-controlled metadata.

-- Operational retention example (run in a privileged scheduler, not anonymously):
-- delete from public.tool_usage where occurred_at < now() - interval '90 days';
-- delete from public.visitor_sessions where started_at < now() - interval '90 days';
-- delete from private.telemetry_quota where window_started < now() - interval '2 days';
-- Deletion requests and privacy notices must be handled by your deployment process.
