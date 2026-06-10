import "server-only";

// Thin fetch wrapper over the Telegram Bot API — no library.
// All outgoing messages use parse_mode 'HTML'; esc() every piece of
// user-originated text before interpolating it into a message.

const TELEGRAM_MESSAGE_LIMIT = 4096;

export interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface SendMessageOptions {
  reply_markup?: InlineKeyboardMarkup;
}

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

interface TelegramSentMessage {
  message_id: number;
}

/** Base call. Throws on HTTP/Telegram-level failure with the API description. */
export async function tg<T = unknown>(
  method: string,
  payload: Record<string, unknown>
): Promise<T> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");

  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = (await res.json()) as TelegramApiResponse<T>;
  if (!data.ok) {
    throw new Error(
      `Telegram ${method} failed (${data.error_code ?? res.status}): ${data.description ?? "unknown error"}`
    );
  }
  return data.result as T;
}

/** Escape &, <, > for safe interpolation of user content into HTML messages. */
export function esc(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/** Split a message at the 4096-char limit, preferring line boundaries. */
export function splitMessage(text: string): string[] {
  if (text.length <= TELEGRAM_MESSAGE_LIMIT) return [text];

  const chunks: string[] = [];
  let current = "";

  const pushCurrent = () => {
    if (current.length > 0) {
      chunks.push(current);
      current = "";
    }
  };

  for (const rawLine of text.split("\n")) {
    let line = rawLine;
    // Pathological single line longer than the limit: hard-split it.
    while (line.length > TELEGRAM_MESSAGE_LIMIT) {
      pushCurrent();
      chunks.push(line.slice(0, TELEGRAM_MESSAGE_LIMIT));
      line = line.slice(TELEGRAM_MESSAGE_LIMIT);
    }
    const extra = current.length === 0 ? line.length : current.length + 1 + line.length;
    if (extra > TELEGRAM_MESSAGE_LIMIT) {
      pushCurrent();
      current = line;
    } else {
      current = current.length === 0 ? line : `${current}\n${line}`;
    }
  }
  pushCurrent();
  return chunks.length > 0 ? chunks : [""];
}

/**
 * Send an HTML message, splitting at 4096 chars on line boundaries.
 * The inline keyboard (if any) is attached to the LAST chunk.
 * Returns the message_id of the last message sent.
 */
export async function sendMessage(
  chatId: number,
  html: string,
  opts?: SendMessageOptions
): Promise<number> {
  const chunks = splitMessage(html);
  let lastMessageId = 0;
  for (let i = 0; i < chunks.length; i++) {
    const isLast = i === chunks.length - 1;
    const sent = await tg<TelegramSentMessage>("sendMessage", {
      chat_id: chatId,
      text: chunks[i],
      parse_mode: "HTML",
      ...(isLast && opts?.reply_markup ? { reply_markup: opts.reply_markup } : {}),
    });
    lastMessageId = sent.message_id;
  }
  return lastMessageId;
}

/** Edit a previously-sent message (HTML). Omitting reply_markup removes buttons. */
export async function editMessageText(
  chatId: number,
  messageId: number,
  html: string,
  opts?: SendMessageOptions
): Promise<void> {
  await tg("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: html.slice(0, TELEGRAM_MESSAGE_LIMIT),
    parse_mode: "HTML",
    ...(opts?.reply_markup ? { reply_markup: opts.reply_markup } : {}),
  });
}

/** Acknowledge a callback query (stops the client-side spinner). */
export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string
): Promise<void> {
  await tg("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    ...(text ? { text } : {}),
  });
}
