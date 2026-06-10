import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { computeWeekReport } from "@/lib/report/compute";
import { bandFor } from "@/lib/report/health";
import { localToday, weekBounds, previousWeekStart, addDays, formatDateLabel, type IsoDate } from "@/lib/time";
import { formatMAD, formatDelta, formatNumber } from "@/lib/format";
import { HealthBadge, BAND_TEXT } from "@/components/report/health-badge";
import { RevenueChart, type RevenueChartRow } from "@/components/report/revenue-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { ProjectWeekReport } from "@/lib/report/types";

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week: weekParam } = await searchParams;
  const today = localToday();
  const currentWeekStart = weekBounds(today).start;

  // Default to current week; snap whatever is passed to its Monday.
  const requestedWeek: IsoDate = weekParam ?? currentWeekStart;
  const { start: weekStart, end: weekEnd } = weekBounds(requestedWeek);

  const supabase = await createClient();
  const report = await computeWeekReport(supabase, weekStart);

  const prevWeekStart = previousWeekStart(weekStart);
  const nextWeekStart = addDays(weekStart, 7);
  const isCurrentWeek = weekStart === currentWeekStart;

  const overallDelta =
    report.overall !== null && report.lastWeekOverall !== null
      ? report.overall - report.lastWeekOverall
      : null;
  const overallBand = bandFor(report.overall);

  const revenueChartData: RevenueChartRow[] = report.projects.map((p) => ({
    name: p.project.name,
    thisWeek: p.revenueMad,
    lastWeek: p.lastWeekRevenueMad,
  }));

  const hasRevenue = report.projects.some(
    (p) => p.revenueMad > 0 || p.lastWeekRevenueMad > 0,
  );

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Weekly Report</h1>
          <p className="text-sm text-muted-foreground">
            {formatDateLabel(weekStart)} — {formatDateLabel(weekEnd)}
          </p>
        </div>
        {/* Week navigator */}
        <div className="flex items-center gap-1">
          <Link
            href={`/report?week=${prevWeekStart}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background text-sm hover:bg-accent"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="min-w-[110px] text-center text-sm font-medium">
            {isCurrentWeek ? "This week" : formatDateLabel(weekStart).slice(4)}
          </span>
          {isCurrentWeek ? (
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-muted text-muted-foreground opacity-50 cursor-not-allowed">
              <ChevronRight className="h-4 w-4" />
            </span>
          ) : (
            <Link
              href={`/report?week=${nextWeekStart}`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background text-sm hover:bg-accent"
              aria-label="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>

      {/* Overall hero */}
      <Card>
        <CardContent className="flex flex-col items-center gap-1 py-8">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Overall Health
          </p>
          <p className={`text-6xl font-bold tabular-nums ${BAND_TEXT[overallBand]}`}>
            {report.overall === null ? "—" : `${Math.round(report.overall)}%`}
          </p>
          {overallDelta !== null && (
            <p className="text-sm text-muted-foreground">
              {formatDelta(overallDelta, "%")} vs last week
            </p>
          )}
          <HealthBadge score={report.overall} band={overallBand} className="mt-1" />
        </CardContent>
      </Card>

      {/* Revenue chart */}
      {hasRevenue && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue by Project</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueChart data={revenueChartData} />
          </CardContent>
        </Card>
      )}

      {/* Per-project cards */}
      <div className="space-y-4">
        {report.projects.map((p) => (
          <ProjectReportCard key={p.project.id} p={p} weekStart={weekStart} />
        ))}
      </div>
    </div>
  );
}

function ProjectReportCard({
  p,
  weekStart,
}: {
  p: ProjectWeekReport;
  weekStart: IsoDate;
}) {
  const scoreDelta =
    p.score !== null && p.lastWeekScore !== null ? p.score - p.lastWeekScore : null;

  const revenueDelta = p.revenueMad - p.lastWeekRevenueMad;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {p.project.color && (
              <span
                className="h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: p.project.color }}
              />
            )}
            <CardTitle className="text-base">{p.project.name}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <HealthBadge score={p.score} band={p.band} />
            {scoreDelta !== null && (
              <span className="text-xs text-muted-foreground">
                {formatDelta(scoreDelta, "%")}
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Components breakdown */}
        <div className="grid grid-cols-3 gap-3 text-center text-sm">
          <ComponentCell label="Execution" value={p.components.execution} />
          <ComponentCell label="Ops" value={p.components.ops} />
          <ComponentCell label="Business" value={p.components.business} />
        </div>

        <Separator />

        {/* Tasks */}
        <div className="grid grid-cols-3 gap-3 text-sm">
          <StatCell label="Done" value={String(p.doneThisWeek)} />
          <StatCell
            label="Overdue"
            value={String(p.overdueOpen)}
            danger={p.overdueOpen > 0}
          />
          <StatCell label="Open" value={String(p.openTasks)} />
        </div>

        {/* Revenue (if any data) */}
        {(p.revenueMad > 0 || p.lastWeekRevenueMad > 0) && (
          <>
            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Revenue</span>
              <span className="font-medium">
                {formatMAD(p.revenueMad)}
                {revenueDelta !== 0 && (
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    ({formatDelta(revenueDelta, " MAD")})
                  </span>
                )}
              </span>
            </div>
          </>
        )}

        {/* Pipeline summary */}
        {(p.pipeline.leads > 0 ||
          p.pipeline.proposals > 0 ||
          p.pipeline.won > 0 ||
          p.pipeline.lost > 0) && (
          <>
            <Separator />
            <div className="flex flex-wrap gap-2 text-xs">
              {p.pipeline.leads > 0 && (
                <Badge variant="outline">{p.pipeline.leads} lead{p.pipeline.leads !== 1 ? "s" : ""}</Badge>
              )}
              {p.pipeline.proposals > 0 && (
                <Badge variant="outline">{p.pipeline.proposals} proposal{p.pipeline.proposals !== 1 ? "s" : ""}</Badge>
              )}
              {p.pipeline.won > 0 && (
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                  {p.pipeline.won} won {p.pipeline.wonValueMad > 0 ? `(${formatMAD(p.pipeline.wonValueMad)})` : ""}
                </Badge>
              )}
              {p.pipeline.lost > 0 && (
                <Badge variant="destructive" className="bg-red-500/15 text-red-700 dark:bg-red-500/20 dark:text-red-400">
                  {p.pipeline.lost} lost
                </Badge>
              )}
            </div>
          </>
        )}

        {/* Metric rows */}
        {p.metrics.length > 0 && (
          <>
            <Separator />
            <div className="space-y-1.5">
              {p.metrics.map((m) => {
                const wowDelta = m.value - m.lastWeekValue;
                const hasTarget =
                  m.def.weekly_target !== null && m.def.weekly_target > 0;
                const attainment = hasTarget
                  ? Math.min(Math.round((m.value / m.def.weekly_target!) * 100), 100)
                  : null;
                return (
                  <div
                    key={m.def.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-muted-foreground">
                      {m.def.name}
                      {m.def.unit ? ` (${m.def.unit})` : ""}
                    </span>
                    <span className="flex items-center gap-2 font-medium tabular-nums">
                      {formatNumber(m.value)}
                      {hasTarget && (
                        <span className="text-xs text-muted-foreground">
                          / {formatNumber(m.def.weekly_target!)} · {attainment}%
                        </span>
                      )}
                      {wowDelta !== 0 && (
                        <span className="text-xs text-muted-foreground">
                          ({formatDelta(wowDelta)})
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ComponentCell({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  const band = bandFor(value);
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`text-lg font-semibold tabular-nums ${BAND_TEXT[band]}`}>
        {value === null ? "—" : `${Math.round(value)}%`}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function StatCell({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        className={`text-lg font-semibold tabular-nums ${danger ? "text-red-600 dark:text-red-400" : ""}`}
      >
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
