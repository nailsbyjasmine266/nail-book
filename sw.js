/* Nails by Jasmine — offline support and calendar files.
   Put this file next to index.html. */
var APP_CACHE = 'nbj-app-v3';
var FONT_CACHE = 'nbj-fonts';

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(APP_CACHE)
      .then(function (cache) { return cache.addAll(['./', './index.html']); })
      .catch(function () {})
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k.indexOf('nbj-app-') === 0 && k !== APP_CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // "Add to Calendar": the app puts the event in the address, and this hands it to iOS as a calendar file.
  if (url.origin === self.location.origin && /\/calendar\.ics$/.test(url.pathname)) {
    var body = url.searchParams.get('d') || '';
    event.respondWith(new Response(body, {
      headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="booking.ics"', 'Cache-Control': 'no-store' }
    }));
    return;
  }

  // The app itself: always try for the newest version, fall back to the saved copy when offline.
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(APP_CACHE).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(req, { ignoreSearch: true }).then(function (hit) {
          if (hit) return hit;
          return caches.match('./index.html').then(function (page) { return page || caches.match('./'); });
        });
      })
    );
    return;
  }

  // Fonts: keep a copy so the app looks right offline.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONT_CACHE).then(function (cache) {
        return cache.match(req).then(function (hit) {
          var net = fetch(req).then(function (res) { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(function () { return hit; });
          return hit || net;
        });
      })
    );
  }
});
