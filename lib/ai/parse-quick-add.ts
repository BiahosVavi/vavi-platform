import { generateText, Output } from "ai";
import { parseModel } from "@/lib/ai/provider";
import { localToday, localWeekday, type IsoDate, type Weekday } from "@/lib/time";
import { quickAddSchema, type QuickAddResult } from "./quick-add-schema";

export interface QuickAddProjectContext {
  slug: string;
  name: string;
  description: string | null;
}

export interface QuickAddMetricContext {
  projectSlug: string;
  key: string;
  name: string;
  unit: string | null;
}

export interface QuickAddContext {
  projects: QuickAddProjectContext[];
  metrics: QuickAddMetricContext[];
  /** Defaults to localToday() — injectable for tests/dry-runs. */
  today?: IsoDate;
  /** Defaults to localWeekday(). */
  weekday?: Weekday;
}

function buildSystemPrompt(context: QuickAddContext): string {
  const today = context.today ?? localToday();
  const weekday = context.weekday ?? localWeekday();

  const projectLines = context.projects
    .map((p) => `- "${p.slug}" (${p.name})${p.description ? `: ${p.description}` : ""}`)
    .join("\n");

  const metricLines = context.metrics
    .map(
      (m) =>
        `- project "${m.projectSlug}" → metric_key "${m.key}" (${m.name}${m.unit ? `, unit: ${m.unit}` : ""})`
    )
    .join("\n");

  return [
    "You parse short business quick-add messages (often informal, possibly mixing English/French/Darija) into ONE structured action.",
    "",
    `Today is ${weekday} ${today} (timezone Africa/Casablanca). Weeks run Monday–Sunday.`,
    "Resolve relative dates against today: 'today' → today's date, 'tomorrow' → today + 1 day, a weekday name like 'Friday' → the NEXT occurrence of that weekday (if today is that weekday, use today). Always output dates as YYYY-MM-DD.",
    "",
    "Projects (use the slug exactly):",
    projectLines,
    "",
    "Default project hints when not stated explicitly:",
    "- drone, agri, farm, spraying, hectares, cooperative → flyson",
    "- client, automation, website, app, n8n, CRM, landing page → abna-son",
    "- post, content, followers, video, audience → personal-brand",
    "",
    "Metric definitions (log_metric MUST use one of these metric_key values for the matching project):",
    metricLines || "- (none defined)",
    "",
    "Money rules: the only currency is MAD (Moroccan dirham). 'dh', 'dhs', 'dirham', 'MAD' all mean MAD.",
    "Shorthand amounts: '5k' → 5000, '1.5k' → 1500, '12k' → 12000.",
    "Income/payment received → log_money kind 'revenue'; cost/purchase/spend → kind 'expense'.",
    "Sales pipeline: new lead/prospect → lead_added; quote/proposal/devis sent → proposal_sent; deal closed/signed/won → deal_won; deal lost/refused → deal_lost. Use log_pipeline (with optional contact and value_mad), NOT log_money, unless the message clearly says money was received.",
    "Tasks: things to do ('call X', 'prepare Y', 'send Z'). Priority p1=critical, p2=high, p3=normal (default), p4=low.",
    "Ideas: 'idea:', 'what if', concepts to explore later → capture_idea.",
    "",
    "Confidence: 'high' only when the action type, project, and all required values are unambiguous. Use 'low' when you had to guess the project, the amount, the metric, or the action type.",
    "If the message is not a parseable business action (greetings, questions, random text), return action type 'unknown' with a short reason — and confidence 'high'.",
  ].join("\n");
}

const FALLBACK_REASON =
  "I couldn't understand that message as a task, money/pipeline/metric log, or idea.";

/**
 * Parse a free-text Telegram message into a structured quick-add action.
 * Never throws: on any error returns a high-confidence 'unknown' action.
 */
export async function parseQuickAdd(
  text: string,
  context: QuickAddContext
): Promise<QuickAddResult> {
  try {
    const result = await generateText({
      model: parseModel(),
      output: Output.object({
        schema: quickAddSchema,
        name: "quick_add",
        description: "One structured quick-add action parsed from the message.",
      }),
      system: buildSystemPrompt(context),
      prompt: text,
    });

    return quickAddSchema.parse(result.output);
  } catch (error) {
    console.error("parseQuickAdd failed:", error);
    return {
      confidence: "high",
      action: { type: "unknown", reason: FALLBACK_REASON },
    };
  }
}
