# Build plan — 6 features

I'll ship this in two database migrations + a focused set of UI changes. Order chosen so each step is verifiable before moving on.

## 1. Database (one migration)

Three new tables, all with RLS scoped to `auth.uid()`:

- **`recurring_expenses`** — `name, category_id, amount, payment_mode, start_date, end_date, day_of_month, note`. Used both as a plan record and as the source for auto-generated expense rows.
- **`memory_entries`** (Money Memory / IOUs) — `direction` ('OWED_TO_ME' | 'I_OWE'), `person_name, amount, date, deadline, note, settled_at`.
- **`monthly_savings`** — `month` (date, first of month), `salary_snapshot, total_spent, amount_saved`. One row per user per month.

Plus a Postgres function `materialize_recurring_expenses(user_id)` that inserts any missing `expenses` rows for active recurring plans up to today, idempotently (unique on `recurring_id + date`). Called from a server fn on app load and after creating a recurring plan.

A second function `recompute_savings(user_id)` recalculates `monthly_savings` for every completed month from the user's earliest expense onward.

## 2. Reports page (`/reports`) — build out

Always-on view (no insights gating):

- **Range selector**: This month / Last month / Last 3 months / This year / All time.
- **Total spent card** + **% of salary** + **# of transactions**.
- **Spend by category** — sortable table (name · amount · % · count) + horizontal bar chart.
- **Spend by payment mode** — donut.
- **NEED / WANT / EMI / INVESTMENT split** — stacked bar with %.
- **Monthly trend** — line chart (last 6 months).

## 3. Recurring expenses (`/recurring`)

New nav item. List of active + ended plans. "Add recurring" form: name, category, monthly amount, payment mode, start date, end date, day of month (1–28), note. On save: insert plan + materialize. Delete plan = stop future generation (past generated expenses stay).

## 4. Money Memory (`/memory`)

New nav item. Two tabs: **Owed to me** / **I owe**. Each entry shows person, amount, date logged, deadline (with "X days left" or "overdue" pill), note. Mark as settled (sets `settled_at`, hides from active list, shows in Settled tab). Add/edit/delete.

## 5. Savings (`/savings`)

New nav item. Auto-computed cards:

- **Total saved till now** (sum of all `monthly_savings.amount_saved`, only positive months).
- **Average monthly savings**.
- **Best month**.
- List: "Jan 2026 — ₹23,420 saved" rows, newest first, with salary + spend breakdown on tap.

Recomputed on app load via server fn.

## 6. Expenses — edit, delete, PDF

- **Edit/Delete**: each expense row gets a kebab menu → Edit (opens `/add` prefilled via `?edit=<id>`) / Delete (confirm dialog, soft toast with undo).
- **PDF export button** on `/expenses`: generates a styled PDF (header with month + total, category summary table, full transaction list grouped by date, footer with salary % and savings rate). Uses `jspdf` + `jspdf-autotable` — pure JS, Worker-safe. File: `Expenses-MMM-YYYY.pdf`.

## 7. Nav update

Mobile bottom nav becomes 5 primary: Dashboard · Add · Expenses · Reports · More. "More" sheet lists Recurring, Memory, Savings, Insights, Settings. Desktop side rail shows everything.

## Technical notes

- All new pages mobile-first (375px).
- Recurring materialization runs in a server fn called from `__root` on auth, debounced to once per session.
- PDF generation is client-side (no server work, no extra deps beyond jspdf).
- Edit flow reuses the existing `/add` form — no duplicate form.
- All money math uses existing `formatCurrency` / `pctOfSalary` helpers.

Ready to start? I'll begin with the migration, then ship features in the order above.