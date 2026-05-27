import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth } from "date-fns";

export type Category = {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: "NEED" | "WANT" | "EMI" | "INVESTMENT";
  is_default: boolean;
};

export type Expense = {
  id: string;
  category_id: string;
  name: string;
  amount: number;
  date: string;
  note: string | null;
  payment_mode: "UPI" | "CARD" | "CASH" | "NET_BANKING" | "EMI";
  recurring_id?: string | null;
  card_id?: string | null;
};

export type CreditCard = {
  id: string;
  name: string;
  last4: string | null;
  network: string | null;
  issuer: string | null;
  billing_day: number;
  due_day: number;
  credit_limit: number | null;
  color: string;
  note: string | null;
  settled_until: string | null;
  is_active: boolean;
};

export type Profile = {
  id: string;
  name: string;
  email: string | null;
  monthly_salary: number;
  currency: string;
};

export type Recurring = {
  id: string;
  category_id: string;
  name: string;
  amount: number;
  payment_mode: Expense["payment_mode"];
  start_date: string;
  end_date: string;
  day_of_month: number;
  note: string | null;
  is_active: boolean;
  card_id?: string | null;
};

export type MemoryEntry = {
  id: string;
  direction: "OWED_TO_ME" | "I_OWE";
  person_name: string;
  amount: number;
  date: string;
  deadline: string | null;
  note: string | null;
  settled_at: string | null;
};

export type SavingRow = {
  id: string;
  month: string;
  salary_snapshot: number;
  total_spent: number;
  amount_saved: number;
};

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId!).maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });
}

export function useCategories(userId: string | undefined) {
  return useQuery({
    queryKey: ["categories", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase.from("categories").select("*").eq("is_deleted", false).order("name");
      if (error) throw error;
      return data as Category[];
    },
  });
}

export function useExpenses(
  userId: string | undefined,
  opts?: { from?: Date; to?: Date; limit?: number }
) {
  return useQuery({
    queryKey: ["expenses", userId, opts?.from?.toISOString(), opts?.to?.toISOString(), opts?.limit],
    enabled: !!userId,
    queryFn: async (): Promise<Expense[]> => {
      let q = supabase.from("expenses").select("*").order("date", { ascending: false });
      if (opts?.from) q = q.gte("date", opts.from.toISOString().slice(0, 10));
      if (opts?.to) q = q.lte("date", opts.to.toISOString().slice(0, 10));
      if (opts?.limit) q = q.limit(opts.limit);
      const { data, error } = await q;
      if (error) throw error;
      return data as Expense[];
    },
  });
}

export function useThisMonthExpenses(userId: string | undefined) {
  const now = new Date();
  return useExpenses(userId, { from: startOfMonth(now), to: endOfMonth(now) });
}

export function useRecurring(userId: string | undefined) {
  return useQuery({
    queryKey: ["recurring", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Recurring[]> => {
      const { data, error } = await supabase
        .from("recurring_expenses")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Recurring[];
    },
  });
}

export function useMemoryEntries(userId: string | undefined) {
  return useQuery({
    queryKey: ["memory", userId],
    enabled: !!userId,
    queryFn: async (): Promise<MemoryEntry[]> => {
      const { data, error } = await supabase
        .from("memory_entries")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as MemoryEntry[];
    },
  });
}

export function useSavings(userId: string | undefined) {
  return useQuery({
    queryKey: ["savings", userId],
    enabled: !!userId,
    queryFn: async (): Promise<SavingRow[]> => {
      const { data, error } = await supabase
        .from("monthly_savings")
        .select("*")
        .order("month", { ascending: false });
      if (error) throw error;
      return data as SavingRow[];
    },
  });
}

export function useCards(userId: string | undefined) {
  return useQuery({
    queryKey: ["cards", userId],
    enabled: !!userId,
    queryFn: async (): Promise<CreditCard[]> => {
      const { data, error } = await supabase
        .from("cards")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CreditCard[];
    },
  });
}
