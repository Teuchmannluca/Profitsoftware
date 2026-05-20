"use server";

import {
  getCapitalOverview as _get,
  getCapitalDetail as _getDetail,
} from "./capital-overview";

export async function getCapitalOverview() {
  return _get();
}

export async function getCapitalDetail() {
  return _getDetail();
}
