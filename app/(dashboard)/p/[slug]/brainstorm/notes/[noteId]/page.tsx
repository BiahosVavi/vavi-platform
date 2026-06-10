import { notFound } from "next/navigation";
import { NoteEditor } from "@/components/brainstorm/note-editor";
import { createClient } from "@/lib/supabase/server";

export default async function NoteEditorPage({
  params,
}: {
  params: Promise<{ slug: string; noteId: string }>;
}) {
  const { slug, noteId } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("slug", slug)
    .single();
  if (!project) notFound();

  const { data: note } = await supabase
    .from("notes")
    .select("*")
    .eq("id", noteId)
    .eq("project_id", project.id)
    .single();
  if (!note) notFound();

  return <NoteEditor note={note} slug={slug} />;
}
