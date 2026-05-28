import { useSpendView, type SpendView } from "@/lib/payable";
import { cn } from "@/lib/utils";
import { Wallet, CalendarClock } from "lucide-react";

const OPTIONS: { key: SpendView; label: string; short: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "spent", label: "Spent", short: "Spent", icon: Wallet },
  { key: "payable", label: "Payable", short: "Payable", icon: CalendarClock },
];

export function SpendViewToggle({ className }: { className?: string }) {
  const [view, setView] = useSpendView();
  return (
    <div
      role="tablist"
      aria-label="View mode"
      className={cn("inline-flex items-center rounded-full bg-muted p-0.5 text-xs", className)}
    >
      {OPTIONS.map((o) => {
        const Icon = o.icon;
        const active = view === o.key;
        return (
          <button
            key={o.key}
            role="tab"
            aria-selected={active}
            onClick={() => setView(o.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium transition-colors",
              active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
            title={o.key === "payable" ? "Cards counted on their due date" : "Cards counted on the purchase date"}
          >
            <Icon className="size-3.5" />
            {o.short}
          </button>
        );
      })}
    </div>
  );
}
