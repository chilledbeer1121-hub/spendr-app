import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { AppShell } from "@/components/app-shell";
import { BarChart3 } from "lucide-react";

export const Route = createFileRoute("/reports")({
  component: () => (
    <AppShell>
      <div className="px-4 pt-6 pb-4 md:px-8 md:pt-8 max-w-3xl mx-auto">
        <h1 className="font-display text-2xl font-bold mb-5">Reports</h1>
        <Card className="p-8 bg-card border-border text-center">
          <div className="mx-auto size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            <BarChart3 className="size-6" />
          </div>
          <h2 className="mt-3 font-display text-lg font-semibold">Reports coming next</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Spend by category, monthly trends, payment-mode breakdown, and need vs want analysis.
          </p>
        </Card>
      </div>
    </AppShell>
  ),
  head: () => ({ meta: [{ title: "Reports — Spendr" }] }),
});
