import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useExpenses, useCategories, useProfile, useCards } from "@/lib/expense-queries";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/format";
import { exportExpensesPDF } from "@/lib/pdf";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CategoryDot } from "@/components/category-dot";
import { AppShell } from "@/components/app-shell";
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { MoreVertical, Pencil, Trash2, FileDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/expenses")({
  component: () => <AppShell><ExpensesPage /></AppShell>,
  head: () => ({ meta: [{ title: "Expenses — Spendr" }] }),
});

type RangeKey = "this_month" | "last_month" | "last_3" | "all";
const RANGES: { key: RangeKey; label: string }[] = [
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "last_3", label: "3 months" },
  { key: "all", label: "All" },
];

function range(key: RangeKey): { from?: Date; to?: Date; label: string } {
  const now = new Date();
  if (key === "this_month") return { from: startOfMonth(now), to: endOfMonth(now), label: format(now, "MMMM yyyy") };
  if (key === "last_month") { const lm = subMonths(now, 1); return { from: startOfMonth(lm), to: endOfMonth(lm), label: format(lm, "MMMM yyyy") }; }
  if (key === "last_3") return { from: startOfMonth(subMonths(now, 2)), to: endOfMonth(now), label: "Last 3 months" };
  return { label: "All time" };
}

function ExpensesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [rangeKey, setRangeKey] = useState<RangeKey>("this_month");
  const r = range(rangeKey);
  const { data: profile } = useProfile(user?.id);
  const { data: expenses = [] } = useExpenses(user?.id, { from: r.from, to: r.to });
  const { data: categories = [] } = useCategories(user?.id);
  const currency = profile?.currency ?? "INR";
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  const onDelete = async (id: string) => {
    if (!confirm("Delete this expense?")) return;
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Expense deleted");
    qc.invalidateQueries({ queryKey: ["expenses"] });
  };

  const onExport = () => {
    if (!profile) return;
    if (expenses.length === 0) return toast.error("Nothing to export");
    exportExpensesPDF({
      expenses, categories, profile,
      rangeLabel: r.label,
      fileName: `Spendr-${r.label.replace(/\s+/g, "-")}.pdf`,
    });
    toast.success("PDF generated");
  };

  return (
    <div className="px-4 pt-6 pb-4 md:px-8 md:pt-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4 gap-2">
        <h1 className="font-display text-2xl font-bold">Expenses</h1>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onExport}><FileDown className="size-4" /> PDF</Button>
          <Link to="/add" className="inline-flex"><Button size="sm"><Plus className="size-4" /> Add</Button></Link>
        </div>
      </div>

      <div className="-mx-4 px-4 mb-4 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {RANGES.map((rg) => (
            <button key={rg.key} onClick={() => setRangeKey(rg.key)}
              className={cn("rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
                rangeKey === rg.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>
              {rg.label}
            </button>
          ))}
        </div>
      </div>

      <Card className="p-4 mb-4 bg-card border-border">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-xs text-muted-foreground">{r.label}</div>
            <div className="font-display text-2xl font-bold tabular-nums">{formatCurrency(total, currency)}</div>
          </div>
          <div className="text-xs text-muted-foreground">{expenses.length} expenses</div>
        </div>
      </Card>

      {expenses.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground bg-card border-border">
          Nothing here. <Link to="/add" className="text-primary font-medium">Log your first expense →</Link>
        </Card>
      ) : (
        <Card className="divide-y divide-border bg-card border-border">
          {expenses.map((e) => {
            const c = categories.find((c) => c.id === e.category_id);
            return (
              <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                <CategoryDot color={c?.color ?? "#64748b"} icon={c?.icon ?? "tag"} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <div className="font-medium text-sm truncate">{e.name}</div>
                    {e.recurring_id && <span className="text-[9px] uppercase tracking-wider text-primary bg-primary/10 rounded-full px-1.5 py-0.5">Auto</span>}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {format(parseISO(e.date), "MMM d")} · {c?.name} · {e.payment_mode}
                  </div>
                </div>
                <div className="text-sm font-semibold tabular-nums">{formatCurrency(Number(e.amount), currency)}</div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8 text-muted-foreground"><MoreVertical className="size-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => nav({ to: "/add", search: { edit: e.id } })}>
                      <Pencil className="size-4" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDelete(e.id)} className="text-destructive focus:text-destructive">
                      <Trash2 className="size-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
