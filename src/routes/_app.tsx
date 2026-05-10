import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { LayoutDashboard, Plus, ListOrdered, BarChart3, Lightbulb, Wallet, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

const navItems = [
  { to: "/" as const, label: "Home", icon: LayoutDashboard },
  { to: "/expenses" as const, label: "Expenses", icon: ListOrdered },
  { to: "/add" as const, label: "Add", icon: Plus, prominent: true },
  { to: "/reports" as const, label: "Reports", icon: BarChart3 },
  { to: "/insights" as const, label: "Insights", icon: Lightbulb },
];

function AppLayout() {
  const { user, loading, signOut } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop side rail */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-border bg-card/50 px-4 py-6 md:flex">
        <div className="mb-8 flex items-center gap-2.5 px-2">
          <div className="size-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground">
            <Wallet className="size-5" />
          </div>
          <div>
            <div className="font-display text-lg font-bold tracking-tight">Spendr</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1">
          {navItems.map((it) => (
            <SideNavLink key={it.to} {...it} />
          ))}
        </nav>
        <div className="space-y-1 border-t border-border pt-4">
          <Link
            to="/settings"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Settings className="size-4" /> Settings
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={() => signOut().then(() => nav({ to: "/login" }))}
          >
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="md:ml-60 pb-24 md:pb-8">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <BottomNav />
    </div>
  );
}

function SideNavLink({ to, label, icon: Icon }: { to: string; label: string; icon: any }) {
  const location = useLocation();
  const active = location.pathname === to || (to !== "/" && location.pathname.startsWith(to));
  return (
    <Link
      to={to as any}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="size-4" /> {label}
    </Link>
  );
}

function BottomNav() {
  const location = useLocation();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-md md:hidden pb-safe">
      <div className="grid grid-cols-5">
        {navItems.map((it) => {
          const active = location.pathname === it.to;
          if (it.prominent) {
            return (
              <Link key={it.to} to={it.to as any} className="flex items-center justify-center py-2">
                <div className="-mt-6 size-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center ring-4 ring-background">
                  <it.icon className="size-6" />
                </div>
              </Link>
            );
          }
          return (
            <Link
              key={it.to}
              to={it.to as any}
              className={cn(
                "flex flex-col items-center gap-0.5 py-3 text-[10px] font-medium",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <it.icon className="size-5" />
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
