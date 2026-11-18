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
// 11/19 使用者：「每次手機重開都要重新建立帳號」→ 存檔多一份備份在 localStorage（有些手機瀏覽器／LINE 內建瀏覽器會清掉 IndexedDB），
// 並請瀏覽器把這個網站的資料設成「持久保存」；載入時用兩份裡比較新的那份
try { navigator.storage?.persist?.(); } catch {}
const LS_DB = 'ss_db_backup', LS_T = 'ss_db_backup_t';
const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = t => { const s = atob(t), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
function lsGet() { try { const t = localStorage.getItem(LS_DB); return t ? { db: unb64(t), t: +(localStorage.getItem(LS_T) || 0) } : null; } catch { return null; } }
function lsPut(u8) { try { if (u8.length > 3.5e6) return; localStorage.setItem(LS_DB, b64(u8)); localStorage.setItem(LS_T, String(Date.now())); } catch (e) { console.warn('備份存檔失敗', e); } }
let saved = await idbGet();
{ const ls = lsGet(), idbT = +(globalThis.localStorage?.getItem('ss_db_idb_t') || 0);
  if (ls && (!saved || ls.t > idbT)) saved = ls.db; } // IndexedDB 被清掉（或比較舊）→ 用 localStorage 備份
let dirty = false;
const norm = a => a.map(v => v === undefined ? null : typeof v === 'boolean' ? +v : typeof v === 'bigint' ? Number(v) : v);
export class DatabaseSync {
  constructor() { this.db = saved ? new SQL.Database(saved) : new SQL.Database(); DatabaseSync.main = this; }
  exec(sql) { this.db.exec(sql); this.touch(); }
  touch() { dirty = true; }
  save() { if (!dirty) return; dirty = false; const u8 = this.db.export(); lsPut(u8); return idbPut(u8).then(() => { try { localStorage.setItem('ss_db_idb_t', String(Date.now())); } catch {} }); }
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
