// 伺服器切換（一般 <script>，不是 module，要放在每個頁面所有 module 前面，才能搶先換掉 fetch）：
// - 本機 Node 伺服器（localhost／區網 IP）：照舊直接打 /api/
// - 其他（GitHub Pages、手機）：11/20 起 /api/ 改打雲端伺服器（Cloudflare，cloud/worker.js）→ 手機電腦同一個帳號
//   這台裝置以前有離線存檔：用原本的帳號密碼登入時，自動把舊存檔搬上雲端（同名帳號、只搬一次）
// - 網址加 ?offline：改回離線模式（存檔放這台裝置的 IndexedDB，src/0_offline/server.js）；清掉 localStorage ss_offline 恢復
// - 網址加 ?cloud=<網址>：本機測雲端（例：?cloud=http://localhost:8787）；清掉 localStorage ss_cloud 恢復
(() => {
  const CLOUD_URL = 'https://seal-survivors.linke-web.workers.dev';
  const h = location.hostname;
  const local = h === 'localhost' || h === '127.0.0.1' || /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(h);
  let force = false, cloudSet = null;
  try {
    if (/[?&]offline\b/.test(location.search)) localStorage.setItem('ss_offline', '1');
    const m = location.search.match(/[?&]cloud=([^&#]+)/); if (m) localStorage.setItem('ss_cloud', decodeURIComponent(m[1]));
    force = !!localStorage.getItem('ss_offline'); cloudSet = localStorage.getItem('ss_cloud');
  } catch {}
  const real = window.fetch.bind(window);
  if (local && !force && !cloudSet) {
    // 本機伺服器的帳號搬上雲端（11/20）：在本機登入成功 → 雲端沒有這個帳號 → 用同一組帳密在雲端建帳號並匯入角色（只搬一次；自動測試的瀏覽器不搬）
    if (navigator.webdriver) return;
    window.fetch = async (input, init = {}) => {
      const r = await real(input, init);
      try {
        const u = new URL(typeof input === 'string' ? input : input.url, location.href);
        if (!r.ok || (init.method || '').toUpperCase() !== 'POST' || !u.pathname.endsWith('/api/login')) return r;
        const cred = JSON.parse(init.body), flag = 'ss_cloud_moved_' + cred.username;
        if (localStorage.getItem(flag)) return r;
        const tok = (await r.clone().json()).token, J = { 'content-type': 'application/json' };
        const C = localStorage.getItem('ss_move_to') || 'https://seal-survivors.linke-web.workers.dev'; // ss_move_to：測試用
        const dump = await (await real('/api/export', { headers: { authorization: 'Bearer ' + tok } })).json();
        if (!dump.chars?.length) return r;
        // 雲端已有這個帳號（同密碼）：還沒角色才匯入（/api/import 有角色會拒絕）；沒有帳號：建一個
        let reg = await real(C + '/api/login', { method: 'POST', headers: J, body: init.body });
        if (!reg.ok) reg = await real(C + '/api/register', { method: 'POST', headers: J, body: init.body });
        if (!reg.ok) { console.warn('雲端已有同名帳號，沒有搬'); return r; }
        const ct = (await reg.json()).token;
        const im = await real(C + '/api/import', { method: 'POST', headers: { ...J, authorization: 'Bearer ' + ct }, body: JSON.stringify(dump) });
        if (im.ok || im.status === 409) { localStorage.setItem(flag, '1'); console.log(im.ok ? '已把這個帳號搬上雲端' : '雲端帳號已有角色，沒有搬'); } else console.warn('搬上雲端失敗', await im.text());
      } catch (e) { console.warn('搬上雲端失敗', e); }
      return r;
    };
    return;
  }
  const me = document.currentScript.src;
  let mod = null;
  const offline = async (method, path, hd, body) => { mod ??= import(new URL('server.js', me).href); return (await mod).handle(method, path, hd, body); };
  const parts = async (input, init) => {
    const u = new URL(typeof input === 'string' ? input : input.url, location.href);
    const i = u.pathname.indexOf('/api/');
    if (u.origin !== location.origin || i < 0) return null;
    const hd = {}; new Headers(init.headers || (typeof input === 'string' ? {} : input.headers)).forEach((v, k) => { hd[k] = v; });
    const body = typeof init.body === 'string' ? init.body : init.body ? await new Response(init.body).text() : '';
    return { method: (init.method || 'GET').toUpperCase(), path: u.pathname.slice(i) + u.search, hd, body };
  };
  if (force) {
    window.SS_OFFLINE = true;
    window.fetch = async (input, init = {}) => { const p = await parts(input, init); return p ? offline(p.method, p.path, p.hd, p.body) : real(input, init); };
    return;
  }
  const CLOUD = (cloudSet || CLOUD_URL).replace(/\/$/, '');
  window.SS_CLOUD = CLOUD;
  const cloud = (method, path, hd, body) => real(CLOUD + path, { method, headers: hd, body: method === 'GET' || method === 'HEAD' ? undefined : body });
  const json = (code, o) => new Response(JSON.stringify(o), { status: code, headers: { 'content-type': 'application/json; charset=utf-8' } });
  const hasOld = () => { try { return !!(localStorage.getItem('ss_db_idb_t') || localStorage.getItem('ss_db_backup')); } catch { return false; } };
  // 舊存檔搬家：雲端登入失敗＋這台裝置的離線存檔用同一組帳密登得進去 → 雲端建同名帳號 → 匯入
  async function migrate(p, cloudRes) {
    if (cloudRes.status !== 401 || !hasOld()) return cloudRes;
    let ot; try { const o = await offline('POST', '/api/login', { 'content-type': 'application/json' }, p.body); if (!o.ok) return cloudRes; ot = (await o.json()).token; } catch { return cloudRes; }
    const dump = await (await offline('GET', '/api/export', { authorization: 'Bearer ' + ot }, '')).text();
    const reg = await cloud('POST', '/api/register', { 'content-type': 'application/json' }, p.body);
    if (!reg.ok) return reg.status === 409 ? json(409, { error: '這個帳號名稱雲端已經有人用了。舊存檔還在這台裝置，網址加 ?offline 可以繼續玩' }) : reg;
    const r = await reg.json();
    const im = await cloud('POST', '/api/import', { 'content-type': 'application/json', authorization: 'Bearer ' + r.token }, dump);
    if (!im.ok) console.warn('舊存檔搬上雲端失敗', await im.text());
    else try { localStorage.setItem('ss_migrated', JSON.parse(p.body).username || '1'); } catch {}
    return json(200, r);
  }
  window.fetch = async (input, init = {}) => {
    const p = await parts(input, init); if (!p) return real(input, init);
    let r; try { r = await cloud(p.method, p.path, p.hd, p.body); } catch { return json(503, { error: '連不上伺服器，請檢查網路' }); }
    return p.method === 'POST' && p.path.startsWith('/api/login') ? migrate(p, r) : r;
  };
})();
