import { formatDeltaPct, formatMetricValue } from "./digest";
import type { DailyDigest, NotificationSettings } from "./types";

/** Slack mrkdwn requires these three characters escaped. */
function slackEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildSlackBlocks(digest: DailyDigest): unknown[] {
  const blocks: unknown[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `Daily Report — ${digest.reportDateLabel}`,
        emoji: true,
      },
    },
    {
      type: "section",
      fields: digest.metrics.slice(0, 10).map((m) => ({
        type: "mrkdwn",
        text: `*${m.label}*\n${formatMetricValue(
          m.value,
          m.format
        )}  (${formatDeltaPct(m.deltaPct)})`,
      })),
    },
  ];

  if (digest.bestMover) {
    const parts = [
      `:rocket: *Biggest mover:* ${digest.bestMover.label} ${formatDeltaPct(
        digest.bestMover.deltaPct
      )}`,
    ];
    if (
      digest.worstMover &&
      digest.worstMover.label !== digest.bestMover.label
    ) {
      parts.push(
        `:small_red_triangle_down: *Weakest:* ${
          digest.worstMover.label
        } ${formatDeltaPct(digest.worstMover.deltaPct)}`
      );
    }
    blocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: parts.join("    ·    ") }],
    });
  }

  if (digest.topSellers.length > 0) {
    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "*Top sellers*\n" +
          digest.topSellers
            .map(
              (s, i) =>
                `${i + 1}. ${slackEscape(s.title)} — ${s.units} units · £${s.sales.toFixed(2)}`
            )
            .join("\n"),
      },
    });
  }

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `Comparing ${digest.reportDate} against ${digest.compareDate}.`,
      },
    ],
  });

  return blocks;
}

export async function sendDigestSlack(
  digest: DailyDigest,
  settings: NotificationSettings
): Promise<{ ok: boolean; error?: string }> {
  const url = settings.slack_webhook_url?.trim();
  if (!url) {
    return { ok: false, error: "No Slack webhook URL configured" };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `Daily Report — ${digest.reportDateLabel}`,
        blocks: buildSlackBlocks(digest),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        error: `Slack responded ${res.status}: ${text.slice(0, 200)}`,
      };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown Slack error",
    };
  }
}
