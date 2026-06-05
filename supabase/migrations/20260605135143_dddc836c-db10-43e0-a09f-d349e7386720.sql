CREATE TABLE public.investments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  broker TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.investments TO authenticated;
GRANT ALL ON public.investments TO service_role;

ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own investments" ON public.investments
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_investments_updated_at BEFORE UPDATE ON public.investments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX investments_user_date_idx ON public.investments(user_id, date DESC);