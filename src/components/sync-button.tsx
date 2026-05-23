"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { syncOrders } from "@/actions/sync-orders-action";
import { syncFinances } from "@/actions/sync-finances-action";
import { syncInboundShipments } from "@/actions/sync-inbound-shipments-action";
import { syncReimbursements } from "@/actions/sync-reimbursements-action";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function SyncButton({ lastSyncTime }: { lastSyncTime: string | null }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSync() {
    setLoading(true);
    await syncOrders();
    await syncFinances();
    await syncInboundShipments();
    await syncReimbursements();
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      {lastSyncTime && (
        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
          Synced {timeAgo(lastSyncTime)}
        </span>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={handleSync}
        disabled={loading}
        className="h-9 gap-2 text-xs font-semibold rounded-xl border-border/80 bg-card hover:bg-accent hover:border-indigo-200 transition-all duration-200"
      >
        <RefreshCw
          className={`h-3.5 w-3.5 text-indigo-500 ${loading ? "animate-spin" : ""}`}
        />
        {loading ? "Syncing..." : "Sync Data"}
      </Button>
    </div>
  );
}
