import type {
  IdeaStage,
  PipelineEventType,
  TaskPriority,
  TaskStatus,
} from "@/types/db";

export const TASK_STATUSES: TaskStatus[] = ["todo", "in_progress", "done", "blocked"];
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
  blocked: "Blocked",
};

export const TASK_PRIORITIES: TaskPriority[] = ["p1", "p2", "p3", "p4"];
export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  p1: "P1 — Critical",
  p2: "P2 — High",
  p3: "P3 — Normal",
  p4: "P4 — Low",
};

export const IDEA_STAGES: IdeaStage[] = ["raw", "evaluating", "validated", "executing", "archived"];
export const IDEA_STAGE_LABELS: Record<IdeaStage, string> = {
  raw: "Raw",
  evaluating: "Evaluating",
  validated: "Validated",
  executing: "Executing",
  archived: "Archived",
};

export const PIPELINE_EVENT_LABELS: Record<PipelineEventType, string> = {
  lead_added: "Lead added",
  proposal_sent: "Proposal sent",
  deal_won: "Deal won",
  deal_lost: "Deal lost",
};

/** Eisenhower pair → suggested priority. */
export function suggestPriority(isUrgent: boolean, isImportant: boolean): TaskPriority {
  if (isUrgent && isImportant) return "p1";
  if (isImportant) return "p2";
  if (isUrgent) return "p3";
  return "p4";
}
