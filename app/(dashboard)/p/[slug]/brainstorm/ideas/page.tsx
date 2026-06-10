import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive } from "lucide-react";
import { IdeaBoard } from "@/components/brainstorm/idea-board";
import { BrainstormSubnav } from "@/components/brainstorm/subnav";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export default async function IdeasPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ archived?: string }>;
}) {
  const { slug } = await params;
  const { archived } = await searchParams;
  const showArchived = archived === "1";

  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, slug")
    .eq("slug", slug)
    .single();
  if (!project) notFound();

  const { data: ideas } = await supabase
    .from("ideas")
    .select("*")
    .eq("project_id", project.id)
    .order("sort_order")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BrainstormSubnav slug={slug} />
        <Link
          href={
            showArchived
              ? `/p/${slug}/brainstorm/ideas`
              : `/p/${slug}/brainstorm/ideas?archived=1`
          }
          className={cn(
            "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground",
            showArchived && "bg-muted text-foreground"
          )}
        >
          <Archive className="size-3.5" />
          {showArchived ? "Hide archived" : "Show archived"}
        </Link>
      </div>

      <IdeaBoard
        ideas={ideas ?? []}
        projectId={project.id}
        slug={slug}
        showArchived={showArchived}
      />
    </div>
  );
}
