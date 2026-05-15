import { supabase } from "@/integrations/supabase/client";

const ranForUser = new Set<string>();

/** Materializes recurring expenses + recomputes savings. Once per session per user. */
export async function runMaintenance(userId: string) {
  if (ranForUser.has(userId)) return;
  ranForUser.add(userId);
  try {
    await supabase.rpc("materialize_recurring_expenses", { _user_id: userId });
    await supabase.rpc("recompute_savings", { _user_id: userId });
  } catch (err) {
    console.error("[maintenance]", err);
  }
}
