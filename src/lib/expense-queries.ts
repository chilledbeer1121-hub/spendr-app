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
};

export type Profile = {
  id: string;
  name: string;
  email: string | null;
  monthly_salary: number;
  currency: string;
};

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId!)
        .maybeSingle();
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
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("is_deleted", false)
        .order("name");
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
    queryKey: [
      "expenses",
      userId,
      opts?.from?.toISOString(),
      opts?.to?.toISOString(),
      opts?.limit,
    ],
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
