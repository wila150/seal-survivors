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
  const rel = () => { on = false; for (const k in keys) keys[k] = false; }; addEventListener('blur', rel); document.addEventListener('visibilitychange', () => document.hidden && rel()); // 切出視窗不會一直轉
  let last = performance.now();
  (function spin(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; if (keys.KeyQ) view.yaw += dt * 2; if (keys.KeyE) view.yaw -= dt * 2; requestAnimationFrame(spin); })(last);
  return () => on; // 是否正在轉視角
}

// fx.shake：震動強度，每幀遞減；groundY＝玩家腳下地面高度（原版地圖有起伏）
const cam = { h: null, back: null, look: 0 }; // 11/20 切換視角改成平滑過渡（約 0.4 秒），不再瞬間跳
export function followCamera(camera, pp, fx, groundY = 0) {
  const portrait = innerHeight > innerWidth, V = VIEWS[view.i], z = view.zoom;
  const th = (portrait && view.i === 0 ? 30 : V.h) * z, tb = (portrait && view.i === 0 ? 12 : V.back) * z, tl = view.i === 2 ? 1.2 : 0;
  const now = performance.now(), dt = Math.min(0.1, (now - (cam.t || now)) / 1000); cam.t = now; const k = cam.h == null ? 1 : 1 - Math.exp(-dt * 8);
  cam.h = cam.h == null ? th : cam.h + (th - cam.h) * k; cam.back = cam.back == null ? tb : cam.back + (tb - cam.back) * k; cam.look += (tl - cam.look) * k;
  const h = cam.h, back = cam.back;
  const sy = Math.sin(view.yaw), cy = Math.cos(view.yaw), hp = h * view.pitch;
  camera.position.set(pp.x + sy * back, groundY + hp, pp.z + cy * back); camera.lookAt(pp.x - sy * (portrait ? 1 : 0), groundY + cam.look, pp.z - cy * (portrait ? 1 : 0));
  if (fx.shake > 0) { const k = fx.shake * 0.6; camera.position.x += (Math.random() - 0.5) * k; camera.position.y += (Math.random() - 0.5) * k; fx.shake = Math.max(0, fx.shake - 0.03); }
}
