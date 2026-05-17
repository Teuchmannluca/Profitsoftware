import { createServiceClient } from "@/lib/supabase/service";

export async function addCogsPeriod(data: {
  asin: string;
  unitCost: number;
  prepCost: number;
  validFrom: string;
  notes?: string;
}): Promise<{ success: boolean; error?: string }> {
  "use server";

  const supabase = createServiceClient();

  const { error } = await supabase.from("cogs_periods").insert({
    asin: data.asin,
    unit_cost: data.unitCost,
    prep_cost: data.prepCost,
    valid_from: data.validFrom,
    notes: data.notes || null,
  });

  if (error) {
    console.error("[cogs] addCogsPeriod error:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function updateCogsPeriod(
  id: string,
  data: { unitCost: number; prepCost: number; notes?: string }
): Promise<{ success: boolean; error?: string }> {
  "use server";

  const supabase = createServiceClient();

  const { error } = await supabase
    .from("cogs_periods")
    .update({
      unit_cost: data.unitCost,
      prep_cost: data.prepCost,
      notes: data.notes ?? null,
    })
    .eq("id", id);

  if (error) {
    console.error("[cogs] updateCogsPeriod error:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function deleteCogsPeriod(
  id: string
): Promise<{ success: boolean; error?: string }> {
  "use server";

  const supabase = createServiceClient();

  const { error } = await supabase.from("cogs_periods").delete().eq("id", id);

  if (error) {
    console.error("[cogs] deleteCogsPeriod error:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true };
}
