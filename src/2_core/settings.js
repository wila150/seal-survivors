// 設定頁（企劃_工程交付 項目 12）：音量／顯示／畫質／操作，存 localStorage 'ss_settings'
// 出征（暫停選單）和主城都用同一份：openSettings() 顯示面板，getSettings() 讀值，onSettings(fn) 監聽變更
import { CREDITS_HTML } from '../1_data/credits.js';
const KEY = 'ss_settings';
// 手機（觸控）預設畫質「中」＝解析度倍率 1（高畫質在手機是 2～3 倍像素，11/19 使用者回報手機超卡）
export const TOUCH = typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches;
const DEF = { master: 1, bgm: 0.7, sfx: 0.8, nums: true, meter: true, shake: true, hud: 1, quality: TOUCH ? 'mid' : 'high', autoPick: false };
let S = { ...DEF };
try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch {}
// 舊版暫停選單的兩個開關（ss_opts）接過來
try { const o = JSON.parse(localStorage.getItem('ss_opts') || 'null'); if (o) { if ('nums' in o) S.nums = o.nums; if ('meter' in o) S.meter = o.meter; } } catch {}
const subs = new Set();
export const getSettings = () => S;
export function onSettings(fn) { subs.add(fn); fn(S); return () => subs.delete(fn); }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} for (const f of subs) f(S); }
export function resetSettings() { S = { ...DEF }; save(); }

// 介面大小：把指定的 HUD 元素一起縮放（不縮放 3D 畫布，避免點擊位置跑掉）
export function applyHud(ids) { for (const id of ids) { const el = document.getElementById(id); if (el) el.style.zoom = S.hud; } }
// 畫質 → 解析度倍率
export const pixelRatio = () => S.quality === 'low' ? 0.75 : S.quality === 'mid' ? 1 : Math.min(devicePixelRatio, 2);

const KEYS = [
  ['WASD／方向鍵', '移動'], ['滑鼠左鍵（按住）', '點地面移動（出征）'], ['手機拖曳畫面', '浮動搖桿'], ['V', '切換視角（出征）'], ['滑鼠滾輪', '鏡頭縮放（出征）'],
  ['R', '上／下坐騎'], ['1～3', '升級時選卡片'], ['Esc', '暫停／關閉視窗'], ['空白鍵／Enter', '跟 NPC 交談（主城）'], ['I', '背包（主城）'],
];
const CSS = `
#ssSet{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;background:#0008;padding:16px;font-family:system-ui,"Noto Sans TC",sans-serif}
#ssSet .box{width:min(460px,96vw);max-height:90vh;display:flex;flex-direction:column;background:#eef2fb;color:#26324d;border:2px solid #9db4ee;border-radius:14px;overflow:hidden;box-shadow:0 10px 40px #0006}
#ssSet header{background:linear-gradient(#6f8fd8,#4565b8);color:#fff;font-weight:800;padding:10px 16px}
#ssSet .tabs{display:flex;gap:6px;padding:10px 12px 0;flex-wrap:wrap}
#ssSet .tabs button{font:inherit;font-size:13px;font-weight:700;padding:6px 14px;border-radius:999px;border:1px solid #b8c6e8;background:#fff;color:#3a5bbf;cursor:pointer}
#ssSet .tabs button.on{background:#3a5bbf;color:#fff;border-color:#3a5bbf}
#ssSet .body{padding:12px;overflow:auto;display:flex;flex-direction:column;gap:8px}
#ssSet .row{display:flex;align-items:center;justify-content:space-between;gap:10px;background:#fff;border:1px solid #d5ddf0;border-radius:10px;padding:8px 10px;font-size:14px}
#ssSet .row small{display:block;color:#6b7896;font-size:12px}
#ssSet input[type=range]{width:150px}
#ssSet .seg{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}
#ssSet .seg button{font:inherit;font-size:12px;padding:4px 8px;border-radius:8px;border:1px solid #b8c6e8;background:#f6f8fd;cursor:pointer;color:#26324d}
#ssSet .seg button.on{background:#3a5bbf;color:#fff;border-color:#3a5bbf}
#ssSet table{width:100%;border-collapse:collapse;font-size:13px;background:#fff;border-radius:10px;overflow:hidden}
#ssSet td{padding:6px 10px;border-bottom:1px solid #eef2fb}#ssSet td:first-child{font-weight:700;color:#3a5bbf;white-space:nowrap}
#ssSet footer{display:flex;gap:8px;justify-content:space-between;padding:10px 12px;border-top:1px solid #d5ddf0}
#ssSet footer button{font:inherit;font-weight:700;font-size:14px;padding:8px 14px;border-radius:10px;border:1px solid #b8c6e8;background:#fff;color:#26324d;cursor:pointer}
#ssSet footer .primary{background:linear-gradient(#5b7fe0,#3a5bbf);color:#fff;border-color:#2c4aa0}`;

let tab = 0;
export function openSettings(onClose) {
  if (!document.getElementById('ssSetCss')) { const st = document.createElement('style'); st.id = 'ssSetCss'; st.textContent = CSS; document.head.appendChild(st); }
  let el = document.getElementById('ssSet'); if (el) el.remove();
  el = document.createElement('div'); el.id = 'ssSet'; document.body.appendChild(el);
  const pct = v => Math.round(v * 100) + '%';
  const slider = (k, name, desc) => `<div class="row"><span>${name}<small>${desc}</small></span><span><input type="range" min="0" max="1" step="0.05" value="${S[k]}" data-k="${k}"> <b data-v="${k}">${pct(S[k])}</b></span></div>`;
  const toggle = (k, name, desc) => `<label class="row"><span>${name}<small>${desc}</small></span><input type="checkbox" data-t="${k}" ${S[k] ? 'checked' : ''}></label>`;
  const seg = (k, name, desc, opts) => `<div class="row"><span>${name}<small>${desc}</small></span><span class="seg">${opts.map(([v, l]) => `<button type="button" data-s="${k}" data-val="${v}" class="${S[k] == v ? 'on' : ''}">${l}</button>`).join('')}</span></div>`;
  const pages = [
    () => slider('master', '總音量', '所有聲音') + slider('bgm', '背景音樂', '主城與出征的音樂') + slider('sfx', '音效', '打擊、技能、撿東西'),
    () => toggle('nums', '傷害數字', '怪物頭上跳出傷害數字') + toggle('meter', '傷害統計', '右上角顯示每個技能打了多少') + toggle('shake', '畫面震動', '首領登場、大招時鏡頭震動') + toggle('autoPick', '升級自動選卡', '不跳卡片，自動選（超武 > 已有技能升級 > 新技能 > 被動）')
      + seg('hud', '介面大小', '血條、技能列、小地圖等', [[0.8, '80%'], [0.9, '90%'], [1, '100%'], [1.15, '115%'], [1.35, '135%'], [1.55, '155%']]),
    () => seg('quality', '畫質', '解析度；手機或電腦卡頓時調低', [['high', '高'], ['mid', '中'], ['low', '低']]),
    () => `<table>${KEYS.map(([k, d]) => `<tr><td>${k}</td><td>${d}</td></tr>`).join('')}</table>`,
    () => CREDITS_HTML, // 項目 43
  ];
  const draw = () => {
    el.innerHTML = `<div class="box"><header>◆ 設定</header><div class="tabs">${['音量', '顯示', '畫質', '操作', '製作名單'].map((n, i) => `<button type="button" data-tab="${i}" class="${i === tab ? 'on' : ''}">${n}</button>`).join('')}</div>
      <div class="body">${pages[tab]()}</div><footer><button type="button" id="ssReset">恢復預設</button><button type="button" class="primary" id="ssClose">完成</button></footer></div>`;
    el.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = +b.dataset.tab; draw(); });
    el.querySelectorAll('input[type=range]').forEach(r => r.oninput = () => { S[r.dataset.k] = +r.value; el.querySelector(`[data-v="${r.dataset.k}"]`).textContent = pct(+r.value); save(); });
    el.querySelectorAll('[data-t]').forEach(c => c.onchange = () => { S[c.dataset.t] = c.checked; save(); });
    el.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { const v = b.dataset.val; S[b.dataset.s] = isNaN(+v) ? v : +v; save(); draw(); });
    el.querySelector('#ssReset').onclick = () => { resetSettings(); draw(); };
    el.querySelector('#ssClose').onclick = close;
  };
  const close = () => { el.remove(); removeEventListener('keydown', esc, true); onClose?.(); };
  const esc = e => { if (e.code === 'Escape') { e.stopPropagation(); close(); } };
  addEventListener('keydown', esc, true);
  el.addEventListener('pointerdown', e => { if (e.target === el) close(); });
  draw();
}
