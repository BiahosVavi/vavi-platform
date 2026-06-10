import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json, TelegramInboxRow } from "@/types/db";
import {
  sendMessage,
  editMessageText,
  answerCallbackQuery,
  esc,
  type InlineKeyboardMarkup,
} from "@/lib/telegram/api";
import { applyAction, undoAction, ActionError } from "@/lib/telegram/apply-action";
import { parseQuickAdd, type QuickAddContext } from "@/lib/ai/parse-quick-add";
import type { QuickAddAction, QuickAddResult } from "@/lib/ai/quick-add-schema";
import {
  buildMorningBriefing,
  buildEveningSummary,
  buildWeeklyReportMessage,
  buildWeekToDate,
} from "@/lib/briefings";
import { computeWeekReport } from "@/lib/report/compute";
import { localToday, weekBounds } from "@/lib/time";

type DbClient = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// Telegram update shape (minimal — only what we use)
// ---------------------------------------------------------------------------

interface TelegramUser {
  id: number;
  first_name: string;
  username?: string;
}

interface TelegramChat {
  id: number;
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  text?: string;
}

interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getChatId(supabase: DbClient): Promise<number | null> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "telegram_chat_id")
    .maybeSingle();
  if (!data?.value) return null;
  return typeof data.value === "number" ? data.value : Number(data.value);
}

function undoKeyboard(inboxId: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [[{ text: "↩ Undo", callback_data: `undo:${inboxId}` }]],
  };
}

function confirmKeyboard(inboxId: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "✅ Confirm", callback_data: `confirm:${inboxId}` },
        { text: "❌ Cancel", callback_data: `cancel:${inboxId}` },
      ],
    ],
  };
}

async function loadContext(supabase: DbClient): Promise<QuickAddContext> {
  const [projectsRes, metricsRes] = await Promise.all([
    supabase
      .from("projects")
      .select("slug, name, description")
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("metric_definitions")
      .select("key, name, unit, project_id, projects!inner(slug)")
      .eq("active", true),
  ]);

  const projects = (projectsRes.data ?? []).map((p) => ({
    slug: p.slug,
    name: p.name,
    description: p.description,
  }));

  const metrics = (metricsRes.data ?? []).map((m) => {
    const proj = m.projects as unknown as { slug: string };
    return {
      projectSlug: proj.slug,
      key: m.key,
      name: m.name,
      unit: m.unit,
    };
  });

  return { projects, metrics };
}

// ---------------------------------------------------------------------------
// Command handlers
// ---------------------------------------------------------------------------

async function handleStart(
  supabase: DbClient,
  chatId: number,
  firstName: string,
  registeredChatId: number | null
): Promise<void> {
  if (registeredChatId === null) {
    await supabase.from("app_settings").upsert(
      { key: "telegram_chat_id", value: chatId as unknown as Json, updated_at: new Date().toISOString() },
      { onConflict: "key", ignoreDuplicates: true }
    );
  }

  const name = esc(firstName);
  await sendMessage(
    chatId,
    `👋 Hi ${name}! I'm your Vavi CoWork assistant.\n\n` +
      `<b>Commands</b>\n` +
      `/today — morning briefing\n` +
      `/week — week-to-date numbers\n` +
      `/report — full weekly report\n` +
      `/tasks [flyson|abna|brand] — open tasks\n` +
      `/undo — undo last applied action\n` +
      `/help — examples & tips\n\n` +
      `<b>Quick-add examples</b>\n` +
      `• <code>task: call Ahmed re proposal flyson p2</code>\n` +
      `• <code>revenue 5k abna-son landing page</code>\n` +
      `• <code>lead added: Karim Benali flyson 8k</code>`
  );
}

async function handleToday(supabase: DbClient, chatId: number): Promise<void> {
  const today = localToday();
  const msg = await buildMorningBriefing(supabase, today);
  await sendMessage(chatId, msg);
}

async function handleWeek(supabase: DbClient, chatId: number): Promise<void> {
  const today = localToday();
  const msg = await buildWeekToDate(supabase, today);
  await sendMessage(chatId, msg);
}

async function handleReport(supabase: DbClient, chatId: number): Promise<void> {
  const today = localToday();
  const { start } = weekBounds(today);
  const report = await computeWeekReport(supabase, start);
  const msg = buildWeeklyReportMessage(report);
  await sendMessage(chatId, msg);
}

async function handleTasks(
  supabase: DbClient,
  chatId: number,
  filter?: string
): Promise<void> {
  const today = localToday();

  let query = supabase
    .from("tasks")
    .select("id, project_id, title, priority, due_date, status, projects!inner(slug, name)")
    .neq("status", "done")
    .order("priority")
    .order("created_at");

  if (filter) {
    const slugMap: Record<string, string> = { flyson: "flyson", abna: "abna-son", brand: "personal-brand" };
    const slug = slugMap[filter.toLowerCase()] ?? filter.toLowerCase();
    query = query.eq("projects.slug", slug) as typeof query;
  }

  const { data, error } = await query.limit(60);
  if (error) {
    await sendMessage(chatId, `⚠️ Could not load tasks: ${esc(error.message)}`);
    return;
  }

  const rows = data ?? [];
  if (rows.length === 0) {
    await sendMessage(chatId, "No open tasks found.");
    return;
  }

  type PriorityKey = "p1" | "p2" | "p3" | "p4";
  const grouped = new Map<PriorityKey, typeof rows>();
  for (const row of rows) {
    const p = row.priority as PriorityKey;
    if (!grouped.has(p)) grouped.set(p, []);
    grouped.get(p)!.push(row);
  }

  const LABELS: Record<PriorityKey, string> = {
    p1: "🔴 P1 — Critical",
    p2: "🟠 P2 — High",
    p3: "🟡 P3 — Normal",
    p4: "⚪ P4 — Low",
  };

  const lines: string[] = [filter ? `📋 <b>Open tasks — ${esc(filter)}</b>` : "📋 <b>Open tasks</b>"];
  for (const p of (["p1", "p2", "p3", "p4"] as PriorityKey[])) {
    const group = grouped.get(p);
    if (!group?.length) continue;
    lines.push("", LABELS[p]);
    for (const task of group) {
      const proj = task.projects as unknown as { slug: string; name: string };
      const overdue = task.due_date && task.due_date < today ? ` ⏰ ${task.due_date}` : "";
      lines.push(`• [${esc(proj.slug)}] ${esc(task.title)}${overdue}`);
    }
  }

  await sendMessage(chatId, lines.join("\n"));
}

async function handleUndo(supabase: DbClient, chatId: number): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("telegram_inbox")
    .select("*")
    .eq("status", "applied")
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    await sendMessage(chatId, `⚠️ Could not fetch inbox: ${esc(error.message)}`);
    return;
  }
  if (!data) {
    await sendMessage(chatId, "Nothing to undo in the last 24 hours.");
    return;
  }

  try {
    const receipt = await undoAction(supabase, data as TelegramInboxRow);
    await sendMessage(chatId, receipt);
  } catch (err) {
    const msg = err instanceof ActionError ? err.message : `⚠️ Undo failed.`;
    await sendMessage(chatId, msg);
  }
}

async function handleHelp(supabase: DbClient, chatId: number): Promise<void> {
  await sendMessage(
    chatId,
    `<b>Commands</b>\n` +
      `/today — morning briefing (tasks due + week targets)\n` +
      `/week — week-to-date numbers for all projects\n` +
      `/report — full weekly health report\n` +
      `/tasks [flyson|abna|brand] — list open tasks (optional project filter)\n` +
      `/undo — undo the latest applied quick-add (24h window)\n` +
      `/help — this message\n\n` +
      `<b>Quick-add examples</b>\n` +
      `• <code>task: call Ahmed re proposal flyson p2</code>\n` +
      `• <code>revenue 5k abna-son landing page</code>\n` +
      `• <code>expense 800 flyson fuel</code>\n` +
      `• <code>lead added: Karim Benali flyson 8k</code>\n` +
      `• <code>deal won: SaaS client abna 12k</code>\n` +
      `• <code>metric: hectares 12 flyson</code>\n` +
      `• <code>idea: drone swarm scheduling flyson</code>\n\n` +
      `When confidence is low I'll ask for confirmation before saving.`
  );
}

// ---------------------------------------------------------------------------
// Free-text quick-add
// ---------------------------------------------------------------------------

async function handleFreeText(
  supabase: DbClient,
  chatId: number,
  text: string,
  inboxId: string
): Promise<void> {
  const context = await loadContext(supabase);
  const parsed = await parseQuickAdd(text, context);

  if (parsed.action.type === "unknown") {
    const reason = esc(parsed.action.reason);
    await supabase
      .from("telegram_inbox")
      .update({ action: "unknown", parsed: parsed as unknown as Json, status: "failed" })
      .eq("id", inboxId);

    await sendMessage(
      chatId,
      `❓ ${reason}\n\n` +
        `<b>Examples:</b>\n` +
        `• <code>task: call Ahmed flyson p2</code>\n` +
        `• <code>revenue 5k abna-son</code>`
    );
    return;
  }

  if (parsed.confidence === "high") {
    try {
      const receipt = await applyAction(supabase, parsed, inboxId);
      const botMsgId = await sendMessage(chatId, receipt, { reply_markup: undoKeyboard(inboxId) });
      await supabase
        .from("telegram_inbox")
        .update({ bot_message_id: botMsgId })
        .eq("id", inboxId);
    } catch (err) {
      const msg = err instanceof ActionError ? err.message : `⚠️ Could not apply that action.`;
      await sendMessage(chatId, msg);
    }
  } else {
    // confidence === 'low' — save and ask for confirmation
    await supabase
      .from("telegram_inbox")
      .update({
        action: parsed.action.type,
        parsed: parsed as unknown as Json,
        status: "pending_confirm",
      })
      .eq("id", inboxId);

    const preview = buildPreview(parsed.action);
    const botMsgId = await sendMessage(
      chatId,
      `🤔 Not sure about this one:\n${preview}\n\nConfirm?`,
      { reply_markup: confirmKeyboard(inboxId) }
    );
    await supabase
      .from("telegram_inbox")
      .update({ bot_message_id: botMsgId })
      .eq("id", inboxId);
  }
}

function buildPreview(action: QuickAddAction): string {
  switch (action.type) {
    case "create_task":
      return `📋 Task in <b>${esc(action.project)}</b>: ${esc(action.title)}${action.priority ? ` (${action.priority.toUpperCase()})` : ""}`;
    case "log_pipeline":
      return `🤝 Pipeline in <b>${esc(action.project)}</b>: ${esc(action.event)}${action.contact ? ` — ${esc(action.contact)}` : ""}${action.value_mad != null ? ` (${action.value_mad} MAD)` : ""}`;
    case "log_money":
      return `💰 ${action.kind === "revenue" ? "Revenue" : "Expense"} in <b>${esc(action.project)}</b>: ${action.amount_mad} MAD${action.category ? ` (${esc(action.category)})` : ""}`;
    case "log_metric":
      return `📊 Metric in <b>${esc(action.project)}</b>: ${esc(action.metric_key)} = ${action.value}`;
    case "capture_idea":
      return `💡 Idea in <b>${esc(action.project)}</b>: ${esc(action.title)}`;
    case "unknown":
      return `❓ ${esc(action.reason)}`;
  }
}

// ---------------------------------------------------------------------------
// Callback query handler
// ---------------------------------------------------------------------------

async function handleCallbackQuery(
  supabase: DbClient,
  callbackQuery: TelegramCallbackQuery
): Promise<void> {
  const { id: callbackId, message, data } = callbackQuery;
  const chatId = message?.chat.id;

  // Always ack first
  await answerCallbackQuery(callbackId).catch(() => undefined);

  if (!chatId || !data) return;

  const [action, inboxId] = data.split(":") as [string, string];
  if (!inboxId) return;

  const { data: row, error } = await supabase
    .from("telegram_inbox")
    .select("*")
    .eq("id", inboxId)
    .maybeSingle();

  if (error || !row) {
    if (message) {
      await editMessageText(chatId, message.message_id, "⚠️ Entry not found.").catch(() => undefined);
    }
    return;
  }

  const inbox = row as TelegramInboxRow;
  const botMsgId = message?.message_id ?? inbox.bot_message_id;

  if (action === "confirm") {
    if (!inbox.parsed) {
      if (botMsgId) {
        await editMessageText(chatId, botMsgId, "⚠️ No parsed data to apply.").catch(() => undefined);
      }
      return;
    }
    try {
      const parsed = inbox.parsed as QuickAddResult;
      const receipt = await applyAction(supabase, parsed, inboxId);
      if (botMsgId) {
        await editMessageText(chatId, botMsgId, receipt, { reply_markup: undoKeyboard(inboxId) }).catch(() => undefined);
      }
    } catch (err) {
      const msg = err instanceof ActionError ? err.message : "⚠️ Could not apply that action.";
      if (botMsgId) {
        await editMessageText(chatId, botMsgId, msg).catch(() => undefined);
      }
    }
  } else if (action === "cancel") {
    await supabase
      .from("telegram_inbox")
      .update({ status: "cancelled", decided_at: new Date().toISOString() })
      .eq("id", inboxId);
    if (botMsgId) {
      await editMessageText(chatId, botMsgId, "❌ Cancelled.").catch(() => undefined);
    }
  } else if (action === "undo") {
    try {
      const receipt = await undoAction(supabase, inbox);
      if (botMsgId) {
        await editMessageText(chatId, botMsgId, receipt).catch(() => undefined);
      }
    } catch (err) {
      const msg = err instanceof ActionError ? err.message : "⚠️ Undo failed.";
      if (botMsgId) {
        await editMessageText(chatId, botMsgId, msg).catch(() => undefined);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function handleUpdate(
  supabase: DbClient,
  update: TelegramUpdate,
  inboxId: string
): Promise<void> {
  // Handle callback queries (button presses)
  if (update.callback_query) {
    // Auth check for callback queries
    const registeredChatId = await getChatId(supabase);
    const queryChatId = update.callback_query.message?.chat.id ?? update.callback_query.from.id;
    if (registeredChatId !== null && queryChatId !== registeredChatId) return;

    await handleCallbackQuery(supabase, update.callback_query);
    return;
  }

  const message = update.message;
  if (!message?.text) return;

  const chatId = message.chat.id;
  const text = message.text.trim();
  const firstName = message.from?.first_name ?? "friend";

  // Authorization: /start is allowed when no chat_id registered yet (first wins)
  const registeredChatId = await getChatId(supabase);
  const isStart = text === "/start" || text.startsWith("/start ");

  if (registeredChatId !== null && chatId !== registeredChatId) {
    // Silently ignore updates from other chats
    return;
  }

  // Command routing
  if (isStart) {
    await handleStart(supabase, chatId, firstName, registeredChatId);
    return;
  }

  if (text === "/today" || text.startsWith("/today ")) {
    await handleToday(supabase, chatId);
    return;
  }

  if (text === "/week" || text.startsWith("/week ")) {
    await handleWeek(supabase, chatId);
    return;
  }

  if (text === "/report" || text.startsWith("/report ")) {
    await handleReport(supabase, chatId);
    return;
  }

  if (text === "/tasks" || text.startsWith("/tasks ")) {
    const parts = text.split(/\s+/);
    const filter = parts[1];
    await handleTasks(supabase, chatId, filter);
    return;
  }

  if (text === "/undo" || text.startsWith("/undo ")) {
    await handleUndo(supabase, chatId);
    return;
  }

  if (text === "/help" || text.startsWith("/help ")) {
    await handleHelp(supabase, chatId);
    return;
  }

  // Free-text quick-add
  await handleFreeText(supabase, chatId, text, inboxId);
}
