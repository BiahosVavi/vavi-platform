import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { InboxUndoButton } from "@/components/inbox-undo-button";
import type { TelegramInboxRow, InboxStatus } from "@/types/db";

// Status badge colours using Tailwind utility classes via variant + className
const STATUS_VARIANT: Record<InboxStatus, "default" | "secondary" | "destructive" | "outline"> = {
  received: "secondary",
  pending_confirm: "outline",
  applied: "default",
  cancelled: "secondary",
  undone: "secondary",
  failed: "destructive",
};

const STATUS_LABEL: Record<InboxStatus, string> = {
  received: "Received",
  pending_confirm: "Pending",
  applied: "Applied",
  cancelled: "Cancelled",
  undone: "Undone",
  failed: "Failed",
};

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Casablanca",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

function isUndoable(row: TelegramInboxRow): boolean {
  if (row.status !== "applied") return false;
  return Date.now() - new Date(row.created_at).getTime() < 24 * 60 * 60 * 1000;
}

export default async function InboxPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("telegram_inbox")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = (data ?? []) as TelegramInboxRow[];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Telegram Inbox</h1>
        <p className="text-sm text-muted-foreground">
          Latest 50 quick-add messages received via Telegram.
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive">Failed to load inbox: {error.message}</p>
      )}

      {rows.length === 0 && !error && (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          <p className="font-medium">No messages yet.</p>
          <p className="mt-1">
            Send a quick-add to your Telegram bot — e.g.{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">task: call Ahmed flyson p2</code>{" "}
            — and it will appear here.
          </p>
        </div>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Time</th>
                <th className="px-3 py-2 text-left font-medium">Message</th>
                <th className="px-3 py-2 text-left font-medium">Action</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Result / Error</th>
                <th className="px-3 py-2 text-left font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const status = row.status as InboxStatus;
                const resultOrError = row.error
                  ? row.error.replace(/<[^>]+>/g, "")
                  : row.result_table && row.result_id
                    ? `${row.result_table}/${row.result_id.slice(0, 8)}`
                    : null;

                return (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                      {formatTime(row.created_at)}
                    </td>
                    <td className="max-w-xs px-3 py-2">
                      <span className="line-clamp-2 break-words">
                        {row.raw_text ?? <span className="text-muted-foreground italic">—</span>}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {row.action ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={STATUS_VARIANT[status]}>
                        {STATUS_LABEL[status]}
                      </Badge>
                    </td>
                    <td className="max-w-xs px-3 py-2 text-muted-foreground">
                      {resultOrError ? (
                        <span className="line-clamp-2 break-words text-xs">{resultOrError}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isUndoable(row) && <InboxUndoButton inboxId={row.id} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
