// 執行時看門狗（企劃_工程交付.md 第三章 2）
// 網址加 ?debug=1 才顯示面板；沒加也會把問題寫進 console（【看門狗】開頭）
//   掉幀：連續 3 秒 < 45 fps → 警告（附怪物數、特效數、draw calls）
//   物件洩漏：每 10 秒記錄 scene.children 與各物件池使用量，連續 3 次只增不減 → 警告是哪一類
//   穿模／跑出地圖：座標 NaN、y < −1、玩家出主城邊界 → 錯誤並拉回
//   模型載入失敗：seal-model.js 發出的 seal-model-error 事件 → 錯誤（顯示模型名）
//   動作卡住：玩家在移動但動作不是 rn 超過 1 秒 → 警告
//
// opts：{ page, renderer, scene,
//   active()      → 這一幀要不要檢查（例如 state === 'play'）
//   counts()      → { 怪物, 特效 }（掉幀時附上）
//   pools()       → { 名稱: 使用量 }（洩漏檢查）
//   player, home  → 玩家 Object3D、拉回的位置 {x, z}
//   bounds        → { minX, maxX, minZ, maxZ }（主城邊界，可省略）
//   enemies()     → [{ mesh, ai }]（座標檢查；首領鑽地登場時 y < 0 不算）
//   actor(), moving() → 玩家動作（有 current、busy）、是否正在移動 }
export function createWatchdog(opts) {
  const debug = /[?&]debug=1\b/.test(location.search);
  const log = [], lastMsg = new Map();
  const issue = (level, cat, msg) => {
    const key = cat + msg, now = performance.now();
    if (now - (lastMsg.get(key) || -1e9) < 5000) return; // 同一件事 5 秒內只報一次
    lastMsg.set(key, now);
    (level === 'error' ? console.error : console.warn)(`【看門狗】[${cat}] ${msg}`);
    log.unshift({ level, cat, msg, at: new Date().toLocaleTimeString() }); log.length = Math.min(log.length, 30);
    dirty = true;
  };

  // 模型載入失敗
  addEventListener('seal-model-error', e => issue('error', '模型載入失敗', `${e.detail.name}：${e.detail.message}`));

  // 面板
  let panel = null, dirty = true, fpsNow = 0;
  if (debug) {
    panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:9999;max-width:min(420px,calc(100vw - 16px));max-height:40vh;overflow:auto;background:#000c;color:#dfe;font:12px/1.45 monospace;padding:8px 10px;border-radius:8px;pointer-events:auto';
    document.body.appendChild(panel);
  }
  const esc = s => String(s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  function draw() {
    if (!panel) return;
    const c = opts.counts?.() || {}, p = opts.pools?.() || {};
    panel.innerHTML = `<b>看門狗・${esc(opts.page || '')}</b>　${fpsNow} fps　draw ${opts.renderer.info.render.calls}　物件 ${opts.scene.children.length}<br>`
      + Object.entries({ ...c, ...p }).map(([k, v]) => `${esc(k)} ${v}`).join('　')
      + (log.length ? '<hr style="border-color:#fff3">' + log.map(l => `<div style="color:${l.level === 'error' ? '#ff8a8a' : '#ffd36b'}">${l.at} [${esc(l.cat)}] ${esc(l.msg)}</div>`).join('') : '<div style="color:#8f8">目前沒有問題</div>');
  }

  // 掉幀
  let frames = 0, winStart = performance.now(), lastFrame = winStart, lowSecs = 0;
  // 洩漏
  let leakT = 0; const hist = []; // 每 10 秒一筆 { 名稱: 數量 }
  // 動作卡住
  let stuckT = 0;
  let drawT = 0;

  const bad = v => !Number.isFinite(v);
  function checkPos(obj, name, home, rising) {
    const p = obj.position;
    if (bad(p.x) || bad(p.y) || bad(p.z)) { issue('error', '座標異常', `${name} 座標變成 NaN，已拉回`); p.set(home.x, 0, home.z); return; }
    if (p.y < -1 && !rising) { issue('error', '穿模', `${name} 掉到地面下（y = ${p.y.toFixed(2)}），已拉回`); p.y = 0; }
  }

  return {
    log,
    tick(dt) {
      const now = performance.now();
      // ---- 掉幀（每秒結算一次；切背景回來的長空檔不算）----
      // 切背景回來（兩幀間隔 > 1.5 秒）重新計算
      if (now - lastFrame > 1500) { frames = 0; winStart = now; }
      lastFrame = now; frames++;
      const span = now - winStart;
      if (span >= 1000) {
        fpsNow = Math.round(frames * 1000 / span); frames = 0; winStart = now; dirty = true;
        if (opts.active?.() !== false && fpsNow < 45) {
          if (++lowSecs >= 3) {
            const c = opts.counts?.() || {};
            issue('warn', '掉幀', `連續 3 秒低於 45 fps（現在 ${fpsNow}）　${Object.entries(c).map(([k, v]) => `${k} ${v}`).join('、')}、draw calls ${opts.renderer.info.render.calls}`);
            lowSecs = 0;
          }
        } else lowSecs = 0;
      }
      if (opts.active?.() === false) { stuckT = 0; if (panel && (drawT -= dt) <= 0) { drawT = 0.5; draw(); } return; }

      // ---- 物件洩漏（每 10 秒）----
      if ((leakT += dt) >= 10) {
        leakT = 0;
        hist.push({ 場景物件: opts.scene.children.length, ...(opts.pools?.() || {}) }); if (hist.length > 4) hist.shift();
        if (hist.length === 4) for (const k of Object.keys(hist[3])) {
          if (hist[1][k] > hist[0][k] && hist[2][k] > hist[1][k] && hist[3][k] > hist[2][k])
            issue('warn', '物件洩漏', `${k} 連續 3 次只增不減：${hist.map(h => h[k]).join(' → ')}`);
        }
      }

      // ---- 穿模／跑出地圖 ----
      const home = opts.home || { x: 0, z: 0 };
      if (opts.player) {
        checkPos(opts.player, '玩家', home, false);
        const b = opts.bounds, p = opts.player.position;
        if (b && (p.x < b.minX - 0.5 || p.x > b.maxX + 0.5 || p.z < b.minZ - 0.5 || p.z > b.maxZ + 0.5)) {
          issue('error', '跑出地圖', `玩家跑出主城邊界（${p.x.toFixed(1)}, ${p.z.toFixed(1)}），已拉回`);
          p.x = Math.max(b.minX, Math.min(b.maxX, p.x)); p.z = Math.max(b.minZ, Math.min(b.maxZ, p.z));
        }
      }
      const pp = opts.player?.position || home;
      for (const e of opts.enemies?.() || []) checkPos(e.mesh, `怪物 ${e.type || ''}`, pp, e.ai?.st === 'rise');

      // ---- 動作卡住 ----
      const a = opts.actor?.();
      if (a && opts.moving?.() && !a.busy && a.current !== 'rn') {
        if ((stuckT += dt) > 1) { issue('warn', '動作卡住', `玩家在移動，但動作是「${a.current || '無'}」不是 rn，已超過 1 秒`); stuckT = 0; }
      } else stuckT = 0;

      if (panel && ((drawT -= dt) <= 0 || dirty)) { drawT = 0.5; dirty = false; draw(); }
    },
  };
}
