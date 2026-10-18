/*
 * chowdown's service worker. It exists so the app can be installed and so a
 * page opened offline says so, instead of showing the browser's dinosaur. It
 * deliberately caches nothing else: recipes are personal and change often, so
 * every page comes from the network.
 */

const OFFLINE_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#ffb100">
<title>Offline · chowdown</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #fbf8f2; color: #15120e; font: 16px/1.5 system-ui, sans-serif; text-align: center; padding: 24px; }
  h1 { font-size: 1.75rem; margin: 0 0 8px; }
  p { margin: 0 0 20px; color: #4a453f; }
  button { background: #15120e; color: #fff; border: 0; border-radius: 8px; padding: 12px 20px; font: inherit; font-weight: 600; cursor: pointer; }
</style>
</head>
<body>
<main>
  <h1>You're offline</h1>
  <p>chowdown needs a connection to open your recipes. Check it and try again.</p>
  <button type="button" onclick="location.reload()">Try again</button>
</main>
</body>
</html>`;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.mode !== 'navigate') {
    return;
  }
  event.respondWith(
    fetch(request).catch(
      () =>
        new Response(OFFLINE_PAGE, {
          status: 503,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }),
    ),
  );
});
