-- Phase 3a: profile columns for custom status, bio and active presence.

alter table public.profiles
  add column if not exists status_emoji text,
  add column if not exists status_text  text,
  add column if not exists bio          text,
  add column if not exists is_active    boolean not null default false;
