
-- Cards table
CREATE TABLE public.cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  last4 TEXT,
  network TEXT,
  issuer TEXT,
  billing_day SMALLINT NOT NULL DEFAULT 1 CHECK (billing_day BETWEEN 1 AND 31),
  due_day SMALLINT NOT NULL DEFAULT 15 CHECK (due_day BETWEEN 1 AND 31),
  credit_limit NUMERIC,
  color TEXT NOT NULL DEFAULT '#9FCC2B',
  note TEXT,
  settled_until DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cards TO authenticated;
GRANT ALL ON public.cards TO service_role;

ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own cards" ON public.cards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own cards" ON public.cards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own cards" ON public.cards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own cards" ON public.cards FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER cards_updated_at BEFORE UPDATE ON public.cards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Link expenses + recurring to cards
ALTER TABLE public.expenses ADD COLUMN card_id UUID;
ALTER TABLE public.recurring_expenses ADD COLUMN card_id UUID;

CREATE INDEX idx_expenses_card_id ON public.expenses(card_id) WHERE card_id IS NOT NULL;
CREATE INDEX idx_recurring_card_id ON public.recurring_expenses(card_id) WHERE card_id IS NOT NULL;
