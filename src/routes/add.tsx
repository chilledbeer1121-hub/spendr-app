import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useProfile, useCategories, useCards, type Category } from "@/lib/expense-queries";
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

type Search = { edit?: string };

export const Route = createFileRoute("/add")({
  validateSearch: (s: Record<string, unknown>): Search => ({ edit: typeof s.edit === "string" ? s.edit : undefined }),
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
  const search = useSearch({ from: "/add" });
  const editId = search.edit;
  const { data: profile } = useProfile(user?.id);
  const { data: categories = [] } = useCategories(user?.id);
  const { data: cards = [] } = useCards(user?.id);

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMode, setPaymentMode] = useState<typeof PAYMENT_MODES[number]>("UPI");
  const [cardId, setCardId] = useState<string | null>(null);
  const [typeOverride, setTypeOverride] = useState<"NEED" | "WANT" | "EMI" | "INVESTMENT" | null>(null);
  const [note, setNote] = useState("");
  const [showNewCat, setShowNewCat] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadedEdit, setLoadedEdit] = useState(false);

  const symbol = currencySymbol(profile?.currency ?? "INR");
  const isEdit = !!editId;

  useEffect(() => {
    if (!editId || loadedEdit) return;
    (async () => {
      const { data } = await supabase.from("expenses").select("*").eq("id", editId).maybeSingle();
      if (data) {
        setCategoryId(data.category_id);
        setName(data.name);
        setAmount(String(data.amount));
        setDate(data.date);
        setPaymentMode(data.payment_mode);
        setCardId(data.card_id ?? null);
        setNote(data.note ?? "");
        setLoadedEdit(true);
      }
    })();
  }, [editId, loadedEdit]);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId) return toast.error("Pick a category");
    if (!name.trim()) return toast.error("Add a name");
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    if (paymentMode === "CARD" && !cardId && cards.length > 0) return toast.error("Pick which card");
    setBusy(true);
    const finalCardId = paymentMode === "CARD" ? cardId : null;
    const payload = { category_id: categoryId, name: name.trim(), amount: amt, date, payment_mode: paymentMode, note: note.trim() || null, card_id: finalCardId };
    const { error } = isEdit
      ? await supabase.from("expenses").update(payload).eq("id", editId!)
      : await supabase.from("expenses").insert({ ...payload, user_id: user!.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    const cat = categories.find((c) => c.id === categoryId);
    toast.success(isEdit ? "Expense updated" : `${symbol}${amt.toLocaleString("en-IN")} added to ${cat?.name}`);
    qc.invalidateQueries({ queryKey: ["expenses"] });
    nav({ to: isEdit ? "/expenses" : "/" });
  };

  return (
    <div className="px-4 pt-4 pb-4 md:px-8 md:pt-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-5">
        <Button variant="ghost" size="icon" onClick={() => nav({ to: isEdit ? "/expenses" : "/" })} className="md:hidden">
          <ChevronLeft className="size-5" />
        </Button>
        <h1 className="font-display text-2xl font-bold">{isEdit ? "Edit expense" : "Log expense"}</h1>
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

        {paymentMode === "CARD" && (
          <div className="space-y-1.5">
            <Label>Which card?</Label>
            {cards.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                No cards yet. <button type="button" className="text-primary font-medium underline" onClick={() => nav({ to: "/cards" })}>Add one →</button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {cards.map((c) => (
                  <button key={c.id} type="button" onClick={() => setCardId(c.id)}
                    className={cn("rounded-full px-3 py-1.5 text-xs font-medium transition-all flex items-center gap-1.5 border-2",
                      cardId === c.id ? "border-primary bg-primary/10" : "border-transparent bg-muted text-muted-foreground hover:text-foreground")}>
                    <span className="size-2 rounded-full" style={{ background: c.color }} />
                    {c.name}{c.last4 ? ` ••${c.last4}` : ""}
                  </button>
                ))}
              </div>
            )}
            {cardId && (
              <p className="text-[11px] text-muted-foreground">
                Charged to card · will be due on its next billing cycle (expense date saved as {date}).
              </p>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="note">Note (optional)</Label>
          <Textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Saving…" : isEdit ? "Update expense" : "Save expense"}</Button>
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
