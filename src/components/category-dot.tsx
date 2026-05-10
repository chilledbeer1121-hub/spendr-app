import * as Icons from "lucide-react";
import { cn } from "@/lib/utils";

export function CategoryDot({ color, icon, size = "sm" }: { color: string; icon: string; size?: "sm" | "md" | "lg" }) {
  // Convert kebab-case icon name to PascalCase for lucide
  const iconName = icon
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
  const Icon = (Icons as any)[iconName] ?? Icons.Tag;

  const sizeCls =
    size === "lg" ? "size-12" : size === "md" ? "size-9" : "size-9";
  const iconCls = size === "lg" ? "size-6" : size === "md" ? "size-4" : "size-4";

  return (
    <div
      className={cn("rounded-xl flex items-center justify-center shrink-0", sizeCls)}
      style={{ background: `${color}22`, color }}
    >
      <Icon className={iconCls} />
    </div>
  );
}
