import { NextResponse } from "next/server";
import { syncOrders } from "@/actions/sync-orders";
import { syncFinances } from "@/actions/sync-finances";
import { syncInboundShipments } from "@/actions/sync-inbound-shipments";
import { syncReimbursements } from "@/actions/sync-reimbursements";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[cron] Starting scheduled sync...");
  const start = Date.now();

  try {
    const ordersResult = await syncOrders();
    const financesResult = await syncFinances();
    const inboundResult = await syncInboundShipments();
    const reimbursementsResult = await syncReimbursements();

    const duration = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`[cron] Sync complete in ${duration}s`);

    return NextResponse.json({
      ok: true,
      duration: `${duration}s`,
      orders: ordersResult,
      finances: financesResult,
      inbound: inboundResult,
      reimbursements: reimbursementsResult,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[cron] Sync failed:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
