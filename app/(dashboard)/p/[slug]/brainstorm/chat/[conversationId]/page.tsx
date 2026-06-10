import { notFound } from "next/navigation";
import type { UIMessage } from "ai";
import { ProjectChat } from "@/components/brainstorm/chat";
import { createClient } from "@/lib/supabase/server";
import type { AiMessageRow, Json } from "@/types/db";

/** Convert a db row's parts (Json) → UIMessage parts array safely. */
function rowToUIMessage(row: AiMessageRow): UIMessage {
  return {
    id: row.id,
    role: row.role as UIMessage["role"],
    parts: row.parts as UIMessage["parts"],
  };
}

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ slug: string; conversationId: string }>;
}) {
  const { slug, conversationId } = await params;
  const supabase = await createClient();

  // Load conversation (validates it belongs to a real project)
  const { data: conversation } = await supabase
    .from("ai_conversations")
    .select("id, project_id, title")
    .eq("id", conversationId)
    .single();
  if (!conversation) notFound();

  const { data: project } = await supabase
    .from("projects")
    .select("id, slug, name")
    .eq("id", conversation.project_id)
    .eq("slug", slug)
    .single();
  if (!project) notFound();

  const { data: messageRows } = await supabase
    .from("ai_messages")
    .select("id, conversation_id, role, parts, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  const initialMessages: UIMessage[] = (messageRows ?? []).map(rowToUIMessage);

  return (
    <ProjectChat
      conversationId={conversationId}
      initialMessages={initialMessages}
      projectName={project.name}
    />
  );
}
