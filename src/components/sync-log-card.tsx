import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity } from "lucide-react";

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

export function SyncLogCard({ logs }: { logs: SyncLogEntry[] }) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Activity className="h-4 w-4 text-muted-foreground" />
          Sync Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">
            No syncs yet
          </p>
        ) : (
          <div className="space-y-3">
            {logs.map((log, i) => (
              <div
                key={i}
                className="flex items-start justify-between gap-3 text-xs"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium capitalize">{log.pillar}</span>
                    <Badge
                      variant={log.status === "success" ? "default" : log.status === "running" ? "secondary" : "destructive"}
                      className="h-4 px-1.5 text-[10px]"
                    >
                      {log.status}
                    </Badge>
                  </div>
                  {log.error ? (
                    <p className="text-destructive truncate">{log.error}</p>
                  ) : (
                    <p className="text-muted-foreground">
                      {log.rows_written} rows written
                    </p>
                  )}
                </div>
                <span className="text-muted-foreground whitespace-nowrap">
                  {log.finished_at ? timeAgo(log.finished_at) : "running..."}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
