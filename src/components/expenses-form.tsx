"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Power, PowerOff } from "lucide-react";
import { addExpense, updateExpense, deleteExpense, type Expense } from "@/actions/expenses";

const frequencyLabels: Record<string, string> = {
  monthly: "Monthly",
  weekly: "Weekly",
  yearly: "Yearly",
  one_off: "One-off",
};

function dailyRate(amount: number, frequency: string): number {
  switch (frequency) {
    case "monthly": return amount / 30.44;
    case "weekly": return amount / 7;
    case "yearly": return amount / 365.25;
    default: return 0;
  }
}

export function ExpensesForm({ initialExpenses }: { initialExpenses: Expense[] }) {
  const router = useRouter();
  const [expenses, setExpenses] = useState(initialExpenses);
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState("monthly");

  const totalMonthly = expenses
    .filter((e) => e.active)
    .reduce((sum, e) => sum + dailyRate(e.amount, e.frequency) * 30.44, 0);

  async function handleAdd() {
    if (!name.trim() || !amount.trim()) return;
    setBusy("add");
    const result = await addExpense({
      name: name.trim(),
      amount: parseFloat(amount),
      frequency,
      startDate: new Date().toISOString().slice(0, 10),
    });
    if (result.success) {
      setName("");
      setAmount("");
      setShowAdd(false);
      router.refresh();
    }
    setBusy(null);
  }

  async function handleToggle(expense: Expense) {
    setBusy(expense.id);
    await updateExpense(expense.id, { active: !expense.active });
    setExpenses((prev) =>
      prev.map((e) => (e.id === expense.id ? { ...e, active: !e.active } : e))
    );
    setBusy(null);
  }

  async function handleDelete(id: string) {
    setBusy(id);
    await deleteExpense(id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    setBusy(null);
  }

  return (
    <Card className="shadow-card ring-1 ring-border/50">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Business Expenses</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Recurring costs deducted from profit · ~£{totalMonthly.toFixed(0)}/month
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAdd(!showAdd)}
            className="h-8 text-xs"
          >
            <Plus className="h-3 w-3 mr-1" /> Add Expense
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {showAdd && (
          <div className="flex flex-wrap items-end gap-2 p-3 rounded-lg bg-muted/50 ring-1 ring-border/50">
            <div className="flex-1 min-w-[140px]">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Amazon Subscription"
                className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
              />
            </div>
            <div className="w-24">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Amount (£)</label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="30.00"
                className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm font-mono"
              />
            </div>
            <div className="w-28">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Frequency</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
              >
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="yearly">Yearly</option>
                <option value="one_off">One-off</option>
              </select>
            </div>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={busy === "add" || !name.trim() || !amount.trim()}
              className="h-8 text-xs"
            >
              {busy === "add" ? "Saving..." : "Save"}
            </Button>
          </div>
        )}

        {expenses.length === 0 && !showAdd && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No expenses yet. Add your first recurring expense above.
          </p>
        )}

        {expenses.map((expense) => (
          <div
            key={expense.id}
            className={`flex items-center justify-between p-3 rounded-lg ring-1 ring-border/50 transition-opacity ${
              expense.active ? "bg-card" : "bg-muted/30 opacity-60"
            }`}
          >
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${!expense.active ? "line-through" : ""}`}>
                {expense.name}
              </p>
              <p className="text-xs text-muted-foreground">
                £{expense.amount.toFixed(2)} / {frequencyLabels[expense.frequency]}
                {expense.frequency !== "one_off" && (
                  <span className="text-muted-foreground/60">
                    {" "}· £{dailyRate(expense.amount, expense.frequency).toFixed(2)}/day
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleToggle(expense)}
                disabled={busy === expense.id}
                className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
                title={expense.active ? "Pause" : "Activate"}
              >
                {expense.active ? (
                  <Power className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <PowerOff className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
              <button
                onClick={() => handleDelete(expense.id)}
                disabled={busy === expense.id}
                className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-500" />
              </button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
