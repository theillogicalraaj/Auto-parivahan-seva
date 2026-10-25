```javascript
const APP_CACHE = "musical-auto-seva-app-v1";
const AUDIO_CACHE = "musical-auto-seva-audio-v1";

const APP_FILES = [
  "./",
  "./index.html",
  "./songs.json"
];

// Install service worker and cache essential website files
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_CACHE);

      for (const file of APP_FILES) {
        try {
          await cache.add(file);
        } catch (error) {
          console.warn("Could not cache:", file, error);
        }
      }

      await self.skipWaiting();
    })()
  );
});

// Activate service worker
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
    })()
  );
});

// Handle website and audio requests
self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Only handle files hosted on this website
  if (url.origin !== self.location.origin) return;

  // Audio: play cached songs when available
  if (
    request.destination === "audio" ||
    /\.(mp3|m4a|aac|wav|ogg|flac)$/i.test(url.pathname)
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(AUDIO_CACHE);
        const cached = await cache.match(request, {
          ignoreSearch: true
        });

        if (cached) return cached;

        // If not cached, try downloading it from the website
        return fetch(request);
      })()
    );

    return;
  }

  // Keep songs.json available offline
  if (url.pathname.endsWith("/songs.json")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(APP_CACHE);

        try {
          const response = await fetch(request);

          if (response.ok) {
            await cache.put(request, response.clone());
          }

          return response;
        } catch (error) {
          return (await cache.match(request)) || Response.error();
        }
      })()
    );

    return;
  }

  // Serve the website when offline
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(APP_CACHE);

        try {
          const response = await fetch(request);

          if (response.ok) {
            await cache.put("./index.html", response.clone());
          }

          return response;
        } catch (error) {
          return (
            (await cache.match(request)) ||
            (await cache.match("./index.html")) ||
            Response.error()
          );
        }
      })()
    );
  }
});

// Allow index.html to request that songs be saved for offline playback
self.addEventListener("message", (event) => {
  if (!event.data || event.data.type !== "CACHE_SONGS") return;

  const port = event.ports && event.ports[0];

  event.waitUntil(
    (async () => {
      const urls = [
        ...new Set(
          (event.data.urls || []).filter((songUrl) => {
            try {
              return new URL(songUrl, self.location.href).origin ===
                self.location.origin;
            } catch (error) {
              return false;
            }
          })
        )
      ];

      const cache = await caches.open(AUDIO_CACHE);

      let done = 0;
      let saved = 0;
      let failed = 0;

      for (const songUrl of urls) {
        try {
          const absoluteUrl = new URL(songUrl, self.location.href).href;
          const existing = await cache.match(absoluteUrl);

          if (existing) {
            saved++;
          } else {
            const response = await fetch(absoluteUrl);

            if (!response.ok) {
              throw new Error("HTTP " + response.status);
            }

            await cache.put(absoluteUrl, response.clone());
            saved++;
          }
        } catch (error) {
          failed++;
          console.warn("Could not save song offline:", songUrl, error);
        }

        done++;

        if (port) {
          port.postMessage({
            type: "progress",
            done,
            total: urls.length
          });
        }
      }

      if (port) {
        port.postMessage({
          type: "complete",
          done,
          total: urls.length,
          saved,
          failed
        });
      }
    })()
  );
});
```