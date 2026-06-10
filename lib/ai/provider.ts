import { openai } from "@ai-sdk/openai";

// Single indirection point for AI models. Swapping to Anthropic later:
// npm i @ai-sdk/anthropic, change these two lines + env var. Nothing else.

/** Small/fast model for Telegram quick-add parsing. */
export function parseModel() {
  return openai(process.env.OPENAI_PARSE_MODEL ?? "gpt-5-mini");
}

/** Stronger model for the per-project research chat. */
export function chatModel() {
  return openai(process.env.OPENAI_CHAT_MODEL ?? "gpt-5.1");
}
