-- Phase 3c – Level System: xp, level, xp_to_next_level in profiles

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS xp              integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level           integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS xp_to_next_level integer NOT NULL DEFAULT 100;
