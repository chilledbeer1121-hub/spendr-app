import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Target, Check, X } from "lucide-react";
import { toast } from "sonner";

const STORAGE_KEY = "spendr.goal-reminder.lastShown";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Goal = { id: string; title: string; description: string | null };

export function DailyGoalReminder() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [alreadyDone, setAlreadyDone] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined") return;
    const today = todayStr();
    const last = window.localStorage.getItem(STORAGE_KEY);
    if (last === today) return;

    let cancelled = false;
    (async () => {
      const [{ data: g }, { data: c }] = await Promise.all([
        supabase.from("goals").select("id, title, description").order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
        supabase.from("goal_checkins").select("status").eq("date", today).maybeSingle(),
      ]);
      if (cancelled) return;
      const list = (g ?? []) as Goal[];
      if (list.length === 0) {
        // nothing to remind about; don't open
        return;
      }
      setGoals(list);
      setAlreadyDone(!!c?.status);
      setOpen(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  function markShown() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, todayStr());
    }
  }

  async function checkIn(status: "on_track" | "off_track") {
    if (!user || alreadyDone) {
      markShown();
      setOpen(false);
      return;
    }
    setSubmitting(true);
    const { error } = await supabase
      .from("goal_checkins")
      .upsert({ user_id: user.id, date: todayStr(), status }, { onConflict: "user_id,date" });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(status === "on_track" ? "Great — keep going!" : "Tomorrow's a new day. You've got this.");
    markShown();
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) markShown();
        setOpen(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
              <Target className="size-5" />
            </div>
            <DialogTitle>Your goals for today</DialogTitle>
          </div>
          <DialogDescription>
            A quick reminder of what you're working toward. How's it going so far?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-72 overflow-y-auto">
          {goals.map((g, i) => (
            <div key={g.id} className="rounded-lg border border-border p-3">
              <div className="text-xs text-muted-foreground">Goal {i + 1}</div>
              <div className="font-semibold">{g.title}</div>
              {g.description && (
                <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{g.description}</div>
              )}
            </div>
          ))}
        </div>

        {alreadyDone ? (
          <div className="text-sm text-muted-foreground text-center">
            You've already checked in today. ✨
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="default"
            disabled={submitting}
            onClick={() => checkIn("on_track")}
          >
            <Check className="size-4" /> I'm on track
          </Button>
          <Button
            variant="destructive"
            disabled={submitting}
            onClick={() => checkIn("off_track")}
          >
            <X className="size-4" /> I'm off track
          </Button>
        </div>

        <div className="text-center">
          <Link
            to="/goals"
            onClick={() => {
              markShown();
              setOpen(false);
            }}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Manage goals
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
