-- Add a "games" column to profiles so users can share which games they are
-- currently playing (1–3 games). Stored as a JSON array of game labels, e.g.
-- ["WoW", "ETS2"]. Defaults to an empty array.
--
-- RLS is unchanged: SELECT stays open to all authenticated users, UPDATE remains
-- restricted to the own row (auth.uid() = id). Realtime already includes the
-- profiles table, so changes to this column are broadcast like status changes.
alter table public.profiles
  add column if not exists games jsonb not null default '[]'::jsonb;
