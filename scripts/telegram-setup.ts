#!/usr/bin/env tsx
/**
 * Register the Telegram webhook and bot commands.
 *
 * Usage:
 *   npx tsx scripts/telegram-setup.ts https://yourapp.vercel.app
 *
 * Reads TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET from .env.local
 * (parsed manually — no dotenv dependency required).
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// ---------------------------------------------------------------------------
// Parse .env.local manually
// ---------------------------------------------------------------------------

function loadEnvLocal(): Record<string, string> {
  const envPath = resolve(process.cwd(), ".env.local");
  let raw: string;
  try {
    raw = readFileSync(envPath, "utf-8");
  } catch {
    console.warn(".env.local not found — falling back to process.env only");
    return {};
  }

  const result: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Telegram API helper
// ---------------------------------------------------------------------------

interface TgResponse<T = unknown> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

async function tg<T = unknown>(
  token: string,
  method: string,
  payload: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as TgResponse<T>;
  if (!data.ok) {
    throw new Error(
      `Telegram ${method} failed (${data.error_code ?? res.status}): ${data.description ?? "unknown"}`
    );
  }
  return data.result as T;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const [, , baseUrl] = process.argv;
  if (!baseUrl || !baseUrl.startsWith("https://")) {
    console.error("Usage: npx tsx scripts/telegram-setup.ts <https-url>");
    console.error("  e.g. npx tsx scripts/telegram-setup.ts https://yourapp.vercel.app");
    process.exit(1);
  }

  const envLocal = loadEnvLocal();
  const getEnv = (key: string): string =>
    envLocal[key] ?? process.env[key] ?? "";

  const token = getEnv("TELEGRAM_BOT_TOKEN");
  const webhookSecret = getEnv("TELEGRAM_WEBHOOK_SECRET");

  if (!token) {
    console.error("TELEGRAM_BOT_TOKEN is not set in .env.local or process.env");
    process.exit(1);
  }
  if (!webhookSecret) {
    console.error("TELEGRAM_WEBHOOK_SECRET is not set in .env.local or process.env");
    process.exit(1);
  }

  const webhookUrl = `${baseUrl.replace(/\/$/, "")}/api/telegram`;

  // 1. Set webhook
  console.log(`\nSetting webhook → ${webhookUrl}`);
  await tg(token, "setWebhook", {
    url: webhookUrl,
    secret_token: webhookSecret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  console.log("  setWebhook: OK");

  // 2. Set bot commands
  const commands = [
    { command: "today", description: "Morning briefing — tasks due & week targets" },
    { command: "week", description: "Week-to-date numbers for all projects" },
    { command: "report", description: "Full weekly health report" },
    { command: "tasks", description: "Open tasks (optional: flyson | abna | brand)" },
    { command: "undo", description: "Undo the last applied quick-add (24h window)" },
    { command: "help", description: "Command list & quick-add examples" },
  ];
  await tg(token, "setMyCommands", { commands });
  console.log("  setMyCommands: OK");

  // 3. Print webhook info
  const info = await tg(token, "getWebhookInfo", {});
  console.log("\ngetWebhookInfo:");
  console.log(JSON.stringify(info, null, 2));
}

main().catch((err) => {
  console.error("\nSetup failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
