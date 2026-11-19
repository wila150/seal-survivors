// 雲端伺服器入口（Cloudflare Workers 免費方案）：所有 /api/ 請求都交給同一個 Durable Object「main」
// 那個 Durable Object 裡跑的就是 server.mjs（cloud/server.js 由 tools/build-cloud.mjs 產生），資料存在它內建的 SQLite
// 部署：cd cloud && npx wrangler deploy（之前先 node tools/build-cloud.mjs）
import { DurableObject } from 'cloudflare:workers';

const ALLOW = /^https:\/\/wila150\.github\.io$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const cors = origin => ({ 'access-control-allow-origin': ALLOW.test(origin || '') ? origin : 'https://wila150.github.io', 'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS', 'access-control-allow-headers': 'content-type, authorization', 'access-control-max-age': '86400', vary: 'origin' });

export class Game extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    globalThis.__SS_STORAGE = ctx.storage;
    globalThis.process ??= { env: {} }; globalThis.process.env ??= {}; globalThis.process.env.GM_USERS = env.GM_USERS || ''; // GM 帳號（wrangler.toml [vars]）
    ctx.blockConcurrencyWhile(async () => { this.srv = await import('./server.js'); });
  }
  async fetch(request) { return this.srv.handle(request); }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('origin');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    const u = new URL(request.url);
    let r;
    if (!u.pathname.startsWith('/api/')) return Response.redirect('https://wila150.github.io/seal-survivors/', 302); // 直接開伺服器網址 → 跳到遊戲
    else { try { r = await env.GAME.get(env.GAME.idFromName('main')).fetch(request); } catch (e) { console.error(e); r = new Response(JSON.stringify({ error: '伺服器忙碌，請再試一次' }), { status: 503, headers: { 'content-type': 'application/json; charset=utf-8' } }); } }
    r = new Response(r.body, r);
    for (const [k, v] of Object.entries(cors(origin))) r.headers.set(k, v);
    return r;
  },
};
