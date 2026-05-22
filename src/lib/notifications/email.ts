import { formatDeltaPct, formatMetricValue } from "./digest";
import type { DailyDigest, DigestMetric, NotificationSettings } from "./types";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function metricCell(m: DigestMetric): string {
  const value = formatMetricValue(m.value, m.format);
  const up = m.deltaPct !== null && m.deltaPct >= 0;
  const color = m.deltaPct === null ? "#94a3b8" : up ? "#10b981" : "#ef4444";
  const arrow = m.deltaPct === null ? "" : up ? "&#9650; " : "&#9660; ";
  return `<td width="33.33%" valign="top" style="padding:8px;">
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;">
      <div style="font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#64748b;">${escapeHtml(m.label)}</div>
      <div style="font-size:21px;font-weight:800;color:#0f172a;margin-top:6px;">${value}</div>
      <div style="font-size:12px;font-weight:600;color:${color};margin-top:3px;">${arrow}${formatDeltaPct(m.deltaPct)}</div>
    </div>
  </td>`;
}

export function renderEmailSubject(digest: DailyDigest): string {
  const profit = digest.metrics.find((m) => m.key === "profit");
  const profitStr = profit
    ? formatMetricValue(profit.value, profit.format)
    : "";
  return `Daily Report — ${digest.reportDateLabel}${
    profitStr ? ` · Profit ${profitStr}` : ""
  }`;
}

export function renderEmailHtml(digest: DailyDigest): string {
  const rows: string[] = [];
  for (let i = 0; i < digest.metrics.length; i += 3) {
    rows.push(
      `<tr>${digest.metrics.slice(i, i + 3).map(metricCell).join("")}</tr>`
    );
  }
  const metricTable = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;">${rows.join(
    ""
  )}</table>`;

  const sellers = digest.topSellers.length
    ? digest.topSellers
        .map(
          (s, i) => `<tr>
        <td style="padding:6px 0;width:26px;color:#a1a1aa;font-weight:700;font-size:13px;">${i + 1}</td>
        <td style="padding:6px 0;color:#18181b;font-weight:600;font-size:13px;">${escapeHtml(s.title)}</td>
        <td style="padding:6px 0;text-align:right;color:#52525b;font-size:13px;white-space:nowrap;">${s.units} units · £${s.sales.toFixed(2)}</td>
      </tr>`
        )
        .join("")
    : `<tr><td style="padding:6px 0;color:#a1a1aa;font-size:13px;">No sales recorded for this day.</td></tr>`;

  const moverLine = digest.bestMover
    ? `<strong style="color:#10b981;">${escapeHtml(
        digest.bestMover.label
      )}</strong> led the day at ${formatDeltaPct(digest.bestMover.deltaPct)}${
        digest.worstMover && digest.worstMover.label !== digest.bestMover.label
          ? `, while <strong style="color:#ef4444;">${escapeHtml(
              digest.worstMover.label
            )}</strong> moved ${formatDeltaPct(digest.worstMover.deltaPct)}`
          : ""
      } versus the previous day.`
    : "Not enough data from the previous day to compare against.";

  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:28px 32px;">
          <div style="color:#e0e7ff;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;">LAK &amp; Co. Group</div>
          <div style="color:#ffffff;font-size:22px;font-weight:800;margin-top:4px;">Daily Performance Report</div>
          <div style="color:#c7d2fe;font-size:13px;margin-top:2px;">${escapeHtml(
            digest.reportDateLabel
          )}</div>
        </td></tr>
        <tr><td style="padding:24px 24px 8px;">${metricTable}</td></tr>
        <tr><td style="padding:8px 32px 20px;">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;font-size:13px;color:#334155;line-height:1.5;">${moverLine}</div>
        </td></tr>
        <tr><td style="padding:0 32px 28px;">
          <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#64748b;margin-bottom:6px;">Top Sellers</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${sellers}</table>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;">
          <div style="font-size:11px;color:#94a3b8;">Comparing ${escapeHtml(
            digest.reportDate
          )} against ${escapeHtml(
    digest.compareDate
  )}. Sent automatically by ProfitSoftware.</div>
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
