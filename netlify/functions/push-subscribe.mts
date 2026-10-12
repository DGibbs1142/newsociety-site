// Stores/removes a visitor's browser push subscription in Netlify Blobs.
// Push subscription endpoints are themselves unique per browser install, so
// they double as the id — hashed here only to keep blob keys short and free
// of URL characters, not for any secrecy reason.
import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

async function hashEndpoint(endpoint: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export default async (req: Request, context: Context) => {
  if (req.method !== "POST" && req.method !== "DELETE") {
    return jsonError("Method not allowed", 405);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  if (!endpoint || !endpoint.startsWith("https://")) {
    return jsonError("Invalid subscription", 400);
  }

  const store = getStore("push-subscriptions");
  const key = await hashEndpoint(endpoint);

  if (req.method === "DELETE") {
    await store.delete(key);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
    });
  }

  if (!body?.keys?.p256dh || !body?.keys?.auth) {
    return jsonError("Invalid subscription", 400);
  }

  await store.setJSON(key, { endpoint, keys: body.keys });
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
};

export const config: Config = {
  path: "/api/push-subscribe"
};
