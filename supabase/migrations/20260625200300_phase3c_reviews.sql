-- Phase 3c – Game Reviews / Ratings

CREATE TABLE public.game_reviews (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_name   text        NOT NULL,
  rating      integer     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text text        CHECK (review_text IS NULL OR char_length(review_text) <= 500),
  created_at  timestamptz DEFAULT now() NOT NULL,
  updated_at  timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id, game_name)
);

-- RLS
ALTER TABLE public.game_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "game_reviews_select"
  ON public.game_reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "game_reviews_insert"
  ON public.game_reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "game_reviews_update"
  ON public.game_reviews FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "game_reviews_delete"
  ON public.game_reviews FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_reviews;
