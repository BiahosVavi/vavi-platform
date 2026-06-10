"use client";

import { Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { createTask, deleteTask, updateTask } from "@/app/actions/tasks";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  suggestPriority,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
} from "@/lib/labels";
import type { Task, TaskPriority, TaskStatus } from "@/types/db";
import { parseTags } from "./utils";

interface TaskDialogProps {
  slug: string;
  /** Required for create mode. */
  projectId?: string;
  /** Edit mode when provided. */
  task?: Task;
  /** Controlled mode (used by task cards / list rows). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Label for the built-in trigger button (uncontrolled create mode). */
  triggerLabel?: string;
}

interface FormState {
  title: string;
  description: string;
  isUrgent: boolean;
  isImportant: boolean;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string;
  tags: string;
}

function initialState(task?: Task): FormState {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    isUrgent: task?.is_urgent ?? false,
    isImportant: task?.is_important ?? false,
    priority: task?.priority ?? "p4",
    status: task?.status ?? "todo",
    dueDate: task?.due_date ?? "",
    tags: task?.tags.join(", ") ?? "",
  };
}

export function TaskDialog({
  slug,
  projectId,
  task,
  open,
  onOpenChange,
  triggerLabel = "New task",
}: TaskDialogProps) {
  const controlled = open !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlled ? open : internalOpen;
  const [form, setForm] = useState<FormState>(() => initialState(task));
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  const setOpen = useCallback(
    (next: boolean) => {
      if (controlled) onOpenChange?.(next);
      else setInternalOpen(next);
    },
    [controlled, onOpenChange]
  );

  // Re-seed the form each time the dialog opens (fresh task data, reset confirm).
  useEffect(() => {
    if (isOpen) {
      setForm(initialState(task));
      setConfirmingDelete(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  /** Eisenhower switches live-suggest the priority (still overridable below). */
  function setEisenhower(key: "isUrgent" | "isImportant", value: boolean) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      next.priority = suggestPriority(next.isUrgent, next.isImportant);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Title is required.");
      return;
    }
    startTransition(async () => {
      const result = task
        ? await updateTask(
            task.id,
            {
              title: form.title,
              description: form.description || null,
              priority: form.priority,
              isUrgent: form.isUrgent,
              isImportant: form.isImportant,
              status: form.status,
              dueDate: form.dueDate || null,
              tags: parseTags(form.tags),
            },
            slug
          )
        : await createTask({
            slug,
            projectId: projectId!,
            title: form.title,
            description: form.description || null,
            priority: form.priority,
            isUrgent: form.isUrgent,
            isImportant: form.isImportant,
            status: form.status,
            dueDate: form.dueDate || null,
            tags: parseTags(form.tags),
          });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(task ? "Task updated" : "Task created");
      setOpen(false);
    });
  }

  function handleDelete() {
    if (!task) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    startTransition(async () => {
      const result = await deleteTask(task.id, slug);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Task deleted");
      setOpen(false);
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {!controlled && (
        <DialogTrigger asChild>
          <Button size="sm">
            <Plus data-icon="inline-start" />
            {triggerLabel}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
          <DialogDescription>
            {task
              ? "Update the task details below."
              : "Add a task to this project."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="What needs to be done?"
              autoFocus
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Optional details…"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <Label htmlFor="task-urgent" className="text-sm">
                Urgent
              </Label>
              <Switch
                id="task-urgent"
                checked={form.isUrgent}
                onCheckedChange={(v) => setEisenhower("isUrgent", v)}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <Label htmlFor="task-important" className="text-sm">
                Important
              </Label>
              <Switch
                id="task-important"
                checked={form.isImportant}
                onCheckedChange={(v) => setEisenhower("isImportant", v)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={form.priority}
                onValueChange={(v) => set("priority", v as TaskPriority)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {TASK_PRIORITY_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => set("status", v as TaskStatus)}
              >
                <SelectTrigger className="w-full">
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
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="task-due">Due date</Label>
              <Input
                id="task-due"
                type="date"
                value={form.dueDate}
                onChange={(e) => set("dueDate", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-tags">Tags</Label>
              <Input
                id="task-tags"
                value={form.tags}
                onChange={(e) => set("tags", e.target.value)}
                placeholder="comma, separated"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            {task ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={pending}
                onClick={handleDelete}
              >
                <Trash2 data-icon="inline-start" />
                {confirmingDelete ? "Click again to confirm" : "Delete"}
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving…" : task ? "Save changes" : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
