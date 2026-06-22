-- Phase 2 tables: game statistics, achievements (master + user junction).
-- RPC for atomic increment, Realtime for both new tables.

-- ──────────────────────────────────────────────────────────────────────────────
-- user_game_statistics
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.user_game_statistics (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  game_name text not null,
  select_count integer not null default 0,
  last_selected timestamptz not null default now(),
  primary key (id),
  unique (user_id, game_name)
);

create index if not exists user_game_statistics_user_score_idx
  on public.user_game_statistics (user_id, select_count desc);

alter table public.user_game_statistics enable row level security;

drop policy if exists "Stats are viewable by authenticated users" on public.user_game_statistics;
create policy "Stats are viewable by authenticated users"
  on public.user_game_statistics for select to authenticated using (true);

drop policy if exists "Users can insert their own stats" on public.user_game_statistics;
create policy "Users can insert their own stats"
  on public.user_game_statistics for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own stats" on public.user_game_statistics;
create policy "Users can update their own stats"
  on public.user_game_statistics for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter publication supabase_realtime add table public.user_game_statistics;

-- ──────────────────────────────────────────────────────────────────────────────
-- achievements (master list, append-only by admins — users cannot insert)
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.achievements (
  id uuid not null default gen_random_uuid(),
  name text not null,
  description text not null,
  icon text not null,
  condition text not null unique,
  primary key (id)
);

alter table public.achievements enable row level security;

drop policy if exists "Achievements are viewable by authenticated users" on public.achievements;
create policy "Achievements are viewable by authenticated users"
  on public.achievements for select to authenticated using (true);

-- ──────────────────────────────────────────────────────────────────────────────
-- user_achievements (junction: which user has which achievement)
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.user_achievements (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  achievement_id uuid not null references public.achievements (id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (id),
  unique (user_id, achievement_id)
);

create index if not exists user_achievements_user_idx
  on public.user_achievements (user_id);

alter table public.user_achievements enable row level security;

drop policy if exists "User achievements are viewable by authenticated users" on public.user_achievements;
create policy "User achievements are viewable by authenticated users"
  on public.user_achievements for select to authenticated using (true);

drop policy if exists "Users can insert their own achievements" on public.user_achievements;
create policy "Users can insert their own achievements"
  on public.user_achievements for insert to authenticated
  with check (auth.uid() = user_id);

alter publication supabase_realtime add table public.user_achievements;

-- ──────────────────────────────────────────────────────────────────────────────
-- RPC: atomically increment select_count per game (ON CONFLICT DO UPDATE)
-- Only the calling user's own stats can be updated (runtime check).
-- ──────────────────────────────────────────────────────────────────────────────
create or replace function public.increment_game_stats(
  p_user_id uuid,
  p_games text[]
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id <> auth.uid() then
    raise exception 'permission denied';
  end if;

  insert into public.user_game_statistics (user_id, game_name, select_count, last_selected)
  select p_user_id, unnest(p_games), 1, now()
  on conflict (user_id, game_name) do update
    set select_count = public.user_game_statistics.select_count + 1,
        last_selected = now();
end;
$$;

revoke execute on function public.increment_game_stats(uuid, text[]) from anon, public;
grant  execute on function public.increment_game_stats(uuid, text[]) to authenticated;
