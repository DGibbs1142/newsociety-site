// Manual push broadcast — the admin-push.html page posts here with a shared
// secret (PUSH_ADMIN_SECRET) to send a one-off notification to everyone
// currently subscribed. There's no real auth system on this static site, so
// this header check is the only thing standing between the public internet
// and every subscriber's lock screen — keep it required.
import type { Context, Config } from "@netlify/functions";
import { configureWebPush, broadcastPush } from "./lib/push-shared.mts";

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") return jsonError("Method not allowed", 405);

  const adminSecret = req.headers.get("x-admin-secret") || "";
  const expected = Netlify.env.get("PUSH_ADMIN_SECRET");
  if (!expected || adminSecret !== expected) {
    return jsonError("Unauthorized", 401);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const title = String(body?.title || "").trim();
  const text = String(body?.body || "").trim();
  const url = String(body?.url || "/").trim();
  if (!title || !text) return jsonError("title and body are required", 400);

  if (!configureWebPush()) return jsonError("Push is not configured", 500);

  const result = await broadcastPush({ title, body: text, url });
  return new Response(JSON.stringify(result), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
};

export const config: Config = {
  path: "/api/push-send"
};
