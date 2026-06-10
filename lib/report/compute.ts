// Computes a full WeekReport from the database for a given week.
// SIGNATURE IS A CONTRACT: lib/briefings.ts (Telegram Friday report) and the
// /report page both call this. Implemented in Phase 2.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";
import type { IsoDate } from "@/lib/time";
import type { WeekReport } from "./types";

export async function computeWeekReport(
  _supabase: SupabaseClient<Database>,
  _weekStart: IsoDate
): Promise<WeekReport> {
  throw new Error("computeWeekReport: implemented in Phase 2");
}
