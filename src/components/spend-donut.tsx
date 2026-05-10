import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/format";

type Slice = { id: string; name: string; amount: number; color: string };

export function SpendDonut({
  data,
  centerLabel,
  centerSub,
  currency = "INR",
}: {
  data: Slice[];
  centerLabel: string;
  centerSub?: string;
  currency?: string;
}) {
  return (
    <div className="relative">
      <div className="h-56 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="amount"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="62%"
              outerRadius="92%"
              paddingAngle={2}
              stroke="none"
            >
              {data.map((s) => (
                <Cell key={s.id} fill={s.color} />
              ))}
            </Pie>
            <Tooltip
              cursor={false}
              contentStyle={{
                background: "var(--color-popover)",
                border: "1px solid var(--color-border)",
                borderRadius: 10,
                fontSize: 12,
              }}
              formatter={(value: any, name) => [formatCurrency(Number(value), currency), name]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-display text-xl sm:text-2xl font-bold tabular-nums">{centerLabel}</div>
        {centerSub && <div className="text-[11px] text-muted-foreground mt-0.5">{centerSub}</div>}
      </div>
      {/* Legend */}
      <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        {data.slice(0, 6).map((s) => (
          <div key={s.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-2.5 rounded-full" style={{ background: s.color }} />
            <span className="truncate max-w-[100px]">{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
