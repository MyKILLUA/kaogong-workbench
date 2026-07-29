// 考公学习工作台 · Service Worker
// 作用：① 让站点成为「可安装 PWA」（满足 Chrome 独立打开条件）② 离线可打开
// 注意：每次发布新版本请提升下方 CACHE 版本号，旧缓存会在 activate 时自动清除，
//       避免手机一直加载旧的 index.html（即使重装主屏图标也不会卸载 SW 缓存）。
const CACHE = 'kaogong-v2';
const ASSETS = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 页面检测到新版本时，要求立即跳过等待、接管并触发刷新
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // 云同步接口：永远走网络，避免缓存干扰数据同步
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request));
    return;
  }
  // 页面导航：网络优先，失败回退到缓存的 index.html（离线也能开 App）
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match('/index.html')));
    return;
  }
  // 其它静态资源：网络优先，失败用缓存
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
