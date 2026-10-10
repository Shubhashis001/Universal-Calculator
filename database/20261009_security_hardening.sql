-- Additive security migration for an existing, already-provisioned admin database.
-- For a new project use launch_admin.sql INSTEAD of this migration.
-- Back up your database and review existing finance data before applying.
begin;
create schema if not exists private;
revoke all on schema private from public, anon;
create table if not exists private.telemetry_quota (
  visitor_id uuid primary key,
  window_started timestamptz not null default now(),
  requests integer not null default 0 check (requests >= 0)
);
revoke all on private.telemetry_quota from public, anon, authenticated;
alter table private.telemetry_quota enable row level security;

-- Name constraints to allow safe re-application. Existing invalid rows must be corrected.
do $$ begin
 if not exists(select 1 from pg_constraint where conname='finance_category_safe' and conrelid='public.finance_entries'::regclass)
 then alter table public.finance_entries add constraint finance_category_safe
   check (length(btrim(category)) between 1 and 64 and category !~ '[[:cntrl:]]'); end if;
 if not exists(select 1 from pg_constraint where conname='finance_description_safe' and conrelid='public.finance_entries'::regclass)
 then alter table public.finance_entries add constraint finance_description_safe
   check (length(description)<=300 and description !~ '[[:cntrl:]]'); end if;
 if not exists(select 1 from pg_constraint where conname='finance_date_safe' and conrelid='public.finance_entries'::regclass)
 then alter table public.finance_entries add constraint finance_date_safe
   check (entry_date between DATE '2000-01-01' and DATE '2100-12-31'); end if;
end $$;

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

commit;
