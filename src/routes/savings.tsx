import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useSavings, useProfile, type SavingRow } from "@/lib/expense-queries";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AppShell } from "@/components/app-shell";
import { formatCurrency } from "@/lib/format";
import { format, parseISO } from "date-fns";
import { PiggyBank, TrendingUp, Award, Gift, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/savings")({
  component: () => <AppShell><SavingsPage /></AppShell>,
  head: () => ({ meta: [{ title: "Savings — Spendr" }] }),
});

function SavingsPage() {
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const { data: savings = [] } = useSavings(user?.id);
  const currency = profile?.currency ?? "INR";
  const qc = useQueryClient();
  const [editing, setEditing] = useState<SavingRow | null>(null);
  const [bonusVal, setBonusVal] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const stats = useMemo(() => {
    const positive = savings.filter((s) => Number(s.amount_saved) > 0);
    const total = positive.reduce((s, r) => s + Number(r.amount_saved), 0);
    const avg = positive.length > 0 ? total / positive.length : 0;
    const best = positive.reduce<typeof savings[number] | null>((b, r) => (!b || Number(r.amount_saved) > Number(b.amount_saved) ? r : b), null);
    const totalBonus = savings.reduce((s, r) => s + Number((r as SavingRow).bonus ?? 0), 0);
    return { total, avg, best, totalBonus };
  }, [savings]);

  const openEdit = (s: SavingRow) => {
    setEditing(s);
    setBonusVal(String(Number((s as SavingRow).bonus ?? 0) || ""));
  };

  const saveBonus = async () => {
    if (!editing || !user?.id) return;
    setBusy(true);
    try {
      const bonus = parseFloat(bonusVal || "0") || 0;
      const { error } = await supabase.rpc("set_month_bonus", {
        _user_id: user.id,
        _month: editing.month,
        _bonus: bonus,
      });
      if (error) throw error;
      toast.success("Bonus updated");
      await qc.invalidateQueries({ queryKey: ["savings", user.id] });
      setEditing(null);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update bonus");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-4 pt-6 pb-4 md:px-8 md:pt-8 max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="font-display text-2xl font-bold">Savings</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Auto-tallied at the end of every month · add bonuses for months with extra income</p>
      </div>

      <Card className="p-5 bg-gradient-to-br from-primary/15 via-card to-card border-primary/30 mb-4">
        <div className="flex items-center gap-2 text-primary text-sm font-medium">
          <PiggyBank className="size-4" /> Total saved
        </div>
        <div className="mt-2 font-display text-3xl font-bold tabular-nums">{formatCurrency(stats.total, currency)}</div>
        <div className="text-xs text-muted-foreground mt-1">across {savings.filter((s) => Number(s.amount_saved) > 0).length} positive months</div>
      </Card>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card className="p-3.5 bg-card border-border">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
            <TrendingUp className="size-3" /> Average / mo
          </div>
          <div className="mt-1 font-display text-lg font-bold tabular-nums">{formatCurrency(stats.avg, currency)}</div>
        </Card>
        <Card className="p-3.5 bg-card border-border">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
            <Award className="size-3" /> Best month
          </div>
          <div className="mt-1 font-display text-lg font-bold tabular-nums">
            {stats.best ? formatCurrency(Number(stats.best.amount_saved), currency) : "—"}
          </div>
          <div className="text-[10px] text-muted-foreground">{stats.best ? format(parseISO(stats.best.month), "MMM yyyy") : ""}</div>
        </Card>
        <Card className="p-3.5 bg-card border-border">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
            <Gift className="size-3" /> Bonuses added
          </div>
          <div className="mt-1 font-display text-lg font-bold tabular-nums">{formatCurrency(stats.totalBonus, currency)}</div>
        </Card>
      </div>

      {savings.length === 0 ? (
        <Card className="p-8 text-center bg-card border-border">
          <div className="mx-auto size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center"><PiggyBank className="size-6" /></div>
          <p className="mt-3 text-sm text-muted-foreground">No completed months yet. Come back at the end of the month.</p>
        </Card>
      ) : (
        <Card className="divide-y divide-border bg-card border-border">
          {savings.map((s) => {
            const saved = Number(s.amount_saved);
            const bonus = Number((s as SavingRow).bonus ?? 0);
            const totalIncome = Number(s.salary_snapshot) + bonus;
            const rate = totalIncome > 0 ? (saved / totalIncome) * 100 : 0;
            return (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm flex items-center gap-2">
                    {format(parseISO(s.month), "MMMM yyyy")}
                    {bonus > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-[10px] px-1.5 py-0.5">
                        <Gift className="size-2.5" /> +{formatCurrency(bonus, currency)}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                    Salary {formatCurrency(Number(s.salary_snapshot), currency)} · Spent {formatCurrency(Number(s.total_spent), currency)}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-semibold tabular-nums ${saved >= 0 ? "text-primary" : "text-destructive"}`}>
                    {saved >= 0 ? "+" : ""}{formatCurrency(saved, currency)}
                  </div>
                  <div className="text-[10px] text-muted-foreground tabular-nums">{rate.toFixed(0)}% rate</div>
                </div>
                <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(s)} aria-label="Add bonus">
                  <Pencil className="size-3.5" />
                </Button>
              </div>
            );
          })}
        </Card>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Bonus for {editing ? format(parseISO(editing.month), "MMMM yyyy") : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Add any extra income for this month (bonus, refund, side income). It gets added to your salary when computing savings.</p>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={bonusVal}
              onChange={(e) => setBonusVal(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveBonus} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
