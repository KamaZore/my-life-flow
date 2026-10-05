/**
 * Cloudflare Worker — Telegram alert relay for Flowday.
 *
 * Keeps the bot token OUT of the public JavaScript bundle: the browser posts
 * { "text": "..." } to this worker, the worker adds the secret token and
 * forwards the message to Telegram.
 *
 * Deploy (once):
 *   1. wrangler deploy                      (from this folder; `wrangler login` first)
 *   2. wrangler secret put TELEGRAM_BOT_TOKEN
 *   3. wrangler secret put TELEGRAM_CHAT_ID
 *   4. optional: wrangler secret put ALLOWED_ORIGIN   (e.g. https://kamazore.github.io)
 *   5. In the project's Keys/API keys tab set:
 *      VITE_TELEGRAM_ALERT_URL = https://<your-worker>.workers.dev/telegram
 *
 * Contract: POST JSON { "text": "<message>" }
 *        or: POST JSON { "photo": "<url>", "caption": "<text ≤1024>" }
 * → forwards to Telegram (sendMessage / sendPhoto).
 */

export default {
  async fetch(request, env) {
    // The app calls this worker cross-origin from the browser, so every
    // response needs CORS headers and preflights must be answered.
    const cors = {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method === "GET") {
      return new Response("flowday telegram relay", { status: 200, headers: cors });
    }
    if (request.method !== "POST") {
      return new Response("method not allowed", { status: 405, headers: cors });
    }

    // Optional origin lock so strangers cannot burn your bot quota.
    const origin = request.headers.get("Origin");
    if (env.ALLOWED_ORIGIN && origin !== env.ALLOWED_ORIGIN) {
      return new Response("forbidden", { status: 403, headers: cors });
    }

    let text = "";
    let photo = "";
    let caption = "";
    try {
      const body = await request.json();
      text = String(body?.text ?? "");
      photo = String(body?.photo ?? "");
      caption = String(body?.caption ?? "");
    } catch {
      // fall through to the 400 below
    }
    if (!text && !photo) {
      return new Response("missing text or photo", { status: 400, headers: cors });
    }

    const payload = photo
      ? {
          chat_id: env.TELEGRAM_CHAT_ID,
          photo: photo.slice(0, 512),
          caption: caption.slice(0, 1024),
          disable_web_page_preview: true,
        }
      : {
          chat_id: env.TELEGRAM_CHAT_ID,
          text: text.slice(0, 4096),
          disable_web_page_preview: true,
        };

    const res = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${photo ? "sendPhoto" : "sendMessage"}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    return new Response(res.ok ? "ok" : "telegram error", {
      status: res.ok ? 200 : 502,
      headers: cors,
    });
  },
};
