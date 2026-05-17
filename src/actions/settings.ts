import { createServiceClient } from "@/lib/supabase/service";

export interface BusinessSettings {
  vat_status: string;
  vat_rate: number;
  vat_registration_number: string | null;
  vat_registration_date: string | null;
  amazon_vat_activation_date: string | null;
  vat_deregistration_date: string | null;
  flat_rate_percentage: number | null;
  exemption_period_start: string | null;
  exemption_period_end: string | null;
  business_name: string | null;
  business_email: string | null;
}

const DEFAULT_SETTINGS: BusinessSettings = {
  vat_status: "standard",
  vat_rate: 0.2,
  vat_registration_number: null,
  vat_registration_date: null,
  amazon_vat_activation_date: null,
  vat_deregistration_date: null,
  flat_rate_percentage: null,
  exemption_period_start: null,
  exemption_period_end: null,
  business_name: null,
  business_email: null,
};

export async function getSettings(): Promise<BusinessSettings> {
  "use server";

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("business_settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (error || !data) {
    return DEFAULT_SETTINGS;
  }

  return {
    vat_status: data.vat_status ?? DEFAULT_SETTINGS.vat_status,
    vat_rate: data.vat_rate ?? DEFAULT_SETTINGS.vat_rate,
    vat_registration_number: data.vat_registration_number ?? null,
    vat_registration_date: data.vat_registration_date ?? null,
    amazon_vat_activation_date: data.amazon_vat_activation_date ?? null,
    vat_deregistration_date: data.vat_deregistration_date ?? null,
    flat_rate_percentage: data.flat_rate_percentage ?? null,
    exemption_period_start: data.exemption_period_start ?? null,
    exemption_period_end: data.exemption_period_end ?? null,
    business_name: data.business_name ?? null,
    business_email: data.business_email ?? null,
  };
}

export async function updateSettings(
  data: Partial<BusinessSettings>
): Promise<{ success: boolean; error?: string }> {
  "use server";

  const supabase = createServiceClient();

  const { error } = await supabase
    .from("business_settings")
    .upsert({
      id: 1,
      ...data,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error("[settings] updateSettings error:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true };
}
