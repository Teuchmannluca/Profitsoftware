"use server";

import {
  getCapitalOverview as _get,
  getCapitalDetail as _getDetail,
} from "./capital-overview";
import { requireAuth } from "@/lib/auth-guard";

export async function getCapitalOverview() {
  await requireAuth();
  return _get();
}

export async function getCapitalDetail() {
  await requireAuth();
  return _getDetail();
}
