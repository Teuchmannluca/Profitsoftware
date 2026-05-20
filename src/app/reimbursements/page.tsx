import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { StatBox } from "@/components/stat-card";
import { ReturnsTable } from "@/components/returns-table";
import { SyncReturnsButton } from "@/components/sync-returns-button";
import { PeriodFilter } from "@/components/period-filter";
import { PageHeader } from "@/components/page-header";
import { getDateRange } from "@/lib/queries/sales";

export const dynamic = "force-dynamic";

export default async function ReimbursementsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const period = params.period ?? "this_month";
  const { from, to } = getDateRange(period);

  const supabase = createServiceClient();

  // Fetch returns for the period
  const { data: returns } = await supabase
    .from("returns")
    .select(
      "id, amazon_order_id, asin, sku, item_name, return_quantity, return_reason, return_request_date, refunded_amount, return_status, resolution, in_policy"
    )
    .gte("return_request_date", from.toISOString())
    .lte("return_request_date", to.toISOString())
    .order("return_request_date", { ascending: false });

  const returnRows = returns ?? [];

  // KPI calculations
  const totalReturns = returnRows.length;

  const totalRefunded = returnRows.reduce(
    (sum, r) => sum + (r.refunded_amount ?? 0),
    0
  );

  // Fetch total order count for return rate
  const { count: orderCount } = await supabase
    .from("orders")
    .select("amazon_order_id", { count: "exact", head: true })
    .gte("purchase_date", from.toISOString())
    .lte("purchase_date", to.toISOString());

  const returnRate =
    orderCount && orderCount > 0
      ? ((totalReturns / orderCount) * 100).toFixed(1)
      : "0.0";

  // Pending claims count (reimbursements with status = 'pending')
  const { count: pendingClaims } = await supabase
    .from("reimbursements")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  return (
    <div className="min-h-screen">
      <Sidebar email={user.email ?? ""} />

      <main className="pl-[240px]">
        <PageHeader
          title="Returns & Reimbursements"
          subtitle="Track refunds, returns, and claims"
          action={<SyncReturnsButton />}
        />

        <div className="p-8 space-y-6">
          <PeriodFilter />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatBox
              label="Total Returns"
              value={totalReturns}
              iconName="RotateCcw"
              gradient="rose"
            />
            <StatBox
              label="Refunded"
              value={`£${totalRefunded.toFixed(2)}`}
              iconName="Wallet"
              gradient="amber"
            />
            <StatBox
              label="Return Rate"
              value={`${returnRate}%`}
              iconName="Percent"
              gradient="orange"
            />
            <StatBox
              label="Pending Claims"
              value={pendingClaims ?? 0}
              iconName="Receipt"
              gradient="violet"
            />
          </div>

          <ReturnsTable rows={returnRows} />
        </div>
      </main>
    </div>
  );
}
