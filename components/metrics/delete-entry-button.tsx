"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteMetricEntry,
  deleteMoneyEntry,
  deletePipelineEvent,
} from "@/app/actions/metrics";
import { Button } from "@/components/ui/button";

export type EntryKind = "metric" | "pipeline" | "money";

const DELETERS: Record<EntryKind, (id: string) => Promise<{ ok: boolean; error?: string }>> = {
  metric: deleteMetricEntry,
  pipeline: deletePipelineEvent,
  money: deleteMoneyEntry,
};

export function DeleteEntryButton({ kind, id }: { kind: EntryKind; id: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={pending}
      aria-label="Delete entry"
      className="text-muted-foreground hover:text-destructive"
      onClick={() =>
        startTransition(async () => {
          const res = await DELETERS[kind](id);
          if (res.ok) toast.success("Entry deleted.");
          else toast.error(res.error ?? "Failed to delete.");
        })
      }
    >
      <Trash2 />
    </Button>
  );
}
