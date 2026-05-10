import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { AppShell } from "@/components/app-shell";
import { Lightbulb } from "lucide-react";

export const Route = createFileRoute("/insights")({
  component: () => (
    <AppShell>
      <div className="px-4 pt-6 pb-4 md:px-8 md:pt-8 max-w-3xl mx-auto">
        <h1 className="font-display text-2xl font-bold mb-5">Insights</h1>
        <Card className="p-8 bg-card border-border text-center">
          <div className="mx-auto size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            <Lightbulb className="size-6" />
          </div>
          <h2 className="mt-3 font-display text-lg font-semibold">Add at least 1 month of expenses</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Once you have data logged, sharp observations about your spending habits will show up here.
          </p>
        </Card>
      </div>
    </AppShell>
  ),
  head: () => ({ meta: [{ title: "Insights — Spendr" }] }),
});
