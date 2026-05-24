"use server";

import { createServiceClient } from "@/lib/supabase/service";
import { requireAuth } from "@/lib/auth-guard";

export interface Expense {
  id: string;
  name: string;
  amount: number;
  frequency: "monthly" | "weekly" | "yearly" | "one_off";
  start_date: string;
  end_date: string | null;
  active: boolean;
  notes: string | null;
}

export async function getExpenses(): Promise<Expense[]> {
  await requireAuth();
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("expenses")
    .select("id, name, amount, frequency, start_date, end_date, active, notes")
    .order("active", { ascending: false })
    .order("name", { ascending: true });

  return (data ?? []).map((r) => ({
    ...r,
    amount: Number(r.amount),
  }));
}

export async function addExpense(data: {
  name: string;
  amount: number;
  frequency: string;
  startDate: string;
  notes?: string;
}): Promise<{ success: boolean; error?: string }> {
  await requireAuth();
  const supabase = createServiceClient();
  const { error } = await supabase.from("expenses").insert({
    name: data.name,
    amount: data.amount,
    frequency: data.frequency,
    start_date: data.startDate,
    notes: data.notes || null,
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function updateExpense(
  id: string,
  data: { name?: string; amount?: number; active?: boolean; notes?: string }
): Promise<{ success: boolean; error?: string }> {
  await requireAuth();
  const supabase = createServiceClient();
  const update: Record<string, unknown> = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.amount !== undefined) update.amount = data.amount;
  if (data.active !== undefined) update.active = data.active;
  if (data.notes !== undefined) update.notes = data.notes || null;

  const { error } = await supabase.from("expenses").update(update).eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deleteExpense(id: string): Promise<{ success: boolean; error?: string }> {
  await requireAuth();
  const supabase = createServiceClient();
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}
