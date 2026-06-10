import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { computeWeekReport } from "@/lib/report/compute";
import { localToday, weekBounds } from "@/lib/time";
import { formatMAD, formatDelta } from "@/lib/format";
import { HealthBadge } from "@/components/report/health-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { bandFor } from "@/lib/report/health";

export default async function OverviewPage() {
  const supabase = await createClient();
  const today = localToday();
  const { start: weekStart } = weekBounds(today);
  const report = await computeWeekReport(supabase, weekStart);

  const overallBand = bandFor(report.overall);
  const overallDelta =
    report.overall !== null && report.lastWeekOverall !== null
      ? report.overall - report.lastWeekOverall
      : null;

  return (
    <div className="space-y-6 pb-10">
      {/* Page header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground">
            {report.projects.length} active project{report.projects.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums">
              {report.overall === null ? "—" : `${Math.round(report.overall)}%`}
            </p>
            {overallDelta !== null && (
              <p className="text-xs text-muted-foreground">
                {formatDelta(overallDelta, "%")} vs last week
              </p>
            )}
          </div>
          <HealthBadge score={report.overall} band={overallBand} />
          <Link
            href="/report"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Full report →
          </Link>
        </div>
      </div>

      {/* Project cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {report.projects.map((p) => {
          const revenueDelta = p.revenueMad - p.lastWeekRevenueMad;
          return (
            <Link
              key={p.project.id}
              href={`/p/${p.project.slug}/tasks`}
              className="block group"
            >
              <Card className="h-full transition-colors group-hover:border-foreground/20">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {p.project.color && (
                        <span
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: p.project.color }}
                        />
                      )}
                      <CardTitle className="text-sm font-semibold truncate">
                        {p.project.name}
                      </CardTitle>
                    </div>
                    <HealthBadge score={p.score} band={p.band} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Task stats */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <MiniStat label="Done" value={String(p.doneThisWeek)} />
                    <MiniStat
                      label="Overdue"
                      value={String(p.overdueOpen)}
                      danger={p.overdueOpen > 0}
                    />
                    <MiniStat label="Open" value={String(p.openTasks)} />
                  </div>

                  {/* Revenue */}
                  {(p.revenueMad > 0 || p.lastWeekRevenueMad > 0) && (
                    <div className="flex items-center justify-between text-sm border-t pt-2">
                      <span className="text-muted-foreground">Revenue</span>
                      <span className="font-medium tabular-nums">
                        {formatMAD(p.revenueMad)}
                        {revenueDelta !== 0 && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({formatDelta(revenueDelta, " MAD")})
                          </span>
                        )}
                      </span>
                    </div>
                  )}

                  {/* Pipeline pill if active */}
                  {(p.pipeline.won > 0 || p.pipeline.proposals > 0) && (
                    <div className="flex flex-wrap gap-1">
                      {p.pipeline.won > 0 && (
                        <Badge className="text-xs bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                          {p.pipeline.won} won
                        </Badge>
                      )}
                      {p.pipeline.proposals > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {p.pipeline.proposals} proposal{p.pipeline.proposals !== 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function MiniStat({
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
        className={`text-base font-semibold tabular-nums ${danger ? "text-red-600 dark:text-red-400" : ""}`}
      >
        {value}
      </span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}
