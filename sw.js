const CACHE_NAME = 'ping-pong-v2';
const ASSETS = [
    './',
    './index.html',
    './manifest.json',
    'https://cdn.tailwindcss.com',
    'https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.8.1/firebase-database-compat.js',
    'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    'https://cdn.jsdelivr.net/npm/chart.js'
];

self.addEventListener('install', (e) => {
    // 강제 업데이트: 대기 중인 워커를 즉시 활성화
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', (e) => {
    // 이전 버전의 캐시 모두 삭제
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    // 네트워크 우선(Network-first) 전략으로 변경하여 항상 최신 버전을 시도
    e.respondWith(
        fetch(e.request).catch(() => caches.match(e.request))
    );
});
