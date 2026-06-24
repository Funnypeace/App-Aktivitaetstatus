-- Create session_chat table
create table public.session_chat (
  id uuid default gen_random_uuid() primary key,
  session_id uuid not null references public.gaming_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete set null,
  username text,
  content text not null,
  created_at timestamptz not null default now()
);

create index session_chat_session_id_idx on public.session_chat(session_id);
create index session_chat_created_at_idx on public.session_chat(created_at);

-- Enable RLS
alter table public.session_chat enable row level security;

-- RLS policy: anyone can SELECT (to read messages)
create policy session_chat_select on public.session_chat
  for select using (true);

-- RLS policy: only session members can INSERT
create policy session_chat_insert on public.session_chat
  for insert with check (
    exists(
      select 1 from public.session_members
      where session_members.session_id = session_chat.session_id
      and session_members.user_id = auth.uid()
    )
  );

-- Enable Realtime
alter publication supabase_realtime add table public.session_chat;
