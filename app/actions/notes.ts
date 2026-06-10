"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface NotePatch {
  title?: string;
  content_md?: string;
  pinned?: boolean;
  tags?: string[];
}

export interface ActionResult {
  error: string | null;
}

function revalidateNotes() {
  revalidatePath("/p/[slug]/brainstorm/notes", "page");
  revalidatePath("/p/[slug]/brainstorm/notes/[noteId]", "page");
}

export async function createNote(projectId: string, slug: string): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notes")
    .insert({ project_id: projectId, title: "Untitled note" })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not create note");
  }

  revalidateNotes();
  redirect(`/p/${slug}/brainstorm/notes/${data.id}`);
}

export async function updateNote(id: string, patch: NotePatch): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("notes").update(patch).eq("id", id);

  if (error) return { error: error.message };

  revalidateNotes();
  return { error: null };
}

export async function deleteNote(id: string, slug: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("notes").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidateNotes();
  redirect(`/p/${slug}/brainstorm/notes`);
}
