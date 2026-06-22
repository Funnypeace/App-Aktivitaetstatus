-- Leaderboard RPC functions – each returns (user_id uuid, username text, score bigint).
-- All are SECURITY DEFINER so they bypass RLS for aggregation but are read-only.

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Activity leaderboard: total number of activity events logged
-- ──────────────────────────────────────────────────────────────────────────────
create or replace function public.leaderboard_activity(p_limit int default 20)
returns table(user_id uuid, username text, score bigint)
language sql
security definer
set search_path = ''
as $$
  select ae.user_id, p.username, count(*) as score
  from public.activity_events ae
  join public.profiles p on p.id = ae.user_id
  group by ae.user_id, p.username
  order by score desc
  limit p_limit;
$$;

revoke execute on function public.leaderboard_activity(int) from anon, public;
grant  execute on function public.leaderboard_activity(int) to authenticated;

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. Achievement leaderboard: number of unlocked achievements
-- ──────────────────────────────────────────────────────────────────────────────
create or replace function public.leaderboard_achievements(p_limit int default 20)
returns table(user_id uuid, username text, score bigint)
language sql
security definer
set search_path = ''
as $$
  select ua.user_id, p.username, count(*) as score
  from public.user_achievements ua
  join public.profiles p on p.id = ua.user_id
  group by ua.user_id, p.username
  order by score desc
  limit p_limit;
$$;

revoke execute on function public.leaderboard_achievements(int) from anon, public;
grant  execute on function public.leaderboard_achievements(int) to authenticated;

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. Games leaderboard: sum of all select_counts (total "game sessions")
-- ──────────────────────────────────────────────────────────────────────────────
create or replace function public.leaderboard_games(p_limit int default 20)
returns table(user_id uuid, username text, score bigint)
language sql
security definer
set search_path = ''
as $$
  select ugs.user_id, p.username, sum(ugs.select_count) as score
  from public.user_game_statistics ugs
  join public.profiles p on p.id = ugs.user_id
  group by ugs.user_id, p.username
  order by score desc
  limit p_limit;
$$;

revoke execute on function public.leaderboard_games(int) from anon, public;
grant  execute on function public.leaderboard_games(int) to authenticated;

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. Social leaderboard: number of direct messages sent
-- ──────────────────────────────────────────────────────────────────────────────
create or replace function public.leaderboard_social(p_limit int default 20)
returns table(user_id uuid, username text, score bigint)
language sql
security definer
set search_path = ''
as $$
  select m.sender_id as user_id, p.username, count(*) as score
  from public.messages m
  join public.profiles p on p.id = m.sender_id
  group by m.sender_id, p.username
  order by score desc
  limit p_limit;
$$;

revoke execute on function public.leaderboard_social(int) from anon, public;
grant  execute on function public.leaderboard_social(int) to authenticated;

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. Oldest members leaderboard: earliest created_at (score = unix timestamp)
-- ──────────────────────────────────────────────────────────────────────────────
create or replace function public.leaderboard_oldest(p_limit int default 20)
returns table(user_id uuid, username text, score bigint)
language sql
security definer
set search_path = ''
as $$
  select p.id as user_id, p.username,
         extract(epoch from p.created_at)::bigint as score
  from public.profiles p
  order by p.created_at asc
  limit p_limit;
$$;

revoke execute on function public.leaderboard_oldest(int) from anon, public;
grant  execute on function public.leaderboard_oldest(int) to authenticated;
