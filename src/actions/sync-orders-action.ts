"use server";

import { syncOrders as _syncOrders } from "./sync-orders";

export async function syncOrders() {
  return _syncOrders();
}
