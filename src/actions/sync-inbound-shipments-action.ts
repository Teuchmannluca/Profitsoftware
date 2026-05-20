"use server";

import { syncInboundShipments as _sync } from "./sync-inbound-shipments";

export async function syncInboundShipments() {
  return _sync();
}
