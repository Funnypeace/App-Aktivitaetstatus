-- Phase 3c – Streaks

CREATE TABLE public.user_streaks (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  current_streak      integer     NOT NULL DEFAULT 0,
  longest_streak      integer     NOT NULL DEFAULT 0,
  last_activity_date  date,
  updated_at          timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id)
);

-- RLS
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_streaks_select"
  ON public.user_streaks FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_streaks_insert"
  ON public.user_streaks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_streaks_update"
  ON public.user_streaks FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_streaks;
