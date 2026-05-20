"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Calendar, Clock, Building2, Save, Check } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateSettings } from "@/actions/settings-action";
import type { BusinessSettings } from "@/actions/settings";

interface SettingsFormProps {
  initialSettings: BusinessSettings;
}

export function SettingsForm({ initialSettings }: SettingsFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [vatStatus, setVatStatus] = useState(initialSettings.vat_status);
  const [vatRate, setVatRate] = useState(initialSettings.vat_rate);
  const [vatRegistrationNumber, setVatRegistrationNumber] = useState(
    initialSettings.vat_registration_number ?? ""
  );
  const [flatRatePercentage, setFlatRatePercentage] = useState(
    initialSettings.flat_rate_percentage ?? 0
  );
  const [vatRegistrationDate, setVatRegistrationDate] = useState(
    initialSettings.vat_registration_date ?? ""
  );
  const [amazonVatActivationDate, setAmazonVatActivationDate] = useState(
    initialSettings.amazon_vat_activation_date ?? ""
  );
  const [vatDeregistrationDate, setVatDeregistrationDate] = useState(
    initialSettings.vat_deregistration_date ?? ""
  );
  const [exemptionPeriodStart, setExemptionPeriodStart] = useState(
    initialSettings.exemption_period_start ?? ""
  );
  const [exemptionPeriodEnd, setExemptionPeriodEnd] = useState(
    initialSettings.exemption_period_end ?? ""
  );
  const [businessName, setBusinessName] = useState(
    initialSettings.business_name ?? ""
  );
  const [businessEmail, setBusinessEmail] = useState(
    initialSettings.business_email ?? ""
  );

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);

    const result = await updateSettings({
      vat_status: vatStatus,
      vat_rate: vatStatus === "flat_rate" ? vatRate : 0.2,
      vat_registration_number: vatRegistrationNumber || null,
      vat_registration_date: vatRegistrationDate || null,
      amazon_vat_activation_date: amazonVatActivationDate || null,
      vat_deregistration_date: vatDeregistrationDate || null,
      flat_rate_percentage:
        vatStatus === "flat_rate" ? flatRatePercentage : null,
      exemption_period_start: exemptionPeriodStart || null,
      exemption_period_end: exemptionPeriodEnd || null,
      business_name: businessName || null,
      business_email: businessEmail || null,
    });

    setSaving(false);

    if (result.success) {
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 3000);
    } else {
      setError(result.error ?? "Failed to save settings");
    }
  }

  return (
    <div className="space-y-6">
      {/* Card 1: VAT Registration Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-indigo">
              <Shield className="h-3.5 w-3.5 text-white" />
            </div>
            VAT Registration Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vat-status">VAT Status</Label>
            <select
              id="vat-status"
              value={vatStatus}
              onChange={(e) => setVatStatus(e.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="standard">Standard VAT Registered</option>
              <option value="not_registered">Not VAT Registered</option>
              <option value="flat_rate">Flat Rate Scheme</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vat-number">VAT Registration Number</Label>
            <Input
              id="vat-number"
              placeholder="GB123456789"
              value={vatRegistrationNumber}
              onChange={(e) => setVatRegistrationNumber(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vat-rate">VAT Rate</Label>
              {vatStatus === "flat_rate" ? (
                <Input
                  id="vat-rate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={vatRate}
                  onChange={(e) => setVatRate(parseFloat(e.target.value) || 0)}
                />
              ) : (
                <Input id="vat-rate" value="20%" disabled />
              )}
            </div>

            {vatStatus === "flat_rate" && (
              <div className="space-y-2">
                <Label htmlFor="flat-rate-pct">Flat Rate Percentage</Label>
                <Input
                  id="flat-rate-pct"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={flatRatePercentage}
                  onChange={(e) =>
                    setFlatRatePercentage(parseFloat(e.target.value) || 0)
                  }
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Card 2: VAT Registration History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-emerald">
              <Calendar className="h-3.5 w-3.5 text-white" />
            </div>
            VAT Registration History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vat-reg-date">VAT Registration Date</Label>
              <Input
                id="vat-reg-date"
                type="date"
                value={vatRegistrationDate}
                onChange={(e) => setVatRegistrationDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amazon-vat-date">
                Amazon VAT Activation Date
              </Label>
              <Input
                id="amazon-vat-date"
                type="date"
                value={amazonVatActivationDate}
                onChange={(e) => setAmazonVatActivationDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vat-dereg-date">
                VAT De-Registration Date
              </Label>
              <Input
                id="vat-dereg-date"
                type="date"
                value={vatDeregistrationDate}
                onChange={(e) => setVatDeregistrationDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 3: Exemption Period */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-amber">
              <Clock className="h-3.5 w-3.5 text-white" />
            </div>
            Exemption Period
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="exemption-start">Exemption Start Date</Label>
              <Input
                id="exemption-start"
                type="date"
                value={exemptionPeriodStart}
                onChange={(e) => setExemptionPeriodStart(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="exemption-end">Exemption End Date</Label>
              <Input
                id="exemption-end"
                type="date"
                value={exemptionPeriodEnd}
                onChange={(e) => setExemptionPeriodEnd(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 4: Business Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-violet">
              <Building2 className="h-3.5 w-3.5 text-white" />
            </div>
            Business Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="business-name">Business Name</Label>
            <Input
              id="business-name"
              placeholder="Your Business Ltd"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="business-email">Business Email</Label>
            <Input
              id="business-email"
              type="email"
              placeholder="accounts@yourbusiness.co.uk"
              value={businessEmail}
              onChange={(e) => setBusinessEmail(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save button and status */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? (
            <>
              <Save className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : saved ? (
            <>
              <Check className="h-4 w-4" />
              Saved
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Settings
            </>
          )}
        </Button>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {saved && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            Settings saved successfully
          </p>
        )}
      </div>
    </div>
  );
}
