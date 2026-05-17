"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw, Download } from "lucide-react";
import { syncOrders } from "@/actions/sync-orders-action";

export function SyncButton() {
  const [loading, setLoading] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const router = useRouter();

  async function handleSync() {
    setLoading(true);
    await syncOrders();
    setLoading(false);
    router.refresh();
  }

  async function handleBackfill() {
    if (!confirm("This will sync all orders from Jan 1, 2026. It may take a few minutes. Continue?")) return;
    setBackfilling(true);
    await syncOrders("2026-01-01T00:00:00Z");
    setBackfilling(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleBackfill}
        disabled={loading || backfilling}
        className="h-8 gap-1.5 text-xs"
      >
        <Download className={`h-3 w-3 ${backfilling ? "animate-bounce" : ""}`} />
        {backfilling ? "Backfilling..." : "Backfill 2026"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleSync}
        disabled={loading || backfilling}
        className="h-8 gap-1.5 text-xs"
      >
        <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Syncing..." : "Sync"}
      </Button>
    </div>
  );
}
