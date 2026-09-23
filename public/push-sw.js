/* Notificações do KMZERO — carregado dentro do service worker do app (vite.config.js →
   workbox.importScripts). Recebe o push do Firebase Cloud Messaging e mostra a
   notificação, mesmo com o app fechado. O servidor manda só "data": aqui decidimos
   título, texto, ícone e para onde o toque leva. */

self.addEventListener("push", (event) => {
  let carga = {};
  try { carga = event.data ? event.data.json() : {}; }
  catch (e) { carga = { data: { titulo: "KMZERO", texto: event.data ? event.data.text() : "" } }; }
  const d = carga.data || carga.notification || {};
  const titulo = d.titulo || d.title || "KMZERO";
  event.waitUntil(self.registration.showNotification(titulo, {
    body: d.texto || d.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: d.tag || undefined,
    renotify: !!d.tag,
    lang: "pt-BR",
    vibrate: [200, 100, 200],
    data: { url: d.url || "/app/" },
  }));
});

// Toque na notificação: se o app já está aberto, traz para a frente e abre o aviso;
// senão abre o app direto no aviso.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/app/", self.location.origin).href;
  event.waitUntil((async () => {
    const janelas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const j of janelas) {
      if (new URL(j.url).pathname.startsWith("/app")) {
        await j.focus();
        j.postMessage({ tipo: "kmzero-abrir-aviso", url });
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
