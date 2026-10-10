-- Additive branding migration. Apply AFTER 20261011_privacy_permissions.sql.
-- Preserve any administrator-customized title; only rebrand the unmodified legacy default.
begin;

alter table public.utility_settings
  alter column title set default 'Universal Calculator';

update public.utility_settings
   set title = 'Universal Calculator'
 where id = 1 and title = 'Universal Utility Hub';

-- No Owner/role/auth changes; preserve every prior audit entry and revision.
commit;
