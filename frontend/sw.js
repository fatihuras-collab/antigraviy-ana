// ── Pera Anaokulu Stok PWA Service Worker ─────────────────────────────────────
const CACHE_NAME = 'pera-stok-cache-v1';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/style.css?v=2.4.0',
  '/app.js?v=2.4.0',
  '/manifest.json',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png'
];

// 1. Kurulum (Install): Temel varlıkları önbelleğe al
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS).catch((err) => {
        console.warn('[SW] Bazı varlıklar önbelleğe alınamadı:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// 2. Aktifleştirme (Activate): Eski önbellekleri temizle
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// 3. İstek Yakalama (Fetch):
// - /api/ istekleri doğrudan ağa gider (canlı veri)
// - Statik dosyalar ve sayfalar: Network-First, bağlantı yavaşsa/yoksa Cache-Fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API veya dinamik endpoint'ler: Doğrudan ağa git
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/health')) {
    return;
  }

  // Sayfa gezintileri ve statik varlıklar için Network-First (Hızlı geri dönüş)
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Geçerli yanıtı önbelleğe kopyala
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(async () => {
        // Ağ başarısız olduğunda önbellekten sun
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }
        // Sayfa isteğiyse index.html'e geri dön
        if (request.mode === 'navigate') {
          return caches.match('/index.html') || caches.match('/');
        }
        return new Response('Çevrimdışı', { status: 503, statusText: 'Offline' });
      })
  );
});
