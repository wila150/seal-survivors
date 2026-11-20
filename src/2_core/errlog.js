// 前端錯誤回報（11/20 使用者：「做一個偵測 bug 的系統或推給維運監控幫我顧著」）
// 玩家畫面上發生的 JS 錯誤、Promise 沒接住的錯誤、console.error(Error)、檔案載入失敗 → POST /api/clientlog（伺服器去重複後存起來）
// 維運監控（Windows 工作排程 Bigzhuang Ops Monitor → seal_check.py）每 2 小時來拿新的錯誤，有新的就推 LINE
// 隱私：不送帳號、角色、token；網址的 ?… 全部拿掉；只送「手機／電腦＋瀏覽器」
// 離線模式（?offline，存檔在瀏覽器）不回報；同一頁同一個錯誤只送一次、一頁最多 8 筆
(function () {
  if (window.__errlog) return; window.__errlog = 1;
  var sent = 0, seen = {};
  var NOISE = /ResizeObserver loop|^Script error\.?$|extension:\/\/|Non-Error promise rejection captured|AbortError|The play\(\) request was interrupted|NotAllowedError/;
  var clean = function (s) { return String(s || '').replace(/\?[^\s)'"]*/g, '').replace(/https?:\/\/[^/\s]+\//g, '/'); };
  var ua = function () { var u = navigator.userAgent; return (/iPhone|iPad|iPod/.test(u) ? 'iOS' : /Android/.test(u) ? 'Android' : 'PC') + ' ' + (/Edg\//.test(u) ? 'Edge' : /CriOS|Chrome\//.test(u) ? 'Chrome' : /FxiOS|Firefox\//.test(u) ? 'Firefox' : /Safari\//.test(u) ? 'Safari' : '其他'); };
  function send(kind, msg, src, line, stack) {
    if (window.SS_OFFLINE) return;
    msg = String(msg || '').slice(0, 300); if (!msg || NOISE.test(msg)) return;
    src = clean(src).slice(0, 160); var key = kind + msg + src + (line || 0);
    if (seen[key] || sent >= 8) return; seen[key] = 1; sent++;
    var body = { kind: kind, msg: msg, src: src, line: line || 0, stack: clean(String(stack || '').split('\n').slice(0, 5).join('\n')).slice(0, 800), page: (location.pathname.split('/').pop() || 'index.html').slice(0, 40), ua: ua() };
    setTimeout(function () { try { fetch('/api/clientlog', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), keepalive: true }).catch(function () {}); } catch (e) {} }, 0);
  }
  addEventListener('error', function (e) {
    var t = e.target;
    if (t && t !== window && (t.src || t.href)) { if (/\.(js|css|glb|json)(\?|$)/.test(t.src || t.href || '')) send('load', '檔案載入失敗', t.src || t.href, 0, ''); return; } // 圖片缺圖太多太吵，只報程式／資料檔
    send('js', e.message, e.filename, e.lineno, e.error && e.error.stack);
  }, true);
  addEventListener('unhandledrejection', function (e) { var r = e.reason; send('promise', (r && r.message) || String(r), '', 0, r && r.stack); });
  var ce = console.error; console.error = function () { try { for (var i = 0; i < arguments.length; i++) { var a = arguments[i]; if (a instanceof Error) { send('console', a.message, '', 0, a.stack); break; } } } catch (x) {} return ce.apply(console, arguments); };
  window.reportBug = function (msg, extra) { send('app', msg, '', 0, extra || ''); }; // 遊戲裡自己偵測到不對勁可以呼叫
})();
