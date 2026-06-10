"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database, TaskPriority, TaskStatus } from "@/types/db";

type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];

export interface ActionResult {
  error: string | null;
}

export interface CreateTaskInput {
  /** Project slug, used for revalidation. */
  slug: string;
  projectId: string;
  title: string;
  description?: string | null;
  priority: TaskPriority;
  isUrgent: boolean;
  isImportant: boolean;
  status?: TaskStatus;
  /** ISO date YYYY-MM-DD */
  dueDate?: string | null;
  tags?: string[];
}

export interface TaskPatch {
  title?: string;
  description?: string | null;
  priority?: TaskPriority;
  isUrgent?: boolean;
  isImportant?: boolean;
  status?: TaskStatus;
  dueDate?: string | null;
  tags?: string[];
}

function revalidateTasks(slug: string) {
  revalidatePath(`/p/${slug}/tasks`);
  revalidatePath("/");
}

export async function createTask(input: CreateTaskInput): Promise<ActionResult> {
  const title = input.title.trim();
  if (!title) return { error: "Title is required." };

  const status: TaskStatus = input.status ?? "todo";
  const supabase = await createClient();

  // New tasks go to the top of their column: (min sort_order) - 1, or 0.
  const { data: minRow } = await supabase
    .from("tasks")
    .select("sort_order")
    .eq("project_id", input.projectId)
    .eq("status", status)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  const sortOrder = minRow ? minRow.sort_order - 1 : 0;

  const { error } = await supabase.from("tasks").insert({
    project_id: input.projectId,
    title,
    description: input.description?.trim() || null,
    priority: input.priority,
    is_urgent: input.isUrgent,
    is_important: input.isImportant,
    status,
    due_date: input.dueDate || null,
    tags: input.tags ?? [],
    sort_order: sortOrder,
    completed_at: status === "done" ? new Date().toISOString() : null,
  });

  if (error) return { error: error.message };
  revalidateTasks(input.slug);
  return { error: null };
}

export async function updateTask(
  id: string,
  patch: TaskPatch,
  slug: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const update: TaskUpdate = {};
  if (patch.title !== undefined) {
    const title = patch.title.trim();
    if (!title) return { error: "Title is required." };
    update.title = title;
  }
  if (patch.description !== undefined) update.description = patch.description?.trim() || null;
  if (patch.priority !== undefined) update.priority = patch.priority;
  if (patch.isUrgent !== undefined) update.is_urgent = patch.isUrgent;
  if (patch.isImportant !== undefined) update.is_important = patch.isImportant;
  if (patch.dueDate !== undefined) update.due_date = patch.dueDate || null;
  if (patch.tags !== undefined) update.tags = patch.tags;

  // Keep completed_at in sync when status changes through the edit dialog too.
  if (patch.status !== undefined) {
    const { data: current, error: readError } = await supabase
      .from("tasks")
      .select("status")
      .eq("id", id)
      .single();
    if (readError) return { error: readError.message };
    update.status = patch.status;
    if (patch.status === "done" && current.status !== "done") {
      update.completed_at = new Date().toISOString();
    } else if (patch.status !== "done" && current.status === "done") {
      update.completed_at = null;
    }
  }

  const { error } = await supabase.from("tasks").update(update).eq("id", id);
  if (error) return { error: error.message };
  revalidateTasks(slug);
  return { error: null };
}

export async function setTaskStatus(
  id: string,
  status: TaskStatus,
  slug: string,
  newSortOrder?: number
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: current, error: readError } = await supabase
    .from("tasks")
    .select("status")
    .eq("id", id)
    .single();
  if (readError) return { error: readError.message };

  const update: TaskUpdate = { status };
  if (status === "done" && current.status !== "done") {
    update.completed_at = new Date().toISOString();
  } else if (status !== "done" && current.status === "done") {
    update.completed_at = null;
  }
  if (newSortOrder !== undefined) update.sort_order = newSortOrder;

  const { error } = await supabase.from("tasks").update(update).eq("id", id);
  if (error) return { error: error.message };
  revalidateTasks(slug);
  return { error: null };
}

/**
 * Fractional reordering: the client computes the midpoint between the new
 * neighbours' sort_order values and passes it in — no mass renumbering.
 */
export async function reorderTask(
  id: string,
  newSortOrder: number,
  slug: string,
  newStatus?: TaskStatus
): Promise<ActionResult> {
  if (newStatus !== undefined) {
    // Delegate so completed_at stays correct when the column changes.
    return setTaskStatus(id, newStatus, slug, newSortOrder);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ sort_order: newSortOrder })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidateTasks(slug);
  return { error: null };
}

export async function deleteTask(id: string, slug: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidateTasks(slug);
  return { error: null };
}
