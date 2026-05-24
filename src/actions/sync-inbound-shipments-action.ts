"use server";

import { syncInboundShipments as _sync } from "./sync-inbound-shipments";
import { requireAuth } from "@/lib/auth-guard";

export async function syncInboundShipments() {
  await requireAuth();
  return _sync();
}
