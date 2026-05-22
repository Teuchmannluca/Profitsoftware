"use client";

import { useState, useMemo, useTransition, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight, Loader2 } from "lucide-react";
import type { PpcProductRow } from "@/lib/queries/ppc";
import {
  getPpcCampaigns,
  getPpcAdGroups,
  getPpcKeywords,
  type PpcCampaignRow,
  type PpcAdGroupRow,
  type PpcKeywordRow,
} from "@/actions/ppc-drilldown";

type Filter = "all" | "profitable" | "losing" | "high_acos" | "no_ads";
type SortCol = "ad_spend" | "ad_sales" | "acos" | "tacos" | "roas" | "total_sales" | "organic_ratio" | "profit";

const GBP = (v: number) => `£${v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const PCT = (v: number) => `${v.toFixed(1)}%`;
const NUM = (v: number) => v.toLocaleString("en-GB");

function acosColor(v: number) {
  if (v === 0) return "text-muted-foreground";
  if (v < 25) return "text-emerald-600 dark:text-emerald-400";
  if (v < 40) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

function roasColor(v: number) {
  if (v === 0) return "text-muted-foreground";
  if (v >= 4) return "text-emerald-600 dark:text-emerald-400";
  if (v >= 2) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

function profitColor(v: number) {
  if (v > 0) return "text-emerald-600 dark:text-emerald-400";
  if (v < 0) return "text-rose-600 dark:text-rose-400";
  return "text-muted-foreground";
}

function MatchBadge({ type }: { type: string }) {
  if (!type) return null;
  const label = type.replace("TARGETING_EXPRESSION", "PRODUCT").replace("_", " ");
  const colors: Record<string, string> = {
    EXACT: "bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-950 dark:text-emerald-400 dark:ring-emerald-400/15",
    PHRASE: "bg-sky-50 text-sky-700 ring-sky-600/15 dark:bg-sky-950 dark:text-sky-400 dark:ring-sky-400/15",
    BROAD: "bg-amber-50 text-amber-700 ring-amber-600/15 dark:bg-amber-950 dark:text-amber-400 dark:ring-amber-400/15",
  };
  const cls = colors[type] ?? "bg-zinc-100 text-zinc-500 ring-zinc-300/30 dark:bg-zinc-900 dark:text-zinc-500 dark:ring-zinc-600/30";
  return (
    <span className={`inline-flex text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ring-1 ${cls}`}>
      {label}
    </span>
  );
}

interface DrilldownState {
  campaigns: Map<string, { loading: boolean; data: PpcCampaignRow[] }>;
  adGroups: Map<string, { loading: boolean; data: PpcAdGroupRow[] }>;
  keywords: Map<string, { loading: boolean; data: PpcKeywordRow[] }>;
}

export function PpcTable({
  rows,
  from,
  to,
}: {
  rows: PpcProductRow[];
  from: string;
  to: string;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sortCol, setSortCol] = useState<SortCol>("ad_spend");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expandedAsins, setExpandedAsins] = useState<Set<string>>(new Set());
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [expandedAdGroups, setExpandedAdGroups] = useState<Set<string>>(new Set());
  const [drilldown, setDrilldown] = useState<DrilldownState>({
    campaigns: new Map(),
    adGroups: new Map(),
    keywords: new Map(),
  });
  const [, startTransition] = useTransition();

  const fromDate = useMemo(() => new Date(from), [from]);
  const toDate = useMemo(() => new Date(to), [to]);

  const filtered = useMemo(() => {
    let base = rows;
    if (filter === "profitable") base = rows.filter((r) => r.profit > 0);
    else if (filter === "losing") base = rows.filter((r) => r.profit <= 0 && r.adSpend > 0);
    else if (filter === "high_acos") base = rows.filter((r) => r.acos > 40);
    else if (filter === "no_ads") base = rows.filter((r) => r.adSpend === 0);

    return [...base].sort((a, b) => {
      const av = a[sortCol === "ad_spend" ? "adSpend" : sortCol === "ad_sales" ? "adSales" : sortCol === "total_sales" ? "totalSales" : sortCol === "organic_ratio" ? "organicRatio" : sortCol] ?? 0;
      const bv = b[sortCol === "ad_spend" ? "adSpend" : sortCol === "ad_sales" ? "adSales" : sortCol === "total_sales" ? "totalSales" : sortCol === "organic_ratio" ? "organicRatio" : sortCol] ?? 0;
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [rows, filter, sortCol, sortDir]);

  const counts = useMemo(() => ({
    all: rows.length,
    profitable: rows.filter((r) => r.profit > 0).length,
    losing: rows.filter((r) => r.profit <= 0 && r.adSpend > 0).length,
    high_acos: rows.filter((r) => r.acos > 40).length,
    no_ads: rows.filter((r) => r.adSpend === 0).length,
  }), [rows]);

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "All Products", count: counts.all },
    { key: "profitable", label: "Profitable", count: counts.profitable },
    { key: "losing", label: "Losing Money", count: counts.losing },
    { key: "high_acos", label: "High ACoS", count: counts.high_acos },
    { key: "no_ads", label: "No Ads", count: counts.no_ads },
  ];

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("desc"); }
  }

  const sortArrow = (col: SortCol) =>
    sortCol === col ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  const toggleAsin = useCallback((asin: string) => {
    setExpandedAsins((prev) => {
      const next = new Set(prev);
      if (next.has(asin)) {
        next.delete(asin);
      } else {
        next.add(asin);
        if (!drilldown.campaigns.has(asin)) {
          setDrilldown((d) => {
            const campaigns = new Map(d.campaigns);
            campaigns.set(asin, { loading: true, data: [] });
            return { ...d, campaigns };
          });
          startTransition(async () => {
            const data = await getPpcCampaigns(asin, fromDate, toDate);
            setDrilldown((d) => {
              const campaigns = new Map(d.campaigns);
              campaigns.set(asin, { loading: false, data });
              return { ...d, campaigns };
            });
          });
        }
      }
      return next;
    });
  }, [drilldown.campaigns, fromDate, toDate]);

  const toggleCampaign = useCallback((asin: string, campaignId: string) => {
    const key = `${asin}::${campaignId}`;
    setExpandedCampaigns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        if (!drilldown.adGroups.has(key)) {
          setDrilldown((d) => {
            const adGroups = new Map(d.adGroups);
            adGroups.set(key, { loading: true, data: [] });
            return { ...d, adGroups };
          });
          startTransition(async () => {
            const data = await getPpcAdGroups(asin, campaignId, fromDate, toDate);
            setDrilldown((d) => {
              const adGroups = new Map(d.adGroups);
              adGroups.set(key, { loading: false, data });
              return { ...d, adGroups };
            });
          });
        }
      }
      return next;
    });
  }, [drilldown.adGroups, fromDate, toDate]);

  const toggleAdGroup = useCallback((asin: string, campaignId: string, adGroupId: string) => {
    const key = `${asin}::${campaignId}::${adGroupId}`;
    setExpandedAdGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        if (!drilldown.keywords.has(key)) {
          setDrilldown((d) => {
            const keywords = new Map(d.keywords);
            keywords.set(key, { loading: true, data: [] });
            return { ...d, keywords };
          });
          startTransition(async () => {
            const data = await getPpcKeywords(adGroupId, fromDate, toDate);
            setDrilldown((d) => {
              const keywords = new Map(d.keywords);
              keywords.set(key, { loading: false, data });
              return { ...d, keywords };
            });
          });
        }
      }
      return next;
    });
  }, [drilldown.keywords, fromDate, toDate]);

  const SortHead = ({ col, children, className }: { col: SortCol; children: React.ReactNode; className?: string }) => (
    <TableHead
      className={`text-right cursor-pointer select-none whitespace-nowrap ${className ?? ""}`}
      onClick={() => toggleSort(col)}
    >
      {children}{sortArrow(col)}
    </TableHead>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ring-1 ${
              filter === f.key
                ? "bg-primary text-primary-foreground ring-primary"
                : "bg-card text-muted-foreground ring-border/50 hover:bg-muted"
            }`}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      <Card className="overflow-hidden shadow-card ring-1 ring-border/50">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]" />
                  <TableHead className="w-[280px]">Product</TableHead>
                  <SortHead col="ad_spend">Ad Spend</SortHead>
                  <SortHead col="ad_sales">Ad Sales</SortHead>
                  <SortHead col="acos">ACoS</SortHead>
                  <SortHead col="tacos">TACoS</SortHead>
                  <SortHead col="roas">ROAS</SortHead>
                  <SortHead col="total_sales">Total Sales</SortHead>
                  <SortHead col="organic_ratio">Organic %</SortHead>
                  <SortHead col="profit">Profit</SortHead>
                  <TableHead className="text-right whitespace-nowrap">Impr.</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Clicks</TableHead>
                  <TableHead className="text-right whitespace-nowrap">CTR</TableHead>
                  <TableHead className="text-right whitespace-nowrap">CPC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={14} className="text-center py-12 text-muted-foreground">
                      No products found
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((row) => {
                  const isExpanded = expandedAsins.has(row.asin);
                  const ctr = row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0;
                  const cpc = row.clicks > 0 ? row.adSpend / row.clicks : 0;
                  const campaignState = drilldown.campaigns.get(row.asin);

                  return (
                    <ProductRows
                      key={row.asin}
                      row={row}
                      ctr={ctr}
                      cpc={cpc}
                      isExpanded={isExpanded}
                      onToggle={() => toggleAsin(row.asin)}
                      campaignState={campaignState}
                      expandedCampaigns={expandedCampaigns}
                      expandedAdGroups={expandedAdGroups}
                      drilldown={drilldown}
                      onToggleCampaign={(cId) => toggleCampaign(row.asin, cId)}
                      onToggleAdGroup={(cId, agId) => toggleAdGroup(row.asin, cId, agId)}
                    />
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ProductRows({
  row,
  ctr,
  cpc,
  isExpanded,
  onToggle,
  campaignState,
  expandedCampaigns,
  expandedAdGroups,
  drilldown,
  onToggleCampaign,
  onToggleAdGroup,
}: {
  row: PpcProductRow;
  ctr: number;
  cpc: number;
  isExpanded: boolean;
  onToggle: () => void;
  campaignState?: { loading: boolean; data: PpcCampaignRow[] };
  expandedCampaigns: Set<string>;
  expandedAdGroups: Set<string>;
  drilldown: DrilldownState;
  onToggleCampaign: (campaignId: string) => void;
  onToggleAdGroup: (campaignId: string, adGroupId: string) => void;
}) {
  const borderColor = row.profit > 0
    ? "border-l-emerald-500 dark:border-l-emerald-600"
    : row.profit < 0
    ? "border-l-rose-500 dark:border-l-rose-600"
    : "border-l-transparent";

  return (
    <>
      <TableRow className={`group border-l-2 ${borderColor} cursor-pointer hover:bg-muted/50`} onClick={onToggle}>
        <TableCell className="w-[40px] px-2">
          {row.adSpend > 0 && (
            <ChevronRight
              className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`}
            />
          )}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-3">
            {row.imageUrl ? (
              <Image
                src={row.imageUrl}
                alt={row.title ?? row.asin}
                width={36}
                height={36}
                className="rounded-lg object-cover ring-1 ring-border/50 shrink-0"
              />
            ) : (
              <div className="h-9 w-9 rounded-lg bg-muted shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate max-w-[220px]">
                <Link href={`/product/${row.asin}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                  {row.title ?? "Unknown"}
                </Link>
              </p>
              <p className="text-[10px] text-muted-foreground font-mono">{row.asin}</p>
            </div>
          </div>
        </TableCell>
        <TableCell className="text-right font-mono text-sm">{row.adSpend > 0 ? GBP(row.adSpend) : <span className="text-muted-foreground">—</span>}</TableCell>
        <TableCell className="text-right font-mono text-sm">{row.adSales > 0 ? GBP(row.adSales) : <span className="text-muted-foreground">—</span>}</TableCell>
        <TableCell className={`text-right font-mono text-sm font-semibold ${acosColor(row.acos)}`}>{row.adSpend > 0 ? PCT(row.acos) : <span className="text-muted-foreground">—</span>}</TableCell>
        <TableCell className={`text-right font-mono text-sm ${acosColor(row.tacos)}`}>{row.adSpend > 0 ? PCT(row.tacos) : <span className="text-muted-foreground">—</span>}</TableCell>
        <TableCell className={`text-right font-mono text-sm font-semibold ${roasColor(row.roas)}`}>{row.adSpend > 0 ? `${row.roas.toFixed(2)}x` : <span className="text-muted-foreground">—</span>}</TableCell>
        <TableCell className="text-right font-mono text-sm">{row.totalSales > 0 ? GBP(row.totalSales) : <span className="text-muted-foreground">—</span>}</TableCell>
        <TableCell className="text-right font-mono text-sm">
          {row.totalSales > 0 ? (
            <div className="flex items-center justify-end gap-2">
              <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${Math.min(row.organicRatio, 100)}%` }}
                />
              </div>
              <span>{PCT(row.organicRatio)}</span>
            </div>
          ) : <span className="text-muted-foreground">—</span>}
        </TableCell>
        <TableCell className={`text-right font-mono text-sm font-semibold ${profitColor(row.profit)}`}>
          {row.totalSales > 0 || row.adSpend > 0 ? GBP(row.profit) : <span className="text-muted-foreground">—</span>}
        </TableCell>
        <TableCell className="text-right font-mono text-xs text-muted-foreground">{row.impressions > 0 ? NUM(row.impressions) : "—"}</TableCell>
        <TableCell className="text-right font-mono text-xs text-muted-foreground">{row.clicks > 0 ? NUM(row.clicks) : "—"}</TableCell>
        <TableCell className="text-right font-mono text-xs text-muted-foreground">{row.impressions > 0 ? PCT(ctr) : "—"}</TableCell>
        <TableCell className="text-right font-mono text-xs text-muted-foreground">{row.clicks > 0 ? GBP(cpc) : "—"}</TableCell>
      </TableRow>

      {isExpanded && campaignState && (
        <>
          {campaignState.loading && (
            <TableRow>
              <TableCell colSpan={14} className="bg-muted/30">
                <div className="flex items-center gap-2 pl-12 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading campaigns...
                </div>
              </TableCell>
            </TableRow>
          )}
          {!campaignState.loading && campaignState.data.length === 0 && (
            <TableRow>
              <TableCell colSpan={14} className="bg-muted/30 text-center py-4 text-xs text-muted-foreground">
                No campaign data
              </TableCell>
            </TableRow>
          )}
          {!campaignState.loading && campaignState.data.map((c) => {
            const campaignKey = `${row.asin}::${c.campaignId}`;
            const isCampaignExpanded = expandedCampaigns.has(campaignKey);
            const adGroupState = drilldown.adGroups.get(campaignKey);
            const cAcos = c.adSales > 0 ? (c.spend / c.adSales) * 100 : 0;
            const cRoas = c.spend > 0 ? c.adSales / c.spend : 0;

            return (
              <CampaignRows
                key={c.campaignId}
                campaign={c}
                asin={row.asin}
                acos={cAcos}
                roas={cRoas}
                isExpanded={isCampaignExpanded}
                onToggle={() => onToggleCampaign(c.campaignId)}
                adGroupState={adGroupState}
                expandedAdGroups={expandedAdGroups}
                drilldown={drilldown}
                onToggleAdGroup={(agId) => onToggleAdGroup(c.campaignId, agId)}
              />
            );
          })}
        </>
      )}
    </>
  );
}

function CampaignRows({
  campaign: c,
  asin,
  acos,
  roas,
  isExpanded,
  onToggle,
  adGroupState,
  expandedAdGroups,
  drilldown,
  onToggleAdGroup,
}: {
  campaign: PpcCampaignRow;
  asin: string;
  acos: number;
  roas: number;
  isExpanded: boolean;
  onToggle: () => void;
  adGroupState?: { loading: boolean; data: PpcAdGroupRow[] };
  expandedAdGroups: Set<string>;
  drilldown: DrilldownState;
  onToggleAdGroup: (adGroupId: string) => void;
}) {
  const campaignKey = `${asin}::${c.campaignId}`;
  const ctr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0;
  const cpc = c.clicks > 0 ? c.spend / c.clicks : 0;

  return (
    <>
      <TableRow className="bg-muted/20 border-l-2 border-l-sky-400/50 cursor-pointer hover:bg-muted/40" onClick={onToggle}>
        <TableCell className="px-2" />
        <TableCell className="pl-10">
          <div className="flex items-center gap-2">
            <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
            <div>
              <p className="text-xs font-medium truncate max-w-[200px]">{c.campaignName}</p>
              <p className="text-[10px] text-muted-foreground font-mono">Campaign</p>
            </div>
          </div>
        </TableCell>
        <TableCell className="text-right font-mono text-xs">{GBP(c.spend)}</TableCell>
        <TableCell className="text-right font-mono text-xs">{GBP(c.adSales)}</TableCell>
        <TableCell className={`text-right font-mono text-xs ${acosColor(acos)}`}>{c.adSales > 0 ? PCT(acos) : "—"}</TableCell>
        <TableCell className="text-right font-mono text-xs text-muted-foreground">—</TableCell>
        <TableCell className={`text-right font-mono text-xs ${roasColor(roas)}`}>{c.spend > 0 ? `${roas.toFixed(2)}x` : "—"}</TableCell>
        <TableCell className="text-right font-mono text-xs text-muted-foreground">—</TableCell>
        <TableCell className="text-right font-mono text-xs text-muted-foreground">—</TableCell>
        <TableCell className="text-right font-mono text-xs text-muted-foreground">—</TableCell>
        <TableCell className="text-right font-mono text-xs text-muted-foreground">{NUM(c.impressions)}</TableCell>
        <TableCell className="text-right font-mono text-xs text-muted-foreground">{NUM(c.clicks)}</TableCell>
        <TableCell className="text-right font-mono text-xs text-muted-foreground">{c.impressions > 0 ? PCT(ctr) : "—"}</TableCell>
        <TableCell className="text-right font-mono text-xs text-muted-foreground">{c.clicks > 0 ? GBP(cpc) : "—"}</TableCell>
      </TableRow>

      {isExpanded && adGroupState && (
        <>
          {adGroupState.loading && (
            <TableRow>
              <TableCell colSpan={14} className="bg-muted/40">
                <div className="flex items-center gap-2 pl-16 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading ad groups...
                </div>
              </TableCell>
            </TableRow>
          )}
          {!adGroupState.loading && adGroupState.data.map((ag) => {
            const agKey = `${campaignKey}::${ag.adGroupId}`;
            const isAgExpanded = expandedAdGroups.has(agKey);
            const kwState = drilldown.keywords.get(agKey);
            const agAcos = ag.adSales > 0 ? (ag.spend / ag.adSales) * 100 : 0;
            const agRoas = ag.spend > 0 ? ag.adSales / ag.spend : 0;
            const agCtr = ag.impressions > 0 ? (ag.clicks / ag.impressions) * 100 : 0;
            const agCpc = ag.clicks > 0 ? ag.spend / ag.clicks : 0;

            return (
              <AdGroupRows
                key={ag.adGroupId}
                adGroup={ag}
                agKey={agKey}
                acos={agAcos}
                roas={agRoas}
                ctr={agCtr}
                cpc={agCpc}
                isExpanded={isAgExpanded}
                onToggle={() => onToggleAdGroup(ag.adGroupId)}
                kwState={kwState}
              />
            );
          })}
        </>
      )}
    </>
  );
}

function AdGroupRows({
  adGroup: ag,
  agKey: _agKey,
  acos,
  roas,
  ctr,
  cpc,
  isExpanded,
  onToggle,
  kwState,
}: {
  adGroup: PpcAdGroupRow;
  agKey: string;
  acos: number;
  roas: number;
  ctr: number;
  cpc: number;
  isExpanded: boolean;
  onToggle: () => void;
  kwState?: { loading: boolean; data: PpcKeywordRow[] };
}) {
  return (
    <>
      <TableRow className="bg-muted/35 border-l-2 border-l-violet-400/50 cursor-pointer hover:bg-muted/50" onClick={onToggle}>
        <TableCell className="px-2" />
        <TableCell className="pl-16">
          <div className="flex items-center gap-2">
            <ChevronRight className={`h-3 w-3 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
            <div>
              <p className="text-[11px] font-medium truncate max-w-[180px]">{ag.adGroupName}</p>
              <p className="text-[10px] text-muted-foreground font-mono">Ad Group</p>
            </div>
          </div>
        </TableCell>
        <TableCell className="text-right font-mono text-xs">{GBP(ag.spend)}</TableCell>
        <TableCell className="text-right font-mono text-xs">{GBP(ag.adSales)}</TableCell>
        <TableCell className={`text-right font-mono text-xs ${acosColor(acos)}`}>{ag.adSales > 0 ? PCT(acos) : "—"}</TableCell>
        <TableCell className="text-right font-mono text-xs text-muted-foreground">—</TableCell>
        <TableCell className={`text-right font-mono text-xs ${roasColor(roas)}`}>{ag.spend > 0 ? `${roas.toFixed(2)}x` : "—"}</TableCell>
        <TableCell className="text-right font-mono text-xs text-muted-foreground">—</TableCell>
        <TableCell className="text-right font-mono text-xs text-muted-foreground">—</TableCell>
        <TableCell className="text-right font-mono text-xs text-muted-foreground">—</TableCell>
        <TableCell className="text-right font-mono text-xs text-muted-foreground">{NUM(ag.impressions)}</TableCell>
        <TableCell className="text-right font-mono text-xs text-muted-foreground">{NUM(ag.clicks)}</TableCell>
        <TableCell className="text-right font-mono text-xs text-muted-foreground">{ag.impressions > 0 ? PCT(ctr) : "—"}</TableCell>
        <TableCell className="text-right font-mono text-xs text-muted-foreground">{ag.clicks > 0 ? GBP(cpc) : "—"}</TableCell>
      </TableRow>

      {isExpanded && kwState && (
        <>
          {kwState.loading && (
            <TableRow>
              <TableCell colSpan={14} className="bg-muted/50">
                <div className="flex items-center gap-2 pl-20 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading keywords...
                </div>
              </TableCell>
            </TableRow>
          )}
          {!kwState.loading && kwState.data.length === 0 && (
            <TableRow>
              <TableCell colSpan={14} className="bg-muted/50 text-center py-3 text-xs text-muted-foreground">
                No keyword data
              </TableCell>
            </TableRow>
          )}
          {!kwState.loading && kwState.data.map((kw) => {
            const kwAcos = kw.adSales > 0 ? (kw.spend / kw.adSales) * 100 : 0;
            const kwCpc = kw.clicks > 0 ? kw.spend / kw.clicks : 0;
            const kwCtr = kw.impressions > 0 ? (kw.clicks / kw.impressions) * 100 : 0;

            return (
              <TableRow key={kw.targetingId} className="bg-muted/50 border-l-2 border-l-amber-400/40">
                <TableCell className="px-2" />
                <TableCell className="pl-20">
                  <div className="flex items-center gap-2">
                    <div>
                      <p className="text-[11px] font-mono">{kw.targetingText || "—"}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <MatchBadge type={kw.matchType} />
                        {kw.targetingType && kw.targetingType !== "KEYWORD" && (
                          <span className="text-[9px] text-muted-foreground uppercase">{kw.targetingType}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono text-xs">{GBP(kw.spend)}</TableCell>
                <TableCell className="text-right font-mono text-xs">{GBP(kw.adSales)}</TableCell>
                <TableCell className={`text-right font-mono text-xs ${acosColor(kwAcos)}`}>{kw.adSales > 0 ? PCT(kwAcos) : "—"}</TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground">—</TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground">—</TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground">—</TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground">—</TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground">—</TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground">{NUM(kw.impressions)}</TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground">{NUM(kw.clicks)}</TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground">{kw.impressions > 0 ? PCT(kwCtr) : "—"}</TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground">{kw.clicks > 0 ? GBP(kwCpc) : "—"}</TableCell>
              </TableRow>
            );
          })}
        </>
      )}
    </>
  );
}
