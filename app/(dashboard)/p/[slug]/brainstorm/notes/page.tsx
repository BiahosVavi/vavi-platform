import Link from "next/link";
import { notFound } from "next/navigation";
import { Pin, PinOff, Plus, StickyNote } from "lucide-react";
import { createNote, updateNote } from "@/app/actions/notes";
import { BrainstormSubnav } from "@/components/brainstorm/subnav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

/** Plain-text excerpt of markdown content (~150 chars). */
function excerpt(md: string, max = 150): string {
  const text = md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`~\[\]()|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

export default async function NotesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, slug")
    .eq("slug", slug)
    .single();
  if (!project) notFound();

  const { data: notes } = await supabase
    .from("notes")
    .select("*")
    .eq("project_id", project.id)
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BrainstormSubnav slug={slug} />
        <form action={createNote.bind(null, project.id, slug)}>
          <Button size="sm" type="submit">
            <Plus className="size-4" />
            New note
          </Button>
        </form>
      </div>

      {!notes?.length ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          <StickyNote className="size-6" />
          No notes yet. Capture your first thought.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <Card key={note.id} className={cn("gap-3 py-4", note.pinned && "border-primary/40")}>
              <CardHeader className="px-4">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm leading-snug">
                    <Link
                      href={`/p/${slug}/brainstorm/notes/${note.id}`}
                      className="hover:underline"
                    >
                      {note.title || "Untitled note"}
                    </Link>
                  </CardTitle>
                  <form
                    action={async () => {
                      "use server";
                      await updateNote(note.id, { pinned: !note.pinned });
                    }}
                  >
                    <button
                      type="submit"
                      title={note.pinned ? "Unpin" : "Pin"}
                      className={cn(
                        "rounded p-1 text-muted-foreground transition-colors hover:text-foreground",
                        note.pinned && "text-primary hover:text-primary"
                      )}
                    >
                      {note.pinned ? (
                        <Pin className="size-3.5 fill-current" />
                      ) : (
                        <PinOff className="size-3.5" />
                      )}
                    </button>
                  </form>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 px-4">
                {excerpt(note.content_md) && (
                  <p className="text-xs text-muted-foreground">{excerpt(note.content_md)}</p>
                )}
                {note.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {note.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[10px]">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
