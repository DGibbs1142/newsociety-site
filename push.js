// Subscribe/unsubscribe flow for browser push notifications — currently
// only wired up on live.html (NewSociety Live launch updates + the
// automatic "big game is live" alert from push-live-check.mts both go to
// the same subscriber list, so one button covers both).
// This key is the VAPID public key generated for this project — safe to
// ship client-side, it only lets a browser subscribe, never send.
const VAPID_PUBLIC_KEY = 'BHd5U7ihWMhRr2eeZBtsYwmKnC7f_X_2-_wbaJgTMM03ZKHEcRDH7aXKhEsKwX1Sh_7F76RGRMC6wKG0v7U4pUs';

function urlBase64ToUint8Array(base64String){
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

async function getExistingSubscription(){
  if(!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

function syncPushButton(btn, subscribed){
  btn.textContent = subscribed ? '🔔 Notifications On' : '🔔 Notify Me';
  btn.classList.toggle('subscribed', subscribed);
  btn.disabled = false;
}

async function initPushSubscribe(){
  const btn = document.getElementById('pushSubscribeBtn');
  if(!btn) return;

  if(!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)){
    btn.remove();
    return;
  }

  const existing = await getExistingSubscription().catch(() => null);
  syncPushButton(btn, !!existing);

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try{
      const current = await getExistingSubscription();
      if(current){
        await fetch('/api/push-subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: current.endpoint })
        }).catch(() => {});
        await current.unsubscribe();
        syncPushButton(btn, false);
        return;
      }

      const permission = await Notification.requestPermission();
      if(permission !== 'granted'){
        syncPushButton(btn, false);
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
      await fetch('/api/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub)
      });
      syncPushButton(btn, true);
    }catch(err){
      syncPushButton(btn, false);
    }
  });
}

document.addEventListener('DOMContentLoaded', initPushSubscribe);
