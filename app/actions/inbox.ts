"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { undoAction, ActionError } from "@/lib/telegram/apply-action";
import type { TelegramInboxRow } from "@/types/db";

export interface UndoResult {
  error: string | null;
  receipt: string | null;
}

export async function undoInboxItem(id: string): Promise<UndoResult> {
  const supabase = await createClient();

  const { data: row, error: fetchError } = await supabase
    .from("telegram_inbox")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !row) {
    return { error: fetchError?.message ?? "Inbox item not found.", receipt: null };
  }

  try {
    const receipt = await undoAction(supabase, row as TelegramInboxRow);
    revalidatePath("/inbox");
    return { error: null, receipt };
  } catch (err) {
    const message =
      err instanceof ActionError ? err.message : "Could not undo that entry.";
    return { error: message, receipt: null };
  }
}
