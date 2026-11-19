// 雲端版（Cloudflare Worker＋Durable Object）：讓 server.mjs 的程式原封不動在 Cloudflare 上跑
// tools/build-cloud.mjs 把 server.mjs 的 node: 匯入換成這個檔案 → cloud/server.js
// 資料庫：Durable Object 內建的 SQLite（ctx.storage.sql，同步 API，跟 node:sqlite 一樣用法）
import nodeCrypto from 'node:crypto';
import { Buffer as NodeBuffer } from 'node:buffer';
import skills from '../assets/data/skills.json';
import talents from '../assets/data/talents.json';
globalThis.process ??= { env: {} };

const FILES = { 'skills.json': JSON.stringify(skills), 'talents.json': JSON.stringify(talents) };
export const fs = {
  mkdirSync() {},
  readFileSync(p) { const k = String(p).split('/').pop(); if (k in FILES) return FILES[k]; throw new Error('雲端版沒有這個檔案：' + p); },
  readFile(p, cb) { cb(new Error('no static files in cloud')); },
};
export const path = {
  sep: '/',
  join: (...a) => a.join('/').replace(/\/+/g, '/'),
  dirname: p => p.replace(/\/[^/]*$/, '') || '/',
  extname: p => (p.match(/\.[^./]*$/) || [''])[0],
  relative: (a, b) => b.startsWith(a) ? b.slice(a.length) : b,
};
export const fileURLToPath = () => '/srv/server.js';
export const crypto = nodeCrypto;
export const Buffer = NodeBuffer;

// ---- Durable Object SQLite：仿 node:sqlite 的 DatabaseSync ----
const norm = a => a.map(v => v === undefined ? null : typeof v === 'boolean' ? +v : typeof v === 'bigint' ? Number(v) : v);
export class DatabaseSync {
  // 每次都拿最新的 storage：Durable Object 被回收重建時 server.js 不會重跑，舊的 storage 不能再用
  get st() { return globalThis.__SS_STORAGE; }
  get sql() { return globalThis.__SS_STORAGE.sql; }
  exec(q) { if (/^\s*(BEGIN|COMMIT|ROLLBACK)\b/i.test(q)) return; this.sql.exec(q); } // 交易改走 tx()
  tx(fn) { return this.st.transactionSync(fn); }
  prepare(q) {
    const self = this;
    return {
      get(...a) { for (const r of self.sql.exec(q, ...norm(a))) return r; return undefined; },
      all(...a) { return self.sql.exec(q, ...norm(a)).toArray(); },
      run(...a) { const sql = self.sql; sql.exec(q, ...norm(a)).toArray(); const r = sql.exec('SELECT changes() AS c, last_insert_rowid() AS i').one(); return { changes: r.c, lastInsertRowid: r.i }; },
    };
  }
}

// ---- http：接住 createServer 的處理函式，Durable Object 的 fetch 轉成 Node 風格的 req／res ----
let handler = null;
export const http = { createServer(fn) { handler = fn; return { listen(_p, cb) { cb?.(); } }; } };
export async function handle(request) {
  const u = new URL(request.url), headers = {};
  request.headers.forEach((v, k) => { headers[k] = v; });
  const bodyText = request.method === 'GET' || request.method === 'HEAD' ? '' : await request.text();
  const ev = {};
  // remoteAddress＝真正的連線 IP → GM 指令（只限 127.0.0.1）在雲端自動關掉
  const req = { method: request.method, url: u.pathname + u.search, headers, socket: { remoteAddress: headers['cf-connecting-ip'] || '0.0.0.0' }, on(e, f) { ev[e] = f; }, destroy() {} };
  return await new Promise((ok, bad) => {
    let code = 200, hdr = {};
    const res = { writeHead(c, h) { code = c; hdr = h || {}; }, end(d) { ok(new Response(d ?? '', { status: code, headers: hdr })); } };
    Promise.resolve(handler(req, res)).catch(bad);
    queueMicrotask(() => { if (bodyText) ev.data?.(bodyText); ev.end?.(); });
  });
}
