import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  MetricAggregation,
  ProjectFeatures,
  ProjectTargets,
  TaskPriority,
} from "@/types/db";
import type { WeekReport } from "@/lib/report/types";
import { esc } from "@/lib/telegram/api";
import { formatDelta, formatMAD, formatNumber } from "@/lib/format";
import { PIPELINE_EVENT_LABELS, TASK_PRIORITY_LABELS } from "@/lib/labels";
import {
  addDays,
  formatDateLabel,
  localToday,
  weekBounds,
  type IsoDate,
} from "@/lib/time";

// Telegram-ready HTML message builders. All data flows through the passed
// supabase client; all dates are Casablanca-local ISO dates from lib/time.

type DbClient = SupabaseClient<Database>;

const PRIORITY_ORDER: TaskPriority[] = ["p1", "p2", "p3", "p4"];
const BAND_EMOJI: Record<string, string> = {
  green: "🟢",
  amber: "🟡",
  red: "🔴",
  none: "⚪",
};

interface ProjectLite {
  id: string;
  slug: string;
  name: string;
  features: Partial<ProjectFeatures>;
  targets: ProjectTargets;
}

async function fetchProjects(supabase: DbClient): Promise<ProjectLite[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("id, slug, name, features, targets")
    .eq("active", true)
    .order("sort_order");
  if (error) throw new Error(`projects query failed: ${error.message}`);
  return (data ?? []).map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    features: (p.features ?? {}) as Partial<ProjectFeatures>,
    targets: (p.targets ?? {}) as ProjectTargets,
  }));
}

function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round(
    (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000
  );
}

function shortPriority(p: TaskPriority): string {
  return p.toUpperCase();
}

// ---------------------------------------------------------------------------
// Week-to-date numbers (shared by the morning targets section and /week)
// ---------------------------------------------------------------------------

interface WeekToDateMetric {
  key: string;
  name: string;
  unit: string | null;
  aggregation: MetricAggregation;
  weeklyTarget: number | null;
  value: number;
  hasEntries: boolean;
}

interface WeekToDateProject {
  project: ProjectLite;
  revenueMad: number;
  expensesMad: number;
  revenueTarget: number | null;
  pipeline: { leads: number; proposals: number; won: number; lost: number };
  metrics: WeekToDateMetric[];
}

async function gatherWeekToDate(
  supabase: DbClient,
  localDate: IsoDate
): Promise<{ weekStart: IsoDate; projects: WeekToDateProject[] }> {
  const { start: weekStart } = weekBounds(localDate);
  const projects = await fetchProjects(supabase);

  const [defsRes, entriesRes, moneyRes, pipelineRes] = await Promise.all([
    supabase
      .from("metric_definitions")
      .select("id, project_id, key, name, unit, aggregation, weekly_target, sort_order")
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("metric_entries")
      .select("metric_id, value, entry_date")
      .gte("entry_date", weekStart)
      .lte("entry_date", localDate),
    supabase
      .from("money_entries")
      .select("project_id, type, amount_mad")
      .gte("entry_date", weekStart)
      .lte("entry_date", localDate),
    supabase
      .from("pipeline_events")
      .select("project_id, type")
      .gte("event_date", weekStart)
      .lte("event_date", localDate),
  ]);
  for (const res of [defsRes, entriesRes, moneyRes, pipelineRes]) {
    if (res.error) throw new Error(`week-to-date query failed: ${res.error.message}`);
  }
  const defs = defsRes.data ?? [];
  const entries = entriesRes.data ?? [];
  const money = moneyRes.data ?? [];
  const pipeline = pipelineRes.data ?? [];

  // 'last' metrics fall back to the latest entry on/before today (e.g. follower
  // totals carry over even when nothing was logged this week).
  const lastMetricIds = defs.filter((d) => d.aggregation === "last").map((d) => d.id);
  const latestByMetric = new Map<string, number>();
  if (lastMetricIds.length > 0) {
    const { data: latest } = await supabase
      .from("metric_entries")
      .select("metric_id, value, entry_date, created_at")
      .in("metric_id", lastMetricIds)
      .lte("entry_date", localDate)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);
    for (const row of latest ?? []) {
      if (!latestByMetric.has(row.metric_id)) latestByMetric.set(row.metric_id, row.value);
    }
  }

  return {
    weekStart,
    projects: projects.map((project) => {
      const projectDefs = defs.filter((d) => d.project_id === project.id);
      const metrics: WeekToDateMetric[] = projectDefs.map((def) => {
        const weekEntries = entries
          .filter((e) => e.metric_id === def.id)
          .sort((a, b) => a.entry_date.localeCompare(b.entry_date));
        let value = 0;
        let hasEntries = weekEntries.length > 0;
        if (def.aggregation === "sum") {
          value = weekEntries.reduce((sum, e) => sum + e.value, 0);
        } else {
          const latest = latestByMetric.get(def.id);
          value = weekEntries.length > 0 ? weekEntries[weekEntries.length - 1].value : latest ?? 0;
          hasEntries = hasEntries || latest != null;
        }
        return {
          key: def.key,
          name: def.name,
          unit: def.unit,
          aggregation: def.aggregation,
          weeklyTarget: def.weekly_target,
          value,
          hasEntries,
        };
      });

      const projectMoney = money.filter((m) => m.project_id === project.id);
      const projectPipeline = pipeline.filter((p) => p.project_id === project.id);

      return {
        project,
        revenueMad: projectMoney
          .filter((m) => m.type === "revenue")
          .reduce((sum, m) => sum + m.amount_mad, 0),
        expensesMad: projectMoney
          .filter((m) => m.type === "expense")
          .reduce((sum, m) => sum + m.amount_mad, 0),
        revenueTarget: project.targets.weekly_revenue_mad ?? null,
        pipeline: {
          leads: projectPipeline.filter((p) => p.type === "lead_added").length,
          proposals: projectPipeline.filter((p) => p.type === "proposal_sent").length,
          won: projectPipeline.filter((p) => p.type === "deal_won").length,
          lost: projectPipeline.filter((p) => p.type === "deal_lost").length,
        },
        metrics,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Morning briefing
// ---------------------------------------------------------------------------

export async function buildMorningBriefing(
  supabase: DbClient,
  localDate: IsoDate
): Promise<string> {
  const projects = await fetchProjects(supabase);
  const projectName = new Map(projects.map((p) => [p.id, p.name]));

  const { data: dueTasks, error } = await supabase
    .from("tasks")
    .select("id, project_id, title, priority, due_date, status")
    .neq("status", "done")
    .not("due_date", "is", null)
    .lte("due_date", localDate)
    .order("priority")
    .order("due_date");
  if (error) throw new Error(`tasks query failed: ${error.message}`);
  const tasks = dueTasks ?? [];

  const lines: string[] = [`🌅 <b>Morning briefing — ${formatDateLabel(localDate)}</b>`];

  // Per project: due today or overdue, grouped P1→P4.
  let anyTasks = false;
  for (const project of projects) {
    const projectTasks = tasks.filter((t) => t.project_id === project.id);
    if (projectTasks.length === 0) continue;
    anyTasks = true;
    lines.push("", `<b>${esc(project.name)}</b>`);
    for (const priority of PRIORITY_ORDER) {
      const group = projectTasks.filter((t) => t.priority === priority);
      if (group.length === 0) continue;
      lines.push(TASK_PRIORITY_LABELS[priority]);
      for (const task of group) {
        const overdueDays = task.due_date ? daysBetween(task.due_date, localDate) : 0;
        lines.push(`• ${esc(task.title)}${overdueDays > 0 ? ` ⏰` : ""}`);
      }
    }
  }
  if (!anyTasks) {
    lines.push("", "Nothing due today. Pick something important. 💪");
  }

  // Overdue red-flag list with days overdue.
  const overdue = tasks.filter((t) => t.due_date && t.due_date < localDate);
  if (overdue.length > 0) {
    lines.push("", "⚠️ <b>Overdue</b>");
    for (const task of overdue) {
      const days = daysBetween(task.due_date as IsoDate, localDate);
      lines.push(
        `• ${esc(projectName.get(task.project_id) ?? "?")} — ${esc(task.title)} (${days}d overdue)`
      );
    }
  }

  // Week targets: week-to-date value vs target.
  const { projects: wtd } = await gatherWeekToDate(supabase, localDate);
  const targetLines: string[] = [];
  for (const row of wtd) {
    const projectLines: string[] = [];
    if (row.revenueTarget != null) {
      projectLines.push(
        `• Revenue: ${formatNumber(row.revenueMad)} / ${formatNumber(row.revenueTarget)} MAD`
      );
    }
    for (const metric of row.metrics) {
      if (metric.weeklyTarget == null) continue;
      projectLines.push(
        `• ${esc(metric.name)}: ${formatNumber(metric.value)} / ${formatNumber(metric.weeklyTarget)}${
          metric.unit ? ` ${esc(metric.unit)}` : ""
        }`
      );
    }
    if (projectLines.length > 0) {
      targetLines.push(esc(row.project.name), ...projectLines);
    }
  }
  if (targetLines.length > 0) {
    lines.push("", "🎯 <b>Week targets</b>", ...targetLines);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Evening summary
// ---------------------------------------------------------------------------

export async function buildEveningSummary(
  supabase: DbClient,
  localDate: IsoDate
): Promise<string> {
  const projects = await fetchProjects(supabase);
  const projectName = new Map(projects.map((p) => [p.id, p.name]));
  const tag = (projectId: string) => esc(projectName.get(projectId) ?? "?");
  const tomorrow = addDays(localDate, 1);

  const [doneRes, openRes, pipelineRes, moneyRes, metricRes, defsRes] = await Promise.all([
    // Bounded fetch, then exact local-date filtering via Intl (Ramadan-safe).
    supabase
      .from("tasks")
      .select("id, project_id, title, completed_at")
      .eq("status", "done")
      .gte("completed_at", `${addDays(localDate, -2)}T00:00:00Z`),
    supabase
      .from("tasks")
      .select("id, project_id, title, priority, due_date, status")
      .neq("status", "done"),
    supabase
      .from("pipeline_events")
      .select("project_id, type, contact, value_mad")
      .eq("event_date", localDate),
    supabase
      .from("money_entries")
      .select("project_id, type, amount_mad, category")
      .eq("entry_date", localDate),
    supabase
      .from("metric_entries")
      .select("project_id, metric_id, value")
      .eq("entry_date", localDate),
    supabase.from("metric_definitions").select("id, name, unit"),
  ]);
  for (const res of [doneRes, openRes, pipelineRes, moneyRes, metricRes, defsRes]) {
    if (res.error) throw new Error(`evening query failed: ${res.error.message}`);
  }

  const completedToday = (doneRes.data ?? []).filter(
    (t) => t.completed_at && localToday(new Date(t.completed_at)) === localDate
  );
  const openTasks = openRes.data ?? [];
  const inProgress = openTasks.filter((t) => t.status === "in_progress");
  const metricDefs = new Map((defsRes.data ?? []).map((d) => [d.id, d]));

  const lines: string[] = [`🌙 <b>Evening summary — ${formatDateLabel(localDate)}</b>`];

  lines.push("", `✅ <b>Completed today</b>${completedToday.length === 0 ? " — none" : ""}`);
  for (const task of completedToday) {
    lines.push(`• ${tag(task.project_id)} — ${esc(task.title)}`);
  }

  if (inProgress.length > 0) {
    lines.push("", "🔄 <b>In progress</b>");
    for (const task of inProgress.slice(0, 8)) {
      lines.push(`• ${tag(task.project_id)} — ${esc(task.title)}`);
    }
  }

  const loggedLines: string[] = [];
  for (const event of pipelineRes.data ?? []) {
    loggedLines.push(
      `• ${tag(event.project_id)} — ${PIPELINE_EVENT_LABELS[event.type]}${
        event.contact ? `: ${esc(event.contact)}` : ""
      }${event.value_mad != null ? ` (${formatMAD(event.value_mad)})` : ""}`
    );
  }
  for (const entry of moneyRes.data ?? []) {
    loggedLines.push(
      `• ${tag(entry.project_id)} — ${entry.type === "revenue" ? "Revenue" : "Expense"} ${formatMAD(
        entry.amount_mad
      )}${entry.category ? ` (${esc(entry.category)})` : ""}`
    );
  }
  for (const entry of metricRes.data ?? []) {
    const def = metricDefs.get(entry.metric_id);
    loggedLines.push(
      `• ${tag(entry.project_id)} — ${esc(def?.name ?? "Metric")}: ${formatNumber(entry.value)}${
        def?.unit ? ` ${esc(def.unit)}` : ""
      }`
    );
  }
  lines.push("", `📊 <b>Logged today</b>${loggedLines.length === 0 ? " — nothing" : ""}`);
  lines.push(...loggedLines);

  // Tomorrow's top 3: overdue first, then due tomorrow, then by priority.
  const ranked = [...openTasks].sort((a, b) => {
    const tier = (t: (typeof openTasks)[number]) =>
      t.due_date && t.due_date <= localDate ? 0 : t.due_date === tomorrow ? 1 : 2;
    if (tier(a) !== tier(b)) return tier(a) - tier(b);
    if (a.priority !== b.priority) return a.priority.localeCompare(b.priority);
    return (a.due_date ?? "9999-12-31").localeCompare(b.due_date ?? "9999-12-31");
  });
  const top3 = ranked.slice(0, 3);
  if (top3.length > 0) {
    lines.push("", "📌 <b>Tomorrow's top 3</b>");
    for (const task of top3) {
      const overdueDays = task.due_date ? daysBetween(task.due_date, localDate) : 0;
      const suffix =
        overdueDays > 0
          ? ` — ${overdueDays}d overdue`
          : task.due_date === tomorrow
            ? " — due tomorrow"
            : "";
      lines.push(
        `• ${tag(task.project_id)} — ${esc(task.title)} (${shortPriority(task.priority)})${suffix}`
      );
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Week-to-date (/week command)
// ---------------------------------------------------------------------------

export async function buildWeekToDate(
  supabase: DbClient,
  localDate: IsoDate
): Promise<string> {
  const { weekStart, projects } = await gatherWeekToDate(supabase, localDate);
  const lines: string[] = [
    `📊 <b>Week to date — ${formatDateLabel(weekStart)} → ${formatDateLabel(localDate)}</b>`,
  ];

  for (const row of projects) {
    lines.push("", `<b>${esc(row.project.name)}</b>`);
    if (row.project.features.money) {
      const target = row.revenueTarget != null ? ` / ${formatNumber(row.revenueTarget)}` : "";
      lines.push(
        `💰 Revenue: ${formatNumber(row.revenueMad)}${target} MAD · Expenses: ${formatNumber(row.expensesMad)} MAD`
      );
    }
    if (row.project.features.pipeline) {
      const p = row.pipeline;
      lines.push(`🤝 Leads ${p.leads} · Proposals ${p.proposals} · Won ${p.won} · Lost ${p.lost}`);
    }
    for (const metric of row.metrics) {
      const target =
        metric.weeklyTarget != null ? ` / ${formatNumber(metric.weeklyTarget)}` : "";
      const value = metric.hasEntries ? formatNumber(metric.value) : "–";
      lines.push(
        `📈 ${esc(metric.name)}: ${value}${target}${metric.unit ? ` ${esc(metric.unit)}` : ""}`
      );
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Weekly report (Friday evening + /report)
// ---------------------------------------------------------------------------

function componentLabel(value: number | null): string {
  return value == null ? "–" : String(Math.round(value));
}

export function buildWeeklyReportMessage(report: WeekReport): string {
  const lines: string[] = [
    `📈 <b>Weekly report — ${formatDateLabel(report.weekStart)} → ${formatDateLabel(report.weekEnd)}</b>`,
  ];

  if (report.overall != null) {
    const delta =
      report.lastWeekOverall != null
        ? ` (${formatDelta(Math.round(report.overall - report.lastWeekOverall))})`
        : "";
    lines.push(`Overall: ${Math.round(report.overall)}%${delta}`);
  } else {
    lines.push("Overall: no signal yet");
  }

  for (const p of report.projects) {
    const features = (p.project.features ?? {}) as Partial<ProjectFeatures>;
    const emoji = BAND_EMOJI[p.band] ?? "⚪";
    const scoreDelta =
      p.score != null && p.lastWeekScore != null
        ? ` (${formatDelta(Math.round(p.score - p.lastWeekScore))})`
        : "";
    const scoreLabel = p.score != null ? `${Math.round(p.score)}/100${scoreDelta}` : "no score";

    lines.push("", `${emoji} <b>${esc(p.project.name)}</b> — ${scoreLabel}`);
    lines.push(
      `Exec ${componentLabel(p.components.execution)} · Ops ${componentLabel(p.components.ops)} · Biz ${componentLabel(p.components.business)}`
    );
    lines.push(
      `✅ Done: ${p.doneThisWeek} (${formatDelta(p.doneThisWeek - p.doneLastWeek)}) · Open: ${p.openTasks} · Overdue: ${p.overdueOpen}`
    );

    if (features.money) {
      lines.push(
        `💰 Revenue: ${formatMAD(p.revenueMad)} (${formatDelta(p.revenueMad - p.lastWeekRevenueMad)})${
          p.expensesMad > 0 ? ` · Expenses: ${formatMAD(p.expensesMad)}` : ""
        }`
      );
    }
    if (features.pipeline) {
      const pl = p.pipeline;
      lines.push(
        `🤝 Leads ${pl.leads} · Proposals ${pl.proposals} · Won ${pl.won}${
          pl.wonValueMad > 0 ? ` (${formatMAD(pl.wonValueMad)})` : ""
        } · Lost ${pl.lost}`
      );
    }
    for (const metric of p.metrics) {
      const target =
        metric.def.weekly_target != null ? ` / ${formatNumber(metric.def.weekly_target)}` : "";
      lines.push(
        `📊 ${esc(metric.def.name)}: ${formatNumber(metric.value)}${target}${
          metric.def.unit ? ` ${esc(metric.def.unit)}` : ""
        } (${formatDelta(metric.value - metric.lastWeekValue)})`
      );
    }
  }

  return lines.join("\n");
}
