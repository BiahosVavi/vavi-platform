"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { setTaskStatus } from "@/app/actions/tasks";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TASK_STATUS_LABELS, TASK_STATUSES } from "@/lib/labels";
import { formatDateLabel } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { Task, TaskStatus } from "@/types/db";
import { TaskDialog } from "./task-dialog";
import {
  isOverdue,
  PRIORITY_BADGE_CLASSES,
  priorityShortLabel,
  sortForList,
} from "./utils";

interface TaskListProps {
  tasks: Task[];
  slug: string;
}

export function TaskList({ tasks, slug }: TaskListProps) {
  const sorted = useMemo(() => sortForList(tasks), [tasks]);

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead className="w-40">Status</TableHead>
            <TableHead className="w-20">Priority</TableHead>
            <TableHead className="w-32">Due date</TableHead>
            <TableHead>Tags</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((task) => (
            <TaskRow key={task.id} task={task} slug={slug} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TaskRow({ task, slug }: { task: Task; slug: string }) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(task.status);
  const overdue = isOverdue(task);

  function handleStatusChange(status: TaskStatus) {
    if (status === task.status) return;
    startTransition(async () => {
      setOptimisticStatus(status);
      const result = await setTaskStatus(task.id, status, slug);
      if (result.error) {
        toast.error(`Could not update status: ${result.error}`);
      }
    });
  }

  return (
    <>
      <TableRow
        className="cursor-pointer"
        onClick={() => setOpen(true)}
      >
        <TableCell className="font-medium">{task.title}</TableCell>
        <TableCell onClick={(e) => e.stopPropagation()}>
          <Select value={optimisticStatus} onValueChange={(v) => handleStatusChange(v as TaskStatus)}>
            <SelectTrigger size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {TASK_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          <Badge className={PRIORITY_BADGE_CLASSES[task.priority]}>
            {priorityShortLabel(task.priority)}
          </Badge>
        </TableCell>
        <TableCell
          className={cn(
            "text-sm",
            overdue
              ? "font-medium text-red-600 dark:text-red-400"
              : "text-muted-foreground"
          )}
        >
          {task.due_date ? formatDateLabel(task.due_date) : "—"}
        </TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1">
            {task.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px]">
                {tag}
              </Badge>
            ))}
          </div>
        </TableCell>
      </TableRow>
      <TaskDialog slug={slug} task={task} open={open} onOpenChange={setOpen} />
    </>
  );
}
