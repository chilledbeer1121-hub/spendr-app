import { useEffect, useState } from "react";
import { parseISO, format, isWithinInterval } from "date-fns";
import type { Expense, CreditCard } from "./expense-queries";

export type SpendView = "spent" | "payable";

const KEY = "spendr:viewMode";
const REC_KEY = "spendr:includeRecurring";

export function useSpendView(): [SpendView, (v: SpendView) => void] {
  const [view, setView] = useState<SpendView>(() => {
    if (typeof window === "undefined") return "spent";
    return (localStorage.getItem(KEY) as SpendView) ?? "spent";
  });
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue) setView(e.newValue as SpendView);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const set = (v: SpendView) => {
    localStorage.setItem(KEY, v);
    setView(v);
    window.dispatchEvent(new StorageEvent("storage", { key: KEY, newValue: v }));
  };
  return [view, set];
}

export function useIncludeRecurring(): [boolean, (v: boolean) => void] {
  const [on, setOn] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const raw = localStorage.getItem(REC_KEY);
    return raw === null ? true : raw === "1";
  });
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === REC_KEY && e.newValue !== null) setOn(e.newValue === "1");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const set = (v: boolean) => {
    localStorage.setItem(REC_KEY, v ? "1" : "0");
    setOn(v);
    window.dispatchEvent(new StorageEvent("storage", { key: REC_KEY, newValue: v ? "1" : "0" }));
  };
  return [on, set];
}

export function applyRecurringToggle<T extends { recurring_id?: string | null }>(
  expenses: T[],
  include: boolean,
): T[] {
  if (include) return expenses;
  return expenses.filter((e) => !e.recurring_id);
}

/**
 * Computes when an expense actually needs to be paid out of pocket.
 * - Cash / UPI / Net banking → the expense date itself.
 * - Card → the card's due date for the statement cycle containing the expense.
 */
export function payableDateFor(expense: Expense, cards: CreditCard[]): string {
  if (!expense.card_id) return expense.date;
  const card = cards.find((c) => c.id === expense.card_id);
  if (!card) return expense.date;

  const d = parseISO(expense.date);
  let stmtYear = d.getFullYear();
  let stmtMonth = d.getMonth(); // 0-indexed
  // If expense day is after billing_day, it belongs to the *next* statement.
  if (d.getDate() > card.billing_day) {
    stmtMonth += 1;
    if (stmtMonth > 11) {
      stmtMonth = 0;
      stmtYear += 1;
    }
  }
  // Due date is in the same month as statement-close if due_day > billing_day, else next month.
  let dueYear = stmtYear;
  let dueMonth = stmtMonth;
  if (card.due_day <= card.billing_day) {
    dueMonth += 1;
    if (dueMonth > 11) {
      dueMonth = 0;
      dueYear += 1;
    }
  }
  return format(new Date(dueYear, dueMonth, card.due_day), "yyyy-MM-dd");
}

export function filterByView(
  expenses: Expense[],
  cards: CreditCard[],
  view: SpendView,
  from: Date,
  to: Date,
): Expense[] {
  return expenses.filter((e) => {
    const dateStr = view === "payable" ? payableDateFor(e, cards) : e.date;
    const d = parseISO(dateStr);
    return isWithinInterval(d, { start: from, end: to });
  });
}
