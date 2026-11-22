const CACHE_NAME = 'gostop-offline-v8';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest'
];
// 실사 패는 index.html 안의 <image href="./cards/*.svg"> 로 불린다.
// 로비만 보고 오프라인이 되어도 모든 패가 보이도록 설치 시 전부 캐시한다.
const CARD_ASSETS = [
  './cards/01-bright.svg',
  './cards/01-junk-1.svg',
  './cards/01-junk-2.svg',
  './cards/01-ribbon.svg',
  './cards/02-animal.svg',
  './cards/02-junk-1.svg',
  './cards/02-junk-2.svg',
  './cards/02-ribbon.svg',
  './cards/03-bright.svg',
  './cards/03-junk-1.svg',
  './cards/03-junk-2.svg',
  './cards/03-ribbon.svg',
  './cards/04-animal.svg',
  './cards/04-junk-1.svg',
  './cards/04-junk-2.svg',
  './cards/04-ribbon.svg',
  './cards/05-animal.svg',
  './cards/05-junk-1.svg',
  './cards/05-junk-2.svg',
  './cards/05-ribbon.svg',
  './cards/06-animal.svg',
  './cards/06-junk-1.svg',
  './cards/06-junk-2.svg',
  './cards/06-ribbon.svg',
  './cards/07-animal.svg',
  './cards/07-junk-1.svg',
  './cards/07-junk-2.svg',
  './cards/07-ribbon.svg',
  './cards/08-animal.svg',
  './cards/08-bright.svg',
  './cards/08-junk-1.svg',
  './cards/08-junk-2.svg',
  './cards/09-animal.svg',
  './cards/09-junk-1.svg',
  './cards/09-junk-2.svg',
  './cards/09-ribbon.svg',
  './cards/10-animal.svg',
  './cards/10-junk-1.svg',
  './cards/10-junk-2.svg',
  './cards/10-ribbon.svg',
  './cards/11-bright.svg',
  './cards/11-double.svg',
  './cards/11-junk-1.svg',
  './cards/11-junk-2.svg',
  './cards/12-animal.svg',
  './cards/12-bright.svg',
  './cards/12-double.svg',
  './cards/12-ribbon.svg'
];

// 카드 요청이 실패했을 때 index.html(HTML)을 돌려주면 <image> 가 깨진다.
// 투명 SVG를 돌려 카드 SVG 안에 이미 깔려 있는 벡터 패가 그대로 보이게 한다.
function cardVectorFallback() {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 105" width="64" height="105">' +
    '<title>vector hwatu fallback</title>' +
    '<rect width="64" height="105" fill="none"/>' +
    '</svg>';
  return new Response(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // 핵심 파일은 반드시 캐시한다.
      await cache.addAll(CORE_ASSETS);
      // 카드 한 장이 없거나 네트워크가 불안해도 설치는 끝나게 한다.
      await Promise.allSettled(CARD_ASSETS.map((url) => cache.add(url)));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const isCard = /\/cards\/[^/]+\.svg$/i.test(url.pathname);

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((resp) => {
        // 카드 SVG 요청이 404/500 이거나 SPA fallback HTML 을 받으면
        // 캐시하지 않고 투명 SVG(벡터 패)로 대체한다.
        if (isCard) {
          const contentType = (resp && resp.headers && resp.headers.get('content-type')) || '';
          if (!resp || !resp.ok || contentType.indexOf('image/svg') === -1) {
            return cardVectorFallback();
          }
        }
        if (!resp || resp.status !== 200 || resp.type !== 'basic') return resp;
        const copy = resp.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return resp;
      }).catch(() => {
        if (isCard) return cardVectorFallback();
        if (event.request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});
