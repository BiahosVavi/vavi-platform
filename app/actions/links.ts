"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface LinkPatch {
  url?: string;
  title?: string | null;
  description?: string | null;
  tags?: string[];
}

export interface ActionResult {
  error: string | null;
}

function revalidateLinks() {
  revalidatePath("/p/[slug]/brainstorm/links", "page");
}

/** Normalizes a URL (prepends https:// when no protocol) and validates it. */
function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(candidate).toString();
  } catch {
    return null;
  }
}

export async function createLink(
  projectId: string,
  url: string,
  title?: string,
  description?: string,
  tags: string[] = []
): Promise<ActionResult> {
  const normalized = normalizeUrl(url);
  if (!normalized) return { error: "Please provide a valid URL" };

  const supabase = await createClient();
  const { error } = await supabase.from("links").insert({
    project_id: projectId,
    url: normalized,
    title: title?.trim() || null,
    description: description?.trim() || null,
    tags: tags.map((t) => t.trim()).filter(Boolean),
  });

  if (error) return { error: error.message };
  revalidateLinks();
  return { error: null };
}

export async function updateLink(id: string, patch: LinkPatch): Promise<ActionResult> {
  const update: LinkPatch = { ...patch };
  if (update.url !== undefined) {
    const normalized = normalizeUrl(update.url);
    if (!normalized) return { error: "Please provide a valid URL" };
    update.url = normalized;
  }
  if (update.tags) update.tags = update.tags.map((t) => t.trim()).filter(Boolean);

  const supabase = await createClient();
  const { error } = await supabase.from("links").update(update).eq("id", id);

  if (error) return { error: error.message };
  revalidateLinks();
  return { error: null };
}

export async function deleteLink(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("links").delete().eq("id", id);

  if (error) return { error: error.message };
  revalidateLinks();
  return { error: null };
}
