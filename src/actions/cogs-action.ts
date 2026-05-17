"use server";

import {
  addCogsPeriod as _add,
  updateCogsPeriod as _update,
  deleteCogsPeriod as _delete,
  setProductCost as _setCost,
  setProductVat as _setVat,
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

export async function setProductCost(
  ...args: Parameters<typeof _setCost>
) {
  return _setCost(...args);
}

export async function setProductVat(
  ...args: Parameters<typeof _setVat>
) {
  return _setVat(...args);
}
