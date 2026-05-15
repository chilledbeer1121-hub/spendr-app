REVOKE EXECUTE ON FUNCTION public.materialize_recurring_expenses(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.recompute_savings(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.materialize_recurring_expenses(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_savings(UUID) TO authenticated;

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
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  FOR r IN SELECT * FROM public.recurring_expenses
           WHERE user_id = _user_id AND is_active = true LOOP
    cap_date := LEAST(r.end_date, CURRENT_DATE);
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
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
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