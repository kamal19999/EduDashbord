const CACHE_NAME = "edu-dashboard-cache-v3"; // غيّر الرقم عند كل تحديث
const urlsToCache = [
  "./index.html",
  "./styles.css",
  "./main.js",

  // مكتبات JavaScript
  // "./libs/tailwind-browser.js",
  "./libs/tailwindcss.min.js",
  "./libs/chart.umd.min.js",
  "./libs/chartjs-plugin-datalabels.min.js",
  "./libs/papaparse.min.js",
  "./libs/xlsx.full.min.js",
  "./libs/jspdf.umd.min.js",
  "./libs/html2canvas.min.js",
  "./libs/jspdf.plugin.autotable.min.js",
 

  // الخطوط المحلية (تأكد أنها موجودة فعلاً)
  "./fonts/Amiri.woff2",
  "./fonts/Cairo-Bold-arabic.woff2",
  "./fonts/Cairo-Bold-latin-ext.woff2",
  "./fonts/Cairo-Bold-latin.woff2",
  "./fonts/Cairo-Regular-arabic.woff2",
  "./fonts/Cairo-Regular-latin-ext.woff2",
  "./fonts/Cairo-Regular-latin.woff2",
  "./fonts/Tajawal-Bold-arabic.woff2",
  "./fonts/Tajawal-Bold-latin.woff2",
  "./fonts/Tajawal-Regular-arabic.woff2",
   "./fonts/Tajawal-Regular-latin.woff2",

  // الأيقونة
  "./img/favicon1.png"
];

// تثبيت Service Worker وتخزين الملفات مع كشف الأخطاء
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      for (const url of urlsToCache) {
        try {
          await cache.add(url);
          // console.log("✅ Cached:", url);
        } catch (err) {
          console.error("❌ Failed to cache:", url, err);
        }
      }
    })
  );
});

// تفعيل Service Worker وحذف الكاش القديم عند التحديث
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      )
    ).then(() => {
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: "UPDATE_READY" });
        });
      });
    })
  );
});

// جلب الملفات من الكاش أو الشبكة
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) {
        return response;
      }
      return fetch(event.request).catch(err => {
        console.error("❌ Fetch failed for:", event.request.url, err);
        return new Response("Network error", { status: 408 });
      });
    })
  );
});