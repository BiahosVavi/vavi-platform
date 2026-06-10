import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildMorningBriefing } from "@/lib/briefings";
import { sendMessage } from "@/lib/telegram/api";
import { localToday } from "@/lib/time";
import type { IsoDate } from "@/lib/time";

export const maxDuration = 60;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const searchParams = req.nextUrl.searchParams;
  const isDev = process.env.NODE_ENV === "development";
  const debugSecret = process.env.DEBUG_SECRET;
  const isDryRunAllowed =
    isDev || (!!debugSecret && searchParams.get("debug") === debugSecret);

  // Auth check (bypassed for dry-run mode)
  if (!isDryRunAllowed) {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const isDryRun = isDryRunAllowed && searchParams.get("dryRun") === "1";
  const dateParam = searchParams.get("date");

  const localDate: IsoDate = dateParam ?? localToday();

  const supabase = createAdminClient();

  // Build the message
  let message: string;
  try {
    message = await buildMorningBriefing(supabase, localDate);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Build failed: ${detail}` }, { status: 500 });
  }

  if (isDryRun) {
    return NextResponse.json({ message });
  }

  // Idempotency: insert cron_runs row
  const { data: existing, error: selectError } = await supabase
    .from("cron_runs")
    .select("id, status")
    .eq("job", "morning")
    .eq("local_date", localDate)
    .maybeSingle();

  if (selectError) {
    return NextResponse.json({ error: selectError.message }, { status: 500 });
  }

  if (existing && (existing.status === "sent" || existing.status === "skipped")) {
    return NextResponse.json({ ok: true, skipped: true, reason: "already ran" });
  }

  // Insert or reuse existing row (retry path)
  let cronRunId: string;
  if (existing) {
    cronRunId = existing.id;
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from("cron_runs")
      .insert({ job: "morning", local_date: localDate, status: "pending" })
      .select("id")
      .single();
    if (insertError) {
      // Race condition: another instance inserted first
      if (insertError.code === "23505") {
        return NextResponse.json({ ok: true, skipped: true, reason: "race dedup" });
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
    cronRunId = inserted.id;
  }

  // Get chat_id from app_settings
  const { data: setting } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "telegram_chat_id")
    .maybeSingle();

  if (!setting?.value) {
    await supabase
      .from("cron_runs")
      .update({ status: "skipped", detail: "no telegram_chat_id configured" })
      .eq("id", cronRunId);
    return NextResponse.json({ ok: true, skipped: true, reason: "no chat_id" });
  }

  const chatId = typeof setting.value === "number" ? setting.value : Number(setting.value);

  try {
    await sendMessage(chatId, message);
    await supabase
      .from("cron_runs")
      .update({ status: "sent", detail: null })
      .eq("id", cronRunId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    await supabase
      .from("cron_runs")
      .update({ status: "error", detail })
      .eq("id", cronRunId);
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
