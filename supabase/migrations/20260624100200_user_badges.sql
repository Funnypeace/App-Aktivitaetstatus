-- Phase 3a: user badges (earned titles). Predefined badge definitions live in
-- the app (lib/badges.ts); this table records which user earned which badge.

create table if not exists public.user_badges (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  badge_name text not null,
  icon text not null,
  earned_at timestamptz not null default now(),
  primary key (id),
  unique (user_id, badge_name)
);

create index if not exists user_badges_user_idx
  on public.user_badges (user_id);

alter table public.user_badges enable row level security;

drop policy if exists "Badges are viewable by authenticated users" on public.user_badges;
create policy "Badges are viewable by authenticated users"
  on public.user_badges for select to authenticated using (true);

drop policy if exists "Users can insert their own badges" on public.user_badges;
create policy "Users can insert their own badges"
  on public.user_badges for insert to authenticated
  with check (auth.uid() = user_id);

alter publication supabase_realtime add table public.user_badges;
