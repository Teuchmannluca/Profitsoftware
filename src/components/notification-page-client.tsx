"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Plus,
  Mail,
  MessageSquare,
  Pencil,
  Trash2,
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  Pause,
} from "lucide-react";
import type {
  NotificationProfile,
  NotificationLogEntry,
  BlockConfig,
} from "@/lib/notifications/types";
import {
  createNotificationProfile,
  updateNotificationProfile,
  deleteNotificationProfile,
  sendTestNotification,
} from "@/actions/notifications";
import { NotificationProfileEditor } from "@/components/notification-profile-editor";
import { DEFAULT_BLOCKS } from "@/lib/notifications/store";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatSchedule(p: NotificationProfile): string {
  const time = `${String(p.send_hour).padStart(2, "0")}:${String(p.send_minute).padStart(2, "0")}`;
  if (p.frequency === "daily") return `Daily at ${time}`;
  if (p.frequency === "weekdays") return `Weekdays at ${time}`;
  return `${DAYS[p.weekly_day ?? 0]}s at ${time}`;
}

function recipientCount(emails: string | null): number {
  if (!emails) return 0;
  return emails.split(",").filter((e) => e.trim()).length;
}

interface Props {
  initialProfiles: NotificationProfile[];
  initialHistory: NotificationLogEntry[];
}

export function NotificationPageClient({ initialProfiles, initialHistory }: Props) {
  const router = useRouter();
  const [profiles, setProfiles] = useState(initialProfiles);
  const [history] = useState(initialHistory);
  const [editing, setEditing] = useState<NotificationProfile | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  function showMessage(text: string, ok: boolean) {
    setMessage({ text, ok });
    setTimeout(() => setMessage(null), 4000);
  }

  async function handleCreate(data: Omit<NotificationProfile, "id" | "created_at" | "updated_at" | "last_sent_date">) {
    setSaving(true);
    const res = await createNotificationProfile(data);
    setSaving(false);
    if (res.error) {
      showMessage(`Error: ${res.error}`, false);
    } else {
      setCreating(false);
      showMessage("Profile created", true);
      router.refresh();
      const updatedProfiles = await fetch("/notifications").then(() => {
        window.location.reload();
        return profiles;
      });
      setProfiles(updatedProfiles);
    }
  }

  async function handleUpdate(id: string, data: Partial<NotificationProfile>) {
    setSaving(true);
    const res = await updateNotificationProfile(id, data);
    setSaving(false);
    if (res.error) {
      showMessage(`Error: ${res.error}`, false);
    } else {
      setEditing(null);
      showMessage("Profile updated", true);
      window.location.reload();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this notification profile?")) return;
    setDeleting(id);
    const res = await deleteNotificationProfile(id);
    setDeleting(null);
    if (res.error) {
      showMessage(`Error: ${res.error}`, false);
    } else {
      setProfiles(profiles.filter((p) => p.id !== id));
      showMessage("Profile deleted", true);
    }
  }

  async function handleTest(id: string) {
    setTesting(id);
    const res = await sendTestNotification(id);
    setTesting(null);
    if (res.ok) {
      showMessage("Test sent successfully", true);
    } else {
      const err = res.results.find((r) => r.error)?.error ?? res.skipped ?? "Unknown error";
      showMessage(`Test failed: ${err}`, false);
    }
  }

  async function handleToggle(profile: NotificationProfile) {
    const res = await updateNotificationProfile(profile.id, { enabled: !profile.enabled });
    if (!res.error) {
      setProfiles(profiles.map((p) => p.id === profile.id ? { ...p, enabled: !p.enabled } : p));
    }
  }

  const newProfile: Omit<NotificationProfile, "id" | "created_at" | "updated_at" | "last_sent_date"> = {
    name: "",
    enabled: true,
    email_enabled: true,
    slack_enabled: false,
    email_from: null,
    recipient_emails: null,
    slack_webhook_url: null,
    send_hour: 8,
    send_minute: 0,
    frequency: "daily",
    weekly_day: null,
    blocks: DEFAULT_BLOCKS,
  };

  if (creating) {
    return (
      <NotificationProfileEditor
        profile={newProfile as NotificationProfile}
        isNew
        saving={saving}
        onSave={(data) => handleCreate(data)}
        onCancel={() => setCreating(false)}
      />
    );
  }

  if (editing) {
    return (
      <NotificationProfileEditor
        profile={editing}
        saving={saving}
        onSave={(data) => handleUpdate(editing.id, data)}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {message && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${message.ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300"}`}>
          {message.text}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Notification Profiles</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {profiles.length === 0
              ? "No profiles yet. Create one to start receiving daily reports."
              : `${profiles.length} profile${profiles.length !== 1 ? "s" : ""} configured`}
          </p>
        </div>
        <Button onClick={() => setCreating(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Profile
        </Button>
      </div>

      {profiles.length > 0 && (
        <div className="grid gap-4">
          {profiles.map((profile) => (
            <Card key={profile.id} className="overflow-hidden shadow-card ring-1 ring-border/50">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-bold truncate">{profile.name || "Untitled"}</h3>
                      <button
                        onClick={() => handleToggle(profile)}
                        className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ring-1 transition-colors ${
                          profile.enabled
                            ? "bg-emerald-50 text-emerald-600 ring-emerald-600/10 dark:bg-emerald-950 dark:text-emerald-400 dark:ring-emerald-400/10"
                            : "bg-muted text-muted-foreground ring-border"
                        }`}
                      >
                        {profile.enabled ? (
                          <><CheckCircle2 className="h-3 w-3" /> Active</>
                        ) : (
                          <><Pause className="h-3 w-3" /> Paused</>
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-4 mt-2.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {formatSchedule(profile)}
                      </span>
                      {profile.email_enabled && (
                        <span className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5" />
                          {recipientCount(profile.recipient_emails)} recipient{recipientCount(profile.recipient_emails) !== 1 ? "s" : ""}
                        </span>
                      )}
                      {profile.slack_enabled && (
                        <span className="flex items-center gap-1.5">
                          <MessageSquare className="h-3.5 w-3.5" />
                          Slack
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-4">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleTest(profile.id)}
                      disabled={testing === profile.id}
                      title="Send Test"
                    >
                      {testing === profile.id ? (
                        <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setEditing(profile)}
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDelete(profile.id)}
                      disabled={deleting === profile.id}
                      title="Delete"
                      className="hover:text-rose-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Recent Activity</h3>
          <Card className="overflow-hidden shadow-card ring-1 ring-border/50">
            <CardContent className="p-0">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Channel</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Trigger</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Time</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {history.slice(0, 15).map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          entry.channel === "email"
                            ? "bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400"
                            : "bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400"
                        }`}>
                          {entry.channel === "email" ? <Mail className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}
                          {entry.channel}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase ${
                          entry.status === "sent" ? "text-emerald-600 dark:text-emerald-400" :
                          entry.status === "failed" ? "text-rose-600 dark:text-rose-400" :
                          "text-muted-foreground"
                        }`}>
                          {entry.status === "sent" ? <CheckCircle2 className="h-3 w-3" /> : entry.status === "failed" ? <XCircle className="h-3 w-3" /> : null}
                          {entry.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{entry.trigger}</td>
                      <td className="px-4 py-2.5 text-muted-foreground font-mono">
                        {new Date(entry.sent_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-2.5 text-rose-600 dark:text-rose-400 max-w-[200px] truncate">
                        {entry.error ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
