// 攝影機：45 度斜角俯視追蹤玩家（出征依直／橫螢幕調整），首領登場震動
import * as THREE from 'three';

export function createCamera() { return new THREE.PerspectiveCamera(45, 1, 0.1, 140); } // 霧在 110 公尺全遮 → 140 以外不畫（項目 7）

export function fitCamera(camera, w, h) { camera.aspect = w / h; camera.updateProjectionMatrix(); }

// 視角：V 鍵或按鈕切換（斜角 → 遠景 → 3D 低角度），滑鼠滾輪縮放
export const VIEWS = [{ name: '斜角', h: 20, back: 13 }, { name: '遠景', h: 32, back: 10 }, { name: '3D', h: 7.5, back: 13 }];
export const view = { i: 0, zoom: 1, yaw: 0, pitch: 1 }; // pitch：鏡頭高度倍率（右鍵上下拖）
export function cycleView() { view.i = (view.i + 1) % VIEWS.length; try { localStorage.setItem('ss_view', view.i); } catch {} return VIEWS[view.i].name; }
try { view.i = +(localStorage.getItem('ss_view') || 0) % VIEWS.length; } catch {}
addEventListener('wheel', e => { view.zoom = Math.min(1.8, Math.max(0.5, view.zoom * (e.deltaY > 0 ? 1.08 : 0.93))); }, { passive: true });
// 滑鼠右鍵按住拖曳＝轉視角（左鍵是移動）
// 右鍵（或中鍵）按住：左右拖＝轉向、上下拖＝俯角；Q／E 鍵也能轉。用 mouse 事件＋window 監聽，游標拖出畫面或放在介面上也不會斷
export function enableOrbit(dom) {
  let on = false, lx = 0, ly = 0;
  addEventListener('contextmenu', e => { if (e.target === dom || on) e.preventDefault(); });
  dom.addEventListener('mousedown', e => { if (e.button === 2 || e.button === 1) { on = true; lx = e.clientX; ly = e.clientY; e.preventDefault(); } });
  addEventListener('mousemove', e => { if (!on) return; if (!(e.buttons & 6)) { on = false; return; }
    view.yaw -= (e.clientX - lx) * 0.008; view.pitch = Math.min(1.7, Math.max(0.35, view.pitch - (e.clientY - ly) * 0.004)); lx = e.clientX; ly = e.clientY; });
  addEventListener('mouseup', e => { if (e.button === 2 || e.button === 1) on = false; });
  const keys = {}; addEventListener('keydown', e => { if (e.target.closest?.('input,textarea')) return; keys[e.code] = true; }); addEventListener('keyup', e => keys[e.code] = false);
  let last = performance.now();
  (function spin(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; if (keys.KeyQ) view.yaw += dt * 2; if (keys.KeyE) view.yaw -= dt * 2; requestAnimationFrame(spin); })(last);
  return () => on; // 是否正在轉視角
}

// fx.shake：震動強度，每幀遞減；groundY＝玩家腳下地面高度（原版地圖有起伏）
export function followCamera(camera, pp, fx, groundY = 0) {
  const portrait = innerHeight > innerWidth, V = VIEWS[view.i], z = view.zoom;
  const h = (portrait && view.i === 0 ? 30 : V.h) * z, back = (portrait && view.i === 0 ? 12 : V.back) * z;
  const sy = Math.sin(view.yaw), cy = Math.cos(view.yaw), hp = h * view.pitch;
  camera.position.set(pp.x + sy * back, groundY + hp, pp.z + cy * back); camera.lookAt(pp.x - sy * (portrait ? 1 : 0), groundY + (view.i === 2 ? 1.2 : 0), pp.z - cy * (portrait ? 1 : 0));
  if (fx.shake > 0) { const k = fx.shake * 0.6; camera.position.x += (Math.random() - 0.5) * k; camera.position.y += (Math.random() - 0.5) * k; fx.shake = Math.max(0, fx.shake - 0.03); }
}
