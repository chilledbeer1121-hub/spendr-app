import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Target, Trash2, ChevronLeft, ChevronRight, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/goals")({
  component: GoalsPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6">Not found</div>,
});

type Goal = { id: string; title: string; description: string | null; sort_order: number };
type Checkin = { date: string; status: "on_track" | "off_track" };

function GoalsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const userId = user?.id;

  const goalsQ = useQuery({
    queryKey: ["goals", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals")
        .select("id, title, description, sort_order")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Goal[];
    },
  });

  const checkinsQ = useQuery({
    queryKey: ["goal_checkins", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goal_checkins")
        .select("date, status")
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Checkin[];
    },
  });

  const goals = goalsQ.data ?? [];
  const checkins = checkinsQ.data ?? [];

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const canAdd = goals.length < 3;

  async function addGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !title.trim()) return;
    if (!canAdd) {
      toast.error("You can only have up to 3 goals.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("goals").insert({
      user_id: userId,
      title: title.trim(),
      description: desc.trim() || null,
      sort_order: goals.length,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setTitle("");
    setDesc("");
    goalsQ.refetch();
    router.invalidate();
  }

  async function deleteGoal(id: string) {
    const { error } = await supabase.from("goals").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    goalsQ.refetch();
  }

  const checkinMap = useMemo(() => {
    const m = new Map<string, "on_track" | "off_track">();
    checkins.forEach((c) => m.set(c.date, c.status));
    return m;
  }, [checkins]);

  const onCount = checkins.filter((c) => c.status === "on_track").length;
  const offCount = checkins.length - onCount;
  const total = checkins.length;
  const onPct = total > 0 ? Math.round((onCount / total) * 100) : 0;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6 space-y-6">
      <header className="flex items-center gap-3">
        <div className="size-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
          <Target className="size-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Goals</h1>
          <p className="text-sm text-muted-foreground">
            Up to 3 focus goals. We'll remind you each day to check in.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your goals ({goals.length}/3)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {goals.map((g) => (
            <div key={g.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <div className="font-semibold">{g.title}</div>
                {g.description && (
                  <div className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap">{g.description}</div>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={() => deleteGoal(g.id)} aria-label="Delete goal">
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          {goals.length === 0 && (
            <div className="text-sm text-muted-foreground">No goals yet — add your first one below.</div>
          )}

          {canAdd && (
            <form onSubmit={addGoal} className="space-y-3 pt-3 border-t border-border">
              <div className="space-y-1.5">
                <Label htmlFor="g-title">Goal title</Label>
                <Input
                  id="g-title"
                  value={title}
                  maxLength={100}
                  placeholder="e.g. Save ₹50,000 by Dec"
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="g-desc">Short description (optional)</Label>
                <Textarea
                  id="g-desc"
                  value={desc}
                  maxLength={280}
                  rows={2}
                  placeholder="Why this matters to you…"
                  onChange={(e) => setDesc(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={saving || !title.trim()}>
                Add goal
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="On-track days" value={onCount} tone="primary" />
        <StatCard label="Off-track days" value={offCount} tone="destructive" />
        <StatCard label="On-track rate" value={`${onPct}%`} tone="muted" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Check-in history</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="month">
            <TabsList>
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="year">Year</TabsTrigger>
            </TabsList>
            <TabsContent value="month" className="mt-4">
              <MonthCalendar checkinMap={checkinMap} />
            </TabsContent>
            <TabsContent value="year" className="mt-4">
              <YearCalendar checkinMap={checkinMap} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number | string; tone: "primary" | "destructive" | "muted" }) {
  const toneClasses =
    tone === "primary"
      ? "text-primary"
      : tone === "destructive"
      ? "text-destructive"
      : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={cn("mt-1 text-2xl font-bold", toneClasses)}>{value}</div>
      </CardContent>
    </Card>
  );
}

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function MonthCalendar({ checkinMap }: { checkinMap: Map<string, "on_track" | "off_track"> }) {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  const startDow = first.getDay(); // 0 = Sun

  const cells: Array<{ date: Date | null }> = [];
  for (let i = 0; i < startDow; i++) cells.push({ date: null });
  for (let d = 1; d <= lastDay; d++) cells.push({ date: new Date(year, month, d) });
  while (cells.length % 7 !== 0) cells.push({ date: null });

  const monthLabel = cursor.toLocaleString("default", { month: "long", year: "numeric" });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <Button variant="ghost" size="icon" onClick={() => setCursor(new Date(year, month - 1, 1))}>
          <ChevronLeft className="size-4" />
        </Button>
        <div className="font-semibold">{monthLabel}</div>
        <Button variant="ghost" size="icon" onClick={() => setCursor(new Date(year, month + 1, 1))}>
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground mb-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) => {
          if (!c.date) return <div key={i} className="aspect-square" />;
          const key = ymd(c.date);
          const st = checkinMap.get(key);
          const isToday = ymd(today) === key;
          return (
            <div
              key={i}
              className={cn(
                "aspect-square rounded-md flex flex-col items-center justify-center text-xs border",
                st === "on_track" && "bg-primary/15 border-primary/40 text-primary",
                st === "off_track" && "bg-destructive/15 border-destructive/40 text-destructive",
                !st && "bg-muted/30 border-border text-muted-foreground",
                isToday && "ring-2 ring-ring",
              )}
              title={st === "on_track" ? "On track" : st === "off_track" ? "Off track" : "No check-in"}
            >
              <span className="font-semibold">{c.date.getDate()}</span>
              {st === "on_track" && <Check className="size-3" />}
              {st === "off_track" && <X className="size-3" />}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
        <Legend className="bg-primary/15 border-primary/40" label="On track" />
        <Legend className="bg-destructive/15 border-destructive/40" label="Off track" />
        <Legend className="bg-muted/30 border-border" label="No check-in" />
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn("size-3 rounded-sm border", className)} />
      <span>{label}</span>
    </div>
  );
}

function YearCalendar({ checkinMap }: { checkinMap: Map<string, "on_track" | "off_track"> }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <Button variant="ghost" size="icon" onClick={() => setYear((y) => y - 1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <div className="font-semibold">{year}</div>
        <Button variant="ghost" size="icon" onClick={() => setYear((y) => y + 1)}>
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 12 }).map((_, m) => (
          <MiniMonth key={m} year={year} month={m} checkinMap={checkinMap} today={today} />
        ))}
      </div>
    </div>
  );
}

function MiniMonth({ year, month, checkinMap, today }: { year: number; month: number; checkinMap: Map<string, "on_track" | "off_track">; today: Date }) {
  const first = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  const startDow = first.getDay();
  const cells: Array<Date | null> = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= lastDay; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs font-semibold mb-2">
        {first.toLocaleString("default", { month: "long" })}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="aspect-square" />;
          const key = ymd(d);
          const st = checkinMap.get(key);
          const isToday = ymd(today) === key;
          return (
            <div
              key={i}
              className={cn(
                "aspect-square rounded-sm",
                st === "on_track" && "bg-primary/60",
                st === "off_track" && "bg-destructive/60",
                !st && "bg-muted",
                isToday && "ring-1 ring-ring",
              )}
              title={`${key}${st ? " — " + (st === "on_track" ? "On track" : "Off track") : ""}`}
            />
          );
        })}
      </div>
    </div>
  );
}
