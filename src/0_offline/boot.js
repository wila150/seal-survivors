// 離線模式開關：不是在本機 Node 伺服器（localhost／區網 IP）上開的時候（例如 GitHub Pages），
// 把所有 /api/ 請求改成在瀏覽器裡跑（src/0_offline/server.js），存檔放這台裝置的 IndexedDB。
// 一般 <script>（不是 module），要放在每個頁面所有 module 前面，才能搶先換掉 fetch。
(() => {
  const h = location.hostname;
  const local = h === 'localhost' || h === '127.0.0.1' || /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(h);
  let force = false; try { if (/[?&]offline\b/.test(location.search)) localStorage.setItem('ss_offline', '1'); force = !!localStorage.getItem('ss_offline'); } catch {}
  if (local && !force) return; // 本機測離線版：網址加 ?offline（之後同一個瀏覽器都走離線；清掉 localStorage ss_offline 恢復）
  window.SS_OFFLINE = true;
  const real = window.fetch.bind(window);
  const me = document.currentScript.src;
  let mod = null;
  window.fetch = async (input, init = {}) => {
    const u = new URL(typeof input === 'string' ? input : input.url, location.href);
    const i = u.pathname.indexOf('/api/');
    if (u.origin !== location.origin || i < 0) return real(input, init);
    mod ??= import(new URL('server.js', me).href);
    const { handle } = await mod;
    const hd = {}; new Headers(init.headers || (typeof input === 'string' ? {} : input.headers)).forEach((v, k) => { hd[k] = v; });
    const body = typeof init.body === 'string' ? init.body : init.body ? await new Response(init.body).text() : '';
    return handle((init.method || 'GET').toUpperCase(), u.pathname.slice(i) + u.search, hd, body);
  };
})();
