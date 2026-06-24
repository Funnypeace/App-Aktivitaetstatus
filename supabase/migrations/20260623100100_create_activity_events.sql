-- Activity log: a row per user activity (status change, game change, message,
-- login). Used to render "last 10 events" on the account screen and profile.
create table if not exists public.activity_events (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,        -- 'status' | 'games' | 'message' | 'chat' | 'login'
  details text,              -- human-readable detail, e.g. "Online → Offline"
  created_at timestamptz not null default now(),
  primary key (id)
);

create index if not exists activity_events_user_created_idx
  on public.activity_events (user_id, created_at desc);

alter table public.activity_events enable row level security;

-- Everyone authenticated may read activity (needed for other users' profiles).
drop policy if exists "Activity is viewable by authenticated users" on public.activity_events;
create policy "Activity is viewable by authenticated users"
  on public.activity_events
  for select
  to authenticated
  using (true);

-- Users may only write their own activity rows.
drop policy if exists "Users can insert their own activity" on public.activity_events;
create policy "Users can insert their own activity"
  on public.activity_events
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Broadcast activity changes via Realtime.
alter publication supabase_realtime add table public.activity_events;
