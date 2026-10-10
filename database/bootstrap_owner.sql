-- MANUAL SERVER-SIDE ONLY. Supabase SQL Editor as DB operator after email/password login
-- AND completed TOTP verification. Never ship this as an anonymous/authenticated RPC.
-- Replace UUID below with the IDENTICAL existing auth.users.id, verified out of band.
begin;
select pg_advisory_xact_lock(20261010);
do $$
declare owner_user uuid := '00000000-0000-0000-0000-000000000000';
begin
 if owner_user='00000000-0000-0000-0000-000000000000'::uuid then
   raise exception 'Replace placeholder with approved auth user UUID'; end if;
 if exists(select 1 from public.admin_accounts where role='owner') then
   raise exception 'Owner already configured'; end if;
 if not exists(select 1 from auth.users where id=owner_user) then
   raise exception 'Auth identity does not exist'; end if;
 if not exists(select 1 from auth.mfa_factors where user_id=owner_user and factor_type='totp' and status='verified') then
   raise exception 'Owner must enroll and verify TOTP before bootstrap'; end if;
 insert into public.admin_accounts(user_id,role) values(owner_user,'owner');
 insert into public.admin_audit(actor,actor_snapshot,action,entity,entity_id,detail)
 values(owner_user,owner_user,'owner.bootstrap','admin_accounts',owner_user::text,'{"source":"db-operator"}'::jsonb);
end $$;
commit;
