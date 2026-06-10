"use server";

// Server actions for logging metric entries, pipeline events and money
// entries — used by the project metrics page and the global quick-log.
// All entry/event dates default to the Africa/Casablanca local date.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { localToday, type IsoDate } from "@/lib/time";
import type { MoneyType, PipelineEventType, ProjectFeatures } from "@/types/db";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function revalidateLogPaths(): void {
  revalidatePath("/p/[slug]/metrics", "page");
  revalidatePath("/report");
  revalidatePath("/");
}

function ok(): ActionResult {
  return { ok: true };
}

function fail(error: string): ActionResult {
  return { ok: false, error };
}

function resolveDate(date: IsoDate | null | undefined): IsoDate {
  return date && ISO_DATE_RE.test(date) ? date : localToday();
}

function clean(text: string | null | undefined): string | null {
  const trimmed = text?.trim();
  return trimmed ? trimmed : null;
}

// ---------- logging ----------

export async function logMetric(
  metricId: string,
  projectId: string,
  value: number,
  note?: string | null,
  entryDate?: IsoDate | null
): Promise<ActionResult> {
  if (!Number.isFinite(value)) return fail("Value must be a number.");

  const supabase = await createClient();
  const { error } = await supabase.from("metric_entries").insert({
    metric_id: metricId,
    project_id: projectId,
    value,
    note: clean(note),
    entry_date: resolveDate(entryDate),
    source: "app",
  });
  if (error) return fail(error.message);

  revalidateLogPaths();
  return ok();
}

export async function quickIncrementMetric(
  metricId: string,
  projectId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: def, error: defError } = await supabase
    .from("metric_definitions")
    .select("id, quick_increment")
    .eq("id", metricId)
    .single();
  if (defError || !def) return fail("Metric not found.");

  const { error } = await supabase.from("metric_entries").insert({
    metric_id: metricId,
    project_id: projectId,
    value: def.quick_increment ?? 1,
    entry_date: localToday(),
    source: "app",
  });
  if (error) return fail(error.message);

  revalidateLogPaths();
  return ok();
}

export async function logPipelineEvent(
  projectId: string,
  type: PipelineEventType,
  contact?: string | null,
  valueMad?: number | null,
  note?: string | null,
  eventDate?: IsoDate | null
): Promise<ActionResult> {
  if (valueMad != null && (!Number.isFinite(valueMad) || valueMad < 0)) {
    return fail("Value must be a positive number.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("pipeline_events").insert({
    project_id: projectId,
    type,
    contact: clean(contact),
    value_mad: valueMad ?? null,
    note: clean(note),
    event_date: resolveDate(eventDate),
    source: "app",
  });
  if (error) return fail(error.message);

  revalidateLogPaths();
  return ok();
}

export async function logMoney(
  projectId: string,
  type: MoneyType,
  amountMad: number,
  category?: string | null,
  note?: string | null,
  entryDate?: IsoDate | null
): Promise<ActionResult> {
  if (!Number.isFinite(amountMad) || amountMad <= 0) {
    return fail("Amount must be greater than 0.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("money_entries").insert({
    project_id: projectId,
    type,
    amount_mad: amountMad,
    category: clean(category),
    note: clean(note),
    entry_date: resolveDate(entryDate),
    source: "app",
  });
  if (error) return fail(error.message);

  revalidateLogPaths();
  return ok();
}

// ---------- deleting ----------

export async function deleteMetricEntry(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("metric_entries").delete().eq("id", id);
  if (error) return fail(error.message);
  revalidateLogPaths();
  return ok();
}

export async function deletePipelineEvent(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("pipeline_events").delete().eq("id", id);
  if (error) return fail(error.message);
  revalidateLogPaths();
  return ok();
}

export async function deleteMoneyEntry(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("money_entries").delete().eq("id", id);
  if (error) return fail(error.message);
  revalidateLogPaths();
  return ok();
}

// ---------- quick-log bootstrap data ----------

export interface QuickLogProject {
  id: string;
  slug: string;
  name: string;
  color: string | null;
  pipeline: boolean;
  money: boolean;
}

export interface QuickLogMetric {
  id: string;
  project_id: string;
  name: string;
  unit: string | null;
  quick_increment: number | null;
}

export interface QuickLogData {
  projects: QuickLogProject[];
  metrics: QuickLogMetric[];
}

/** One-shot payload for the global quick-log dialog (fetched on first open). */
export async function getQuickLogData(): Promise<QuickLogData> {
  const supabase = await createClient();
  const [projectsRes, metricsRes] = await Promise.all([
    supabase
      .from("projects")
      .select("id, slug, name, color, features")
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("metric_definitions")
      .select("id, project_id, name, unit, quick_increment")
      .eq("active", true)
      .order("sort_order"),
  ]);

  const projects: QuickLogProject[] = (projectsRes.data ?? []).map((p) => {
    const features = (p.features ?? {}) as Partial<ProjectFeatures>;
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      color: p.color,
      pipeline: features.pipeline ?? false,
      money: features.money ?? false,
    };
  });

  return { projects, metrics: metricsRes.data ?? [] };
}
