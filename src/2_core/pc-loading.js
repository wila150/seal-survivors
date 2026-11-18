// PC 原版風格載入畫面（11/19 使用者：「載入的畫面也跟 PC 一樣」）
// 原版：黑底＋地圖載入插畫（interface/*_load.tex → assets/load）＋上方 TIP 框＋下方黃色進度條（interface/loading_map.tex → assets/ui/pc/loading_map.png）
// 用法：const L = pcLoading({ img, title }); L.set(0～100, '文字'); L.done();
const TIPS = [
  '每升一級可以從三張卡片選一個技能或強化，同一招最多升到 Lv5。',
  '兩招都升到 Lv5 會出現「融合」卡片，合成更強的超武。',
  '連擊每滿 50 下會放出職業無雙，對周圍造成大範圍傷害。',
  '首領寶箱一定會出裝備；難度越高，寶箱裝備品質越好。',
  '回主城找圖書館員可以看新手指南；百業宗師可以轉職。',
  '怪物有屬性，帶相剋屬性的寶石傷害更高。',
  '撿經驗寶石會升級；磁鐵道具可以一次吸光整個畫面的寶石。',
  '精煉等級越高越容易失敗，重要的裝備要想清楚再精煉。',
];
let css = false;
function style() {
  if (css) return; css = true;
  const s = document.createElement('style');
  s.textContent = `
  .pcload{position:fixed;inset:0;z-index:999;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:min(2vh,14px);transition:opacity .4s;font-family:inherit}
  .pcload .tip{width:min(92vw,560px);box-sizing:border-box;background:#0d0d0dcc;border:1px solid #333;border-radius:10px;padding:10px 14px 12px;color:#e8e8e8;font-size:13px;line-height:1.5;min-height:64px}
  .pcload .tip b{display:block;color:#ffcf4a;font-size:16px;letter-spacing:1px;text-shadow:0 1px 0 #7a4b00,0 0 6px #ff9d0066;margin-bottom:2px}
  .pcload .art{width:min(92vw,62vh,560px);aspect-ratio:1;background:center/contain no-repeat}
  .pcload .msg{color:#cfe3ff;font-size:13px;width:min(92vw,560px);text-align:left}
  .pcload .gauge{position:relative;width:min(92vw,560px);aspect-ratio:382/28;background:url(assets/ui/pc/loading_map.png) no-repeat;background-size:calc(512px * var(--k)) auto;background-position:calc(-60px * var(--k)) calc(-436px * var(--k))}
  .pcload .gauge i{position:absolute;left:0.6%;top:12%;bottom:12%;width:0;background:url(assets/ui/pc/loading_map.png) no-repeat;background-size:calc(512px * var(--k)) auto;background-position:calc(-62px * var(--k)) calc(-478px * var(--k));border-radius:20px;transition:width .2s}
  `;
  document.head.appendChild(s);
}
export function pcLoading({ img, title = '' } = {}) {
  style();
  const el = document.createElement('div'); el.className = 'pcload';
  el.innerHTML = `<div class="tip"><b>TIP</b><span></span></div><div class="art"></div><div class="msg"></div><div class="gauge"><i></i></div>`;
  el.querySelector('.tip span').textContent = TIPS[Math.random() * TIPS.length | 0];
  if (img) el.querySelector('.art').style.backgroundImage = `url(${img})`;
  const fit = () => { const w = el.querySelector('.gauge').offsetWidth || 382; el.style.setProperty('--k', w / 382); };
  document.body.appendChild(el); fit(); addEventListener('resize', fit);
  const bar = el.querySelector('.gauge i'), msg = el.querySelector('.msg');
  const api = {
    el,
    set(p, text) { bar.style.width = `calc(${Math.max(0, Math.min(100, p))}% * 0.988)`; msg.textContent = text ?? `正在進入 ${title}… ${Math.round(p)}%`; },
    done() { api.set(100); el.style.opacity = 0; removeEventListener('resize', fit); setTimeout(() => el.remove(), 450); },
  };
  api.set(0);
  return api;
}
