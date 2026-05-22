"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Mail,
  MessageSquare,
  Clock,
  Send,
  Save,
  Check,
  History,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  updateNotificationSettings,
  sendTestNotification,
} from "@/actions/notifications";
import type {
  NotificationSettings,
  NotificationLogEntry,
} from "@/lib/notifications/types";

interface Props {
  initialSettings: NotificationSettings;
  initialHistory: NotificationLogEntry[];
}

const pad = (n: number) => String(n).padStart(2, "0");

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 text-left"
    >
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {description && (
          <span className="block text-xs text-muted-foreground mt-0.5">
            {description}
          </span>
        )}
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-indigo-500" : "bg-muted"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

function statusColor(status: string) {
  if (status === "sent") return "text-emerald-600 dark:text-emerald-400";
  if (status === "failed") return "text-rose-600 dark:text-rose-400";
  return "text-muted-foreground";
}

export function NotificationSettingsForm({
  initialSettings,
  initialHistory,
}: Props) {
  const router = useRouter();

  const [enabled, setEnabled] = useState(initialSettings.enabled);
  const [emailEnabled, setEmailEnabled] = useState(
    initialSettings.email_enabled
  );
  const [slackEnabled, setSlackEnabled] = useState(
    initialSettings.slack_enabled
  );
  const [sendTime, setSendTime] = useState(
    `${pad(initialSettings.send_hour)}:${pad(initialSettings.send_minute)}`
  );
  const [emailFrom, setEmailFrom] = useState(initialSettings.email_from ?? "");
  const [recipientEmails, setRecipientEmails] = useState(
    initialSettings.recipient_emails ?? ""
  );
  const [slackWebhookUrl, setSlackWebhookUrl] = useState(
    initialSettings.slack_webhook_url ?? ""
  );

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);

    const [hourStr, minuteStr] = sendTime.split(":");
    const sendHour = Number(hourStr);
    const sendMinute = Number(minuteStr);
    if (Number.isNaN(sendHour) || Number.isNaN(sendMinute)) {
      setSaving(false);
      setError("Enter a valid send time.");
      return;
    }

    const result = await updateNotificationSettings({
      enabled,
      email_enabled: emailEnabled,
      slack_enabled: slackEnabled,
      send_hour: sendHour,
      send_minute: sendMinute,
      email_from: emailFrom.trim() || null,
      recipient_emails: recipientEmails.trim() || null,
      slack_webhook_url: slackWebhookUrl.trim() || null,
    });

    setSaving(false);

    if (result.success) {
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 3000);
    } else {
      setError(result.error ?? "Failed to save notification settings");
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    setError(null);

    try {
      const result = await sendTestNotification();

      if (result.skipped === "no_channels") {
        setTestResult({
          ok: false,
          message: "Enable Email or Slack, then save before sending a test.",
        });
      } else {
        const message = result.results
          .map((r) => {
            const channel = r.channel === "email" ? "Email" : "Slack";
            return r.status === "sent"
              ? `${channel}: sent`
              : `${channel}: failed — ${r.error ?? "unknown error"}`;
          })
          .join("  ·  ");
        setTestResult({ ok: result.ok, message: message || "Nothing to send." });
      }
      router.refresh();
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : "Test send failed.",
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-indigo">
              <Bell className="h-3.5 w-3.5 text-white" />
            </div>
            Daily Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <Toggle
              checked={enabled}
              onChange={setEnabled}
              label="Send a daily report"
              description="After the syncs each day, email a summary of the previous day's performance versus the day before."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="send-time" className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              Send time
            </Label>
            <Input
              id="send-time"
              type="time"
              value={sendTime}
              onChange={(e) => setSendTime(e.target.value)}
              className="w-40"
            />
            <p className="text-xs text-muted-foreground">
              The report is sent on the first sync at or after this time each
              day (server time). Use a time shortly after midnight for an
              early-morning report.
            </p>
          </div>

          {/* Email channel */}
          <div className="rounded-xl border border-border p-4 space-y-4">
            <Toggle
              checked={emailEnabled}
              onChange={setEmailEnabled}
              label="Email"
              description="Delivered via Resend."
            />
            <div className="space-y-2">
              <Label htmlFor="email-from" className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                From address
              </Label>
              <Input
                id="email-from"
                placeholder="LAK & Co. Reports <reports@yourdomain.com>"
                value={emailFrom}
                onChange={(e) => setEmailFrom(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Must use a Resend-verified domain. The API key is read from the{" "}
                <code className="font-mono">RESEND_API_KEY</code> environment
                variable.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="recipient-emails">Recipients</Label>
              <Input
                id="recipient-emails"
                placeholder="you@example.com, partner@example.com"
                value={recipientEmails}
                onChange={(e) => setRecipientEmails(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated list of email addresses.
              </p>
            </div>
          </div>

          {/* Slack channel */}
          <div className="rounded-xl border border-border p-4 space-y-4">
            <Toggle
              checked={slackEnabled}
              onChange={setSlackEnabled}
              label="Slack"
              description="Posted to a channel via an incoming webhook."
            />
            <div className="space-y-2">
              <Label
                htmlFor="slack-webhook"
                className="flex items-center gap-1.5"
              >
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                Incoming webhook URL
              </Label>
              <Input
                id="slack-webhook"
                placeholder="https://hooks.slack.com/services/..."
                value={slackWebhookUrl}
                onChange={(e) => setSlackWebhookUrl(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleSave} disabled={saving} size="lg">
              {saving ? (
                <>
                  <Save className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : saved ? (
                <>
                  <Check className="h-4 w-4" />
                  Saved
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Settings
                </>
              )}
            </Button>

            <Button
              onClick={handleTest}
              disabled={testing}
              size="lg"
              variant="outline"
            >
              <Send className={`h-4 w-4 ${testing ? "animate-pulse" : ""}`} />
              {testing ? "Sending..." : "Send Test Now"}
            </Button>

            {saved && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                Settings saved successfully
              </p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            {testResult && (
              <p
                className={`text-sm ${
                  testResult.ok
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-destructive"
                }`}
              >
                {testResult.message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-violet">
              <History className="h-3.5 w-3.5 text-white" />
            </div>
            Notification History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {initialHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No notifications sent yet.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {initialHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-4 py-2.5 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
                      {entry.channel === "email" ? (
                        <Mail className="h-3 w-3" />
                      ) : (
                        <MessageSquare className="h-3 w-3" />
                      )}
                      {entry.channel}
                    </span>
                    <span
                      className={`font-medium ${statusColor(entry.status)}`}
                    >
                      {entry.status}
                    </span>
                    {entry.trigger === "manual" && (
                      <span className="text-[11px] text-muted-foreground">
                        (test)
                      </span>
                    )}
                    {entry.error && (
                      <span className="truncate text-xs text-muted-foreground">
                        {entry.error}
                      </span>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(entry.sent_at).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
