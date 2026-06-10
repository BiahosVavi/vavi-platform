import { notFound } from "next/navigation";
import { MessageSquarePlus, Sparkles, Trash2 } from "lucide-react";
import { createConversation, deleteConversation } from "@/app/actions/chat";
import { BrainstormSubnav } from "@/components/brainstorm/subnav";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default async function ChatListPage({
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

  const { data: conversations } = await supabase
    .from("ai_conversations")
    .select("id, title, updated_at")
    .eq("project_id", project.id)
    .order("updated_at", { ascending: false });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BrainstormSubnav slug={slug} />
        <form action={createConversation.bind(null, project.id, slug)}>
          <Button size="sm" type="submit">
            <MessageSquarePlus className="size-4" />
            New conversation
          </Button>
        </form>
      </div>

      {!conversations?.length ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          <Sparkles className="size-6" />
          No conversations yet. Start a new one.
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3"
            >
              <a
                href={`/p/${slug}/brainstorm/chat/${conv.id}`}
                className="min-w-0 flex-1"
              >
                <p className="truncate text-sm font-medium">
                  {conv.title ?? "Untitled"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatRelative(conv.updated_at)}
                </p>
              </a>
              <form
                action={async () => {
                  "use server";
                  await deleteConversation(conv.id, slug);
                }}
              >
                <button
                  type="submit"
                  title="Delete conversation"
                  className="rounded p-1 text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
