-- Phase 3a: emoji reactions for direct messages and global chat.
-- One reaction per (target, user, emoji); SELECT open, INSERT/DELETE own only.

-- ──────────────────────────────────────────────────────────────────────────────
-- message_reactions (reactions on direct messages)
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.message_reactions (
  id uuid not null default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (id),
  unique (message_id, user_id, emoji)
);

create index if not exists message_reactions_message_idx
  on public.message_reactions (message_id);

alter table public.message_reactions enable row level security;

drop policy if exists "Message reactions are viewable by authenticated users" on public.message_reactions;
create policy "Message reactions are viewable by authenticated users"
  on public.message_reactions for select to authenticated using (true);

drop policy if exists "Users can add their own message reactions" on public.message_reactions;
create policy "Users can add their own message reactions"
  on public.message_reactions for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can remove their own message reactions" on public.message_reactions;
create policy "Users can remove their own message reactions"
  on public.message_reactions for delete to authenticated
  using (auth.uid() = user_id);

alter publication supabase_realtime add table public.message_reactions;

-- ──────────────────────────────────────────────────────────────────────────────
-- chat_reactions (reactions on global chat messages)
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.chat_reactions (
  id uuid not null default gen_random_uuid(),
  chat_message_id uuid not null references public.chat_messages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (id),
  unique (chat_message_id, user_id, emoji)
);

create index if not exists chat_reactions_message_idx
  on public.chat_reactions (chat_message_id);

alter table public.chat_reactions enable row level security;

drop policy if exists "Chat reactions are viewable by authenticated users" on public.chat_reactions;
create policy "Chat reactions are viewable by authenticated users"
  on public.chat_reactions for select to authenticated using (true);

drop policy if exists "Users can add their own chat reactions" on public.chat_reactions;
create policy "Users can add their own chat reactions"
  on public.chat_reactions for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can remove their own chat reactions" on public.chat_reactions;
create policy "Users can remove their own chat reactions"
  on public.chat_reactions for delete to authenticated
  using (auth.uid() = user_id);

alter publication supabase_realtime add table public.chat_reactions;
