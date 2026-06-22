-- Phase 3c – Daily Quests

CREATE TABLE public.daily_quests (
  id          uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text    NOT NULL,
  description text    NOT NULL,
  icon        text    NOT NULL DEFAULT '📋',
  xp_reward   integer NOT NULL DEFAULT 10,
  condition   text    NOT NULL,
  target      integer NOT NULL DEFAULT 1
);

CREATE TABLE public.user_daily_quests (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  quest_id     uuid        NOT NULL REFERENCES public.daily_quests(id) ON DELETE CASCADE,
  date         date        NOT NULL DEFAULT CURRENT_DATE,
  progress     integer     NOT NULL DEFAULT 0,
  completed    boolean     NOT NULL DEFAULT false,
  claimed      boolean     NOT NULL DEFAULT false,
  completed_at timestamptz,
  UNIQUE (user_id, quest_id, date)
);

-- RLS
ALTER TABLE public.daily_quests      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_daily_quests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_quests_select"
  ON public.daily_quests FOR SELECT TO authenticated USING (true);

CREATE POLICY "user_daily_quests_select"
  ON public.user_daily_quests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_daily_quests_insert"
  ON public.user_daily_quests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_daily_quests_update"
  ON public.user_daily_quests FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_daily_quests;

-- Seed: 6 predefined quests
INSERT INTO public.daily_quests (name, description, icon, xp_reward, condition, target) VALUES
  ('Post a Message',    'Schreibe eine Nachricht im Global Chat',          '💬', 10, 'send_chat',      1),
  ('Chat with Friends', 'Schreibe eine Direktnachricht',                   '📧', 10, 'send_dm',        1),
  ('Play a Game',       'Wähle ein Spiel aus deiner Liste aus',            '🎮', 10, 'select_game',    1),
  ('Make a Friend',     'Tritt einem Squad bei oder erstelle einen',       '👥', 15, 'join_squad',     1),
  ('React!',            'Reagiere mit einem Emoji auf eine Nachricht',     '😊', 10, 'react',          1),
  ('Create a Session',  'Erstelle eine Gaming Session',                    '🎯', 20, 'create_session', 1);
