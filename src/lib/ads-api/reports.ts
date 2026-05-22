import { refreshAdsAccessToken } from "./auth";
import { gunzipSync } from "zlib";

const BASE_URL = "https://advertising-api-eu.amazon.com";

async function adsHeaders(): Promise<Record<string, string>> {
  const token = await refreshAdsAccessToken();
  return {
    "Authorization": `Bearer ${token}`,
    "Amazon-Advertising-API-ClientId": process.env.AMAZON_ADS_CLIENT_ID!,
    "Amazon-Advertising-API-Scope": process.env.AMAZON_ADS_PROFILE_ID!,
    "Content-Type": "application/json",
    "Accept": "application/vnd.createasyncreportrequest.v3+json",
  };
}

export interface CampaignSpendRow {
  date: string;
  campaignId: string;
  campaignName: string;
  impressions: number;
  clicks: number;
  spend: number;
  sales: number;
  unitsSold: number;
}

export interface AdvertisedProductRow {
  date: string;
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  adGroupName: string;
  advertisedAsin: string;
  advertisedSku: string;
  impressions: number;
  clicks: number;
  spend: number;
  sales: number;
  unitsSold: number;
  orders: number;
}

export interface TargetingRow {
  date: string;
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  adGroupName: string;
  targetingId: string;
  targetingText: string;
  targetingType: string;
  matchType: string;
  impressions: number;
  clicks: number;
  spend: number;
  sales: number;
  unitsSold: number;
  orders: number;
}

function extractDuplicateReportId(body: string): string | null {
  const match = body.match(/duplicate of\s*:\s*([0-9a-f-]+)/i);
  return match?.[1] ?? null;
}

export async function requestReport(params: {
  startDate: string;
  endDate: string;
}): Promise<string> {
  const headers = await adsHeaders();
  const body = {
    name: `sp-campaigns-${params.startDate}-${params.endDate}`,
    startDate: params.startDate,
    endDate: params.endDate,
    configuration: {
      adProduct: "SPONSORED_PRODUCTS",
      groupBy: ["campaign"],
      columns: [
        "date",
        "campaignId",
        "campaignName",
        "impressions",
        "clicks",
        "spend",
        "sales14d",
        "unitsSoldClicks14d",
      ],
      reportTypeId: "spCampaigns",
      timeUnit: "DAILY",
      format: "GZIP_JSON",
    },
  };

  const res = await fetch(`${BASE_URL}/reporting/reports`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 425) {
      const existingId = extractDuplicateReportId(text);
      if (existingId) {
        console.log(`[ads] Campaign report already exists: ${existingId}, reusing`);
        return existingId;
      }
    }
    throw new Error(`Ads report request failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.reportId;
}

export async function pollReport(reportId: string, maxWaitMs = 300_000): Promise<string> {
  const headers = await adsHeaders();
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    const res = await fetch(`${BASE_URL}/reporting/reports/${reportId}`, {
      headers: {
        ...headers,
        "Accept": "application/vnd.createasyncreportrequest.v3+json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ads report poll failed: ${res.status} ${text}`);
    }

    const data = await res.json();
    if (data.status === "COMPLETED" && data.url) {
      return data.url;
    }
    if (data.status === "FAILURE") {
      throw new Error(`Ads report failed: ${JSON.stringify(data)}`);
    }

    await new Promise((r) => setTimeout(r, 5000));
  }

  throw new Error("Ads report timed out");
}

export async function downloadReport(url: string): Promise<CampaignSpendRow[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Ads report download failed: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());

  let jsonStr: string;
  try {
    jsonStr = gunzipSync(buffer).toString("utf-8");
  } catch {
    jsonStr = buffer.toString("utf-8");
  }

  const rows = JSON.parse(jsonStr);
  return (Array.isArray(rows) ? rows : []).map((r: Record<string, unknown>) => ({
    date: String(r.date ?? ""),
    campaignId: String(r.campaignId ?? ""),
    campaignName: String(r.campaignName ?? ""),
    impressions: Number(r.impressions ?? 0),
    clicks: Number(r.clicks ?? 0),
    spend: Number(r.spend ?? 0),
    sales: Number(r.sales14d ?? 0),
    unitsSold: Number(r.unitsSoldClicks14d ?? 0),
  }));
}

// Amazon Ads API V3 includes a ~10% "Regulatory Operating Cost Recovery" surcharge
// in the spend column. Seller Central and the Ads Console show the net amount.
// Dividing by this factor aligns API spend with what SC/Ads Console report.
const REGULATORY_SURCHARGE_FACTOR = 1.099;

export async function fetchCampaignSpend(
  startDate: string,
  endDate: string
): Promise<CampaignSpendRow[]> {
  console.log(`[ads] Requesting campaign report ${startDate} → ${endDate}`);
  const reportId = await requestReport({ startDate, endDate });
  console.log(`[ads] Report ID: ${reportId}, polling...`);
  const downloadUrl = await pollReport(reportId);
  console.log(`[ads] Report ready, downloading...`);
  const rows = await downloadReport(downloadUrl);
  return rows.map((r) => ({
    ...r,
    spend: Math.round((r.spend / REGULATORY_SURCHARGE_FACTOR) * 100) / 100,
    sales: Math.round((r.sales / REGULATORY_SURCHARGE_FACTOR) * 100) / 100,
  }));
}

// --- Advertised Product report (per-ASIN per-campaign per-ad-group) ---

export async function requestProductReport(params: {
  startDate: string;
  endDate: string;
}): Promise<string> {
  const headers = await adsHeaders();
  const body = {
    name: `sp-products-${params.startDate}-${params.endDate}`,
    startDate: params.startDate,
    endDate: params.endDate,
    configuration: {
      adProduct: "SPONSORED_PRODUCTS",
      groupBy: ["advertiser"],
      columns: [
        "date",
        "campaignId",
        "campaignName",
        "adGroupId",
        "adGroupName",
        "advertisedAsin",
        "advertisedSku",
        "impressions",
        "clicks",
        "spend",
        "sales14d",
        "unitsSoldClicks14d",
        "purchases14d",
      ],
      reportTypeId: "spAdvertisedProduct",
      timeUnit: "DAILY",
      format: "GZIP_JSON",
    },
  };

  const res = await fetch(`${BASE_URL}/reporting/reports`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 425) {
      const existingId = extractDuplicateReportId(text);
      if (existingId) {
        console.log(`[ads] Product report already exists: ${existingId}, reusing`);
        return existingId;
      }
    }
    throw new Error(`Ads product report request failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.reportId;
}

export async function downloadProductReport(url: string): Promise<AdvertisedProductRow[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Ads product report download failed: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  let jsonStr: string;
  try {
    jsonStr = gunzipSync(buffer).toString("utf-8");
  } catch {
    jsonStr = buffer.toString("utf-8");
  }

  const rows = JSON.parse(jsonStr);
  return (Array.isArray(rows) ? rows : []).map((r: Record<string, unknown>) => ({
    date: String(r.date ?? ""),
    campaignId: String(r.campaignId ?? ""),
    campaignName: String(r.campaignName ?? ""),
    adGroupId: String(r.adGroupId ?? ""),
    adGroupName: String(r.adGroupName ?? ""),
    advertisedAsin: String(r.advertisedAsin ?? ""),
    advertisedSku: String(r.advertisedSku ?? ""),
    impressions: Number(r.impressions ?? 0),
    clicks: Number(r.clicks ?? 0),
    spend: Number(r.spend ?? 0),
    sales: Number(r.sales14d ?? 0),
    unitsSold: Number(r.unitsSoldClicks14d ?? 0),
    orders: Number(r.purchases14d ?? 0),
  }));
}

export async function fetchAdvertisedProductSpend(
  startDate: string,
  endDate: string
): Promise<AdvertisedProductRow[]> {
  console.log(`[ads] Requesting product report ${startDate} → ${endDate}`);
  const reportId = await requestProductReport({ startDate, endDate });
  console.log(`[ads] Product report ID: ${reportId}, polling...`);
  const downloadUrl = await pollReport(reportId);
  console.log(`[ads] Product report ready, downloading...`);
  const rows = await downloadProductReport(downloadUrl);
  return rows.map((r) => ({
    ...r,
    spend: Math.round((r.spend / REGULATORY_SURCHARGE_FACTOR) * 100) / 100,
    sales: Math.round((r.sales / REGULATORY_SURCHARGE_FACTOR) * 100) / 100,
  }));
}

// --- Targeting report (per-keyword/target per-ad-group) ---

export async function requestTargetingReport(params: {
  startDate: string;
  endDate: string;
}): Promise<string> {
  const headers = await adsHeaders();
  const body = {
    name: `sp-targeting-${params.startDate}-${params.endDate}`,
    startDate: params.startDate,
    endDate: params.endDate,
    configuration: {
      adProduct: "SPONSORED_PRODUCTS",
      groupBy: ["targeting"],
      columns: [
        "date",
        "campaignId",
        "campaignName",
        "adGroupId",
        "adGroupName",
        "keywordId",
        "keyword",
        "keywordType",
        "matchType",
        "impressions",
        "clicks",
        "cost",
        "sales14d",
        "unitsSoldClicks14d",
        "purchases14d",
      ],
      reportTypeId: "spTargeting",
      timeUnit: "DAILY",
      format: "GZIP_JSON",
    },
  };

  const res = await fetch(`${BASE_URL}/reporting/reports`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 425) {
      const existingId = extractDuplicateReportId(text);
      if (existingId) {
        console.log(`[ads] Targeting report already exists: ${existingId}, reusing`);
        return existingId;
      }
    }
    throw new Error(`Ads targeting report request failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.reportId;
}

export async function downloadTargetingReport(url: string): Promise<TargetingRow[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Ads targeting report download failed: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  let jsonStr: string;
  try {
    jsonStr = gunzipSync(buffer).toString("utf-8");
  } catch {
    jsonStr = buffer.toString("utf-8");
  }

  const rows = JSON.parse(jsonStr);
  return (Array.isArray(rows) ? rows : []).map((r: Record<string, unknown>) => ({
    date: String(r.date ?? ""),
    campaignId: String(r.campaignId ?? ""),
    campaignName: String(r.campaignName ?? ""),
    adGroupId: String(r.adGroupId ?? ""),
    adGroupName: String(r.adGroupName ?? ""),
    targetingId: String(r.keywordId ?? ""),
    targetingText: String(r.keyword ?? ""),
    targetingType: String(r.keywordType ?? ""),
    matchType: String(r.matchType ?? ""),
    impressions: Number(r.impressions ?? 0),
    clicks: Number(r.clicks ?? 0),
    spend: Number(r.cost ?? 0),
    sales: Number(r.sales14d ?? 0),
    unitsSold: Number(r.unitsSoldClicks14d ?? 0),
    orders: Number(r.purchases14d ?? 0),
  }));
}

export async function fetchTargetingSpend(
  startDate: string,
  endDate: string
): Promise<TargetingRow[]> {
  console.log(`[ads] Requesting targeting report ${startDate} → ${endDate}`);
  const reportId = await requestTargetingReport({ startDate, endDate });
  console.log(`[ads] Targeting report ID: ${reportId}, polling...`);
  const downloadUrl = await pollReport(reportId);
  console.log(`[ads] Targeting report ready, downloading...`);
  const rows = await downloadTargetingReport(downloadUrl);
  return rows.map((r) => ({
    ...r,
    spend: Math.round((r.spend / REGULATORY_SURCHARGE_FACTOR) * 100) / 100,
    sales: Math.round((r.sales / REGULATORY_SURCHARGE_FACTOR) * 100) / 100,
  }));
}
