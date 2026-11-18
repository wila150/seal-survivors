// 離線模式（GitHub Pages／手機）：讓 server.mjs 的程式直接在瀏覽器裡跑
// tools/build-offline.mjs 把 server.mjs 的 node: 匯入換成這個檔案 → src/0_offline/server.js
// 資料庫：sql.js（SQLite 的 wasm 版），存檔放瀏覽器 IndexedDB（有寫入的請求，存完才回應）
const BASE = new URL('../../', import.meta.url); // 專案根目錄
globalThis.process ??= { env: {} };

// ---- 預先載入 server 會用 readFileSync 讀的 JSON ----
const FILES = {};
await Promise.all(['assets/data/skills.json', 'assets/data/talents.json'].map(async p => { FILES[p.split('/').pop()] = await (await fetch(new URL(p, BASE))).text(); }));
export const fs = {
  mkdirSync() {},
  readFileSync(p) { const k = String(p).split('/').pop(); if (k in FILES) return FILES[k]; throw new Error('離線模式沒有這個檔案：' + p); },
  readFile(p, cb) { cb(new Error('no static files offline')); },
};
export const path = {
  sep: '/',
  join: (...a) => a.join('/').replace(/\/+/g, '/'),
  dirname: p => p.replace(/\/[^/]*$/, '') || '/',
  extname: p => (p.match(/\.[^./]*$/) || [''])[0],
  relative: (a, b) => b.startsWith(a) ? b.slice(a.length) : b,
};
export const fileURLToPath = u => new URL(u).pathname;

// ---- crypto：只用到 randomBytes／scryptSync／timingSafeEqual（離線只有自己一個人，密碼雜湊用簡單版）----
const hexOf = bytes => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
const hx = h => ({ h, toString: () => h });
function slowHash(s, n) { // FNV-1a 多輪 → n bytes
  const out = new Uint8Array(n); let h = 0x811c9dc5;
  for (let r = 0; r < 2000; r++) for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i) + r; h = Math.imul(h, 0x01000193) >>> 0; out[(i + r) % n] ^= h & 255; }
  return out;
}
export const crypto = {
  randomBytes: n => hx(hexOf(globalThis.crypto.getRandomValues(new Uint8Array(n)))),
  scryptSync: (pw, salt, n) => hx(hexOf(slowHash(salt + ':' + pw, n))),
  timingSafeEqual: (a, b) => a.toString('hex') === b.toString('hex'),
};
export const Buffer = { from: (s, enc) => hx(String(s)) };

// ---- sql.js：仿 node:sqlite 的 DatabaseSync ----
const IDB = 'seal-survivors', KEY = 'game.db';
const idb = () => new Promise((ok, bad) => { const r = indexedDB.open(IDB, 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => ok(r.result); r.onerror = () => bad(r.error); });
async function idbGet() { try { const d = await idb(); return await new Promise(ok => { const q = d.transaction('kv').objectStore('kv').get(KEY); q.onsuccess = () => ok(q.result || null); q.onerror = () => ok(null); }); } catch { return null; } }
async function idbPut(v) { try { const d = await idb(); await new Promise((ok, bad) => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, KEY); t.oncomplete = ok; t.onerror = () => bad(t.error); }); } catch (e) { console.warn('存檔失敗', e); } }
await new Promise((ok, bad) => { if (globalThis.initSqlJs) return ok(); const s = document.createElement('script'); s.src = new URL('vendor/sql-wasm.js', import.meta.url); s.onload = ok; s.onerror = bad; document.head.appendChild(s); });
const SQL = await globalThis.initSqlJs({ locateFile: f => new URL('vendor/' + f, import.meta.url).href });
const saved = await idbGet();
let dirty = false;
const norm = a => a.map(v => v === undefined ? null : typeof v === 'boolean' ? +v : typeof v === 'bigint' ? Number(v) : v);
export class DatabaseSync {
  constructor() { this.db = saved ? new SQL.Database(saved) : new SQL.Database(); DatabaseSync.main = this; }
  exec(sql) { this.db.exec(sql); this.touch(); }
  touch() { dirty = true; }
  save() { if (!dirty) return; dirty = false; return idbPut(this.db.export()); }
  prepare(sql) {
    const db = this.db, self = this, write = !/^\s*select/i.test(sql);
    const each = (args, fn) => { const st = db.prepare(sql); try { st.bind(norm(args)); while (st.step()) if (fn(st.getAsObject()) === false) break; } finally { st.free(); } };
    return {
      get(...a) { let row; each(a, r => { row = r; return false; }); return row; },
      all(...a) { const rows = []; each(a, r => { rows.push(r); }); return rows; },
      run(...a) { each(a, () => {}); const changes = db.getRowsModified(), id = db.exec('SELECT last_insert_rowid()')[0]?.values[0][0] ?? 0; if (write) self.touch(); return { changes, lastInsertRowid: id }; },
    };
  }
}
addEventListener('pagehide', () => DatabaseSync.main?.save());
addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && DatabaseSync.main?.save());

// ---- http：接住 createServer 的處理函式，給 fetch 攔截用 ----
let handler = null;
export const http = { createServer(fn) { handler = fn; return { listen(_p, cb) { cb?.(); } }; } };
export async function handle(method, url, headers, bodyText) {
  const ev = {};
  const req = { method, url, headers, socket: { remoteAddress: '127.0.0.1' }, on(e, f) { ev[e] = f; }, destroy() {} };
  return await new Promise((ok, bad) => {
    let code = 200, hdr = {};
    // 回應前先把資料庫寫進 IndexedDB（等寫完才回應 → 之後馬上換頁也不會掉存檔）
    const res = { writeHead(c, h) { code = c; hdr = h || {}; }, end(d) { Promise.resolve(DatabaseSync.main?.save()).finally(() => ok(new Response(d ?? '', { status: code, headers: hdr }))); } };
    Promise.resolve(handler(req, res)).catch(bad);
    queueMicrotask(() => { if (bodyText) ev.data?.(bodyText); ev.end?.(); });
  });
}
