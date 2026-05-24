import { NextResponse } from "next/server";
import { syncAds } from "@/actions/sync-ads";

export const dynamic = "force-dynamic";
export const maxDuration = 900;

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[sync-ads] Starting ads sync...");
  const start = Date.now();

  try {
    const result = await syncAds();
    const duration = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`[sync-ads] Complete in ${duration}s`);
    return NextResponse.json({ ok: true, duration: `${duration}s`, ...result });
  } catch (err) {
    console.error("[sync-ads] Failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
