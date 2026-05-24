import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { PageHeader } from "@/components/page-header";
import { MainContent } from "@/components/main-content";
import { CircleGauge } from "@/components/circle-gauge";
import { StatBox } from "@/components/stat-card";
import { SyncInboundButton } from "@/components/sync-inbound-button";
import { SyncInventoryButton } from "@/components/sync-inventory-button";
import { CapitalInventoryTable } from "@/components/capital-inventory-table";
import { CapitalShipmentsTable } from "@/components/capital-shipments-table";
import { CapitalStatusTable } from "@/components/capital-status-table";
import { getCapitalDetail, getInventoryStatusBreakdown } from "@/actions/capital-overview";

export const dynamic = "force-dynamic";

function fmt(n: number): string {
  return n.toLocaleString("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export default async function CapitalPage() {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [data, statusRows] = await Promise.all([
    getCapitalDetail(),
    getInventoryStatusBreakdown(),
  ]);

  const overview = data?.overview ?? {
    totalCapital: 0,
    totalUnits: 0,
    buckets: [
      { label: "At Amazon", value: 0, units: 0, color: "emerald" },
      { label: "Reserved", value: 0, units: 0, color: "amber" },
      { label: "In Transit", value: 0, units: 0, color: "sky" },
      { label: "Unsellable", value: 0, units: 0, color: "rose" },
    ],
    skusWithoutCogs: 0,
  };

  const products = data?.products ?? [];
  const shipments = data?.shipments ?? [];
  const grandTotal = data?.grandTotalCapital ?? 0;

  const atAmazon = overview.buckets.find((b) => b.label === "At Amazon");
  const reserved = overview.buckets.find((b) => b.label === "Reserved");
  const inTransit = overview.buckets.find((b) => b.label === "In Transit");
  const unsellable = overview.buckets.find((b) => b.label === "Unsellable");

  const activeShipments = shipments.filter(
    (s) => s.status !== "CLOSED" && s.status !== "CANCELLED"
  );

  const gaugeMax = Math.max(grandTotal, 1);

  return (
    <div className="min-h-screen">
      <Sidebar email={user.email ?? ""} />

      <MainContent>
        <PageHeader
          title="Capital"
          subtitle="Where your money is tied up"
          action={
            <div className="flex items-center gap-3">
              <SyncInboundButton />
              <SyncInventoryButton />
            </div>
          }
        />

        <div className="p-4 md:p-8 space-y-8">
          {/* Circle gauges */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            <CircleGauge
              value={grandTotal}
              max={gaugeMax}
              label="Total Capital"
              formattedValue={fmt(grandTotal)}
              subtitle={`${overview.totalUnits.toLocaleString("en-GB")} units`}
              color="#6366f1"
              gradient="from-indigo-500 to-indigo-600"
              shadow="shadow-indigo-500/20"
            />
            <CircleGauge
              value={(atAmazon?.value ?? 0) + (reserved?.value ?? 0)}
              max={gaugeMax}
              label="At Amazon"
              formattedValue={fmt((atAmazon?.value ?? 0) + (reserved?.value ?? 0))}
              subtitle={`${((atAmazon?.units ?? 0) + (reserved?.units ?? 0)).toLocaleString("en-GB")} units`}
              color="#10b981"
              gradient="from-emerald-500 to-emerald-600"
              shadow="shadow-emerald-500/20"
            />
            <CircleGauge
              value={inTransit?.value ?? 0}
              max={gaugeMax}
              label="In Transit"
              formattedValue={fmt(inTransit?.value ?? 0)}
              subtitle={`${activeShipments.length} shipment${activeShipments.length !== 1 ? "s" : ""}`}
              color="#0ea5e9"
              gradient="from-sky-500 to-sky-600"
              shadow="shadow-sky-500/20"
            />
            <CircleGauge
              value={unsellable?.value ?? 0}
              max={gaugeMax}
              label="At Risk"
              formattedValue={fmt(unsellable?.value ?? 0)}
              subtitle={`${(unsellable?.units ?? 0).toLocaleString("en-GB")} unsellable`}
              color="#f43f5e"
              gradient="from-rose-500 to-rose-600"
              shadow="shadow-rose-500/20"
            />
          </div>

          {/* Stat strip */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatBox
              label="Total Units"
              value={overview.totalUnits.toLocaleString("en-GB")}
              iconName="Package"
              gradient="indigo"
            />
            <StatBox
              label="Active Shipments"
              value={String(activeShipments.length)}
              iconName="Truck"
              gradient="sky"
            />
            <StatBox
              label="In Transit"
              value={fmt(inTransit?.value ?? 0)}
              iconName="ArrowRight"
              gradient="sky"
            />
            <StatBox
              label="Fulfillable"
              value={fmt(atAmazon?.value ?? 0)}
              iconName="Warehouse"
              gradient="emerald"
            />
            <StatBox
              label="Missing COGS"
              value={String(overview.skusWithoutCogs)}
              iconName="AlertTriangle"
              gradient="amber"
            />
            <StatBox
              label="Unsellable"
              value={fmt(unsellable?.value ?? 0)}
              iconName="Ban"
              gradient="rose"
            />
          </div>

          {/* Capital breakdown bar */}
          {grandTotal > 0 && (
            <div className="rounded-xl border border-border/50 bg-card p-5 shadow-card ring-1 ring-border/50">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Capital Distribution
              </p>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted/60">
                {overview.buckets.map((bucket) => {
                  const pct = grandTotal > 0 ? (bucket.value / grandTotal) * 100 : 0;
                  if (pct === 0) return null;
                  const colorMap: Record<string, string> = {
                    emerald: "bg-emerald-500",
                    amber: "bg-amber-500",
                    sky: "bg-sky-500",
                    rose: "bg-rose-400",
                  };
                  return (
                    <div
                      key={bucket.label}
                      className={`${colorMap[bucket.color]} transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
                {overview.buckets.map((bucket) => {
                  const pct = grandTotal > 0 ? ((bucket.value / grandTotal) * 100).toFixed(1) : "0.0";
                  const dotColor: Record<string, string> = {
                    emerald: "bg-emerald-500",
                    amber: "bg-amber-500",
                    sky: "bg-sky-500",
                    rose: "bg-rose-400",
                  };
                  return (
                    <div key={bucket.label} className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${dotColor[bucket.color]}`} />
                      <span className="text-[11px] text-muted-foreground">
                        {bucket.label}
                      </span>
                      <span className="text-[11px] font-semibold font-mono text-foreground">
                        {fmt(bucket.value)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">({pct}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Inventory by status */}
          <CapitalStatusTable rows={statusRows} products={products} />

          {/* Shipments table */}
          <CapitalShipmentsTable shipments={shipments} />

          {/* Product breakdown table */}
          <CapitalInventoryTable rows={products} />
        </div>
      </MainContent>
    </div>
  );
}
