import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { runMaintenance } from "@/lib/maintenance";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Plus, ListOrdered, BarChart3, Lightbulb, Wallet, Settings, LogOut,
  MoreHorizontal, Repeat, BookHeart, PiggyBank, CreditCard as CreditCardIcon,
  PanelLeftClose, PanelLeftOpen, Network, Gauge, TrendingUp, Target, CalendarDays, Utensils,
} from "lucide-react";


const primaryNav = [
  { to: "/", label: "Home", icon: LayoutDashboard },
  { to: "/expenses", label: "Expenses", icon: ListOrdered },
  { to: "/add", label: "Add", icon: Plus, prominent: true as const },
  { to: "/reports", label: "Reports", icon: BarChart3 },
] as const;

const moreNav = [
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/cheat-meals", label: "Cheat meals", icon: Utensils },
  { to: "/progress", label: "Progress", icon: Gauge },
  { to: "/goals", label: "Goals", icon: Target },
  { to: "/visualization", label: "Visualization", icon: Network },
  { to: "/cards", label: "Cards", icon: CreditCardIcon },
  { to: "/recurring", label: "Recurring (EMIs)", icon: Repeat },
  { to: "/investing", label: "Investing", icon: TrendingUp },
  { to: "/memory", label: "Money Memory", icon: BookHeart },
  { to: "/savings", label: "Savings", icon: PiggyBank },
  { to: "/insights", label: "Insights", icon: Lightbulb },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const SIDEBAR_KEY = "spendr.sidebar.collapsed";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SIDEBAR_KEY) === "1";
  });

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  useEffect(() => {
    if (user) void runMaintenance(user.id);
  }, [user]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
    }
  }, [collapsed]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!user) return null;

  const allDesktop = [...primaryNav, ...moreNav];

  return (
    <TooltipProvider delayDuration={150}>
      <div className="min-h-screen bg-background text-foreground">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-20 hidden flex-col border-r border-border bg-card/50 py-6 md:flex transition-[width] duration-200",
            collapsed ? "w-16 px-2" : "w-60 px-4"
          )}
        >
          <div className={cn("mb-8 flex items-center gap-2.5", collapsed ? "justify-center px-0" : "px-2")}>
            <div className="size-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shrink-0">
              <Wallet className="size-5" />
            </div>
            {!collapsed && <div className="font-display text-lg font-bold tracking-tight">Spendr</div>}
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden">
            {allDesktop.filter((it) => it.to !== "/settings").map((it) => {
              const active = location.pathname === it.to;
              const link = (
                <Link
                  key={it.to}
                  to={it.to}
                  className={cn(
                    "flex items-center gap-3 rounded-lg text-sm font-medium transition-colors",
                    collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2",
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <it.icon className="size-4 shrink-0" />
                  {!collapsed && <span className="truncate">{it.label}</span>}
                </Link>
              );
              return collapsed ? (
                <Tooltip key={it.to}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{it.label}</TooltipContent>
                </Tooltip>
              ) : link;
            })}
          </nav>
          <div className="space-y-1 border-t border-border pt-4">
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link to="/settings" className="flex items-center justify-center rounded-lg py-2.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                    <Settings className="size-4" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">Settings</TooltipContent>
              </Tooltip>
            ) : (
              <Link to="/settings" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                <Settings className="size-4" /> Settings
              </Link>
            )}
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => signOut().then(() => nav({ to: "/login" }))}
                    className="flex w-full items-center justify-center rounded-lg py-2.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <LogOut className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Sign out</TooltipContent>
              </Tooltip>
            ) : (
              <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={() => signOut().then(() => nav({ to: "/login" }))}>
                <LogOut className="size-4" /> Sign out
              </Button>
            )}
            <button
              onClick={() => setCollapsed((c) => !c)}
              className={cn(
                "mt-1 flex w-full items-center gap-3 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
                collapsed ? "justify-center py-2.5" : "px-3 py-2"
              )}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
              {!collapsed && <span>Collapse</span>}
            </button>
          </div>
        </aside>

        <main className={cn("pb-24 md:pb-8 transition-[margin] duration-200", collapsed ? "md:ml-16" : "md:ml-60")}>
          {children}
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-md md:hidden pb-safe">
          <div className="grid grid-cols-5">
            {primaryNav.map((it) => {
              const active = location.pathname === it.to;
              if ("prominent" in it && it.prominent) {
                return (
                  <Link key={it.to} to={it.to} className="flex items-center justify-center py-2">
                    <div className="-mt-6 size-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center ring-4 ring-background">
                      <it.icon className="size-6" />
                    </div>
                  </Link>
                );
              }
              return (
                <Link key={it.to} to={it.to} className={cn("flex flex-col items-center gap-0.5 py-3 text-[10px] font-medium", active ? "text-primary" : "text-muted-foreground")}>
                  <it.icon className="size-5" />
                  {it.label}
                </Link>
              );
            })}
            <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
              <SheetTrigger asChild>
                <button className="flex flex-col items-center gap-0.5 py-3 text-[10px] font-medium text-muted-foreground">
                  <MoreHorizontal className="size-5" />
                  More
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-2xl">
                <SheetHeader className="text-left mb-3">
                  <SheetTitle>More</SheetTitle>
                </SheetHeader>
                <div className="grid gap-1 pb-6">
                  {moreNav.map((it) => (
                    <Link
                      key={it.to}
                      to={it.to}
                      onClick={() => setMoreOpen(false)}
                      className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium hover:bg-muted"
                    >
                      <div className="size-9 rounded-lg bg-muted flex items-center justify-center">
                        <it.icon className="size-4" />
                      </div>
                      {it.label}
                    </Link>
                  ))}
                  <button
                    className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-muted text-left"
                    onClick={() => { setMoreOpen(false); signOut().then(() => nav({ to: "/login" })); }}
                  >
                    <div className="size-9 rounded-lg bg-muted flex items-center justify-center">
                      <LogOut className="size-4" />
                    </div>
                    Sign out
                  </button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </nav>
        
      </div>
    </TooltipProvider>
  );
}
