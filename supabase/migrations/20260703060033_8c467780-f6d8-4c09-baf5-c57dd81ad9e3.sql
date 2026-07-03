
ALTER TABLE public.monthly_savings ADD COLUMN IF NOT EXISTS bonus NUMERIC NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.recompute_savings(_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  salary NUMERIC;
  first_month DATE;
  cur_month DATE;
  this_month DATE := date_trunc('month', CURRENT_DATE)::DATE;
  spent NUMERIC;
  bonus_val NUMERIC;
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

    SELECT COALESCE(bonus, 0) INTO bonus_val
    FROM public.monthly_savings
    WHERE user_id = _user_id AND month = cur_month;
    IF bonus_val IS NULL THEN bonus_val := 0; END IF;

    INSERT INTO public.monthly_savings (user_id, month, salary_snapshot, total_spent, amount_saved, bonus)
    VALUES (_user_id, cur_month, salary, spent, salary + bonus_val - spent, bonus_val)
    ON CONFLICT (user_id, month) DO UPDATE
      SET salary_snapshot = EXCLUDED.salary_snapshot,
          total_spent = EXCLUDED.total_spent,
          amount_saved = EXCLUDED.salary_snapshot + public.monthly_savings.bonus - EXCLUDED.total_spent,
          updated_at = now();
    rows_affected := rows_affected + 1;
    cur_month := (cur_month + INTERVAL '1 month')::DATE;
  END LOOP;

  RETURN rows_affected;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_month_bonus(_user_id uuid, _month date, _bonus numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  salary NUMERIC;
  spent NUMERIC;
  m DATE := date_trunc('month', _month)::DATE;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  SELECT COALESCE(monthly_salary, 0) INTO salary FROM public.profiles WHERE id = _user_id;
  SELECT COALESCE(SUM(amount), 0) INTO spent
  FROM public.expenses
  WHERE user_id = _user_id
    AND date >= m
    AND date < (m + INTERVAL '1 month')::DATE;

  INSERT INTO public.monthly_savings (user_id, month, salary_snapshot, total_spent, amount_saved, bonus)
  VALUES (_user_id, m, salary, spent, salary + COALESCE(_bonus,0) - spent, COALESCE(_bonus,0))
  ON CONFLICT (user_id, month) DO UPDATE
    SET bonus = COALESCE(_bonus, 0),
        salary_snapshot = EXCLUDED.salary_snapshot,
        total_spent = EXCLUDED.total_spent,
        amount_saved = EXCLUDED.salary_snapshot + COALESCE(_bonus,0) - EXCLUDED.total_spent,
        updated_at = now();
END;
$function$;
