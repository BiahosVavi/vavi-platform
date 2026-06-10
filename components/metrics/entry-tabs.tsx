"use client";

// Tabbed entry forms for the project metrics page. Tabs are filtered by the
// project's feature flags (pipeline/money); the Metric tab is always shown.

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MetricForm,
  MoneyForm,
  PipelineEventForm,
  type MetricOption,
} from "@/components/metrics/log-forms";

export function EntryTabs({
  projectId,
  pipelineEnabled,
  moneyEnabled,
  metrics,
}: {
  projectId: string;
  pipelineEnabled: boolean;
  moneyEnabled: boolean;
  metrics: MetricOption[];
}) {
  const defaultTab = pipelineEnabled ? "pipeline" : moneyEnabled ? "money" : "metric";

  return (
    <Tabs defaultValue={defaultTab}>
      <TabsList className="w-full">
        {pipelineEnabled && <TabsTrigger value="pipeline">Pipeline</TabsTrigger>}
        {moneyEnabled && <TabsTrigger value="money">Money</TabsTrigger>}
        <TabsTrigger value="metric">Metric</TabsTrigger>
      </TabsList>
      {pipelineEnabled && (
        <TabsContent value="pipeline" className="pt-2">
          <PipelineEventForm projectId={projectId} />
        </TabsContent>
      )}
      {moneyEnabled && (
        <TabsContent value="money" className="pt-2">
          <MoneyForm projectId={projectId} />
        </TabsContent>
      )}
      <TabsContent value="metric" className="pt-2">
        <MetricForm projectId={projectId} metrics={metrics} />
      </TabsContent>
    </Tabs>
  );
}
