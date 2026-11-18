// 玩家：輸入（鍵盤＋拖曳搖桿）、XZ 移動、轉向、坐騎、受傷閃爍、磁吸經驗寶石
// 距離一律只算 XZ（不要用 3D 距離）
import * as THREE from 'three';
import { sealModel, sealActor, glowGear } from './seal-model.js';
import { GUP } from '../1_data/items.js';
import { OUTFITS, playerModelId, playerAnimSet, playerLook, MOUNT } from '../1_data/jobs.js';
import { view } from './camera.js';

// ===== 輸入 =====
// 電腦：WASD／方向鍵，或滑鼠左鍵點地面移動（按住可以一直跟著滑鼠走）
// 手機：按住畫面拖曳 = 浮動搖桿
// opts.camera＋opts.target()（玩家位置）有給才啟用滑鼠點擊移動
export function createInput(dom, joyEl, opts = {}) {
  const keys = {}; addEventListener('keydown', e => keys[e.code] = true); addEventListener('keyup', e => keys[e.code] = false);
  const joy = { on: false, ox: 0, oy: 0, dx: 0, dy: 0 };
  const click = { on: false, held: false, x: 0, z: 0, sx: 0, sy: 0 };
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  function aim(e) { // 螢幕座標 → 地面座標
    const r = dom.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    plane.constant = -(opts.groundY?.() || 0); // 點擊平面放在玩家腳下的地面高度
    ray.setFromCamera(ndc, opts.camera); if (ray.ray.intersectPlane(plane, hit)) { click.x = hit.x; click.z = hit.z; click.on = true; showMarker(); }
  }
  // 點擊位置的小光圈
  let marker = null;
  function showMarker() { if (!opts.scene) return; if (!marker) { marker = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.4, 24), new THREE.MeshBasicMaterial({ color: 0x9fe0ff, transparent: true, opacity: 0.9, depthWrite: false })); marker.rotation.x = -Math.PI / 2; opts.scene.add(marker); }
    marker.position.set(click.x, 0.06, click.z); marker.visible = true; }
  dom.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && opts.camera) { if (e.button !== 0) return; click.held = true; aim(e); return; }
    joy.on = true; joy.ox = e.clientX; joy.oy = e.clientY; joy.dx = joy.dy = 0; joyEl.style.left = e.clientX + 'px'; joyEl.style.top = e.clientY + 'px'; joyEl.style.display = 'block';
  });
  addEventListener('pointermove', e => {
    if (click.held && e.pointerType === 'mouse') { aim(e); return; }
    if (!joy.on) return; let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy; const d = Math.hypot(dx, dy), m = 45; if (d > m) { dx *= m / d; dy *= m / d; } joy.dx = dx / m; joy.dy = dy / m; joyEl.firstChild.style.transform = `translate(${dx}px,${dy}px)`;
  });
  const joyEnd = () => { click.held = false; joy.on = false; joy.dx = joy.dy = 0; joyEl.style.display = 'none'; joyEl.firstChild.style.transform = ''; };
  addEventListener('pointerup', joyEnd); addEventListener('pointercancel', joyEnd);
  const out = { mx: 0, mz: 0, ml: 0 };
  return {
    keys, joy, click,
    cancelClick() { click.on = false; if (marker) marker.visible = false; },
    read() {
      let mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joy.dx;
      let mz = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0) + joy.dy;
      // 鍵盤／搖桿方向跟著視角轉（右鍵轉過視角後，W 還是往畫面上方走）
      if (view.yaw) { const c = Math.cos(view.yaw), s = Math.sin(view.yaw), x = mx * c + mz * s; mz = -mx * s + mz * c; mx = x; }
      // 有按鍵盤或搖桿就取消點擊移動；否則朝點擊位置走，到了就停
      if (Math.hypot(mx, mz) > 0.05) this.cancelClick();
      else if (click.on && opts.target) { const p = opts.target(), dx = click.x - p.x, dz = click.z - p.z, d = Math.hypot(dx, dz);
        if (d < 0.35) this.cancelClick(); else { mx = dx / d; mz = dz / d; } }
      const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
      out.mx = mx; out.mz = mz; out.ml = Math.min(1, ml); return out;
    },
  };
}

// ===== 玩家角色 =====
// 先放膠囊，希望OL 原版模型載入好才換（失敗就留膠囊）；有租坐騎才載坐騎
export function createPlayer(scene, { CHAR, JOB, MOUNT_ON, onPortrait }) {
  const group = new THREE.Group();
  { const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 0.8, 4, 12), new THREE.MeshStandardMaterial({ color: OUTFITS[CHAR.outfit] ?? JOB.color, roughness: 0.5 }));
    body.position.y = 0.9; group.add(body);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.4, 8), new THREE.MeshStandardMaterial({ color: 0xffd36b }));
    nose.rotation.x = Math.PI / 2; nose.position.set(0, 1.2, 0.5); group.add(nose); }
  // 腳下的光圈（服裝顏色）
  { const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.7, 32), new THREE.MeshBasicMaterial({ color: OUTFITS[CHAR.outfit] ?? JOB.color, transparent: true, opacity: 0.8 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; group.add(ring); }
  scene.add(group);

  const rig = { group, actor: null, mounted: false, mountCd: 0, mountObj: null, riderLift: 0 };
  // 坐騎：上坐騎時人坐到坐騎背上
  const mountReady = MOUNT_ON ? sealModel(JOB.mount, 1.5).then(m => { m.children[0].rotation.y = Math.PI; m.visible = false; group.add(m); rig.mountObj = m; rig.riderLift = 0.85; }).catch(() => {}) : Promise.resolve();
  const LOOK = playerLook(CHAR.job, CHAR.gender, CHAR.hair ?? 0, CHAR.hairColor ?? 0, CHAR.outfit ?? 0, CHAR.items);
  const actorReady = sealActor(playerModelId(CHAR.job, CHAR.gender), playerAnimSet(CHAR.job, CHAR.gender), 1.7, LOOK.gear, LOOK.opts).then(m => {
    { const w = (CHAR.items || []).find(i => i.equipped && i.slot === 'weapon'); if (w?.gup) glowGear(m, GUP[w.gup].glow); } // 項目 46：G 化武器發光
    m.children[0].rotation.y = Math.PI; group.remove(group.children[0], group.children[1]); group.add(m); group.userData.model = m; rig.actor = m.userData.actor;
    // 頭像：用自己的模型拍一張大頭照（先 update 一次，不然貼圖／骨架還沒套上會拍成白的）
    try { rig.actor.update(0.016, false); const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); r.setSize(128, 128);
      const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 2)); sc.add(m); m.rotation.y = 0.35;  // 直接拍本體（clone 會丟掉骨架），拍完放回去
      const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50); cam.position.set(0, 1.45, 1.6); cam.lookAt(0, 1.35, 0); r.render(sc, cam);
      onPortrait?.(r.domElement.toDataURL()); r.dispose(); } catch {}
    m.rotation.y = 0; group.add(m);
  }).catch(e => console.warn('玩家模型', e.message));
  rig.mountReady = mountReady; rig.actorReady = actorReady;

  // 出招：播攻擊動作並轉向目標（face = 弧度，跟 P.face 同一套）
  // 轉身一律平滑轉到 rig.yaw（以前直接設角度，多招同時放、目標不同時角色會一直抽搐）
  // 移動中只面向移動方向；站著時出招才轉向目標，攻擊動作最快 0.9 秒播一次
  rig.yaw = 0; rig.moving = false; rig.swingCd = 0;
  rig.swing = (face, motion = null) => {
    if (!rig.actor || rig.moving) return;
    if (face != null && rig.swingCd <= 0) rig.yaw = -face + Math.PI / 2;
    if (rig.swingCd > 0 || (rig.actor.busy && rig.actor.current !== 'fid')) return; // 等待動作（伸懶腰）可以被攻擊打斷
    rig.swingCd = motion ? 1.1 : 0.9; rig.actor.attack(1.6, motion);
  };
  // 上下坐騎（冷卻中或沒租回傳 false）
  rig.setMounted = on => {
    if (!MOUNT_ON || rig.mountCd > 0) return false;
    rig.mounted = on; rig.mountCd = MOUNT.cd;
    if (rig.mountObj) rig.mountObj.visible = on;
    if (group.userData.model) group.userData.model.position.y = on ? rig.riderLift : 0;
    return true;
  };
  rig.resetMount = () => { rig.mounted = false; rig.mountCd = 0; if (rig.mountObj) rig.mountObj.visible = false; if (group.userData.model) group.userData.model.position.y = 0; };
  // XZ 移動＋面向移動方向＋站／跑動作；騎乘移速 +15%
  rig.move = (dt, inp, P) => {
    rig.mountCd -= dt; const spd = P.speed * (rig.mounted ? 1 + MOUNT.speed : 1) * (P.tmp?.speed > 0 ? 1.2 : 1) * (P.tmp?.dash > 0 ? 1.6 : 1); // 項目 37 祝福、54 衝鋒加速
    rig.moving = inp.ml > 0.05; rig.swingCd -= dt;
    if (rig.moving) { const nx = group.position.x + inp.mx * spd * dt, nz = group.position.z + inp.mz * spd * dt;
      if (rig.walk) rig.walk(group.position, nx, nz); else { group.position.x = nx; group.position.z = nz; } P.face = Math.atan2(inp.mz, inp.mx); rig.yaw = -P.face + Math.PI / 2; }
    let d = rig.yaw - group.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); // 最短角度
    group.rotation.y += Math.max(-12 * dt, Math.min(12 * dt, d * Math.min(1, dt * 14))); // 最快每秒轉 12 弧度
    rig.actor?.update(dt, rig.moving);
  };
  // 受傷無敵期間閃爍
  rig.blink = P => { const m = group.userData.model; if (m) m.visible = !(P.inv > 0 && Math.floor(P.inv * 20) % 2); };
  return rig;
}

// 磁吸經驗寶石：進入 P.magnet 範圍就飛過來，碰到（< 0.6）呼叫 collect(g)
export function magnetGems(gems, pp, P, dt, collect) {
  for (let i = gems.length - 1; i >= 0; i--) {
    const g = gems[i], p = g.mesh.position; g.mesh.rotation.y += dt * 3;
    const d = Math.hypot(pp.x - p.x, pp.z - p.z);
    if (d < P.magnet) g.pull = true;
    if (g.pull) { const s = Math.min(1, dt * 14 / Math.max(d, 0.1)); p.x += (pp.x - p.x) * s * 1.5; p.z += (pp.z - p.z) * s * 1.5; }
    if (d < 0.6) { gems.splice(i, 1); collect(g); }
  }
}
