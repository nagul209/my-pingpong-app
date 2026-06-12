const CACHE_NAME = 'ping-pong-v3';
const ASSETS = [
    './',
    './index.html',
    './manifest.json',
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/react@18/umd/react.production.min.js',
    'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
    'https://unpkg.com/@babel/standalone/babel.min.js',
    'https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.8.1/firebase-database-compat.js',
    'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth-compat.js'
];

async function cacheAsset(cache, asset) {
    try {
        const request = new Request(asset, { cache: 'reload' });
        const response = await fetch(request);

        if (!response || (!response.ok && response.type !== 'opaque')) {
            throw new Error(`Unexpected response while caching ${asset}: ${response?.status || 'no response'}`);
        }

        await cache.put(request, response.clone());
    } catch (error) {
        // 외부 CDN 캐시 실패가 서비스 워커 설치 전체 실패로 이어지지 않도록 개별 자산만 건너뜁니다.
        console.warn('[Service Worker] Failed to cache asset:', asset, error);
    }
}

self.addEventListener('install', (e) => {
    // 강제 업데이트: 대기 중인 워커를 즉시 활성화
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => Promise.all(ASSETS.map((asset) => cacheAsset(cache, asset))))
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
    if (e.request.method !== 'GET') {
        return;
    }

    e.respondWith(
        fetch(e.request)
            .then((response) => {
                if (response && (response.ok || response.type === 'opaque')) {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(e.request, responseToCache)).catch(error => {
                        console.warn('[Service Worker] Failed to update cached response:', e.request.url, error);
                    });
                }
                return response;
            })
            .catch(async () => {
                const cachedResponse = await caches.match(e.request);
                if (cachedResponse) return cachedResponse;

                if (e.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }

                return Response.error();
            })
    );
});
