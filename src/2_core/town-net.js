// 主城看得到其他玩家（11/20 使用者：「上線還看不到對方」）；只有雲端版（window.SS_CLOUD）
// 有動才送位置（每秒最多 4 次）；分頁切到背景、或 5 分鐘沒動作 → 斷線（每個網站閒置就休息），一動或切回來就重連
import { sealActor } from './seal-model.js';
import { playerModelId, playerAnimSet, playerLook } from '../1_data/jobs.js';

export function createTownNet({ THREE, scene, camera, player, CHAR, token, groundAt, modelY = groundAt, moving, riding }) { // modelY：主城畫面會整個抬到地面高度（liftScene），模型放 0
  if (!window.SS_CLOUD || !CHAR?.id || !token) return null;
  const others = new Map(), box = document.createElement('div');
  box.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:3'; document.body.appendChild(box);
  let ws = null, want = true, lastAct = performance.now(), sendAcc = 0, lastSent = '', tries = 0;
  const IDLE = 5 * 60e3;
  function add(m, p) {
    if (m.charId === CHAR.id || others.has(m.charId)) return;
    const o = { m, x: p?.x ?? 0, z: p?.z ?? 0, tx: p?.x ?? 0, tz: p?.z ?? 0, ry: p?.ry ?? 0, mv: 0, seen: !!p, g: null, el: document.createElement('div') };
    o.el.className = 'town-tag'; o.el.textContent = m.name; box.appendChild(o.el); others.set(m.charId, o);
    const L = playerLook(m.job, m.gender, m.hair ?? 0, m.hairColor ?? 0, m.outfit ?? 0, m.items || [], m.costume || null);
    sealActor(playerModelId(m.job, m.gender), playerAnimSet(m.job, m.gender), 1.7, L.gear, L.opts).then(g => { if (!others.has(m.charId)) return; g.children[0].rotation.y = Math.PI; g.position.set(o.x, 0, o.z); scene.add(g); o.g = g; }).catch(() => {});
  }
  function remove(id) { const o = others.get(id); if (!o) return; o.g && scene.remove(o.g); o.el.remove(); others.delete(id); }
  function clearAll() { for (const id of [...others.keys()]) remove(id); }
  function connect() {
    if (ws || !want || document.hidden) return;
    ws = new WebSocket(`${window.SS_CLOUD.replace(/^http/, 'ws')}/town?token=${encodeURIComponent(token)}&charId=${CHAR.id}`);
    ws.onopen = () => { tries = 0; lastSent = ''; sendPos(true); };
    ws.onmessage = e => { let o; try { o = JSON.parse(e.data); } catch { return; }
      if (o.t === 'all') for (const x of o.list) add(x.m, x.p);
      else if (o.t === 'join') add(o.m, null);
      else if (o.t === 'leave') remove(o.id);
      else if (o.t === 'p') { const r = others.get(o.id); if (!r) return; r.tx = o.x; r.tz = o.z; r.ry = o.ry; r.mv = o.mv; if (!r.seen) { r.x = o.x; r.z = o.z; r.seen = true; } } };
    ws.onclose = e => { ws = null; clearAll(); if (want && !document.hidden && e.code !== 4001 && tries++ < 6) setTimeout(connect, 1500 * tries); };
  }
  function drop() { want = false; try { ws?.close(1000); } catch {} ws = null; clearAll(); }
  function sendPos(force) {
    if (ws?.readyState !== 1) return; const p = player.position;
    const o = { t: 'p', x: +p.x.toFixed(2), z: +p.z.toFixed(2), ry: +player.rotation.y.toFixed(2), mv: moving() ? 1 : 0, rd: riding?.() ? 1 : 0 }, k = JSON.stringify(o);
    if (force || k !== lastSent) { ws.send(k); lastSent = k; }
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) { drop(); } else { want = true; lastAct = performance.now(); connect(); } });
  connect();
  return {
    get count() { return others.size; },
    tick(dt) {
      const now = performance.now(), mv = moving();
      if (mv) { lastAct = now; if (!want) { want = true; connect(); } }
      else if (want && now - lastAct > IDLE) drop(); // 5 分鐘沒動作就離線，一動就回來
      if ((sendAcc += dt) >= 0.25) { sendAcc = 0; sendPos(false); }
      for (const o of others.values()) {
        o.x += (o.tx - o.x) * Math.min(1, dt * 8); o.z += (o.tz - o.z) * Math.min(1, dt * 8);
        if (!o.g) continue; o.g.visible = o.seen; o.g.position.set(o.x, modelY(o.x, o.z), o.z);
        let d = o.ry - o.g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); o.g.rotation.y += d * Math.min(1, dt * 10);
        o.g.userData.actor?.update(dt, !!o.mv);
      }
    },
    render() {
      const v = this._v ??= new THREE.Vector3(), W = innerWidth, H = innerHeight;
      for (const o of others.values()) { v.set(o.x, groundAt(o.x, o.z) + 2.1, o.z).project(camera); const vis = o.seen && v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
        o.el.style.display = vis ? 'block' : 'none'; if (vis) o.el.style.transform = `translate(${(v.x + 1) / 2 * W}px,${(1 - v.y) / 2 * H}px) translate(-50%,-100%)`; }
    },
  };
}
