"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { syncInventory } from "@/actions/sync-inventory-action";

export function SyncInventoryButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSync() {
    setLoading(true);
    await syncInventory();
    setLoading(false);
    router.refresh();
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSync}
      disabled={loading}
      className="h-9 gap-2 text-xs font-semibold rounded-xl border-border/80 bg-card hover:bg-accent hover:border-violet-200 transition-all duration-200"
    >
      <RefreshCw
        className={`h-3.5 w-3.5 text-violet-500 ${loading ? "animate-spin" : ""}`}
      />
      {loading ? "Syncing..." : "Sync Inventory"}
    </Button>
  );
}
