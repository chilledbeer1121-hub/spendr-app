
-- Enums
create type public.category_type as enum ('NEED', 'WANT', 'EMI', 'INVESTMENT');
create type public.payment_mode as enum ('UPI', 'CARD', 'CASH', 'NET_BANKING', 'EMI');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text,
  monthly_salary numeric not null default 0,
  currency text not null default 'INR',
  week_start_day smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "Users view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Categories
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text not null default 'tag',
  color text not null default '#6366F1',
  type public.category_type not null default 'WANT',
  is_default boolean not null default false,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.categories enable row level security;
create index categories_user_idx on public.categories(user_id);

create policy "Users view own categories" on public.categories for select using (auth.uid() = user_id);
create policy "Users insert own categories" on public.categories for insert with check (auth.uid() = user_id);
create policy "Users update own categories" on public.categories for update using (auth.uid() = user_id);
create policy "Users delete own categories" on public.categories for delete using (auth.uid() = user_id);

-- Expenses
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete restrict,
  name text not null,
  amount numeric not null check (amount >= 0),
  date date not null default current_date,
  note text,
  payment_mode public.payment_mode not null default 'UPI',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.expenses enable row level security;
create index expenses_user_date_idx on public.expenses(user_id, date desc);
create index expenses_category_idx on public.expenses(category_id);

create policy "Users view own expenses" on public.expenses for select using (auth.uid() = user_id);
create policy "Users insert own expenses" on public.expenses for insert with check (auth.uid() = user_id);
create policy "Users update own expenses" on public.expenses for update using (auth.uid() = user_id);
create policy "Users delete own expenses" on public.expenses for delete using (auth.uid() = user_id);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger expenses_updated_at before update on public.expenses
  for each row execute function public.set_updated_at();

-- New user handler: profile + default categories
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email
  );

  insert into public.categories (user_id, name, icon, color, type, is_default) values
    (new.id, 'Groceries',      'shopping-cart', '#3B82F6', 'NEED',       true),
    (new.id, 'Eating Out',     'utensils',      '#F59E0B', 'WANT',       true),
    (new.id, 'Transport',      'car',           '#8B5CF6', 'NEED',       true),
    (new.id, 'Health',         'pill',          '#EF4444', 'NEED',       true),
    (new.id, 'Gym/Fitness',    'dumbbell',      '#10B981', 'WANT',       true),
    (new.id, 'Entertainment',  'clapperboard',  '#EC4899', 'WANT',       true),
    (new.id, 'Shopping',       'shopping-bag',  '#F97316', 'WANT',       true),
    (new.id, 'Bills',          'zap',           '#6366F1', 'NEED',       true),
    (new.id, 'Insurance',      'shield',        '#7C3AED', 'EMI',        true),
    (new.id, 'EMI/Loan',       'clipboard',     '#9D174D', 'EMI',        true),
    (new.id, 'Subscriptions',  'smartphone',    '#0EA5E9', 'WANT',       true),
    (new.id, 'Investment/SIP', 'trending-up',   '#059669', 'INVESTMENT', true),
    (new.id, 'Others',         'package',       '#6B7280', 'WANT',       true);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
