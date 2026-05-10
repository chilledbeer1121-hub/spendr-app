import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/expense-queries";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { LogOut } from "lucide-react";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Settings — Spendr" }] }),
});

function SettingsPage() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useProfile(user?.id);

  const [name, setName] = useState("");
  const [salary, setSalary] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? "");
      setSalary(String(profile.monthly_salary ?? 0));
      setCurrency(profile.currency ?? "INR");
    }
  }, [profile]);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ name, monthly_salary: parseFloat(salary) || 0, currency })
      .eq("id", user!.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["profile"] });
  };

  return (
    <div className="px-4 pt-6 pb-4 md:px-8 md:pt-8 max-w-xl mx-auto space-y-4">
      <h1 className="font-display text-2xl font-bold mb-2">Settings</h1>

      <Card className="p-5 bg-card border-border space-y-4">
        <h2 className="font-semibold">Personal</h2>
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input value={user?.email ?? ""} disabled />
        </div>
      </Card>

      <Card className="p-5 bg-card border-border space-y-4">
        <h2 className="font-semibold">Finance</h2>
        <div className="space-y-1.5">
          <Label>Monthly take-home salary</Label>
          <Input type="number" inputMode="decimal" value={salary} onChange={(e) => setSalary(e.target.value)} />
          <p className="text-xs text-muted-foreground">Drives every percentage in the app.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Currency</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="INR">INR (₹)</SelectItem>
              <SelectItem value="USD">USD ($)</SelectItem>
              <SelectItem value="EUR">EUR (€)</SelectItem>
              <SelectItem value="GBP">GBP (£)</SelectItem>
              <SelectItem value="AED">AED (د.إ)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={save} disabled={busy} className="w-full">
          {busy ? "Saving…" : "Save changes"}
        </Button>
      </Card>

      <Card className="p-5 bg-card border-border">
        <Button
          variant="ghost"
          className="w-full justify-start text-destructive hover:text-destructive"
          onClick={() => signOut().then(() => nav({ to: "/login" }))}
        >
          <LogOut className="size-4" /> Sign out
        </Button>
      </Card>
    </div>
  );
}
