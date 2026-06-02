import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/expense-queries";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppShell } from "@/components/app-shell";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { LogOut, Target } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  component: () => <AppShell><SettingsPage /></AppShell>,
  head: () => ({ meta: [{ title: "Settings — Spendr" }] }),
});

type BudgetMode = "daily" | "monthly" | "percent";

const SUGGESTED_PCTS = [
  { value: 10, label: "Lean", hint: "Aggressive saver" },
  { value: 15, label: "Balanced", hint: "Healthy default" },
  { value: 20, label: "Comfortable", hint: "Easy lifestyle" },
  { value: 30, label: "Generous", hint: "Spend freely" },
];

function SettingsPage() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useProfile(user?.id);

  const [name, setName] = useState("");
  const [salary, setSalary] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [busy, setBusy] = useState(false);

  // Daily budget controls
  const [budgetMode, setBudgetMode] = useState<BudgetMode>("daily");
  const [dailyInput, setDailyInput] = useState("");
  const [monthlyInput, setMonthlyInput] = useState("");
  const [percentInput, setPercentInput] = useState("");

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? "");
      setSalary(String(profile.monthly_salary ?? 0));
      setCurrency(profile.currency ?? "INR");
      setDailyInput(String(profile.daily_budget ?? 0));
    }
  }, [profile]);

  const salaryNum = parseFloat(salary) || 0;

  const computedDaily = useMemo(() => {
    if (budgetMode === "daily") return parseFloat(dailyInput) || 0;
    if (budgetMode === "monthly") return (parseFloat(monthlyInput) || 0) / 30;
    if (budgetMode === "percent") {
      const pct = parseFloat(percentInput) || 0;
      return (salaryNum * (pct / 100)) / 30;
    }
    return 0;
  }, [budgetMode, dailyInput, monthlyInput, percentInput, salaryNum]);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        name,
        monthly_salary: salaryNum,
        currency,
        daily_budget: Math.round(computedDaily * 100) / 100,
      })
      .eq("id", user!.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["profile"] });
  };

  return (
    <div className="px-4 pt-6 pb-4 md:px-8 md:pt-8 max-w-xl mx-auto space-y-4">
      <h1 className="font-display text-2xl font-bold mb-2">Settings</h1>

      <Card className="p-5 bg-card border-border space-y-4">
        <h2 className="font-semibold">Personal</h2>
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input value={user?.email ?? ""} disabled />
        </div>
      </Card>

      <Card className="p-5 bg-card border-border space-y-4">
        <h2 className="font-semibold">Finance</h2>
        <div className="space-y-1.5">
          <Label>Monthly take-home salary</Label>
          <Input type="number" inputMode="decimal" value={salary} onChange={(e) => setSalary(e.target.value)} />
          <p className="text-xs text-muted-foreground">Drives every percentage in the app.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Currency</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="INR">INR (₹)</SelectItem>
              <SelectItem value="USD">USD ($)</SelectItem>
              <SelectItem value="EUR">EUR (€)</SelectItem>
              <SelectItem value="GBP">GBP (£)</SelectItem>
              <SelectItem value="AED">AED (د.إ)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="p-5 bg-card border-border space-y-4">
        <div className="flex items-start gap-3">
          <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Target className="size-4" />
          </div>
          <div>
            <h2 className="font-semibold leading-tight">Daily discretionary budget</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Caps your day-to-day spends. <span className="font-medium">NEED</span> &amp; <span className="font-medium">EMI</span> categories are excluded — only the optional stuff counts.
            </p>
          </div>
        </div>

        <div role="tablist" className="inline-flex w-full rounded-lg bg-muted p-0.5 text-xs">
          {(["daily", "monthly", "percent"] as BudgetMode[]).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={budgetMode === m}
              onClick={() => setBudgetMode(m)}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 font-medium capitalize transition-colors",
                budgetMode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              {m === "percent" ? "% of salary" : m}
            </button>
          ))}
        </div>

        {budgetMode === "daily" && (
          <div className="space-y-1.5">
            <Label>Per-day amount</Label>
            <Input type="number" inputMode="decimal" value={dailyInput} onChange={(e) => setDailyInput(e.target.value)} placeholder="e.g. 500" />
          </div>
        )}
        {budgetMode === "monthly" && (
          <div className="space-y-1.5">
            <Label>Per-month amount (divided by 30)</Label>
            <Input type="number" inputMode="decimal" value={monthlyInput} onChange={(e) => setMonthlyInput(e.target.value)} placeholder="e.g. 15000" />
          </div>
        )}
        {budgetMode === "percent" && (
          <div className="space-y-2">
            <Label>Percent of monthly salary</Label>
            <Input type="number" inputMode="decimal" value={percentInput} onChange={(e) => setPercentInput(e.target.value)} placeholder="e.g. 15" />
            <div className="grid grid-cols-4 gap-1.5">
              {SUGGESTED_PCTS.map((s) => {
                const active = parseFloat(percentInput) === s.value;
                return (
                  <button
                    key={s.value}
                    onClick={() => setPercentInput(String(s.value))}
                    className={cn(
                      "rounded-md border px-2 py-1.5 text-left transition-colors",
                      active ? "border-primary bg-primary/10" : "border-border hover:bg-muted",
                    )}
                  >
                    <div className="text-xs font-semibold tabular-nums">{s.value}%</div>
                    <div className="text-[10px] text-muted-foreground leading-tight">{s.label}</div>
                  </button>
                );
              })}
            </div>
            {salaryNum === 0 && (
              <p className="text-[11px] text-warning">Set a salary above to use percentage mode.</p>
            )}
          </div>
        )}

        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Effective daily limit</span>
            <span className="font-display text-base font-bold tabular-nums text-foreground">
              {formatCurrency(computedDaily, currency)}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
            <span>≈ {formatCurrency(computedDaily * 30, currency)} / month</span>
            {salaryNum > 0 && (
              <span>{((computedDaily * 30) / salaryNum * 100).toFixed(1)}% of salary</span>
            )}
          </div>
        </div>

        <Button onClick={save} disabled={busy} className="w-full">{busy ? "Saving…" : "Save changes"}</Button>
      </Card>

      <Card className="p-5 bg-card border-border">
        <Button variant="ghost" className="w-full justify-start text-destructive hover:text-destructive" onClick={() => signOut().then(() => nav({ to: "/login" }))}>
          <LogOut className="size-4" /> Sign out
        </Button>
      </Card>
    </div>
  );
}
