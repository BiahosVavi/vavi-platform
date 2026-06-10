// Pure health-score engine. No I/O — unit-tested in health.test.ts.
// Weights renormalize over non-null components so a project without pipeline
// (e.g. Personal Brand) is not penalized for the missing signal.

import type { HealthBand, HealthComponents, MetricWeek, PipelineWeek } from "./types";

export const WEIGHTS = { execution: 0.4, ops: 0.3, business: 0.3 } as const;

/** E = 100 × done / (done + overdueOpen); null when there is no signal at all. */
export function executionScore(doneThisWeek: number, overdueOpen: number): number | null {
  const denominator = doneThisWeek + overdueOpen;
  if (denominator === 0) return null;
  return (100 * doneThisWeek) / denominator;
}

/** O = mean attainment vs weekly_target across metrics that have a target, capped at 100%. */
export function opsScore(metrics: MetricWeek[]): number | null {
  const targeted = metrics.filter(
    (m) => m.def.weekly_target !== null && m.def.weekly_target > 0
  );
  if (targeted.length === 0) return null;
  const attainments = targeted.map((m) => Math.min(m.value / m.def.weekly_target!, 1));
  return (100 * attainments.reduce((a, b) => a + b, 0)) / attainments.length;
}

/** Pipeline ladder: won=100, proposal=75, lead=50, nothing=25. */
export function pipelineLadder(pipeline: PipelineWeek): number {
  if (pipeline.won > 0) return 100;
  if (pipeline.proposals > 0) return 75;
  if (pipeline.leads > 0) return 50;
  return 25;
}

/**
 * B = mean of the non-null of:
 *  R (revenue vs weekly target, capped) — null without a revenue target or with money disabled
 *  P (pipeline ladder) — null with pipeline disabled
 */
export function businessScore(input: {
  revenueMad: number;
  weeklyRevenueTargetMad: number | null;
  moneyEnabled: boolean;
  pipelineEnabled: boolean;
  pipeline: PipelineWeek;
}): number | null {
  const revenue =
    input.moneyEnabled && input.weeklyRevenueTargetMad && input.weeklyRevenueTargetMad > 0
      ? 100 * Math.min(input.revenueMad / input.weeklyRevenueTargetMad, 1)
      : null;
  const pipeline = input.pipelineEnabled ? pipelineLadder(input.pipeline) : null;
  const parts = [revenue, pipeline].filter((v): v is number => v !== null);
  if (parts.length === 0) return null;
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

/** Weighted mean over non-null components, weights renormalized. Null if all null. */
export function healthScore(components: HealthComponents): number | null {
  const entries = (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[])
    .map((k): { weight: number; value: number | null } => ({
      weight: WEIGHTS[k],
      value: components[k],
    }))
    .filter((e): e is { weight: number; value: number } => e.value !== null);
  if (entries.length === 0) return null;
  const totalWeight = entries.reduce((a, e) => a + e.weight, 0);
  return entries.reduce((a, e) => a + e.weight * e.value, 0) / totalWeight;
}

export function bandFor(score: number | null): HealthBand {
  if (score === null) return "none";
  if (score >= 80) return "green";
  if (score >= 60) return "amber";
  return "red";
}

/** Mean of non-null scores (the overall %), or null. */
export function overallScore(scores: (number | null)[]): number | null {
  const present = scores.filter((s): s is number => s !== null);
  if (present.length === 0) return null;
  return present.reduce((a, b) => a + b, 0) / present.length;
}
