ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS daily_budget numeric NOT NULL DEFAULT 0;