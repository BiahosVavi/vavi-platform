"use client";

import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { formatDateLabel } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/db";
import { TaskDialog } from "./task-dialog";
import { isOverdue, PRIORITY_BADGE_CLASSES, priorityShortLabel } from "./utils";

interface TaskCardProps {
  task: Task;
  slug: string;
  /** Render-only (e.g. inside a DragOverlay) — no edit dialog. */
  overlay?: boolean;
  className?: string;
}

export function TaskCard({ task, slug, overlay = false, className }: TaskCardProps) {
  const [open, setOpen] = useState(false);
  const overdue = isOverdue(task);

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => !overlay && setOpen(true)}
        onKeyDown={(e) => {
          if (!overlay && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          "space-y-2 rounded-lg border bg-card p-3 text-left text-card-foreground shadow-xs transition-colors",
          !overlay && "cursor-pointer hover:border-primary/40",
          className
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 text-sm leading-snug font-medium break-words">
            {task.title}
          </p>
          <Badge className={cn("shrink-0", PRIORITY_BADGE_CLASSES[task.priority])}>
            {priorityShortLabel(task.priority)}
          </Badge>
        </div>

        {(task.due_date || task.tags.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {task.due_date && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-xs",
                  overdue ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground"
                )}
              >
                <CalendarDays className="size-3" />
                {formatDateLabel(task.due_date)}
              </span>
            )}
            {task.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px]">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {!overlay && (
        <TaskDialog slug={slug} task={task} open={open} onOpenChange={setOpen} />
      )}
    </>
  );
}
