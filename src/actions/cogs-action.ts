"use server";

import {
  addCogsPeriod as _add,
  updateCogsPeriod as _update,
  deleteCogsPeriod as _delete,
  setProductCost as _setCost,
  setProductVat as _setVat,
} from "./cogs";

export async function addCogsPeriod(
  ...args: Parameters<typeof _add>
) {
  return _add(...args);
}

export async function updateCogsPeriod(
  ...args: Parameters<typeof _update>
) {
  return _update(...args);
}

export async function deleteCogsPeriod(
  ...args: Parameters<typeof _delete>
) {
  return _delete(...args);
}

export async function setProductCost(
  ...args: Parameters<typeof _setCost>
) {
  return _setCost(...args);
}

export async function setProductVat(
  ...args: Parameters<typeof _setVat>
) {
  return _setVat(...args);
}

export async function setProductActive(
  sku: string,
  active: boolean
): Promise<{ success: boolean; error?: string }> {
  const { createServiceClient } = await import("@/lib/supabase/service");
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("products")
    .update({ active })
    .eq("sku", sku);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function setProductsActive(
  skus: string[],
  active: boolean
): Promise<{ success: boolean; error?: string }> {
  if (skus.length === 0) return { success: true };
  const { createServiceClient } = await import("@/lib/supabase/service");
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("products")
    .update({ active })
    .in("sku", skus);
  if (error) return { success: false, error: error.message };
  return { success: true };
}
