import { notFound } from "next/navigation";
import { FilterBar } from "@/components/tasks/filter-bar";
import { Kanban } from "@/components/tasks/kanban";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { TaskList } from "@/components/tasks/task-list";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { TaskPriority, TaskStatus } from "@/types/db";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Escape %, _ and \ so user input is matched literally in ilike. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export default async function TasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);

  const view = first(sp.view) === "list" ? "list" : "kanban";
  const rawStatus = first(sp.status);
  const rawPriority = first(sp.priority);
  const status = (TASK_STATUSES as string[]).includes(rawStatus ?? "")
    ? (rawStatus as TaskStatus)
    : undefined;
  const priority = (TASK_PRIORITIES as string[]).includes(rawPriority ?? "")
    ? (rawPriority as TaskPriority)
    : undefined;
  const tag = first(sp.tag)?.trim() || undefined;
  const q = first(sp.q)?.trim() || undefined;
  const hasFilters = Boolean(status || priority || tag || q);

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, slug")
    .eq("slug", slug)
    .single();
  if (!project) notFound();

  let query = supabase
    .from("tasks")
    .select("*")
    .eq("project_id", project.id)
    .order("sort_order", { ascending: true });
  if (status) query = query.eq("status", status);
  if (priority) query = query.eq("priority", priority);
  if (tag) query = query.contains("tags", [tag]);
  if (q) query = query.ilike("title", `%${escapeLike(q)}%`);

  const { data, error } = await query;
  if (error) {
    return (
      <p className="py-8 text-center text-sm text-destructive">
        Could not load tasks: {error.message}
      </p>
    );
  }
  const tasks = data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <FilterBar />
        </div>
        <TaskDialog slug={slug} projectId={project.id} />
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-16 text-center">
          {hasFilters ? (
            <>
              <p className="text-sm font-medium">No tasks match your filters</p>
              <p className="text-sm text-muted-foreground">
                Try adjusting or clearing the filters above.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">No tasks yet</p>
              <p className="text-sm text-muted-foreground">
                Create your first task to get this project moving.
              </p>
              <TaskDialog slug={slug} projectId={project.id} />
            </>
          )}
        </div>
      ) : view === "list" ? (
        <TaskList tasks={tasks} slug={slug} />
      ) : (
        <Kanban tasks={tasks} slug={slug} />
      )}
    </div>
  );
}
