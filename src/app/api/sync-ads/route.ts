import { NextResponse } from "next/server";
import { syncAds } from "@/actions/sync-ads";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  console.log("[sync-ads] Starting ads sync...");
  const start = Date.now();

  try {
    const result = await syncAds();
    const duration = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`[sync-ads] Complete in ${duration}s`);
    return NextResponse.json({ ok: true, duration: `${duration}s`, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[sync-ads] Failed:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
