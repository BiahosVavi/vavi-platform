"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { undoInboxItem } from "@/app/actions/inbox";

interface InboxUndoButtonProps {
  inboxId: string;
}

export function InboxUndoButton({ inboxId }: InboxUndoButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleUndo() {
    startTransition(async () => {
      const result = await undoInboxItem(inboxId);
      if (result.error) {
        // Strip HTML tags from ActionError messages before showing in alert
        const plain = result.error.replace(/<[^>]+>/g, "");
        alert(plain);
      }
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={handleUndo}
      className="h-7 text-xs"
    >
      {isPending ? "Undoing…" : "↩ Undo"}
    </Button>
  );
}
