self.addEventListener('install', (e) => {
  console.log('HARDcall Service Worker Instalado');
});

self.addEventListener('fetch', (e) => {
  e.respondWith(fetch(e.request));
});