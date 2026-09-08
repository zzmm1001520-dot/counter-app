const CACHE_NAME = "counter-app-v9";
const OFFLINE_PAGE = "./index.html";

async function cacheOfflinePage() {
  const response = await fetch(OFFLINE_PAGE, { cache: "reload" });
  if (!response.ok || response.redirected) return response;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(OFFLINE_PAGE, response.clone());
  return response;
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_OFFLINE_PAGE") return;
  event.waitUntil(cacheOfflinePage().catch(() => {}));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (new URL(event.request.url).origin !== self.location.origin) return;

  if (event.request.mode === "navigate" || event.request.destination === "document") {
    const pageUpdate = cacheOfflinePage();

    event.waitUntil(pageUpdate.then(() => {}).catch(() => {}));
    event.respondWith((async () => {
      const cached = await caches.match(OFFLINE_PAGE);
      if (cached) return cached;
      return pageUpdate;
    })());
    return;
  }

  const networkResponse = fetch(event.request);
  event.waitUntil(
    networkResponse.then((response) => {
      if (!response.ok || response.redirected) return undefined;
      return caches.open(CACHE_NAME)
        .then((cache) => cache.put(event.request, response.clone()));
    }).catch(() => {}),
  );

  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    return networkResponse;
  })());
});
