-- Direct messages between two users.
create table if not exists public.messages (
  id uuid not null default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  content text not null,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (id)
);

create index if not exists messages_pair_created_idx
  on public.messages (sender_id, recipient_id, created_at);
create index if not exists messages_recipient_idx
  on public.messages (recipient_id);

alter table public.messages enable row level security;

-- A user may read messages where they are sender or recipient.
drop policy if exists "Users can read their own messages" on public.messages;
create policy "Users can read their own messages"
  on public.messages
  for select
  to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

-- A user may only send as themselves.
drop policy if exists "Users can send messages as themselves" on public.messages;
create policy "Users can send messages as themselves"
  on public.messages
  for insert
  to authenticated
  with check (auth.uid() = sender_id);

-- The recipient may update (used to mark messages as read).
drop policy if exists "Recipient can update read flag" on public.messages;
create policy "Recipient can update read flag"
  on public.messages
  for update
  to authenticated
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

alter publication supabase_realtime add table public.messages;
