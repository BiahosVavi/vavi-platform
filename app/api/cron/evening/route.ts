import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildEveningSummary, buildWeeklyReportMessage } from "@/lib/briefings";
import { computeWeekReport } from "@/lib/report/compute";
import { sendMessage } from "@/lib/telegram/api";
import { localToday, localWeekday, weekBounds } from "@/lib/time";
import type { IsoDate } from "@/lib/time";
import type { Json } from "@/types/db";

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

  // Build the evening summary
  let message: string;
  try {
    message = await buildEveningSummary(supabase, localDate);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Build failed: ${detail}` }, { status: 500 });
  }

  // Append weekly report on Fridays
  const weekday = localWeekday(dateParam ? new Date(`${dateParam}T12:00:00Z`) : new Date());
  let weeklyReportPayload: ReturnType<typeof buildWeeklyReportMessage> | null = null;

  if (weekday === "Fri") {
    try {
      const { start } = weekBounds(localDate);
      const report = await computeWeekReport(supabase, start);
      weeklyReportPayload = buildWeeklyReportMessage(report);
      message = `${message}\n\n${weeklyReportPayload}`;

      if (!isDryRun) {
        // Upsert report_snapshots
        await supabase
          .from("report_snapshots")
          .upsert(
            {
              week_start: start,
              payload: report as unknown as Json,
              overall_score: report.overall ?? null,
            },
            { onConflict: "week_start" }
          );
      }
    } catch (err) {
      console.error("weekly report build failed:", err instanceof Error ? err.message : String(err));
      // Non-fatal: continue with evening summary only
    }
  }

  if (isDryRun) {
    return NextResponse.json({ message });
  }

  // Idempotency: insert cron_runs row
  const { data: existing, error: selectError } = await supabase
    .from("cron_runs")
    .select("id, status")
    .eq("job", "evening")
    .eq("local_date", localDate)
    .maybeSingle();

  if (selectError) {
    return NextResponse.json({ error: selectError.message }, { status: 500 });
  }

  if (existing && (existing.status === "sent" || existing.status === "skipped")) {
    return NextResponse.json({ ok: true, skipped: true, reason: "already ran" });
  }

  let cronRunId: string;
  if (existing) {
    cronRunId = existing.id;
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from("cron_runs")
      .insert({ job: "evening", local_date: localDate, status: "pending" })
      .select("id")
      .single();
    if (insertError) {
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
