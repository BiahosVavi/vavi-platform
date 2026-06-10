import { describe, expect, it } from "vitest";
import {
  WEIGHTS,
  bandFor,
  businessScore,
  executionScore,
  healthScore,
  opsScore,
  overallScore,
  pipelineLadder,
} from "./health";
import type { MetricWeek, PipelineWeek } from "./types";

function metric(
  value: number,
  weeklyTarget: number | null,
  lastWeekValue = 0
): MetricWeek {
  return {
    def: {
      id: "m1",
      key: "k",
      name: "Metric",
      unit: null,
      aggregation: "sum",
      weekly_target: weeklyTarget,
    },
    value,
    lastWeekValue,
  };
}

function pipeline(partial: Partial<PipelineWeek> = {}): PipelineWeek {
  return { leads: 0, proposals: 0, won: 0, lost: 0, wonValueMad: 0, ...partial };
}

describe("executionScore", () => {
  it("returns null when there is no signal at all (0 done, 0 overdue)", () => {
    expect(executionScore(0, 0)).toBeNull();
  });

  it("returns 100 when everything done and nothing overdue", () => {
    expect(executionScore(5, 0)).toBe(100);
  });

  it("returns 0 when nothing done but tasks are overdue", () => {
    expect(executionScore(0, 3)).toBe(0);
  });

  it("computes the done ratio", () => {
    expect(executionScore(3, 1)).toBe(75);
  });
});

describe("opsScore", () => {
  it("returns null when no metric has a target", () => {
    expect(opsScore([])).toBeNull();
    expect(opsScore([metric(10, null)])).toBeNull();
  });

  it("ignores zero or negative targets", () => {
    expect(opsScore([metric(10, 0)])).toBeNull();
  });

  it("caps each attainment at 100%", () => {
    expect(opsScore([metric(50, 10)])).toBe(100);
  });

  it("averages attainment across targeted metrics only", () => {
    // 50% + 100% (capped) over two targeted metrics; untargeted ignored.
    const score = opsScore([metric(5, 10), metric(20, 10), metric(999, null)]);
    expect(score).toBe(75);
  });
});

describe("pipelineLadder", () => {
  it("scores 100 with a won deal", () => {
    expect(pipelineLadder(pipeline({ won: 1, leads: 2, proposals: 3 }))).toBe(100);
  });

  it("scores 75 with a proposal and no win", () => {
    expect(pipelineLadder(pipeline({ proposals: 1, leads: 4 }))).toBe(75);
  });

  it("scores 50 with only leads", () => {
    expect(pipelineLadder(pipeline({ leads: 1 }))).toBe(50);
  });

  it("scores 25 with no activity (losses don't help)", () => {
    expect(pipelineLadder(pipeline())).toBe(25);
    expect(pipelineLadder(pipeline({ lost: 2 }))).toBe(25);
  });
});

describe("businessScore", () => {
  it("returns null when pipeline is disabled and there is no revenue target", () => {
    expect(
      businessScore({
        revenueMad: 5000,
        weeklyRevenueTargetMad: null,
        moneyEnabled: true,
        pipelineEnabled: false,
        pipeline: pipeline(),
      })
    ).toBeNull();
  });

  it("returns null when money is disabled and pipeline is disabled", () => {
    expect(
      businessScore({
        revenueMad: 5000,
        weeklyRevenueTargetMad: 10000,
        moneyEnabled: false,
        pipelineEnabled: false,
        pipeline: pipeline({ won: 1 }),
      })
    ).toBeNull();
  });

  it("uses only the pipeline ladder when there is no revenue target", () => {
    expect(
      businessScore({
        revenueMad: 0,
        weeklyRevenueTargetMad: null,
        moneyEnabled: true,
        pipelineEnabled: true,
        pipeline: pipeline({ proposals: 1 }),
      })
    ).toBe(75);
  });

  it("uses only revenue attainment when pipeline is disabled, capped at 100", () => {
    expect(
      businessScore({
        revenueMad: 25000,
        weeklyRevenueTargetMad: 10000,
        moneyEnabled: true,
        pipelineEnabled: false,
        pipeline: pipeline(),
      })
    ).toBe(100);
  });

  it("averages revenue attainment and pipeline ladder when both present", () => {
    // R = 50, P = 100 → 75
    expect(
      businessScore({
        revenueMad: 5000,
        weeklyRevenueTargetMad: 10000,
        moneyEnabled: true,
        pipelineEnabled: true,
        pipeline: pipeline({ won: 1 }),
      })
    ).toBe(75);
  });
});

describe("healthScore", () => {
  it("returns null when all components are null", () => {
    expect(healthScore({ execution: null, ops: null, business: null })).toBeNull();
  });

  it("equals the single present component (weights renormalize)", () => {
    expect(healthScore({ execution: 70, ops: null, business: null })).toBe(70);
    expect(healthScore({ execution: null, ops: 42, business: null })).toBe(42);
  });

  it("renormalizes weights over the present components", () => {
    // (0.4 * 100 + 0.3 * 50) / 0.7
    const expected =
      (WEIGHTS.execution * 100 + WEIGHTS.business * 50) /
      (WEIGHTS.execution + WEIGHTS.business);
    expect(
      healthScore({ execution: 100, ops: null, business: 50 })
    ).toBeCloseTo(expected, 10);
  });

  it("uses the documented 40/30/30 weights when all present", () => {
    expect(
      healthScore({ execution: 100, ops: 0, business: 0 })
    ).toBeCloseTo(40, 10);
  });
});

describe("bandFor", () => {
  it("is none for null", () => {
    expect(bandFor(null)).toBe("none");
  });

  it("is green at exactly 80 and above", () => {
    expect(bandFor(80)).toBe("green");
    expect(bandFor(100)).toBe("green");
  });

  it("is amber from 60 up to (not including) 80", () => {
    expect(bandFor(79.99)).toBe("amber");
    expect(bandFor(60)).toBe("amber");
  });

  it("is red below 60", () => {
    expect(bandFor(59.99)).toBe("red");
    expect(bandFor(0)).toBe("red");
  });
});

describe("overallScore", () => {
  it("returns null when no project has a score", () => {
    expect(overallScore([])).toBeNull();
    expect(overallScore([null, null])).toBeNull();
  });

  it("averages only the non-null scores", () => {
    expect(overallScore([80, null, 60])).toBe(70);
  });

  it("passes a single score through", () => {
    expect(overallScore([null, 55])).toBe(55);
  });
});
