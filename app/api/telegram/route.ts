import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleUpdate, type TelegramUpdate } from "@/lib/telegram/handlers";
import { sendMessage } from "@/lib/telegram/api";
import type { Json } from "@/types/db";

export const maxDuration = 60;

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Verify webhook secret
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (!secret || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const chatId =
    update.message?.chat.id ??
    update.callback_query?.message?.chat.id ??
    null;

  const messageId =
    update.message?.message_id ??
    update.callback_query?.message?.message_id ??
    null;

  const rawText =
    update.message?.text ??
    update.callback_query?.data ??
    null;

  // Deduplicate by telegram_update_id (unique constraint)
  const { data: inserted, error: insertError } = await supabase
    .from("telegram_inbox")
    .insert({
      telegram_update_id: update.update_id,
      chat_id: chatId,
      message_id: messageId,
      raw_text: rawText,
      status: "received",
    })
    .select("id")
    .single();

  if (insertError) {
    // Unique violation (code 23505) means we already processed this update_id
    if (insertError.code === "23505") {
      return NextResponse.json({ ok: true, deduped: true });
    }
    console.error("telegram_inbox insert error:", insertError.message);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  const inboxId = inserted.id;

  try {
    await handleUpdate(supabase, update, inboxId);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("handleUpdate error:", detail);

    // Mark inbox row as failed
    await supabase
      .from("telegram_inbox")
      .update({ status: "failed", error: detail })
      .eq("id", inboxId);

    // Send a short apology if we know the chat
    if (chatId) {
      try {
        await sendMessage(chatId, "⚠️ Something went wrong. Please try again.");
      } catch {
        // Swallow secondary error
      }
    }
  }

  // Always return 200 to Telegram
  return NextResponse.json({ ok: true });
}
