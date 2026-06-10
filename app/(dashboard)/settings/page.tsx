import { createClient } from "@/lib/supabase/server";
import {
  AddMetricDialog,
  EditMetricDialog,
  MetricActiveToggle,
  TargetForm,
  type MetricDefForEdit,
} from "@/components/metrics/settings-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { ProjectFeatures, ProjectTargets } from "@/types/db";

export default async function SettingsPage() {
  const supabase = await createClient();

  // Fetch all active projects
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, color, features, targets")
    .eq("active", true)
    .order("sort_order");

  // Fetch ALL metric definitions for active projects (including inactive ones — settings shows all)
  const projectIds = (projects ?? []).map((p) => p.id);
  const { data: allDefs } = projectIds.length
    ? await supabase
        .from("metric_definitions")
        .select("id, project_id, key, name, unit, aggregation, weekly_target, quick_increment, active, sort_order")
        .in("project_id", projectIds)
        .order("sort_order")
    : { data: [] };

  // Fetch Telegram chat_id from app_settings
  const { data: telegramSetting } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "telegram_chat_id")
    .maybeSingle();

  const telegramChatId: string | null =
    telegramSetting?.value != null
      ? String(telegramSetting.value).replace(/^"|"$/g, "")
      : null;

  // Group defs by project
  const defs = allDefs ?? [];
  type DefRow = (typeof defs)[number];
  const defsByProject = new Map<string, DefRow[]>(
    (projects ?? []).map((p) => [p.id, []])
  );
  for (const def of defs) {
    defsByProject.get(def.project_id)?.push(def);
  }

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Weekly revenue targets, metric definitions, and integrations.
        </p>
      </div>

      {/* Per-project sections */}
      {(projects ?? []).map((project) => {
        const features = (project.features ?? {}) as Partial<ProjectFeatures>;
        const moneyEnabled = features.money ?? false;
        const targets = (project.targets ?? {}) as ProjectTargets;
        const initialTarget = targets.weekly_revenue_mad ?? null;

        const defs = defsByProject.get(project.id) ?? [];

        const defsForEdit: MetricDefForEdit[] = defs.map((d) => ({
          id: d.id,
          name: d.name,
          unit: d.unit ?? null,
          weekly_target: d.weekly_target != null ? Number(d.weekly_target) : null,
          quick_increment: d.quick_increment != null ? Number(d.quick_increment) : null,
          active: d.active,
        }));

        return (
          <Card key={project.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                {project.color && (
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: project.color }}
                  />
                )}
                <CardTitle className="text-base">{project.name}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Weekly revenue target — only when money feature is enabled */}
              {moneyEnabled && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Revenue Target</p>
                  <TargetForm
                    projectId={project.id}
                    initialTarget={initialTarget ?? null}
                  />
                </div>
              )}

              {moneyEnabled && <Separator />}

              {/* Metric definitions */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Metric Definitions</p>
                  <AddMetricDialog projectId={project.id} />
                </div>

                {defsForEdit.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No metrics yet. Add one to start tracking.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs text-muted-foreground">
                          <th className="pb-2 pr-3 font-medium">Name</th>
                          <th className="pb-2 pr-3 font-medium">Key</th>
                          <th className="pb-2 pr-3 font-medium">Unit</th>
                          <th className="pb-2 pr-3 font-medium">Agg.</th>
                          <th className="pb-2 pr-3 font-medium">Target / wk</th>
                          <th className="pb-2 pr-3 font-medium">Quick +N</th>
                          <th className="pb-2 pr-3 font-medium">Active</th>
                          <th className="pb-2 font-medium" />
                        </tr>
                      </thead>
                      <tbody>
                        {defs.map((def, i) => (
                          <tr key={def.id} className="border-b last:border-0">
                            <td className="py-2 pr-3 font-medium">{def.name}</td>
                            <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">
                              {def.key}
                            </td>
                            <td className="py-2 pr-3 text-muted-foreground">
                              {def.unit ?? "—"}
                            </td>
                            <td className="py-2 pr-3 text-muted-foreground">
                              {def.aggregation}
                            </td>
                            <td className="py-2 pr-3 tabular-nums text-muted-foreground">
                              {def.weekly_target != null
                                ? String(Number(def.weekly_target))
                                : "—"}
                            </td>
                            <td className="py-2 pr-3 tabular-nums text-muted-foreground">
                              {def.quick_increment != null
                                ? String(Number(def.quick_increment))
                                : "—"}
                            </td>
                            <td className="py-2 pr-3">
                              <MetricActiveToggle id={def.id} active={def.active} />
                            </td>
                            <td className="py-2 text-right">
                              <EditMetricDialog def={defsForEdit[i]} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Telegram section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Telegram Integration</CardTitle>
        </CardHeader>
        <CardContent>
          {telegramChatId ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              Bot connected (chat {telegramChatId})
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Not connected — send <code className="font-mono">/start</code> to your bot after deploy to link your chat.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
