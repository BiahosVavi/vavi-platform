import type { IsoDate } from "@/lib/time";
import type { MetricDefinition, Project } from "@/types/db";

export interface PipelineWeek {
  leads: number;
  proposals: number;
  won: number;
  lost: number;
  wonValueMad: number;
}

export interface MetricWeek {
  def: Pick<MetricDefinition, "id" | "key" | "name" | "unit" | "aggregation" | "weekly_target">;
  value: number;
  lastWeekValue: number;
}

export interface HealthComponents {
  /** 0–100 or null = no signal (renormalized out of the weighted mean) */
  execution: number | null;
  ops: number | null;
  business: number | null;
}

export type HealthBand = "green" | "amber" | "red" | "none";

export interface ProjectWeekReport {
  project: Pick<Project, "id" | "slug" | "name" | "color" | "features" | "targets">;
  doneThisWeek: number;
  doneLastWeek: number;
  overdueOpen: number;
  openTasks: number;
  revenueMad: number;
  lastWeekRevenueMad: number;
  expensesMad: number;
  pipeline: PipelineWeek;
  lastWeekPipeline: PipelineWeek;
  metrics: MetricWeek[];
  components: HealthComponents;
  /** Weighted mean of non-null components, 0–100, or null if all null */
  score: number | null;
  lastWeekScore: number | null;
  band: HealthBand;
}

export interface WeekReport {
  weekStart: IsoDate;
  weekEnd: IsoDate;
  /** Mean of non-null project scores */
  overall: number | null;
  lastWeekOverall: number | null;
  projects: ProjectWeekReport[];
}
