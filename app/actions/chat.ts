"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function revalidateChat(slug: string) {
  revalidatePath(`/p/${slug}/brainstorm/chat`, "page");
}

export async function createConversation(projectId: string, slug: string): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_conversations")
    .insert({ project_id: projectId })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not create conversation");
  }

  revalidateChat(slug);
  redirect(`/p/${slug}/brainstorm/chat/${data.id}`);
}

export async function deleteConversation(id: string, slug: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("ai_conversations").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidateChat(slug);
  redirect(`/p/${slug}/brainstorm/chat`);
}

export async function renameConversation(
  id: string,
  title: string,
  slug: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ai_conversations")
    .update({ title: title.trim() || null })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidateChat(slug);
}
