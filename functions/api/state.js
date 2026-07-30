// 考公学习工作台 · 云同步后端（Cloudflare Pages Functions 原生）
// deploy-ver: 2026-07-30-05 (deep merge to prevent sub-field data loss)
// 数据按「房间号」存于 KV 命名空间，绑定名必须为 SYNC_KV。
// 与前端约定：GET/PUT /api/state?room=<房间号>
//   请求体 / 返回体：{ state:{...}, keyTs:{...} }
//   keyTs 为各顶层字段的最后修改时间，合并时取较新一方，防互覆盖。

const CORS = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, PUT, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'cache-control': 'no-store'
};

// 深合并：保留本地独有子数据，远端独有的加进来，两边都有的按 id/ts 去重。
// 避免「整块字段级合并」把本端刚输入的数据（如血压）被对端整块覆盖而丢失。
function deepMerge(local, remote) {
  if (remote === undefined || remote === null) return local;
  if (Array.isArray(remote)) {
    if (!Array.isArray(local)) return remote.slice();
    const keyOf = x => (x && (x.id !== undefined ? x.id : (x.ts !== undefined ? x.ts : JSON.stringify(x))));
    const map = new Map();
    local.forEach(it => map.set(keyOf(it), it));
    remote.forEach(it => map.set(keyOf(it), it)); // 远端覆盖同 key 项
    return Array.from(map.values());
  }
  if (remote && typeof remote === 'object') {
    if (!local || typeof local !== 'object' || Array.isArray(local)) local = {};
    for (const k of Object.keys(remote)) local[k] = deepMerge(local[k], remote[k]);
    return local;
  }
  return remote;
}

// 字段级合并：每个顶层 key 按 keyTs 取修改时间较新的一方，但合并时做深合并而非整块替换
function mergeStates(a, b) {
  const state = Object.assign({}, a.state || {}, b.state || {});
  const keyTs = Object.assign({}, a.keyTs || {}, b.keyTs || {});
  const bs = b.state || {}, bk = b.keyTs || {}, ak = a.keyTs || {}, ast = a.state || {};
  for (const k of Object.keys(bs)) {
    const tb = bk[k] || 0, ta = ak[k] || 0;
    if (tb >= ta) { state[k] = deepMerge(ast[k], bs[k]); keyTs[k] = tb; }
    else { state[k] = deepMerge(bs[k], ast[k]); keyTs[k] = ta; }
  }
  return { state, keyTs };
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.SYNC_KV) {
    return new Response(JSON.stringify({
      error: 'KV_NOT_BOUND',
      hint: '请在 Cloudflare Pages 项目「设置 → Functions → KV 命名空间绑定」中添加绑定名 SYNC_KV 的命名空间'
    }), { status: 500, headers: CORS });
  }
  const url = new URL(request.url);
  const room = (url.searchParams.get('room') || 'kaogong-shared').toString().slice(0, 64);

  if (request.method === 'GET') {
    const raw = await env.SYNC_KV.get(room);
    return new Response(raw || JSON.stringify({ state: {}, keyTs: {} }), { headers: CORS });
  }

  if (request.method === 'PUT') {
    let incoming;
    try { incoming = await request.json(); }
    catch (e) { return new Response(JSON.stringify({ error: 'bad_json' }), { status: 400, headers: CORS }); }
    const cur = JSON.parse(await env.SYNC_KV.get(room) || '{}');
    // 清空指令：resetAt 比云端新则整体替换（用于「清空全部数据」跨设备生效）
    if (incoming && incoming.resetAt && incoming.resetAt > (cur.resetAt || 0)) {
      const cleared = { state: incoming.state || {}, keyTs: incoming.keyTs || {}, resetAt: incoming.resetAt };
      await env.SYNC_KV.put(room, JSON.stringify(cleared));
      return new Response(JSON.stringify(cleared), { headers: CORS });
    }
    const merged = mergeStates(cur, incoming || {});
    merged.resetAt = Math.max(cur.resetAt || 0, (incoming && incoming.resetAt) || 0);
    await env.SYNC_KV.put(room, JSON.stringify(merged));
    return new Response(JSON.stringify(merged), { headers: CORS });
  }

  return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: CORS });
}
