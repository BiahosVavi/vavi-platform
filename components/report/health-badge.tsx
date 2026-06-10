// Server-safe presentational helpers for health bands. No client JS needed.

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { HealthBand } from "@/lib/report/types";

/** Badge background + text classes per band. */
export const BAND_BADGE: Record<HealthBand, string> = {
  green: "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
  amber: "bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
  red: "bg-red-500/15 text-red-700 dark:bg-red-500/20 dark:text-red-400",
  none: "bg-muted text-muted-foreground",
};

/** Plain text color classes per band (for large numbers). */
export const BAND_TEXT: Record<HealthBand, string> = {
  green: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  red: "text-red-600 dark:text-red-400",
  none: "text-muted-foreground",
};

export function HealthBadge({
  score,
  band,
  className,
}: {
  score: number | null;
  band: HealthBand;
  className?: string;
}) {
  return (
    <Badge variant="secondary" className={cn(BAND_BADGE[band], className)}>
      {score === null ? "No data" : `${Math.round(score)}%`}
    </Badge>
  );
}
