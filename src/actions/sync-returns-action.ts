"use server";

import { syncReturns as _sync } from "./sync-returns";

export async function syncReturns() {
  return _sync();
}
