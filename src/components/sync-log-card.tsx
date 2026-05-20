"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface SyncLogEntry {
  pillar: string;
  status: string;
  finished_at: string | null;
  rows_written: number;
  error: string | null;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function StatusIcon({ status }: { status: string }) {
  if (status === "success") {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950">
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-950">
        <XCircle className="h-4 w-4 text-rose-500" />
      </div>
    );
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-50 dark:bg-sky-950">
      <Loader2 className="h-4 w-4 text-sky-500 animate-spin" />
    </div>
  );
}

export function SyncLogCard({ logs }: { logs: SyncLogEntry[] }) {
  return (
    <Card className="overflow-hidden shadow-card ring-1 ring-border/50">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2.5 text-sm font-semibold">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-950">
            <Activity className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </div>
          Sync Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-2xl bg-violet-50 dark:bg-violet-950 p-4 mb-3">
              <Activity className="h-5 w-5 text-violet-400" />
            </div>
            <p className="text-sm font-semibold text-foreground">No syncs yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Data will appear after your first sync
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {logs.map((log, i) => (
              <div
                key={i}
                className="flex items-start gap-3 text-sm"
              >
                <StatusIcon status={log.status} />
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground capitalize text-[13px]">
                      {log.pillar}
                    </span>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {log.finished_at ? timeAgo(log.finished_at) : "running..."}
                    </span>
                  </div>
                  {log.error ? (
                    <p className="text-xs text-rose-600 dark:text-rose-400 truncate">{log.error}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {log.rows_written.toLocaleString()} rows written
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
