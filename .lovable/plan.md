This is a large spec. I'll build it in focused phases so we can verify each one looks and works right on mobile before moving on. Each phase is shippable on its own.

## Phase 1 — Foundation (this turn)
- Enable Lovable Cloud (database + auth)
- Database: `profiles` (name, monthly_salary, currency), `categories`, `expenses` with RLS policies + 13 default categories auto-seeded on signup
- Auth: email/password + Google sign-in, `/login`, `/signup`, `/reset-password`
- Design system: dark-mode-first, distinctive (not generic purple). Indian number formatting helper. Salary % shared utility.
- App shell with mobile bottom nav (Dashboard / Add / Expenses / Reports / Insights) and desktop side rail
- **Dashboard** (`/`) — header strip, 4 summary cards (stack 2x2 on mobile), spending donut, salary bar, recent 7 expenses
- **Add Expense** (`/add`) — full single-screen form, inline new-category creator, optimized for 375px

## Phase 2
- **Expenses** (`/expenses`) — sticky filter bar, date presets, grouped list, swipe actions on mobile, live footer summary

## Phase 3
- **Reports** (`/reports`) — sections A–F, charts collapse to full-width on mobile, sortable category table, payment mode donut, NEED/WANT/EMI/INVESTMENT split

## Phase 4
- **Insights** (`/insights`) — server-side insight generation, dismissible cards
- **Categories** (`/categories`) — manage grid + reassign-on-delete flow
- **Settings** (`/settings`) — profile, salary, currency, week start, data export/delete

## Phase 5
- **Export** — PDF (jsPDF + html2canvas), Excel (SheetJS), CSV (Papa Parse)
- Polish: count-up animations, toasts with category color, undo on delete

## Technical notes
- Tech adapted to this template: TanStack Start (not Express), Lovable Cloud (Postgres + RLS, not standalone Prisma), `createServerFn` for server logic. Same data model, same UX.
- Recharts, Zustand, react-hook-form, date-fns, lucide-react, sonner (toasts), Zod — all added as needed.
- Mobile-first throughout: every layout designed at 375px first, then enhanced for tablet/desktop.

Ready to start Phase 1?