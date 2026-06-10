// Computes a full WeekReport from the database for a given week.
// SIGNATURE IS A CONTRACT: lib/briefings.ts (Telegram Friday report) and the
// /report page both call this as a black box.
//
// Query strategy: ONE query per table across ALL projects (6 round trips
// total regardless of project count), grouped in JS afterwards. All score
// math is delegated to the pure functions in lib/report/health.ts.

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  MetricAggregation,
  MoneyType,
  PipelineEventType,
  ProjectFeatures,
  ProjectTargets,
} from "@/types/db";
import {
  addDays,
  localToday,
  previousWeekStart,
  weekBounds,
  type IsoDate,
} from "@/lib/time";
import {
  bandFor,
  businessScore,
  executionScore,
  healthScore,
  opsScore,
  overallScore,
} from "./health";
import type {
  HealthComponents,
  MetricWeek,
  PipelineWeek,
  ProjectWeekReport,
  WeekReport,
} from "./types";

// ---------- row shapes for the narrow selects below ----------

interface CompletedTaskRow {
  project_id: string;
  completed_at: string;
}

interface OpenTaskRow {
  project_id: string;
  due_date: string | null;
}

interface MoneyRow {
  project_id: string;
  type: MoneyType;
  amount_mad: number;
  entry_date: string;
}

interface PipelineRow {
  project_id: string;
  type: PipelineEventType;
  value_mad: number | null;
  event_date: string;
}

interface MetricDefRow {
  id: string;
  project_id: string;
  key: string;
  name: string;
  unit: string | null;
  aggregation: MetricAggregation;
  weekly_target: number | null;
}

interface MetricEntryRow {
  metric_id: string;
  project_id: string;
  value: number;
  entry_date: string;
  created_at: string;
}

// ---------- small helpers ----------

function unwrap<T>(result: { data: T | null; error: { message: string } | null }, label: string): T {
  if (result.error || result.data === null) {
    throw new Error(`computeWeekReport(${label}): ${result.error?.message ?? "no data"}`);
  }
  return result.data;
}

function groupBy<T>(rows: T[], keyOf: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const bucket = map.get(key);
    if (bucket) bucket.push(row);
    else map.set(key, [row]);
  }
  return map;
}

function featuresOf(features: unknown): ProjectFeatures {
  const f = (features ?? {}) as Partial<ProjectFeatures>;
  return { pipeline: f.pipeline ?? false, money: f.money ?? false };
}

function targetsOf(targets: unknown): ProjectTargets {
  return (targets ?? {}) as ProjectTargets;
}

function emptyPipeline(): PipelineWeek {
  return { leads: 0, proposals: 0, won: 0, lost: 0, wonValueMad: 0 };
}

function pipelineWeekOf(rows: PipelineRow[], start: IsoDate, end: IsoDate): PipelineWeek {
  const week = emptyPipeline();
  for (const row of rows) {
    if (row.event_date < start || row.event_date > end) continue;
    switch (row.type) {
      case "lead_added":
        week.leads += 1;
        break;
      case "proposal_sent":
        week.proposals += 1;
        break;
      case "deal_won":
        week.won += 1;
        week.wonValueMad += row.value_mad ?? 0;
        break;
      case "deal_lost":
        week.lost += 1;
        break;
    }
  }
  return week;
}

function sumMoney(rows: MoneyRow[], type: MoneyType, start: IsoDate, end: IsoDate): number {
  return rows.reduce(
    (acc, row) =>
      row.type === type && row.entry_date >= start && row.entry_date <= end
        ? acc + row.amount_mad
        : acc,
    0
  );
}

/** Week value of one metric: sum of entries, or the latest entry (by entry_date, then created_at). */
function metricValueOf(
  aggregation: MetricAggregation,
  entries: MetricEntryRow[],
  start: IsoDate,
  end: IsoDate
): number {
  const inWeek = entries.filter((e) => e.entry_date >= start && e.entry_date <= end);
  if (aggregation === "sum") {
    return inWeek.reduce((acc, e) => acc + e.value, 0);
  }
  let latest: MetricEntryRow | null = null;
  for (const e of inWeek) {
    if (
      !latest ||
      e.entry_date > latest.entry_date ||
      (e.entry_date === latest.entry_date && e.created_at > latest.created_at)
    ) {
      latest = e;
    }
  }
  return latest?.value ?? 0;
}

/** Count completed tasks whose LOCAL completion date falls inside [start..end]. */
function countDoneInWeek(rows: CompletedTaskRow[], start: IsoDate, end: IsoDate): number {
  return rows.reduce((acc, row) => {
    const localDate = localToday(new Date(row.completed_at));
    return localDate >= start && localDate <= end ? acc + 1 : acc;
  }, 0);
}

// ---------- main ----------

export async function computeWeekReport(
  supabase: SupabaseClient<Database>,
  weekStart: IsoDate
): Promise<WeekReport> {
  // Snap defensively to the containing Monday-to-Sunday week.
  const { start, end } = weekBounds(weekStart);
  const lastStart = previousWeekStart(start);
  const lastEnd = addDays(start, -1);

  // completed_at is a UTC timestamptz; the local (Casablanca) date can be at
  // most one day AHEAD of the UTC date (UTC+0/+1), never behind. Fetch a
  // one-day buffer before last week's Monday and filter precisely in JS.
  const completedFloor = `${addDays(lastStart, -1)}T00:00:00Z`;
  const completedCeil = `${addDays(end, 1)}T00:00:00Z`;

  const [projectsRes, completedRes, openRes, moneyRes, pipelineRes, defsRes, entriesRes] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id, slug, name, color, features, targets")
        .eq("active", true)
        .order("sort_order"),
      supabase
        .from("tasks")
        .select("project_id, completed_at")
        .not("completed_at", "is", null)
        .gte("completed_at", completedFloor)
        .lt("completed_at", completedCeil),
      supabase
        .from("tasks")
        .select("project_id, due_date")
        .neq("status", "done"),
      supabase
        .from("money_entries")
        .select("project_id, type, amount_mad, entry_date")
        .gte("entry_date", lastStart)
        .lte("entry_date", end),
      supabase
        .from("pipeline_events")
        .select("project_id, type, value_mad, event_date")
        .gte("event_date", lastStart)
        .lte("event_date", end),
      supabase
        .from("metric_definitions")
        .select("id, project_id, key, name, unit, aggregation, weekly_target")
        .eq("active", true)
        .order("sort_order"),
      supabase
        .from("metric_entries")
        .select("metric_id, project_id, value, entry_date, created_at")
        .gte("entry_date", lastStart)
        .lte("entry_date", end),
    ]);

  const projects = unwrap(projectsRes, "projects");
  const completedRows = (unwrap(completedRes, "tasks/completed") as CompletedTaskRow[]).filter(
    (r) => r.completed_at !== null
  );
  const openRows = unwrap(openRes, "tasks/open") as OpenTaskRow[];
  const moneyRows = unwrap(moneyRes, "money_entries") as MoneyRow[];
  const pipelineRows = unwrap(pipelineRes, "pipeline_events") as PipelineRow[];
  const defRows = unwrap(defsRes, "metric_definitions") as MetricDefRow[];
  const entryRows = unwrap(entriesRes, "metric_entries") as MetricEntryRow[];

  const completedByProject = groupBy(completedRows, (r) => r.project_id);
  const openByProject = groupBy(openRows, (r) => r.project_id);
  const moneyByProject = groupBy(moneyRows, (r) => r.project_id);
  const pipelineByProject = groupBy(pipelineRows, (r) => r.project_id);
  const defsByProject = groupBy(defRows, (r) => r.project_id);
  const entriesByMetric = groupBy(entryRows, (r) => r.metric_id);

  const projectReports: ProjectWeekReport[] = projects.map((project) => {
    const features = featuresOf(project.features);
    const targets = targetsOf(project.targets);

    const completed = completedByProject.get(project.id) ?? [];
    const open = openByProject.get(project.id) ?? [];
    const money = moneyByProject.get(project.id) ?? [];
    const pipelineEvents = pipelineByProject.get(project.id) ?? [];
    const defs = defsByProject.get(project.id) ?? [];

    const doneThisWeek = countDoneInWeek(completed, start, end);
    const doneLastWeek = countDoneInWeek(completed, lastStart, lastEnd);
    const openTasks = open.length;
    const overdueOpen = open.filter((t) => t.due_date !== null && t.due_date <= end).length;

    const revenueMad = sumMoney(money, "revenue", start, end);
    const expensesMad = sumMoney(money, "expense", start, end);
    const lastWeekRevenueMad = sumMoney(money, "revenue", lastStart, lastEnd);

    const pipeline = pipelineWeekOf(pipelineEvents, start, end);
    const lastWeekPipeline = pipelineWeekOf(pipelineEvents, lastStart, lastEnd);

    const metrics: MetricWeek[] = defs.map((def) => {
      const entries = entriesByMetric.get(def.id) ?? [];
      return {
        def: {
          id: def.id,
          key: def.key,
          name: def.name,
          unit: def.unit,
          aggregation: def.aggregation,
          weekly_target: def.weekly_target,
        },
        value: metricValueOf(def.aggregation, entries, start, end),
        lastWeekValue: metricValueOf(def.aggregation, entries, lastStart, lastEnd),
      };
    });

    const weeklyRevenueTargetMad = targets.weekly_revenue_mad ?? null;

    const components: HealthComponents = {
      execution: executionScore(doneThisWeek, overdueOpen),
      ops: opsScore(metrics),
      business: businessScore({
        revenueMad,
        weeklyRevenueTargetMad,
        moneyEnabled: features.money,
        pipelineEnabled: features.pipeline,
        pipeline,
      }),
    };
    const score = healthScore(components);

    // Last week's score is computed from last week's own numbers. There is no
    // historical snapshot of overdue tasks, so the CURRENT overdueOpen is
    // reused — an acceptable approximation for a WoW delta.
    const lastWeekComponents: HealthComponents = {
      execution: executionScore(doneLastWeek, overdueOpen),
      ops: opsScore(metrics.map((m) => ({ ...m, value: m.lastWeekValue }))),
      business: businessScore({
        revenueMad: lastWeekRevenueMad,
        weeklyRevenueTargetMad,
        moneyEnabled: features.money,
        pipelineEnabled: features.pipeline,
        pipeline: lastWeekPipeline,
      }),
    };
    const lastWeekScore = healthScore(lastWeekComponents);

    return {
      project: {
        id: project.id,
        slug: project.slug,
        name: project.name,
        color: project.color,
        features: project.features,
        targets: project.targets,
      },
      doneThisWeek,
      doneLastWeek,
      overdueOpen,
      openTasks,
      revenueMad,
      lastWeekRevenueMad,
      expensesMad,
      pipeline,
      lastWeekPipeline,
      metrics,
      components,
      score,
      lastWeekScore,
      band: bandFor(score),
    };
  });

  return {
    weekStart: start,
    weekEnd: end,
    overall: overallScore(projectReports.map((p) => p.score)),
    lastWeekOverall: overallScore(projectReports.map((p) => p.lastWeekScore)),
    projects: projectReports,
  };
}
