"use client";

// Global quick-log: Ctrl+K (or Cmd+K) anywhere in the dashboard, plus a
// floating button bottom-right. Self-contained — fetches projects + metric
// definitions via getQuickLogData() on first open, remembers the last
// project in localStorage. Target: a log takes under 30 seconds.

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { getQuickLogData, type QuickLogData } from "@/app/actions/metrics";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MetricForm,
  MoneyForm,
  PipelineEventForm,
} from "@/components/metrics/log-forms";

const STORAGE_KEY = "vavi.quicklog.project";

export function QuickLog() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<QuickLogData | null>(null);
  const [projectId, setProjectId] = useState<string>("");
  const [tab, setTab] = useState("pipeline");

  // Ctrl+K / Cmd+K toggles the dialog from anywhere in the dashboard.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Fetch projects + metric definitions once, on first open.
  useEffect(() => {
    if (!open || data) return;
    let cancelled = false;
    getQuickLogData()
      .then((d) => {
        if (cancelled) return;
        setData(d);
        const stored =
          typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
        const initial =
          d.projects.find((p) => p.id === stored)?.id ?? d.projects[0]?.id ?? "";
        setProjectId(initial);
      })
      .catch(() => {
        if (!cancelled) setData({ projects: [], metrics: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [open, data]);

  const project = data?.projects.find((p) => p.id === projectId) ?? null;
  const projectMetrics =
    data?.metrics.filter((m) => m.project_id === projectId) ?? [];

  // Keep the active tab valid for the selected project's features.
  const availableTabs = project
    ? [
        ...(project.pipeline ? ["pipeline"] : []),
        ...(project.money ? ["money"] : []),
        "metric",
      ]
    : [];
  const activeTab = availableTabs.includes(tab) ? tab : availableTabs[0] ?? "metric";

  function selectProject(id: string) {
    setProjectId(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // localStorage unavailable — last-project memory is best-effort only.
    }
  }

  return (
    <>
      <Button
        size="icon-lg"
        aria-label="Quick log (Ctrl+K)"
        title="Quick log (Ctrl+K)"
        className="fixed right-6 bottom-6 z-40 size-12 rounded-full shadow-lg"
        onClick={() => setOpen(true)}
      >
        <Plus className="size-5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Quick log</DialogTitle>
            <DialogDescription>
              Log a pipeline event, money entry or metric. Ctrl+K opens this anywhere.
            </DialogDescription>
          </DialogHeader>

          {!data ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : data.projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active projects.</p>
          ) : (
            <div className="space-y-4">
              <Select value={projectId} onValueChange={selectProject}>
                <SelectTrigger className="w-full" aria-label="Project">
                  <SelectValue placeholder="Pick a project" />
                </SelectTrigger>
                <SelectContent>
                  {data.projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: p.color ?? "#999" }}
                      />
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {project && (
                <Tabs value={activeTab} onValueChange={setTab}>
                  <TabsList className="w-full">
                    {project.pipeline && (
                      <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
                    )}
                    {project.money && <TabsTrigger value="money">Money</TabsTrigger>}
                    <TabsTrigger value="metric">Metric</TabsTrigger>
                  </TabsList>
                  {project.pipeline && (
                    <TabsContent value="pipeline" className="pt-2">
                      <PipelineEventForm
                        key={project.id}
                        projectId={project.id}
                        showDate={false}
                        onSuccess={() => setOpen(false)}
                      />
                    </TabsContent>
                  )}
                  {project.money && (
                    <TabsContent value="money" className="pt-2">
                      <MoneyForm
                        key={project.id}
                        projectId={project.id}
                        showDate={false}
                        onSuccess={() => setOpen(false)}
                      />
                    </TabsContent>
                  )}
                  <TabsContent value="metric" className="pt-2">
                    <MetricForm
                      key={project.id}
                      projectId={project.id}
                      metrics={projectMetrics.map((m) => ({
                        id: m.id,
                        name: m.name,
                        unit: m.unit,
                      }))}
                      showDate={false}
                      onSuccess={() => setOpen(false)}
                    />
                  </TabsContent>
                </Tabs>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
