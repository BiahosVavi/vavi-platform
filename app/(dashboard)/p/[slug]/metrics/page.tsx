import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDateLabel, localToday, weekBounds } from "@/lib/time";
import { formatMAD, formatNumber } from "@/lib/format";
import { QuickIncrementButton } from "@/components/metrics/quick-increment-button";
import { DeleteEntryButton } from "@/components/metrics/delete-entry-button";
import { EntryTabs } from "@/components/metrics/entry-tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { ProjectFeatures } from "@/types/db";
import type { MetricOption } from "@/components/metrics/log-forms";

export default async function ProjectMetricsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  // Fetch project
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, name, slug, color, features")
    .eq("slug", slug)
    .single();

  if (projectError || !project) notFound();

  const features = (project.features ?? {}) as Partial<ProjectFeatures>;
  const pipelineEnabled = features.pipeline ?? false;
  const moneyEnabled = features.money ?? false;

  // Fetch active metric definitions
  const { data: defs } = await supabase
    .from("metric_definitions")
    .select("id, project_id, key, name, unit, aggregation, weekly_target, quick_increment, active")
    .eq("project_id", project.id)
    .eq("active", true)
    .order("sort_order");

  const activeDefs = defs ?? [];

  // This-week summary: fetch entries for current week
  const today = localToday();
  const { start: weekStart, end: weekEnd } = weekBounds(today);

  const { data: weekEntries } = await supabase
    .from("metric_entries")
    .select("metric_id, value, entry_date, created_at")
    .eq("project_id", project.id)
    .gte("entry_date", weekStart)
    .lte("entry_date", weekEnd);

  // Compute this-week values per metric
  const weekValueMap = new Map<string, number>();
  for (const def of activeDefs) {
    const entries = (weekEntries ?? []).filter((e) => e.metric_id === def.id);
    if (def.aggregation === "sum") {
      weekValueMap.set(def.id, entries.reduce((acc, e) => acc + Number(e.value), 0));
    } else {
      // last: pick entry with latest entry_date, then latest created_at
      let latest: { value: number; entry_date: string; created_at: string } | null = null;
      for (const e of entries) {
        if (
          !latest ||
          e.entry_date > latest.entry_date ||
          (e.entry_date === latest.entry_date && e.created_at > latest.created_at)
        ) {
          latest = e;
        }
      }
      weekValueMap.set(def.id, latest ? Number(latest.value) : 0);
    }
  }

  // Recent 15 metric entries
  const { data: recentMetricEntries } = await supabase
    .from("metric_entries")
    .select("id, metric_id, value, note, entry_date, created_at")
    .eq("project_id", project.id)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(15);

  // Recent 15 pipeline events (if enabled)
  const { data: recentPipelineEvents } = pipelineEnabled
    ? await supabase
        .from("pipeline_events")
        .select("id, type, contact, value_mad, note, event_date")
        .eq("project_id", project.id)
        .order("event_date", { ascending: false })
        .limit(15)
    : { data: null };

  // Recent 15 money entries (if enabled)
  const { data: recentMoneyEntries } = moneyEnabled
    ? await supabase
        .from("money_entries")
        .select("id, type, amount_mad, category, note, entry_date")
        .eq("project_id", project.id)
        .order("entry_date", { ascending: false })
        .limit(15)
    : { data: null };

  // Build a name-lookup for metric entries table
  const defNameMap = new Map(activeDefs.map((d) => [d.id, `${d.name}${d.unit ? ` (${d.unit})` : ""}`]));

  // MetricOption[] for EntryTabs
  const metricOptions: MetricOption[] = activeDefs.map((d) => ({
    id: d.id,
    name: d.name,
    unit: d.unit ?? null,
  }));

  // Quick-increment metrics
  const quickDefs = activeDefs.filter((d) => d.quick_increment !== null && d.quick_increment > 0);

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        {project.color && (
          <span
            className="h-4 w-4 rounded-full shrink-0"
            style={{ backgroundColor: project.color }}
          />
        )}
        <h1 className="text-2xl font-bold tracking-tight">{project.name} — Metrics</h1>
      </div>

      {/* Quick-increment buttons */}
      {quickDefs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">
              Quick Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {quickDefs.map((d) => (
                <QuickIncrementButton
                  key={d.id}
                  metricId={d.id}
                  projectId={project.id}
                  increment={Number(d.quick_increment)}
                  name={d.name}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* This-week summary */}
      {activeDefs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              This Week{" "}
              <span className="font-normal text-muted-foreground">
                ({formatDateLabel(weekStart)} – {formatDateLabel(weekEnd)})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {activeDefs.map((def) => {
                const value = weekValueMap.get(def.id) ?? 0;
                const target = def.weekly_target ? Number(def.weekly_target) : null;
                const attainment =
                  target && target > 0
                    ? Math.min(Math.round((value / target) * 100), 100)
                    : null;
                return (
                  <div key={def.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-muted-foreground">
                      {def.name}
                      {def.unit ? ` (${def.unit})` : ""}
                    </span>
                    <span className="font-medium tabular-nums">
                      {formatNumber(value)}
                      {target !== null && (
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          / {formatNumber(target)} · {attainment}%
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Entry forms */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Log Entry</CardTitle>
        </CardHeader>
        <CardContent>
          <EntryTabs
            projectId={project.id}
            pipelineEnabled={pipelineEnabled}
            moneyEnabled={moneyEnabled}
            metrics={metricOptions}
          />
        </CardContent>
      </Card>

      {/* Recent metric entries */}
      {(recentMetricEntries ?? []).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recent Metric Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">Date</th>
                    <th className="pb-2 pr-3 font-medium">Metric</th>
                    <th className="pb-2 pr-3 font-medium">Value</th>
                    <th className="pb-2 pr-3 font-medium">Note</th>
                    <th className="pb-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {(recentMetricEntries ?? []).map((e) => (
                    <tr key={e.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 tabular-nums text-muted-foreground">
                        {formatDateLabel(e.entry_date)}
                      </td>
                      <td className="py-2 pr-3">
                        {defNameMap.get(e.metric_id) ?? e.metric_id}
                      </td>
                      <td className="py-2 pr-3 tabular-nums font-medium">
                        {formatNumber(Number(e.value))}
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {e.note ?? "—"}
                      </td>
                      <td className="py-2 text-right">
                        <DeleteEntryButton kind="metric" id={e.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent pipeline events */}
      {pipelineEnabled && (recentPipelineEvents ?? []).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recent Pipeline Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">Date</th>
                    <th className="pb-2 pr-3 font-medium">Type</th>
                    <th className="pb-2 pr-3 font-medium">Contact</th>
                    <th className="pb-2 pr-3 font-medium">Value</th>
                    <th className="pb-2 pr-3 font-medium">Note</th>
                    <th className="pb-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {(recentPipelineEvents ?? []).map((e) => (
                    <tr key={e.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 tabular-nums text-muted-foreground">
                        {formatDateLabel(e.event_date)}
                      </td>
                      <td className="py-2 pr-3 capitalize">
                        {e.type.replace(/_/g, " ")}
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {e.contact ?? "—"}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">
                        {e.value_mad != null ? formatMAD(Number(e.value_mad)) : "—"}
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {e.note ?? "—"}
                      </td>
                      <td className="py-2 text-right">
                        <DeleteEntryButton kind="pipeline" id={e.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent money entries */}
      {moneyEnabled && (recentMoneyEntries ?? []).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recent Money Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">Date</th>
                    <th className="pb-2 pr-3 font-medium">Type</th>
                    <th className="pb-2 pr-3 font-medium">Amount</th>
                    <th className="pb-2 pr-3 font-medium">Category</th>
                    <th className="pb-2 pr-3 font-medium">Note</th>
                    <th className="pb-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {(recentMoneyEntries ?? []).map((e) => (
                    <tr key={e.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 tabular-nums text-muted-foreground">
                        {formatDateLabel(e.entry_date)}
                      </td>
                      <td className="py-2 pr-3 capitalize">{e.type}</td>
                      <td className="py-2 pr-3 tabular-nums font-medium">
                        {formatMAD(Number(e.amount_mad))}
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {e.category ?? "—"}
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {e.note ?? "—"}
                      </td>
                      <td className="py-2 text-right">
                        <DeleteEntryButton kind="money" id={e.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
