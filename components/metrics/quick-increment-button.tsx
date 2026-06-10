"use client";

import { useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { quickIncrementMetric } from "@/app/actions/metrics";
import { Button } from "@/components/ui/button";

export function QuickIncrementButton({
  metricId,
  projectId,
  increment,
  name,
}: {
  metricId: string;
  projectId: string;
  increment: number;
  name: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await quickIncrementMetric(metricId, projectId);
          if (res.ok) toast.success(`+${increment} ${name}`);
          else toast.error(res.error ?? "Failed to log.");
        })
      }
    >
      <Plus data-icon="inline-start" />
      {`+${increment} ${name}`}
    </Button>
  );
}
