import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@/lib/supabase/server";
import { chatModel } from "@/lib/ai/provider";
import { localToday, weekBounds } from "@/lib/time";
import type { Json } from "@/types/db";

export const maxDuration = 60;

export async function POST(req: Request): Promise<Response> {
  const supabase = await createClient();

  // Auth guard
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = (await req.json()) as { messages: UIMessage[]; conversationId: string };
  const { messages, conversationId } = body;

  // Load conversation + project
  const { data: conversation } = await supabase
    .from("ai_conversations")
    .select("id, project_id, title")
    .eq("id", conversationId)
    .single();

  if (!conversation) {
    return new Response("Conversation not found", { status: 404 });
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, context_md")
    .eq("id", conversation.project_id)
    .single();

  if (!project) {
    return new Response("Project not found", { status: 404 });
  }

  // --- Live context ---
  const today = localToday();
  const { start: weekStart, end: weekEnd } = weekBounds(today);

  // Top 10 open tasks
  const { data: openTasks } = await supabase
    .from("tasks")
    .select("title, priority, due_date, status")
    .eq("project_id", project.id)
    .neq("status", "done")
    .order("priority", { ascending: true })
    .order("due_date", { ascending: true })
    .limit(10);

  // This week's revenue sum
  const { data: revenueRows } = await supabase
    .from("money_entries")
    .select("amount_mad")
    .eq("project_id", project.id)
    .eq("type", "revenue")
    .gte("entry_date", weekStart)
    .lte("entry_date", weekEnd);

  const weekRevenue = (revenueRows ?? []).reduce((s, r) => s + r.amount_mad, 0);

  // This week's pipeline event counts
  const { data: pipelineRows } = await supabase
    .from("pipeline_events")
    .select("type")
    .eq("project_id", project.id)
    .gte("event_date", weekStart)
    .lte("event_date", weekEnd);

  const pipelineCounts: Record<string, number> = {};
  for (const row of pipelineRows ?? []) {
    pipelineCounts[row.type] = (pipelineCounts[row.type] ?? 0) + 1;
  }

  // This week's metric totals (joined with definitions for names)
  const { data: metricDefs } = await supabase
    .from("metric_definitions")
    .select("id, name, unit")
    .eq("project_id", project.id)
    .eq("active", true);

  const metricMap = new Map(
    (metricDefs ?? []).map((d) => [d.id, { name: d.name, unit: d.unit }])
  );

  const { data: metricEntries } = await supabase
    .from("metric_entries")
    .select("metric_id, value")
    .eq("project_id", project.id)
    .gte("entry_date", weekStart)
    .lte("entry_date", weekEnd);

  const metricTotals: Record<string, { name: string; unit: string | null; total: number }> = {};
  for (const entry of metricEntries ?? []) {
    const def = metricMap.get(entry.metric_id);
    if (!def) continue;
    if (!metricTotals[entry.metric_id]) {
      metricTotals[entry.metric_id] = { name: def.name, unit: def.unit, total: 0 };
    }
    metricTotals[entry.metric_id].total += entry.value;
  }

  // Last 5 deal_won events
  const { data: dealWons } = await supabase
    .from("pipeline_events")
    .select("contact, value_mad, event_date, note")
    .eq("project_id", project.id)
    .eq("type", "deal_won")
    .order("event_date", { ascending: false })
    .limit(5);

  // --- Build system prompt ---
  const taskLines =
    (openTasks ?? [])
      .map(
        (t) =>
          `- [${t.priority}] ${t.title}${t.due_date ? ` (due ${t.due_date})` : ""} [${t.status}]`
      )
      .join("\n") || "None";

  const pipelineLines =
    Object.entries(pipelineCounts)
      .map(([k, v]) => `- ${k}: ${v}`)
      .join("\n") || "None";

  const metricLines =
    Object.values(metricTotals)
      .map((m) => `- ${m.name}: ${m.total}${m.unit ? ` ${m.unit}` : ""}`)
      .join("\n") || "None";

  const dealWonLines =
    (dealWons ?? [])
      .map(
        (d) =>
          `- ${d.contact ?? "—"} | ${d.value_mad != null ? `${d.value_mad} MAD` : "—"} | ${d.event_date}${d.note ? ` — ${d.note}` : ""}`
      )
      .join("\n") || "None";

  const systemPrompt = [
    `You are Vavi, research & strategy assistant for "${project.name}".`,
    project.context_md ? `\nProject context:\n${project.context_md}` : "",
    `\n--- Live context (week ${weekStart} → ${weekEnd}) ---`,
    `\nOpen tasks (top 10):\n${taskLines}`,
    `\nThis week revenue: ${weekRevenue} MAD`,
    `\nThis week pipeline events:\n${pipelineLines}`,
    `\nThis week metrics:\n${metricLines}`,
    `\nLast 5 deals won:\n${dealWonLines}`,
    "\n---",
    "\nBe practical, direct, operator mindset; concrete next actions; amounts in MAD.",
  ]
    .filter(Boolean)
    .join("");

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: chatModel(),
    system: systemPrompt,
    messages: modelMessages,
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    onFinish: async ({ messages: finalMessages }) => {
      // Upsert all messages into ai_messages
      const rows = finalMessages.map((msg) => ({
        id: msg.id,
        conversation_id: conversationId,
        role: msg.role,
        parts: msg.parts as unknown as Json,
      }));

      if (rows.length > 0) {
        await supabase
          .from("ai_messages")
          .upsert(rows, { onConflict: "id" });
      }

      // Update conversation updated_at; set title from first user message if still null
      const firstUserMsg = finalMessages.find((m) => m.role === "user");
      const firstUserText = firstUserMsg?.parts
        .filter((p) => p.type === "text")
        .map((p) => p.text)
        .join(" ")
        .trim();

      const titleUpdate =
        conversation.title == null && firstUserText
          ? firstUserText.slice(0, 60)
          : undefined;

      await supabase
        .from("ai_conversations")
        .update({
          updated_at: new Date().toISOString(),
          ...(titleUpdate != null ? { title: titleUpdate } : {}),
        })
        .eq("id", conversationId);
    },
  });
}
