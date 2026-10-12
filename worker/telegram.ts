import type { Env } from "./db";
import { sha256 } from "./db";

export async function tgSecret(env: Env): Promise<string | null> {
  if (!env.TELEGRAM_BOT_TOKEN) return null;
  return (await sha256("spin-league:" + env.TELEGRAM_BOT_TOKEN)).slice(0, 32);
}

export async function tgCall(env: Env, method: string, body: unknown): Promise<any> {
  if (!env.TELEGRAM_BOT_TOKEN) return { ok: false, description: "TELEGRAM_BOT_TOKEN non impostato" };
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json().catch(() => ({ ok: false, description: `HTTP ${res.status}` }));
}

export function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Telegram accetta al massimo 4096 caratteri per messaggio. */
export async function tgSend(env: Env, chatId: string | null, html: string) {
  if (!chatId || !env.TELEGRAM_BOT_TOKEN) return;
  const chunks: string[] = [];
  let cur = "";
  for (const para of html.split("\n\n")) {
    if ((cur + "\n\n" + para).length > 3800) { chunks.push(cur); cur = para; } else cur = cur ? cur + "\n\n" + para : para;
  }
  if (cur) chunks.push(cur);
  for (const c of chunks) await tgCall(env, "sendMessage", { chat_id: chatId, text: c, parse_mode: "HTML", disable_web_page_preview: true });
}
