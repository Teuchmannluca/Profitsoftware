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
      className="h-8 gap-1.5 text-xs"
    >
      <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
      {loading ? "Syncing..." : "Sync Inventory"}
    </Button>
  );
}
