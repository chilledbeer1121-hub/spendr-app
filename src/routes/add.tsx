import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useProfile, useCategories, type Category } from "@/lib/expense-queries";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { CategoryDot } from "@/components/category-dot";
import { AppShell } from "@/components/app-shell";
import { currencySymbol } from "@/lib/format";
import { toast } from "sonner";
import { Plus, X, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/add")({
  component: () => <AppShell><AddExpense /></AppShell>,
  head: () => ({ meta: [{ title: "Add expense — Spendr" }] }),
});

const PAYMENT_MODES = ["UPI", "CARD", "CASH", "NET_BANKING", "EMI"] as const;
const PAYMENT_LABELS: Record<string, string> = { UPI: "UPI", CARD: "Card", CASH: "Cash", NET_BANKING: "Net Banking", EMI: "EMI" };
const TYPES = ["NEED", "WANT", "EMI", "INVESTMENT"] as const;
const SWATCHES = ["#3B82F6","#F59E0B","#8B5CF6","#EF4444","#10B981","#EC4899","#F97316","#6366F1","#7C3AED","#0EA5E9","#059669","#6B7280"];

function AddExpense() {
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useProfile(user?.id);
  const { data: categories = [] } = useCategories(user?.id);

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMode, setPaymentMode] = useState<typeof PAYMENT_MODES[number]>("UPI");
  const [note, setNote] = useState("");
  const [showNewCat, setShowNewCat] = useState(false);
  const [busy, setBusy] = useState(false);

  const symbol = currencySymbol(profile?.currency ?? "INR");

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId) return toast.error("Pick a category");
    if (!name.trim()) return toast.error("Add a name");
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    setBusy(true);
    const { error } = await supabase.from("expenses").insert({
      user_id: user!.id, category_id: categoryId, name: name.trim(), amount: amt, date, payment_mode: paymentMode, note: note.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    const cat = categories.find((c) => c.id === categoryId);
    toast.success(`${symbol}${amt.toLocaleString("en-IN")} added to ${cat?.name}`);
    qc.invalidateQueries({ queryKey: ["expenses"] });
    nav({ to: "/" });
  };

  return (
    <div className="px-4 pt-4 pb-4 md:px-8 md:pt-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-5">
        <Button variant="ghost" size="icon" onClick={() => nav({ to: "/" })} className="md:hidden">
          <ChevronLeft className="size-5" />
        </Button>
        <h1 className="font-display text-2xl font-bold">Log expense</h1>
      </div>

      <form onSubmit={onSave} className="space-y-5">
        <div>
          <Label className="mb-2 block">Category</Label>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {categories.map((c) => (
              <button key={c.id} type="button" onClick={() => setCategoryId(c.id)}
                className={cn("flex flex-col items-center gap-1.5 rounded-xl border p-2.5 transition-all",
                  categoryId === c.id ? "border-primary bg-primary/10 ring-2 ring-primary/20" : "border-border bg-card hover:border-muted-foreground/30")}>
                <CategoryDot color={c.color} icon={c.icon} size="md" />
                <span className="text-[11px] font-medium leading-tight text-center line-clamp-2">{c.name}</span>
              </button>
            ))}
            <button type="button" onClick={() => setShowNewCat(true)}
              className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border p-2.5 text-muted-foreground hover:text-foreground hover:border-primary/50">
              <div className="size-9 rounded-lg bg-muted flex items-center justify-center"><Plus className="size-4" /></div>
              <span className="text-[11px] font-medium">New</span>
            </button>
          </div>
        </div>

        {showNewCat && <NewCategoryInline onClose={() => setShowNewCat(false)} onCreated={(c) => { setShowNewCat(false); setCategoryId(c.id); qc.invalidateQueries({ queryKey: ["categories"] }); }} />}

        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" placeholder="e.g. Big Basket, Netflix" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="amount">Amount</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">{symbol}</span>
            <Input id="amount" type="number" inputMode="decimal" step="0.01" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="pl-8 h-14 text-2xl font-display font-bold tabular-nums" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Payment mode</Label>
            <div className="flex flex-wrap gap-1.5">
              {PAYMENT_MODES.map((m) => (
                <button key={m} type="button" onClick={() => setPaymentMode(m)}
                  className={cn("rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    paymentMode === m ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>
                  {PAYMENT_LABELS[m]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="note">Note (optional)</Label>
          <Textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Saving…" : "Save expense"}</Button>
      </form>
    </div>
  );
}

function NewCategoryInline({ onClose, onCreated }: { onClose: () => void; onCreated: (c: Category) => void }) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [type, setType] = useState<typeof TYPES[number]>("WANT");
  const [color, setColor] = useState(SWATCHES[0]);
  const [busy, setBusy] = useState(false);

  const onCreate = async () => {
    if (!name.trim()) return toast.error("Name?");
    setBusy(true);
    const { data, error } = await supabase.from("categories").insert({ user_id: user!.id, name: name.trim(), color, type, icon: "tag" }).select("*").single();
    setBusy(false);
    if (error) return toast.error(error.message);
    onCreated(data as Category);
  };

  return (
    <Card className="p-4 bg-card border-primary/30">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-sm">New category</h3>
        <Button type="button" variant="ghost" size="icon" onClick={onClose}><X className="size-4" /></Button>
      </div>
      <div className="space-y-3">
        <Input placeholder="Category name" value={name} onChange={(e) => setName(e.target.value)} />
        <div>
          <Label className="text-xs mb-1.5 block">Type</Label>
          <div className="flex flex-wrap gap-1.5">
            {TYPES.map((t) => (
              <button key={t} type="button" onClick={() => setType(t)}
                className={cn("rounded-full px-3 py-1.5 text-xs font-medium",
                  type === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{t}</button>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-xs mb-1.5 block">Color</Label>
          <div className="flex flex-wrap gap-1.5">
            {SWATCHES.map((s) => (
              <button key={s} type="button" onClick={() => setColor(s)}
                className={cn("size-7 rounded-full border-2 transition-all", color === s ? "border-foreground scale-110" : "border-transparent")}
                style={{ background: s }} />
            ))}
          </div>
        </div>
        <Button type="button" onClick={onCreate} disabled={busy} className="w-full">Create & select</Button>
      </div>
    </Card>
  );
}
