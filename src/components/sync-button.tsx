"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { syncOrders } from "@/actions/sync-orders-action";

export function SyncButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setResult(null);

    const res = await syncOrders();

    if (res.error) {
      setResult(`Error: ${res.error}`);
    } else {
      setResult(`Synced ${res.ordersWritten} orders, ${res.itemsWritten} items`);
    }
    setLoading(false);
  }

  return (
    <div className="flex items-center gap-4">
      <Button onClick={handleSync} disabled={loading}>
        {loading ? "Syncing..." : "Sync Orders"}
      </Button>
      {result && (
        <span className="text-sm text-muted-foreground">{result}</span>
      )}
    </div>
  );
}
