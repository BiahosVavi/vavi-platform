"use server";

// Server actions for the settings page: project targets + metric definitions.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database, Json, MetricAggregation } from "@/types/db";

type MetricDefinitionUpdate = Database["public"]["Tables"]["metric_definitions"]["Update"];

export interface SettingsActionResult {
  ok: boolean;
  error?: string;
}

function revalidateSettingsPaths(): void {
  revalidatePath("/settings");
  revalidatePath("/p/[slug]/metrics", "page");
  revalidatePath("/report");
  revalidatePath("/");
}

function ok(): SettingsActionResult {
  return { ok: true };
}

function fail(error: string): SettingsActionResult {
  return { ok: false, error };
}

/** Set or clear (null) the weekly revenue target, preserving other target keys. */
export async function updateProjectTargets(
  projectId: string,
  weeklyRevenueMad: number | null
): Promise<SettingsActionResult> {
  if (weeklyRevenueMad !== null && (!Number.isFinite(weeklyRevenueMad) || weeklyRevenueMad <= 0)) {
    return fail("Target must be a positive number (or empty to clear).");
  }

  const supabase = await createClient();
  const { data: project, error: readError } = await supabase
    .from("projects")
    .select("targets")
    .eq("id", projectId)
    .single();
  if (readError || !project) return fail("Project not found.");

  const current =
    project.targets && typeof project.targets === "object" && !Array.isArray(project.targets)
      ? (project.targets as Record<string, Json | undefined>)
      : {};
  const targets: Record<string, Json | undefined> = { ...current };
  if (weeklyRevenueMad === null) delete targets.weekly_revenue_mad;
  else targets.weekly_revenue_mad = weeklyRevenueMad;

  const { error } = await supabase
    .from("projects")
    .update({ targets: targets as Json })
    .eq("id", projectId);
  if (error) return fail(error.message);

  revalidateSettingsPaths();
  return ok();
}

export interface CreateMetricInput {
  name: string;
  key?: string | null;
  unit?: string | null;
  aggregation?: MetricAggregation;
  weeklyTarget?: number | null;
  quickIncrement?: number | null;
}

function slugifyKey(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function createMetricDefinition(
  projectId: string,
  input: CreateMetricInput
): Promise<SettingsActionResult> {
  const name = input.name.trim();
  if (!name) return fail("Name is required.");
  const key = input.key?.trim() ? slugifyKey(input.key) : slugifyKey(name);
  if (!key) return fail("Could not derive a key from the name.");

  const supabase = await createClient();
  const { count } = await supabase
    .from("metric_definitions")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);

  const { error } = await supabase.from("metric_definitions").insert({
    project_id: projectId,
    key,
    name,
    unit: input.unit?.trim() ? input.unit.trim() : null,
    aggregation: input.aggregation ?? "sum",
    weekly_target: input.weeklyTarget ?? null,
    quick_increment: input.quickIncrement ?? null,
    sort_order: (count ?? 0) + 1,
  });
  if (error) {
    if (error.code === "23505") return fail(`A metric with key "${key}" already exists.`);
    return fail(error.message);
  }

  revalidateSettingsPaths();
  return ok();
}

export interface UpdateMetricInput {
  name?: string;
  unit?: string | null;
  weeklyTarget?: number | null;
  quickIncrement?: number | null;
  active?: boolean;
}

export async function updateMetricDefinition(
  id: string,
  input: UpdateMetricInput
): Promise<SettingsActionResult> {
  const patch: MetricDefinitionUpdate = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) return fail("Name cannot be empty.");
    patch.name = name;
  }
  if (input.unit !== undefined) patch.unit = input.unit?.trim() ? input.unit.trim() : null;
  if (input.weeklyTarget !== undefined) patch.weekly_target = input.weeklyTarget;
  if (input.quickIncrement !== undefined) patch.quick_increment = input.quickIncrement;
  if (input.active !== undefined) patch.active = input.active;
  if (Object.keys(patch).length === 0) return ok();

  const supabase = await createClient();
  const { error } = await supabase.from("metric_definitions").update(patch).eq("id", id);
  if (error) return fail(error.message);

  revalidateSettingsPaths();
  return ok();
}
