"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { reorderTask, setTaskStatus } from "@/app/actions/tasks";
import { Badge } from "@/components/ui/badge";
import { TASK_STATUS_LABELS, TASK_STATUSES } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { Task, TaskStatus } from "@/types/db";
import { TaskCard } from "./task-card";
import { midpointSortOrder } from "./utils";

type Columns = Record<TaskStatus, Task[]>;

function groupTasks(tasks: Task[]): Columns {
  const cols: Columns = { todo: [], in_progress: [], done: [], blocked: [] };
  for (const task of tasks) cols[task.status].push(task); // already sorted by sort_order
  return cols;
}

function isStatus(id: string): id is TaskStatus {
  return (TASK_STATUSES as string[]).includes(id);
}

function findColumnOf(id: string, cols: Columns): TaskStatus | null {
  if (isStatus(id)) return id;
  for (const status of TASK_STATUSES) {
    if (cols[status].some((t) => t.id === id)) return status;
  }
  return null;
}

interface KanbanProps {
  tasks: Task[];
  slug: string;
}

export function Kanban({ tasks, slug }: KanbanProps) {
  const [columns, setColumns] = useState<Columns>(() => groupTasks(tasks));
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const originRef = useRef<Columns | null>(null);
  const recentDragRef = useRef(false);

  // Re-sync local state whenever the server data refreshes.
  useEffect(() => {
    setColumns(groupTasks(tasks));
  }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleDragStart(event: DragStartEvent) {
    originRef.current = columns;
    const id = String(event.active.id);
    const col = findColumnOf(id, columns);
    setActiveTask(col ? columns[col].find((t) => t.id === id) ?? null : null);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    setColumns((prev) => {
      const from = findColumnOf(activeId, prev);
      const to = findColumnOf(overId, prev);
      if (!from || !to || from === to) return prev;

      const task = prev[from].find((t) => t.id === activeId);
      if (!task) return prev;

      const fromList = prev[from].filter((t) => t.id !== activeId);
      const toList = [...prev[to]];
      const overIndex = toList.findIndex((t) => t.id === overId);
      const insertAt = overIndex >= 0 ? overIndex : toList.length;
      toList.splice(insertAt, 0, { ...task, status: to });
      return { ...prev, [from]: fromList, [to]: toList };
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const origin = originRef.current;
    originRef.current = null;
    setActiveTask(null);
    // Suppress the synthetic click that follows a drop (would open the dialog).
    recentDragRef.current = true;
    setTimeout(() => {
      recentDragRef.current = false;
    }, 150);

    if (!over) {
      if (origin) setColumns(origin);
      return;
    }

    const activeId = String(active.id);
    const col = findColumnOf(activeId, columns);
    if (!col) return;

    const list = columns[col];
    const oldIndex = list.findIndex((t) => t.id === activeId);
    if (oldIndex < 0) return;

    const overId = String(over.id);
    const overIndex = overId !== activeId ? list.findIndex((t) => t.id === overId) : -1;
    const newIndex = overIndex >= 0 ? overIndex : oldIndex;
    const newList = arrayMove(list, oldIndex, newIndex);

    const finalIndex = newList.findIndex((t) => t.id === activeId);
    const before = newList[finalIndex - 1]?.sort_order;
    const after = newList[finalIndex + 1]?.sort_order;
    const newSortOrder = midpointSortOrder(before, after);

    const serverTask = tasks.find((t) => t.id === activeId);
    const statusChanged = serverTask !== undefined && serverTask.status !== col;
    if (!statusChanged && newIndex === oldIndex) return; // dropped where it was

    // Optimistic: apply the final order + fractional sort_order locally.
    setColumns((prev) => ({
      ...prev,
      [col]: newList.map((t) =>
        t.id === activeId ? { ...t, sort_order: newSortOrder } : t
      ),
    }));

    void (async () => {
      const result = statusChanged
        ? await setTaskStatus(activeId, col, slug, newSortOrder)
        : await reorderTask(activeId, newSortOrder, slug);
      if (result.error) {
        toast.error(`Could not move task: ${result.error}`);
        if (origin) setColumns(origin);
      }
    })();
  }

  function handleDragCancel() {
    const origin = originRef.current;
    originRef.current = null;
    setActiveTask(null);
    if (origin) setColumns(origin);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {TASK_STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={columns[status]}
            slug={slug}
            recentDragRef={recentDragRef}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask && (
          <TaskCard task={activeTask} slug={slug} overlay className="shadow-lg" />
        )}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColumn({
  status,
  tasks,
  slug,
  recentDragRef,
}: {
  status: TaskStatus;
  tasks: Task[];
  slug: string;
  recentDragRef: React.RefObject<boolean>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-48 flex-col gap-2 rounded-lg border bg-muted/30 p-2 transition-colors",
        isOver && "border-primary/50 bg-muted/60"
      )}
    >
      <div className="flex items-center justify-between px-1 pt-1">
        <span className="text-sm font-medium">{TASK_STATUS_LABELS[status]}</span>
        <Badge variant="secondary">{tasks.length}</Badge>
      </div>
      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-1 flex-col gap-2">
          {tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              slug={slug}
              recentDragRef={recentDragRef}
            />
          ))}
          {tasks.length === 0 && (
            <p className="px-1 py-4 text-center text-xs text-muted-foreground">
              No tasks
            </p>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableTaskCard({
  task,
  slug,
  recentDragRef,
}: {
  task: Task;
  slug: string;
  recentDragRef: React.RefObject<boolean>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("touch-none", isDragging && "opacity-40")}
      onClickCapture={(e) => {
        if (recentDragRef.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      {...attributes}
      {...listeners}
    >
      <TaskCard task={task} slug={slug} />
    </div>
  );
}
