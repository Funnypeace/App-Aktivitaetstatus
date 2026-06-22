-- Phase 3d – Notifications

-- Per-user notification preferences on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notifications_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_levelup         boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_quests          boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_messages        boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_sound           boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_vibration       boolean NOT NULL DEFAULT true;

-- Optional archive of notifications shown to a user
CREATE TABLE public.user_notifications (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type        text        NOT NULL,
  title       text        NOT NULL,
  message     text        NOT NULL,
  action_link text,
  read        boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX user_notifications_user_created_idx
  ON public.user_notifications (user_id, created_at DESC);

-- RLS: a user only ever sees / manages their own notifications
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_notifications_select"
  ON public.user_notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_notifications_insert"
  ON public.user_notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_notifications_update"
  ON public.user_notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_notifications_delete"
  ON public.user_notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
