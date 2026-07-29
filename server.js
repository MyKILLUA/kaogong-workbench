// 考公学习工作台 · 轻量云同步后端（零依赖，仅用 Node 内置模块）
// 功能：
//   1) 静态托管本目录（含 index.html），所以同一个地址既能打开应用也能同步数据
//   2) /api/state?room=<房间号>  GET  -> 返回 {rev,ts,state,keyTs}
//                              PUT  -> 按 keyTs 做「字段级合并」后保存，返回最新
// 数据持久化在 ./data/<room>.json
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function sendJSON(res, code, obj) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', c => (data += c));
    req.on('end', () => resolve(data));
  });
}
function roomFile(room) {
  const safe = String(room || 'default').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || 'default';
  return path.join(DATA_DIR, safe + '.json');
}
function loadRoom(room) {
  try { return JSON.parse(fs.readFileSync(roomFile(room), 'utf8')); }
  catch (e) { return { rev: 0, ts: 0, state: null, keyTs: {} }; }
}
function saveRoom(room, obj) {
  fs.writeFileSync(roomFile(room), JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'OPTIONS') { sendJSON(res, 204, {}); return; }

  // ---- 同步 API ----
  if (url.pathname === '/api/state') {
    const room = url.searchParams.get('room') || 'default';
    if (req.method === 'GET') {
      const rec = loadRoom(room);
      sendJSON(res, 200, { rev: rec.rev || 0, ts: rec.ts || 0, state: rec.state || null, keyTs: rec.keyTs || {} });
      return;
    }
    if (req.method === 'POST' || req.method === 'PUT') {
      let body = {};
      try { body = JSON.parse((await readBody(req)) || '{}'); } catch (e) {}
      const incoming = body.state || {};
      const incomingKeyTs = body.keyTs || {};
      const rec = loadRoom(room);
      const cur = rec.state || {};
      const curKeyTs = rec.keyTs || {};
      // 字段级合并：每个顶层 key 取 keyTs 较大（更新）的一方
      const merged = {};
      const keys = new Set([...Object.keys(cur), ...Object.keys(incoming)]);
      for (const k of keys) {
        const ct = curKeyTs[k] || 0, it = incomingKeyTs[k] || 0;
        merged[k] = (it >= ct) ? incoming[k] : cur[k];
      }
      const newRec = {
        rev: (rec.rev || 0) + 1,
        ts: Date.now(),
        state: merged,
        keyTs: Object.assign({}, curKeyTs, incomingKeyTs)
      };
      saveRoom(room, newRec);
      sendJSON(res, 200, { rev: newRec.rev, ts: newRec.ts, state: merged, keyTs: newRec.keyTs });
      return;
    }
    sendJSON(res, 405, { error: 'method not allowed' });
    return;
  }

  // ---- 静态文件 ----
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  if (p.startsWith('/data/')) { res.writeHead(403); res.end('forbidden'); return; }
  const filePath = path.join(ROOT, p);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(filePath, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('404 Not Found'); return; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(buf);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('[kaogong-sync] listening on ' + PORT));
