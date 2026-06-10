"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { IdeaStage } from "@/types/db";

export interface IdeaInput {
  title: string;
  description?: string | null;
  impact?: number | null;
  effort?: number | null;
}

export interface IdeaPatch {
  title?: string;
  description?: string | null;
  stage?: IdeaStage;
  impact?: number | null;
  effort?: number | null;
}

export interface ActionResult {
  error: string | null;
}

function revalidateIdeas() {
  revalidatePath("/p/[slug]/brainstorm/ideas", "page");
}

function clampScore(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(value)) return null;
  return Math.min(5, Math.max(1, Math.round(value)));
}

export async function createIdea(projectId: string, input: IdeaInput): Promise<ActionResult> {
  const title = input.title.trim();
  if (!title) return { error: "Title is required" };

  const supabase = await createClient();
  const { error } = await supabase.from("ideas").insert({
    project_id: projectId,
    title,
    description: input.description?.trim() || null,
    impact: clampScore(input.impact),
    effort: clampScore(input.effort),
  });

  if (error) return { error: error.message };
  revalidateIdeas();
  return { error: null };
}

export async function updateIdea(id: string, patch: IdeaPatch): Promise<ActionResult> {
  const supabase = await createClient();

  const update: IdeaPatch = { ...patch };
  if ("title" in update && update.title !== undefined) {
    update.title = update.title.trim();
    if (!update.title) return { error: "Title is required" };
  }
  if ("impact" in update) update.impact = clampScore(update.impact);
  if ("effort" in update) update.effort = clampScore(update.effort);

  const { error } = await supabase.from("ideas").update(update).eq("id", id);

  if (error) return { error: error.message };
  revalidateIdeas();
  return { error: null };
}

export async function deleteIdea(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("ideas").delete().eq("id", id);

  if (error) return { error: error.message };
  revalidateIdeas();
  return { error: null };
}

/**
 * Converts an idea into a real task and back-references it
 * (idea.converted_task_id + stage 'executing').
 */
export async function convertIdeaToTask(ideaId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: idea, error: ideaError } = await supabase
    .from("ideas")
    .select("id, project_id, title, description, converted_task_id")
    .eq("id", ideaId)
    .single();

  if (ideaError || !idea) return { error: ideaError?.message ?? "Idea not found" };
  if (idea.converted_task_id) return { error: "Idea was already converted to a task" };

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .insert({
      project_id: idea.project_id,
      title: idea.title,
      description: idea.description,
      priority: "p2",
      status: "todo",
      source: "app",
      sort_order: 0,
    })
    .select("id")
    .single();

  if (taskError || !task) return { error: taskError?.message ?? "Could not create task" };

  const { error: linkError } = await supabase
    .from("ideas")
    .update({ converted_task_id: task.id, stage: "executing" })
    .eq("id", ideaId);

  if (linkError) return { error: linkError.message };

  revalidateIdeas();
  revalidatePath("/p/[slug]/tasks", "page");
  return { error: null };
}
