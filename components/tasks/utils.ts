// Shared pure helpers for the tasks feature (safe to import from server or client).
import { localToday } from "@/lib/time";
import type { Task, TaskPriority } from "@/types/db";

/** Badge classes per priority: p1 red, p2 orange, p3 default, p4 muted. */
export const PRIORITY_BADGE_CLASSES: Record<TaskPriority, string> = {
  p1: "bg-red-500/15 text-red-600 dark:bg-red-500/20 dark:text-red-400",
  p2: "bg-orange-500/15 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400",
  p3: "bg-secondary text-secondary-foreground",
  p4: "bg-muted text-muted-foreground",
};

/** Short display label, e.g. 'P1'. */
export function priorityShortLabel(priority: TaskPriority): string {
  return priority.toUpperCase();
}

/** A task is overdue when it has a due date before today and is not done. */
export function isOverdue(task: Pick<Task, "due_date" | "status">): boolean {
  return Boolean(task.due_date) && task.due_date! < localToday() && task.status !== "done";
}

/** 'tag1, tag2 ,tag3' → ['tag1','tag2','tag3'] (trimmed, deduped, no empties). */
export function parseTags(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    )
  );
}

/**
 * Fractional ordering: sort_order between two neighbours.
 * `before` is the neighbour above (smaller), `after` the one below (larger).
 */
export function midpointSortOrder(before?: number, after?: number): number {
  if (before === undefined && after === undefined) return 0;
  if (before === undefined) return after! - 1;
  if (after === undefined) return before + 1;
  return (before + after) / 2;
}

/** List-view ordering: priority (p1 first), then due date (nulls last), then title. */
export function sortForList(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority < b.priority ? -1 : 1;
    if (a.due_date !== b.due_date) {
      if (a.due_date === null) return 1;
      if (b.due_date === null) return -1;
      return a.due_date < b.due_date ? -1 : 1;
    }
    return a.title.localeCompare(b.title);
  });
}
