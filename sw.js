const CACHE = "eec-pwa-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./assets/logo.svg",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./libs/html2canvas.min.js",
  "./libs/jspdf.umd.min.js"
];

self.addEventListener("install", (e)=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e)=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.map(k=>k!==CACHE && caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e)=>{
  const { request } = e;
  e.respondWith(
    caches.match(request).then(res => res || fetch(request).then(net=>{
      // Optionally cache GET requests
      if(request.method === 'GET' && new URL(request.url).origin === location.origin){
        const clone = net.clone();
        caches.open(CACHE).then(c=>c.put(request, clone));
      }
      return net;
    }).catch(()=>caches.match("./index.html")))
  );
});
