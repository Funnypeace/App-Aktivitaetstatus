-- Phase 1: presence + preferences on profiles.
--   last_seen  : updated on any activity (status toggle, game change, message, login)
--   theme      : per-user UI theme, 'light' (default) or 'dark'
--   created_at : registration date, mirrored so clients can show "Member since …"
--                without needing access to auth.users.
alter table public.profiles
  add column if not exists last_seen timestamptz not null default now();

alter table public.profiles
  add column if not exists theme text not null default 'light'
    check (theme in ('light', 'dark'));

alter table public.profiles
  add column if not exists created_at timestamptz not null default now();

-- Backfill created_at / last_seen for existing rows from the auth user record.
update public.profiles p
set created_at = u.created_at
from auth.users u
where u.id = p.id and p.created_at is not null;

-- Keep created_at in sync for future signups: capture it in the signup trigger.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, created_at, last_seen)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    new.created_at,
    new.created_at
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
