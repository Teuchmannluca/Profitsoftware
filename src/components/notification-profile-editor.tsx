"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Mail,
  MessageSquare,
  Clock,
  Layers,
  Save,
} from "lucide-react";
import type { NotificationProfile, BlockConfig } from "@/lib/notifications/types";

const ALL_METRICS = [
  { key: "revenue", label: "Revenue" },
  { key: "profit", label: "Profit" },
  { key: "margin", label: "Margin" },
  { key: "roi", label: "ROI" },
  { key: "orders", label: "Orders" },
  { key: "units", label: "Units Sold" },
  { key: "adSpend", label: "Ad Spend" },
  { key: "expenses", label: "Expenses" },
  { key: "cogs", label: "COGS" },
  { key: "fees", label: "Fees" },
];

const BLOCK_LABELS: Record<string, string> = {
  kpis: "KPI Cards",
  topSellers: "Top Sellers",
  movers: "Movers (Best Win / Weakest)",
  costBreakdown: "Cost Breakdown",
};

const DAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

type Tab = "content" | "channels" | "schedule";

interface Props {
  profile: NotificationProfile;
  isNew?: boolean;
  saving: boolean;
  onSave: (data: Omit<NotificationProfile, "id" | "created_at" | "updated_at" | "last_sent_date">) => void;
  onCancel: () => void;
}

export function NotificationProfileEditor({ profile, isNew, saving, onSave, onCancel }: Props) {
  const [tab, setTab] = useState<Tab>("content");
  const [name, setName] = useState(profile.name);
  const [enabled, setEnabled] = useState(profile.enabled);
  const [emailEnabled, setEmailEnabled] = useState(profile.email_enabled);
  const [slackEnabled, setSlackEnabled] = useState(profile.slack_enabled);
  const [emailFrom, setEmailFrom] = useState(profile.email_from ?? "");
  const [recipientEmails, setRecipientEmails] = useState(profile.recipient_emails ?? "");
  const [slackWebhookUrl, setSlackWebhookUrl] = useState(profile.slack_webhook_url ?? "");
  const [sendHour, setSendHour] = useState(profile.send_hour);
  const [sendMinute, setSendMinute] = useState(profile.send_minute);
  const [frequency, setFrequency] = useState(profile.frequency);
  const [weeklyDay, setWeeklyDay] = useState(profile.weekly_day ?? 1);
  const [blocks, setBlocks] = useState<BlockConfig[]>(profile.blocks);

  function toggleBlock(key: string) {
    setBlocks(blocks.map((b) => b.key === key ? { ...b, enabled: !b.enabled } : b));
  }

  function toggleMetric(metricKey: string) {
    setBlocks(blocks.map((b) => {
      if (b.key !== "kpis") return b;
      const metrics = b.metrics ?? ALL_METRICS.map((m) => m.key);
      const next = metrics.includes(metricKey)
        ? metrics.filter((k) => k !== metricKey)
        : [...metrics, metricKey];
      return { ...b, metrics: next };
    }));
  }

  function setSellerCount(count: number) {
    setBlocks(blocks.map((b) => b.key === "topSellers" ? { ...b, count } : b));
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    setBlocks(next);
  }

  function handleSubmit() {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      enabled,
      email_enabled: emailEnabled,
      slack_enabled: slackEnabled,
      email_from: emailFrom.trim() || null,
      recipient_emails: recipientEmails.trim() || null,
      slack_webhook_url: slackWebhookUrl.trim() || null,
      send_hour: sendHour,
      send_minute: sendMinute,
      frequency,
      weekly_day: frequency === "weekly" ? weeklyDay : null,
      blocks,
    });
  }

  const kpiBlock = blocks.find((b) => b.key === "kpis");
  const sellerBlock = blocks.find((b) => b.key === "topSellers");
  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "content", label: "Content", icon: Layers },
    { key: "channels", label: "Channels", icon: Mail },
    { key: "schedule", label: "Schedule", icon: Clock },
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-lg font-semibold">{isNew ? "Create Profile" : "Edit Profile"}</h2>
          <p className="text-xs text-muted-foreground">Configure notification content, channels, and schedule</p>
        </div>
      </div>

      <div>
        <Label htmlFor="profile-name">Profile Name</Label>
        <Input
          id="profile-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Daily P&L Report"
          className="mt-1.5 max-w-md"
        />
      </div>

      <div className="flex gap-1 bg-muted/50 rounded-xl p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
              tab === t.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "content" && (
        <Card className="shadow-card ring-1 ring-border/50">
          <CardContent className="p-5 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email & Slack Content Blocks</p>
            <div className="space-y-2">
              {blocks.map((block, i) => (
                <div
                  key={block.key}
                  className={`rounded-xl border p-4 transition-colors ${
                    block.enabled ? "border-border bg-card" : "border-border/40 bg-muted/30 opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => moveBlock(i, -1)}
                          disabled={i === 0}
                          className="p-0.5 text-muted-foreground/50 hover:text-foreground disabled:opacity-20"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => moveBlock(i, 1)}
                          disabled={i === blocks.length - 1}
                          className="p-0.5 text-muted-foreground/50 hover:text-foreground disabled:opacity-20"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="text-sm font-semibold">{BLOCK_LABELS[block.key] ?? block.key}</span>
                    </div>
                    <button
                      onClick={() => toggleBlock(block.key)}
                      className={`relative w-10 h-5 rounded-full transition-colors ${
                        block.enabled ? "bg-indigo-500" : "bg-muted-foreground/20"
                      }`}
                    >
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        block.enabled ? "translate-x-5" : "translate-x-0.5"
                      }`} />
                    </button>
                  </div>

                  {block.key === "kpis" && block.enabled && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {ALL_METRICS.map((m) => {
                        const active = kpiBlock?.metrics?.includes(m.key) ?? true;
                        return (
                          <button
                            key={m.key}
                            onClick={() => toggleMetric(m.key)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                              active
                                ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:ring-indigo-800"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {m.label}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {block.key === "topSellers" && block.enabled && (
                    <div className="mt-3 flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">Show top</span>
                      <select
                        value={sellerBlock?.count ?? 10}
                        onChange={(e) => setSellerCount(Number(e.target.value))}
                        className="rounded-lg border border-border bg-card px-2 py-1 text-xs"
                      >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                      </select>
                      <span className="text-xs text-muted-foreground">sellers</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "channels" && (
        <Card className="shadow-card ring-1 ring-border/50">
          <CardContent className="p-5 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-sky-500" />
                  <span className="text-sm font-semibold">Email</span>
                </div>
                <button
                  onClick={() => setEmailEnabled(!emailEnabled)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    emailEnabled ? "bg-indigo-500" : "bg-muted-foreground/20"
                  }`}
                >
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    emailEnabled ? "translate-x-5" : "translate-x-0.5"
                  }`} />
                </button>
              </div>
              {emailEnabled && (
                <div className="space-y-3 pl-6">
                  <div>
                    <Label htmlFor="email-from">From Address</Label>
                    <Input
                      id="email-from"
                      value={emailFrom}
                      onChange={(e) => setEmailFrom(e.target.value)}
                      placeholder="reports@yourdomain.com"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="recipients">Recipient Emails</Label>
                    <Input
                      id="recipients"
                      value={recipientEmails}
                      onChange={(e) => setRecipientEmails(e.target.value)}
                      placeholder="email1@example.com, email2@example.com"
                      className="mt-1"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">Comma-separated list of email addresses</p>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-border/50 pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-violet-500" />
                  <span className="text-sm font-semibold">Slack</span>
                </div>
                <button
                  onClick={() => setSlackEnabled(!slackEnabled)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    slackEnabled ? "bg-indigo-500" : "bg-muted-foreground/20"
                  }`}
                >
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    slackEnabled ? "translate-x-5" : "translate-x-0.5"
                  }`} />
                </button>
              </div>
              {slackEnabled && (
                <div className="pl-6">
                  <Label htmlFor="slack-webhook">Webhook URL</Label>
                  <Input
                    id="slack-webhook"
                    value={slackWebhookUrl}
                    onChange={(e) => setSlackWebhookUrl(e.target.value)}
                    placeholder="https://hooks.slack.com/services/..."
                    className="mt-1"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "schedule" && (
        <Card className="shadow-card ring-1 ring-border/50">
          <CardContent className="p-5 space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Active</span>
              <button
                onClick={() => setEnabled(!enabled)}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  enabled ? "bg-emerald-500" : "bg-muted-foreground/20"
                }`}
              >
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  enabled ? "translate-x-5" : "translate-x-0.5"
                }`} />
              </button>
            </div>

            <div>
              <Label>Send Time</Label>
              <div className="flex items-center gap-2 mt-1.5">
                <select
                  value={sendHour}
                  onChange={(e) => setSendHour(Number(e.target.value))}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{String(i).padStart(2, "0")}</option>
                  ))}
                </select>
                <span className="text-lg font-bold text-muted-foreground">:</span>
                <select
                  value={sendMinute}
                  onChange={(e) => setSendMinute(Number(e.target.value))}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
                >
                  {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                    <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <Label>Frequency</Label>
              <div className="flex gap-2 mt-1.5">
                {(["daily", "weekdays", "weekly"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFrequency(f)}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                      frequency === f
                        ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:ring-indigo-800"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f === "daily" ? "Every Day" : f === "weekdays" ? "Weekdays" : "Weekly"}
                  </button>
                ))}
              </div>
            </div>

            {frequency === "weekly" && (
              <div>
                <Label>Day of Week</Label>
                <select
                  value={weeklyDay}
                  onChange={(e) => setWeeklyDay(Number(e.target.value))}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-sm mt-1.5"
                >
                  {DAYS.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={handleSubmit} disabled={saving || !name.trim()} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : isNew ? "Create Profile" : "Save Changes"}
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
