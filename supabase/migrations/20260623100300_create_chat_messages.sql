-- Global / public chat. Username is denormalized so the chat renders without a
-- join against profiles.
create table if not exists public.chat_messages (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  username text,
  content text not null,
  created_at timestamptz not null default now(),
  primary key (id)
);

create index if not exists chat_messages_created_idx
  on public.chat_messages (created_at);

alter table public.chat_messages enable row level security;

-- Everyone authenticated may read the global chat.
drop policy if exists "Chat is viewable by authenticated users" on public.chat_messages;
create policy "Chat is viewable by authenticated users"
  on public.chat_messages
  for select
  to authenticated
  using (true);

-- Authenticated users may post only as themselves.
drop policy if exists "Users can post chat as themselves" on public.chat_messages;
create policy "Users can post chat as themselves"
  on public.chat_messages
  for insert
  to authenticated
  with check (auth.uid() = user_id);

alter publication supabase_realtime add table public.chat_messages;
