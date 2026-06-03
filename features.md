# Spendr — Feature Overview

Spendr is a personal expense tracker and budgeting app that helps you understand where your money goes, stay on top of bills, and build better spending habits.

---

## 1. Authentication

- **Sign up** and **log in** securely to access your personal data.
- All your expenses, cards, and settings are private to your account.

---

## 2. Dashboard (Home)

Your main landing page gives a quick snapshot of your financial health for the current month:

- **Key stats at a glance**: total spent, remaining salary, biggest spending category, and number of transactions.
- **Salary consumption bar**: a visual progress bar showing what percentage of your monthly take-home salary has already been used.
- **Category donut chart**: a colorful breakdown of where your money went across all categories.
- **Recent expenses**: the last few transactions you logged, with quick access to view the full list.
- **Spend vs. Payable toggle**: switch between seeing money you've *already spent* vs. money you *have to pay this month* (useful because card purchases may only be due on the billing date).

---

## 3. Log & Edit Expenses

Record every purchase or payment you make:

- **Pick a category** (or create a new one on the spot).
- **Enter details**: name, amount, date, and payment mode (UPI, Card, Cash, Net Banking, EMI).
- **Link to a card**: if you paid by card, link the expense to a specific card for billing-cycle tracking.
- **Classify the spend**: mark each expense as **Need**, **Want**, **EMI**, or **Investment**. This can override the category's default type, giving you fine-grained control over how each rupee is categorized.
- **Add notes**: optional notes for extra context.
- **Edit anytime**: tap any existing expense to update its details.

---

## 4. Expenses List

A complete, filterable history of everything you've logged:

- **Time filters**: view expenses from this month, last month, the last 3 months, or all time.
- **Total for the period**: instantly see how much you spent in the selected range.
- **Edit or delete**: swipe-like actions (via dropdown) to modify or remove any entry.
- **Export to PDF**: generate a downloadable PDF report of your expenses for any selected period.
- **Card tags**: expenses paid by card show a small tag with the card name.
- **Auto tag**: expenses generated from recurring plans are marked "Auto".

---

## 5. Cards

Manage all your credit and debit cards in one place:

- **Add cards**: store card name, issuer, last-4 digits, network (Visa, Mastercard, RuPay, etc.), billing day, due day, credit limit, and color.
- **Outstanding tracking**: see exactly how much is unsettled on each card since the last time you marked it paid.
- **Lifetime spend**: total amount ever charged to the card.
- **Utilization meter**: a progress bar showing how close you are to your credit limit, with a warning if you hit 90%.
- **Mark statement paid**: with one tap, record that you've settled a card's bill up to today.
- **Edit or remove**: update card details or delete a card (linked expenses stay but become unlinked).

---

## 6. Recurring (EMIs & Subscriptions)

Set up expenses that repeat every month and let the app auto-log them:

- **Add plans**: define a name, category, monthly amount, day of the month it hits, start and end dates, and payment mode.
- **Card-linked EMIs**: link recurring charges to a specific card if needed.
- **Active / Paused / Ended states**: pause a plan temporarily or let it naturally end after the end date.
- **Monthly commitment**: see your total locked-in monthly outflow from all active plans at a glance.
- **Edit anytime**: change the amount, dates, or pause/resume a plan.

---

## 7. Reports

Deep-dive analytics with multiple lenses on your spending:

- **Time ranges**: analyze this month, last month, last 3 months, this year, or all time.
- **Category drill-down**: a ranked list of categories with progress bars, percentages, and transaction counts. Tap any category to see every expense inside it.
- **Payment mode split**: a donut chart showing how much you paid via UPI, Card, Cash, Net Banking, or EMI.
- **Need vs. Want vs. EMI vs. Investment**: a breakdown of your spending behavior across these four life categories.
- **Monthly trend**: a line chart of your spending over the last 6 months so you can spot upward or downward patterns.
- **Spend vs. Payable toggle**: available here too, so you can analyze either "money already gone" or "money I still owe."

---

## 8. Visualization

A dedicated page for rich, intuitive visual exploration of your spending:

- **Spend Map (Treemap)**: a block diagram where bigger blocks mean bigger spends, grouped by type (Need, Want, EMI, Investment) and colored by category. Hover for exact amounts and percentages.
- **Money Flow (Sankey)**: a flowing diagram showing how your total spend splits into types, then into top categories — great for tracing where the bulk of your money travels.
- **Daily Heatmap**: a calendar-style grid where darker cells mean heavier spending days. Instantly spot your high-spend days.
- **Type Breakdown Bars**: clean horizontal bars comparing the four types side by side.
- **Top Transactions**: the biggest individual expenses of the period, ranked.

---

## 9. AI Insights

Get intelligent, personalized analysis of your spending powered by AI:

- **Choose the month**: analyze either the current month or the previous month.
- **Quick summary stats**: total spent, number of transactions, and average per day.
- **One-tap analyze**: hit "Analyze with AI" and the app generates:
  - A **headline** and **summary** of your month.
  - **What went well** — positive patterns in your spending.
  - **Watch out** — warnings about risky trends or overruns.
  - **Suggestions** — actionable tips to save more or spend smarter.
  - **Forecast** — a forward-looking estimate based on your current trajectory.

---

## 10. Savings

Track how much you actually save at the end of every month:

- **Auto-tallied**: at the end of each month, the app records your leftover salary after all expenses.
- **Total saved**: cumulative savings across all positive months.
- **Average per month**: your typical monthly surplus.
- **Best month**: your highest-saving month so far, with the exact amount.
- **Month-by-month history**: a list showing salary, total spent, and saved amount for every completed month, with a savings rate percentage.

---

## 11. Progress (Daily Budget Tracker)

Set a daily spending cap for "discretionary" purchases — the fun/optional stuff — and track yourself against it:

- **Set your daily budget** in Settings (as a daily amount, monthly amount divided by 30, or a percentage of your salary).
- **Excluded automatically**: expenses marked as **Need** or **EMI** don't count toward the daily cap — only **Want** and unclassified discretionary spends do.
- **Day-by-day table**: a full table for the selected period (week, month, quarter, or year) showing:
  - How much you spent each day.
  - A progress bar vs. your budget.
  - The exact over/under amount.
  - A status badge: **Expensive** (red, over budget), **Savings** (green, under budget), or **No spend**.
- **Line chart**: a visual trend of your daily spend plotted against your budget line, so you can see patterns at a glance.
- **Click a day**: tap any past day to open a popup showing every individual expense that made up that day's total.
- **Summary stats**: expensive-day count, savings-day count, and net saved or overspent for the period.
- **Spend vs. Payable toggle**: works here too, so you can track either "money already spent" or "money I'll have to pay."

---

## 12. Settings

Configure your profile and financial preferences:

- **Personal info**: name and email.
- **Monthly take-home salary**: the baseline number that drives every percentage and budget calculation in the app.
- **Currency**: choose INR, USD, EUR, GBP, or AED.
- **Daily discretionary budget**: configure your Progress-tracker budget using three modes:
  - **Daily**: enter a fixed per-day amount.
  - **Monthly**: enter a monthly allowance (auto-divided by 30).
  - **% of salary**: pick a percentage of your salary, with helpful preset suggestions (Lean 10%, Balanced 15%, Comfortable 20%, Generous 30%).
- **Sign out**: securely log out of your account.

---

## 13. Spend vs. Payable Toggle (Global)

A special view switcher that appears on the Home, Reports, Visualization, and Progress pages:

- **Spent view**: counts each expense on the date you actually made the purchase.
- **Payable view**: counts card expenses on the date they fall due (based on each card's billing cycle). This is crucial for credit card users who want to see "what do I have to pay this month" rather than "what did I buy this month."

---

## 14. Collapsible Sidebar

- On desktop, the left sidebar can be collapsed to show only icons, giving you more room for data and charts.
- Expanded, it shows both icons and full labels for easy navigation.
- Your preference is remembered across sessions.

---

## Summary of Navigation

| Section | What You Do There |
|---------|-------------------|
| **Home** | Monthly overview, salary bar, category chart, recent expenses |
| **Add** | Log a new expense or edit an existing one |
| **Expenses** | Full history, filters, PDF export, edit/delete |
| **Cards** | Manage cards, track outstanding, billing cycles, utilization |
| **Recurring** | Set up EMIs, rent, subscriptions with auto-generation |
| **Reports** | Detailed analytics with charts, drill-downs, trends |
| **Visualization** | Rich visual maps: treemap, sankey, heatmap, top transactions |
| **AI Insights** | One-tap AI-powered monthly spending analysis |
| **Savings** | Monthly savings history, totals, averages, best month |
| **Progress** | Daily budget tracker, day-by-day table, trend chart |
| **Settings** | Profile, salary, currency, daily budget config, sign out |
