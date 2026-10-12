// Shared by push-send.mts (manual admin broadcast) and push-live-check.mts
// (automatic big-game alert) so there's one copy of the actual send loop and
// dead-subscription cleanup. Lives in a subdirectory of netlify/functions so
// Netlify's bundler doesn't also expose it as its own routed function — it
// has no default export anyway, but subdirectories are excluded regardless.
import { getStore } from "@netlify/blobs";
import webpush from "web-push";

export function configureWebPush(): boolean {
  const publicKey = Netlify.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Netlify.env.get("VAPID_PRIVATE_KEY");
  const subject = Netlify.env.get("VAPID_SUBJECT");
  if (!publicKey || !privateKey || !subject) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export async function broadcastPush(payload: { title: string; body: string; url: string }) {
  const store = getStore("push-subscriptions");
  const { blobs } = await store.list();
  const message = JSON.stringify(payload);

  let sent = 0, failed = 0, removed = 0;
  await Promise.all(blobs.map(async ({ key }) => {
    const sub = await store.get(key, { type: "json" }).catch(() => null);
    if (!sub) return;
    try {
      await webpush.sendNotification(sub as any, message);
      sent++;
    } catch (err: any) {
      failed++;
      // 404/410 means the push service has permanently dropped this
      // endpoint (uninstalled, unsubscribed elsewhere) — clean it up rather
      // than retrying it on every future send.
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await store.delete(key);
        removed++;
      }
    }
  }));

  return { sent, failed, removed };
}
