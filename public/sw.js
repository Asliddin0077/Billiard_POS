// Billiard POS — oddiy service worker (asosan "ilova sifatida o'rnatish" imkonini yoqish uchun)
// Hech narsani keshlamaymiz — har doim internetdan yangi ma'lumot olinadi (Supabase'dagi
// jonli ma'lumotlar eskirib qolmasligi uchun)

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
