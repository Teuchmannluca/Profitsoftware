"use server";

import {
  addCogsPeriod as _add,
  updateCogsPeriod as _update,
  deleteCogsPeriod as _delete,
} from "./cogs";

export async function addCogsPeriod(
  ...args: Parameters<typeof _add>
) {
  return _add(...args);
}

export async function updateCogsPeriod(
  ...args: Parameters<typeof _update>
) {
  return _update(...args);
}

export async function deleteCogsPeriod(
  ...args: Parameters<typeof _delete>
) {
  return _delete(...args);
}
