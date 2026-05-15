-- Recurring expenses (EMIs etc.)
CREATE TABLE public.recurring_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  category_id UUID NOT NULL,
  name TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  payment_mode payment_mode NOT NULL DEFAULT 'EMI',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  day_of_month SMALLINT NOT NULL DEFAULT 1 CHECK (day_of_month BETWEEN 1 AND 28),
  note TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own recurring" ON public.recurring_expenses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own recurring" ON public.recurring_expenses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own recurring" ON public.recurring_expenses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own recurring" ON public.recurring_expenses FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_recurring_updated_at BEFORE UPDATE ON public.recurring_expenses
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Link expenses to a recurring plan (nullable)
ALTER TABLE public.expenses ADD COLUMN recurring_id UUID;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_unique_recurring_date UNIQUE (recurring_id, date);

-- Memory entries (IOUs)
CREATE TYPE public.memory_direction AS ENUM ('OWED_TO_ME', 'I_OWE');

CREATE TABLE public.memory_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  direction memory_direction NOT NULL,
  person_name TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  deadline DATE,
  note TEXT,
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.memory_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own memory" ON public.memory_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own memory" ON public.memory_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own memory" ON public.memory_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own memory" ON public.memory_entries FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_memory_updated_at BEFORE UPDATE ON public.memory_entries
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Monthly savings (auto-computed)
CREATE TABLE public.monthly_savings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  month DATE NOT NULL,
  salary_snapshot NUMERIC NOT NULL DEFAULT 0,
  total_spent NUMERIC NOT NULL DEFAULT 0,
  amount_saved NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, month)
);

ALTER TABLE public.monthly_savings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own savings" ON public.monthly_savings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own savings" ON public.monthly_savings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own savings" ON public.monthly_savings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own savings" ON public.monthly_savings FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_savings_updated_at BEFORE UPDATE ON public.monthly_savings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Materialize recurring expenses up to today, idempotently
CREATE OR REPLACE FUNCTION public.materialize_recurring_expenses(_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  d DATE;
  inserted_count INTEGER := 0;
  cap_date DATE;
BEGIN
  FOR r IN SELECT * FROM public.recurring_expenses
           WHERE user_id = _user_id AND is_active = true LOOP
    cap_date := LEAST(r.end_date, CURRENT_DATE);
    -- first occurrence on/after start_date
    d := make_date(EXTRACT(YEAR FROM r.start_date)::INT,
                   EXTRACT(MONTH FROM r.start_date)::INT,
                   r.day_of_month);
    IF d < r.start_date THEN
      d := (d + INTERVAL '1 month')::DATE;
    END IF;
    WHILE d <= cap_date LOOP
      INSERT INTO public.expenses (user_id, category_id, name, amount, date, note, payment_mode, recurring_id)
      VALUES (r.user_id, r.category_id, r.name, r.amount, d, r.note, r.payment_mode, r.id)
      ON CONFLICT (recurring_id, date) DO NOTHING;
      IF FOUND THEN inserted_count := inserted_count + 1; END IF;
      d := (d + INTERVAL '1 month')::DATE;
    END LOOP;
  END LOOP;
  RETURN inserted_count;
END;
$$;

-- Recompute monthly savings for all completed months
CREATE OR REPLACE FUNCTION public.recompute_savings(_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  salary NUMERIC;
  first_month DATE;
  cur_month DATE;
  this_month DATE := date_trunc('month', CURRENT_DATE)::DATE;
  spent NUMERIC;
  rows_affected INTEGER := 0;
BEGIN
  SELECT monthly_salary INTO salary FROM public.profiles WHERE id = _user_id;
  IF salary IS NULL THEN salary := 0; END IF;

  SELECT date_trunc('month', MIN(date))::DATE INTO first_month
  FROM public.expenses WHERE user_id = _user_id;

  IF first_month IS NULL THEN RETURN 0; END IF;

  cur_month := first_month;
  WHILE cur_month < this_month LOOP
    SELECT COALESCE(SUM(amount), 0) INTO spent
    FROM public.expenses
    WHERE user_id = _user_id
      AND date >= cur_month
      AND date < (cur_month + INTERVAL '1 month')::DATE;

    INSERT INTO public.monthly_savings (user_id, month, salary_snapshot, total_spent, amount_saved)
    VALUES (_user_id, cur_month, salary, spent, salary - spent)
    ON CONFLICT (user_id, month) DO UPDATE
      SET salary_snapshot = EXCLUDED.salary_snapshot,
          total_spent = EXCLUDED.total_spent,
          amount_saved = EXCLUDED.amount_saved,
          updated_at = now();
    rows_affected := rows_affected + 1;
    cur_month := (cur_month + INTERVAL '1 month')::DATE;
  END LOOP;

  RETURN rows_affected;
END;
$$;

CREATE INDEX idx_expenses_user_date ON public.expenses(user_id, date DESC);
CREATE INDEX idx_recurring_user_active ON public.recurring_expenses(user_id, is_active);
CREATE INDEX idx_memory_user_settled ON public.memory_entries(user_id, settled_at);
CREATE INDEX idx_savings_user_month ON public.monthly_savings(user_id, month DESC);