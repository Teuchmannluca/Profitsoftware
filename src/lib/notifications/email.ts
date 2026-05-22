import { formatDeltaPct, formatMetricValue } from "./digest";
import type { DailyDigest, DigestMetric, DigestTopSeller, NotificationSettings } from "./types";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function metricCard(m: DigestMetric): string {
  const value = formatMetricValue(m.value, m.format);
  const up = m.deltaPct !== null && m.deltaPct >= 0;
  const color = m.deltaPct === null ? "#94a3b8" : up ? "#10b981" : "#ef4444";
  const bg = m.deltaPct === null ? "#f8fafc" : up ? "#f0fdf4" : "#fef2f2";
  const arrow = m.deltaPct === null ? "" : up ? "&#9650; " : "&#9660; ";
  return `<td width="33.33%" valign="top" style="padding:6px;">
    <div style="background:${bg};border:1px solid #e2e8f0;border-radius:12px;padding:16px 14px;text-align:center;">
      <div style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#64748b;">${escapeHtml(m.label)}</div>
      <div style="font-size:24px;font-weight:800;color:#0f172a;margin-top:8px;font-family:'SF Mono',SFMono-Regular,Menlo,monospace;">${value}</div>
      <div style="font-size:12px;font-weight:700;color:${color};margin-top:6px;">${arrow}${formatDeltaPct(m.deltaPct)}</div>
    </div>
  </td>`;
}

function sellerRow(s: DigestTopSeller, rank: number): string {
  const image = s.imageUrl
    ? `<img src="${escapeHtml(s.imageUrl)}" width="44" height="44" alt="" style="width:44px;height:44px;border-radius:10px;object-fit:cover;display:block;border:1px solid #e2e8f0;" />`
    : `<div style="width:44px;height:44px;border-radius:10px;background:#f1f5f9;border:1px solid #e2e8f0;"></div>`;

  const rankBg = rank === 1 ? "#fef3c7" : rank === 2 ? "#f1f5f9" : rank === 3 ? "#fff7ed" : "#f8fafc";
  const rankColor = rank === 1 ? "#d97706" : rank === 2 ? "#64748b" : rank === 3 ? "#ea580c" : "#94a3b8";

  return `<tr>
    <td style="padding:8px 0;" valign="middle">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="32" valign="middle" style="padding-right:12px;">
            <div style="width:28px;height:28px;border-radius:8px;background:${rankBg};text-align:center;line-height:28px;font-size:13px;font-weight:800;color:${rankColor};">${rank}</div>
          </td>
          <td width="56" valign="middle" style="padding-right:12px;">${image}</td>
          <td valign="middle">
            <div style="font-size:13px;font-weight:600;color:#0f172a;line-height:1.3;">${escapeHtml(s.title.length > 65 ? s.title.slice(0, 62) + "..." : s.title)}</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:2px;font-family:'SF Mono',SFMono-Regular,Menlo,monospace;">${escapeHtml(s.asin)}</div>
          </td>
          <td width="100" valign="middle" style="text-align:right;">
            <div style="font-size:14px;font-weight:700;color:#0f172a;font-family:'SF Mono',SFMono-Regular,Menlo,monospace;">£${s.sales.toFixed(2)}</div>
            <div style="font-size:11px;color:#64748b;margin-top:2px;">${s.units} unit${s.units !== 1 ? "s" : ""}</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr><td style="border-bottom:1px solid #f1f5f9;"></td></tr>`;
}

export function renderEmailSubject(digest: DailyDigest): string {
  const profit = digest.metrics.find((m) => m.key === "profit");
  const revenue = digest.metrics.find((m) => m.key === "revenue");
  const profitStr = profit ? formatMetricValue(profit.value, profit.format) : "";
  const revenueStr = revenue ? formatMetricValue(revenue.value, revenue.format) : "";
  const parts = [revenueStr ? `Revenue ${revenueStr}` : "", profitStr ? `Profit ${profitStr}` : ""].filter(Boolean).join(" · ");
  return `Daily Report — ${digest.reportDateLabel}${parts ? ` · ${parts}` : ""}`;
}

export function renderEmailHtml(digest: DailyDigest): string {
  const metricRows: string[] = [];
  for (let i = 0; i < digest.metrics.length; i += 3) {
    metricRows.push(
      `<tr>${digest.metrics.slice(i, i + 3).map(metricCard).join("")}</tr>`
    );
  }
  const metricTable = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;">${metricRows.join("")}</table>`;

  const sellers = digest.topSellers.length
    ? digest.topSellers.map((s, i) => sellerRow(s, i + 1)).join("")
    : `<tr><td style="padding:16px 0;color:#94a3b8;font-size:13px;text-align:center;">No sales recorded for this day.</td></tr>`;

  const moverLine = digest.bestMover
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="50%" style="padding:8px;">
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px 14px;">
              <div style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#16a34a;">BIGGEST WIN</div>
              <div style="font-size:15px;font-weight:700;color:#15803d;margin-top:4px;">${escapeHtml(digest.bestMover.label)}</div>
              <div style="font-size:20px;font-weight:800;color:#16a34a;margin-top:2px;">&#9650; ${formatDeltaPct(digest.bestMover.deltaPct)}</div>
            </div>
          </td>
          ${digest.worstMover && digest.worstMover.label !== digest.bestMover.label
            ? `<td width="50%" style="padding:8px;">
                <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:12px 14px;">
                  <div style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#dc2626;">WEAKEST</div>
                  <div style="font-size:15px;font-weight:700;color:#b91c1c;margin-top:4px;">${escapeHtml(digest.worstMover.label)}</div>
                  <div style="font-size:20px;font-weight:800;color:#ef4444;margin-top:2px;">&#9660; ${formatDeltaPct(digest.worstMover.deltaPct)}</div>
                </div>
              </td>`
            : ""
          }
        </tr>
      </table>`
    : `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;font-size:13px;color:#64748b;text-align:center;">Not enough data from the previous day to compare.</div>`;

  return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#4f46e5,#7c3aed,#a855f7);padding:32px 32px 28px;">
          <div style="font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,0.7);">LAK &amp; Co. Group</div>
          <div style="color:#ffffff;font-size:26px;font-weight:800;margin-top:6px;line-height:1.2;">Daily Performance Report</div>
          <div style="color:rgba(255,255,255,0.8);font-size:14px;margin-top:6px;">${escapeHtml(digest.reportDateLabel)}</div>
        </td></tr>

        <!-- KPI Cards -->
        <tr><td style="padding:24px 20px 12px;">${metricTable}</td></tr>

        <!-- Movers -->
        <tr><td style="padding:4px 24px 16px;">${moverLine}</td></tr>

        <!-- Divider -->
        <tr><td style="padding:0 32px;"><div style="border-top:1px solid #e2e8f0;"></div></td></tr>

        <!-- Top Sellers -->
        <tr><td style="padding:20px 32px 28px;">
          <div style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#64748b;margin-bottom:12px;">Top Sellers</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${sellers}</table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f8fafc;padding:18px 32px;border-top:1px solid #e2e8f0;">
          <div style="font-size:11px;color:#94a3b8;line-height:1.5;">Comparing ${escapeHtml(digest.reportDate)} against ${escapeHtml(digest.compareDate)}. Sent automatically by ProfitSoftware.</div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendDigestEmail(
  digest: DailyDigest,
  settings: NotificationSettings
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY environment variable is not set" };
  }

  const from = settings.email_from?.trim();
  if (!from) {
    return { ok: false, error: "No sender address (email_from) configured" };
  }

  const recipients = (settings.recipient_emails ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (recipients.length === 0) {
    return { ok: false, error: "No recipient emails configured" };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject: renderEmailSubject(digest),
        html: renderEmailHtml(digest),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        error: `Resend responded ${res.status}: ${text.slice(0, 300)}`,
      };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown email error",
    };
  }
}
