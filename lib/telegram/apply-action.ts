import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json, TelegramInboxRow } from "@/types/db";
import type { QuickAddResult } from "@/lib/ai/quick-add-schema";
import { esc } from "@/lib/telegram/api";
import { formatMAD, formatNumber } from "@/lib/format";
import { PIPELINE_EVENT_LABELS } from "@/lib/labels";
import { formatDateLabel, localToday } from "@/lib/time";

// Client-agnostic: works with the admin client (webhook/cron) and the
// user-session server client (web UI undo).
type DbClient = SupabaseClient<Database>;

const UNDO_WINDOW_MS = 24 * 60 * 60 * 1000;

const UNDOABLE_TABLES = [
  "tasks",
  "pipeline_events",
  "money_entries",
  "metric_entries",
  "ideas",
] as const;
type UndoableTable = (typeof UNDOABLE_TABLES)[number];

/** Failure with a user-presentable (already HTML-safe) message. */
export class ActionError extends Error {}

async function markFailed(
  supabase: DbClient,
  inboxId: string,
  parsed: QuickAddResult,
  error: string
): Promise<void> {
  await supabase
    .from("telegram_inbox")
    .update({
      status: "failed",
      action: parsed.action.type,
      parsed: parsed as unknown as Json,
      error,
      decided_at: new Date().toISOString(),
    })
    .eq("id", inboxId);
}

async function resolveProject(
  supabase: DbClient,
  slug: string
): Promise<{ id: string; name: string }> {
  const { data, error } = await supabase
    .from("projects")
    .select("id, name")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`Project lookup failed: ${error.message}`);
  if (!data) throw new ActionError(`⚠️ Unknown project "${esc(slug)}".`);
  return data;
}

/**
 * Execute a parsed quick-add action, mark the inbox row 'applied', and return
 * a short human receipt (HTML-safe). On a user-correctable failure (e.g.
 * unknown metric key) the inbox row is marked 'failed' and an ActionError with
 * a helpful message is thrown.
 */
export async function applyAction(
  supabase: DbClient,
  parsed: QuickAddResult,
  inboxId: string
): Promise<string> {
  const action = parsed.action;

  try {
    if (action.type === "unknown") {
      throw new ActionError(`⚠️ Nothing to apply: ${esc(action.reason)}`);
    }

    const project = await resolveProject(supabase, action.project);
    let resultTable: UndoableTable;
    let resultId: string;
    let receipt: string;

    switch (action.type) {
      case "create_task": {
        const priority = action.priority ?? "p3";
        const { data, error } = await supabase
          .from("tasks")
          .insert({
            project_id: project.id,
            title: action.title,
            description: action.description ?? null,
            priority,
            due_date: action.due_date ?? null,
            tags: action.tags ?? [],
            source: "telegram",
            sort_order: 0,
          })
          .select("id")
          .single();
        if (error || !data) throw new Error(error?.message ?? "task insert failed");
        resultTable = "tasks";
        resultId = data.id;
        receipt = `✅ Task created in ${esc(project.name)}: ${esc(action.title)} (${priority.toUpperCase()}${
          action.due_date ? `, due ${formatDateLabel(action.due_date)}` : ""
        })`;
        break;
      }

      case "log_pipeline": {
        const { data, error } = await supabase
          .from("pipeline_events")
          .insert({
            project_id: project.id,
            type: action.event,
            contact: action.contact ?? null,
            value_mad: action.value_mad ?? null,
            note: action.note ?? null,
            event_date: localToday(),
            source: "telegram",
          })
          .select("id")
          .single();
        if (error || !data) throw new Error(error?.message ?? "pipeline insert failed");
        resultTable = "pipeline_events";
        resultId = data.id;
        receipt = `✅ ${PIPELINE_EVENT_LABELS[action.event]} in ${esc(project.name)}${
          action.contact ? `: ${esc(action.contact)}` : ""
        }${action.value_mad != null ? ` (${formatMAD(action.value_mad)})` : ""}`;
        break;
      }

      case "log_money": {
        const { data, error } = await supabase
          .from("money_entries")
          .insert({
            project_id: project.id,
            type: action.kind,
            amount_mad: action.amount_mad,
            category: action.category ?? null,
            note: action.note ?? null,
            entry_date: localToday(),
            source: "telegram",
          })
          .select("id")
          .single();
        if (error || !data) throw new Error(error?.message ?? "money insert failed");
        resultTable = "money_entries";
        resultId = data.id;
        receipt = `✅ ${action.kind === "revenue" ? "Revenue" : "Expense"} logged in ${esc(project.name)}: ${formatMAD(
          action.amount_mad
        )}${action.category ? ` (${esc(action.category)})` : ""}`;
        break;
      }

      case "log_metric": {
        const { data: metric, error: metricError } = await supabase
          .from("metric_definitions")
          .select("id, name, unit")
          .eq("project_id", project.id)
          .eq("key", action.metric_key)
          .maybeSingle();
        if (metricError) throw new Error(metricError.message);
        if (!metric) {
          const { data: available } = await supabase
            .from("metric_definitions")
            .select("key")
            .eq("project_id", project.id)
            .eq("active", true);
          const keys = (available ?? []).map((m) => m.key).join(", ") || "none";
          throw new ActionError(
            `⚠️ No metric "${esc(action.metric_key)}" in ${esc(project.name)}. Available: ${esc(keys)}.`
          );
        }
        const { data, error } = await supabase
          .from("metric_entries")
          .insert({
            metric_id: metric.id,
            project_id: project.id,
            value: action.value,
            note: action.note ?? null,
            entry_date: localToday(),
            source: "telegram",
          })
          .select("id")
          .single();
        if (error || !data) throw new Error(error?.message ?? "metric insert failed");
        resultTable = "metric_entries";
        resultId = data.id;
        receipt = `✅ ${esc(metric.name)} logged in ${esc(project.name)}: ${formatNumber(action.value)}${
          metric.unit ? ` ${esc(metric.unit)}` : ""
        }`;
        break;
      }

      case "capture_idea": {
        const { data, error } = await supabase
          .from("ideas")
          .insert({
            project_id: project.id,
            title: action.title,
            description: action.description ?? null,
            stage: "raw",
            source: "telegram",
          })
          .select("id")
          .single();
        if (error || !data) throw new Error(error?.message ?? "idea insert failed");
        resultTable = "ideas";
        resultId = data.id;
        receipt = `✅ Idea captured in ${esc(project.name)}: ${esc(action.title)}`;
        break;
      }
    }

    const { error: inboxError } = await supabase
      .from("telegram_inbox")
      .update({
        status: "applied",
        action: action.type,
        parsed: { ...parsed, receipt } as unknown as Json,
        result_table: resultTable,
        result_id: resultId,
        error: null,
        decided_at: new Date().toISOString(),
      })
      .eq("id", inboxId);
    if (inboxError) {
      // The entity exists; surface the receipt anyway but log the bookkeeping miss.
      console.error("applyAction: inbox update failed:", inboxError.message);
    }

    return receipt;
  } catch (error) {
    const message =
      error instanceof ActionError
        ? error.message
        : `⚠️ Could not apply that: ${esc(error instanceof Error ? error.message : String(error))}`;
    await markFailed(supabase, inboxId, parsed, message);
    if (error instanceof ActionError) throw error;
    throw new ActionError(message);
  }
}

/**
 * Hard-delete the row created by an applied quick-add and mark the inbox row
 * 'undone'. Only allowed while status is 'applied' and within 24h of creation.
 * Returns a short confirmation string; throws ActionError when not undoable.
 */
export async function undoAction(
  supabase: DbClient,
  inboxRow: TelegramInboxRow
): Promise<string> {
  if (inboxRow.status !== "applied") {
    throw new ActionError("⚠️ Nothing to undo — this entry is no longer applied.");
  }
  if (!inboxRow.result_table || !inboxRow.result_id) {
    throw new ActionError("⚠️ Nothing to undo — no linked record.");
  }
  if (Date.now() - new Date(inboxRow.created_at).getTime() > UNDO_WINDOW_MS) {
    throw new ActionError("⚠️ Too old to undo (24h limit).");
  }
  const table = inboxRow.result_table as UndoableTable;
  if (!UNDOABLE_TABLES.includes(table)) {
    throw new ActionError("⚠️ This entry cannot be undone.");
  }

  const { error: deleteError } = await supabase
    .from(table)
    .delete()
    .eq("id", inboxRow.result_id);
  if (deleteError) {
    throw new ActionError(`⚠️ Undo failed: ${esc(deleteError.message)}`);
  }

  const { error: updateError } = await supabase
    .from("telegram_inbox")
    .update({ status: "undone", decided_at: new Date().toISOString() })
    .eq("id", inboxRow.id);
  if (updateError) {
    console.error("undoAction: inbox update failed:", updateError.message);
  }

  return "↩ Undone.";
}
