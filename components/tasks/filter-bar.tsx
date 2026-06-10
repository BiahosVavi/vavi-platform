"use client";

import { Columns3, List, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
} from "@/lib/labels";
import { cn } from "@/lib/utils";

const ALL = "all";

export function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const view = searchParams.get("view") === "list" ? "list" : "kanban";
  const status = searchParams.get("status") ?? ALL;
  const priority = searchParams.get("priority") ?? ALL;

  // Text inputs are local state, debounced into the URL.
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [tag, setTag] = useState(searchParams.get("tag") ?? "");

  const update = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  useEffect(() => {
    if (q === (searchParams.get("q") ?? "")) return;
    const handle = setTimeout(() => update({ q: q || null }), 300);
    return () => clearTimeout(handle);
  }, [q, searchParams, update]);

  useEffect(() => {
    if (tag === (searchParams.get("tag") ?? "")) return;
    const handle = setTimeout(() => update({ tag: tag || null }), 300);
    return () => clearTimeout(handle);
  }, [tag, searchParams, update]);

  const hasFilters =
    status !== ALL || priority !== ALL || Boolean(searchParams.get("q")) || Boolean(searchParams.get("tag"));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search tasks…"
          className="w-44 pl-8"
          aria-label="Search tasks"
        />
      </div>

      <Select
        value={status}
        onValueChange={(v) => update({ status: v === ALL ? null : v })}
      >
        <SelectTrigger className="w-36" aria-label="Filter by status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          {TASK_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {TASK_STATUS_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={priority}
        onValueChange={(v) => update({ priority: v === ALL ? null : v })}
      >
        <SelectTrigger className="w-36" aria-label="Filter by priority">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All priorities</SelectItem>
          {TASK_PRIORITIES.map((p) => (
            <SelectItem key={p} value={p}>
              {TASK_PRIORITY_LABELS[p]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        value={tag}
        onChange={(e) => setTag(e.target.value)}
        placeholder="Tag"
        className="w-28"
        aria-label="Filter by tag"
      />

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQ("");
            setTag("");
            update({ status: null, priority: null, q: null, tag: null });
          }}
        >
          <X data-icon="inline-start" />
          Clear
        </Button>
      )}

      <div className="ml-auto flex rounded-lg border p-0.5">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Kanban view"
          aria-pressed={view === "kanban"}
          className={cn(view === "kanban" && "bg-muted text-foreground")}
          onClick={() => update({ view: null })}
        >
          <Columns3 />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="List view"
          aria-pressed={view === "list"}
          className={cn(view === "list" && "bg-muted text-foreground")}
          onClick={() => update({ view: "list" })}
        >
          <List />
        </Button>
      </div>
    </div>
  );
}
