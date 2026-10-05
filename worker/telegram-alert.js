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
 * Contract: POST JSON { "text": "<message>" } → forwards to Telegram.
 */

export default {
  async fetch(request, env) {
    if (request.method === "GET") {
      return new Response("flowday telegram relay", { status: 200 });
    }
    if (request.method !== "POST") {
      return new Response("method not allowed", { status: 405 });
    }

    // Optional origin lock so strangers cannot burn your bot quota.
    const origin = request.headers.get("Origin");
    if (env.ALLOWED_ORIGIN && origin !== env.ALLOWED_ORIGIN) {
      return new Response("forbidden", { status: 403 });
    }

    let text = "";
    try {
      const body = await request.json();
      text = String(body?.text ?? "");
    } catch {
      // fall through to the 400 below
    }
    if (!text) return new Response("missing text", { status: 400 });
    if (text.length > 4096) text = text.slice(0, 4096);

    const res = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text,
          disable_web_page_preview: true,
        }),
      },
    );

    return new Response(res.ok ? "ok" : "telegram error", {
      status: res.ok ? 200 : 502,
    });
  },
};
