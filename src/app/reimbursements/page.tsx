import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { StatBox } from "@/components/stat-card";
import { ReturnsTable } from "@/components/returns-table";
import { ReimbursementsTable } from "@/components/reimbursements-table";
import { SyncReturnsButton } from "@/components/sync-returns-button";
import { PeriodFilter } from "@/components/period-filter";
import { PageHeader } from "@/components/page-header";
import { MainContent } from "@/components/main-content";
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

  const [{ data: returns }, { data: reimbursements }, { count: orderCount }] =
    await Promise.all([
      supabase
        .from("returns")
        .select(
          "id, amazon_order_id, asin, sku, item_name, return_quantity, return_reason, return_request_date, refunded_amount, return_status, resolution, in_policy"
        )
        .gte("return_request_date", from.toISOString())
        .lte("return_request_date", to.toISOString())
        .order("return_request_date", { ascending: false }),
      supabase
        .from("reimbursements")
        .select(
          "id, amazon_order_id, asin, sku, reason, quantity, amount, currency, status, claim_id, event_date, source_type"
        )
        .gte("event_date", from.toISOString().slice(0, 10))
        .lte("event_date", to.toISOString().slice(0, 10))
        .order("event_date", { ascending: false }),
      supabase
        .from("orders")
        .select("amazon_order_id", { count: "exact", head: true })
        .gte("purchase_date", from.toISOString())
        .lte("purchase_date", to.toISOString()),
    ]);

  const returnRows = returns ?? [];
  const reimbursementRows = reimbursements ?? [];

  const totalReturns = returnRows.length;
  const totalRefunded = returnRows.reduce(
    (sum, r) => sum + (r.refunded_amount ?? 0),
    0
  );
  const totalReimbursed = reimbursementRows.reduce(
    (sum, r) => sum + (r.amount ?? 0),
    0
  );
  const returnRate =
    orderCount && orderCount > 0
      ? ((totalReturns / orderCount) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="min-h-screen">
      <Sidebar email={user.email ?? ""} />

      <MainContent>
        <PageHeader
          title="Returns & Reimbursements"
          subtitle="Track refunds, returns, and claims"
          action={<SyncReturnsButton />}
        />

        <div className="p-8 space-y-6">
          <PeriodFilter />

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
              label="Reimbursed"
              value={`£${totalReimbursed.toFixed(2)}`}
              iconName="Coins"
              gradient="emerald"
            />
            <StatBox
              label="Return Rate"
              value={`${returnRate}%`}
              iconName="Percent"
              gradient="orange"
            />
            <StatBox
              label="Reimbursement Events"
              value={reimbursementRows.length}
              iconName="Receipt"
              gradient="violet"
            />
          </div>

          <ReturnsTable rows={returnRows} />
          <ReimbursementsTable rows={reimbursementRows} />
        </div>
      </MainContent>
    </div>
  );
}
