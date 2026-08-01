CREATE TABLE public.cheat_meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  label text NOT NULL,
  kcal integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cheat_meals TO authenticated;
GRANT ALL ON public.cheat_meals TO service_role;
ALTER TABLE public.cheat_meals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own cheat meals" ON public.cheat_meals FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX cheat_meals_user_date_idx ON public.cheat_meals (user_id, date);

CREATE TABLE public.cheat_meal_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_budget integer NOT NULL DEFAULT 4,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cheat_meal_settings TO authenticated;
GRANT ALL ON public.cheat_meal_settings TO service_role;
ALTER TABLE public.cheat_meal_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own cheat meal settings" ON public.cheat_meal_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER cheat_meal_settings_updated_at BEFORE UPDATE ON public.cheat_meal_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();