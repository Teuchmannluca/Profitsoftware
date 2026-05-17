"use server";

import {
  getSettings as _get,
  updateSettings as _update,
} from "./settings";

export async function getSettings() {
  return _get();
}

export async function updateSettings(
  ...args: Parameters<typeof _update>
) {
  return _update(...args);
}
