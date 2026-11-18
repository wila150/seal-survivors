// 外觀選擇（建角畫面＋主城造型師共用）：髮型 ◀ n/N ▶、髮色 9 色、服裝配色（上鎖的格子留給之後的 skin）
import { HAIR_STYLES, HAIR_COLORS, OUTFITS, OUTFIT_LOCKED, JOBS } from '../1_data/jobs.js';
const hex = n => '#' + n.toString(16).padStart(6, '0');
const CSS = `.lk-row{display:flex;align-items:center;gap:8px;margin:6px 0;flex-wrap:wrap}.lk-row>b{width:64px;flex:none;font-size:14px}
.lk-step{display:flex;align-items:center;gap:6px}.lk-step span{min-width:44px;text-align:center;font-weight:700}
.lk-sw{display:flex;gap:6px;flex-wrap:wrap;flex:1}.lk-sw button{width:30px;height:30px;border-radius:7px;border:2px solid #fff;box-shadow:0 0 0 1px #b8c6e8;cursor:pointer;padding:0;position:relative;font-size:13px}
.lk-sw button.on{box-shadow:0 0 0 3px var(--accent,#ffb000)}.lk-sw button:disabled{cursor:not-allowed;filter:grayscale(.6) brightness(.8)}`;
let styled = false;

// st = { hair, hairColor, outfit }；改了就呼叫 onChange()
export function renderLook(el, st, job, onChange) {
  if (!styled) { const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); styled = true; }
  const jc = JOBS[job]?.color ?? 0x4fa3ff;
  el.innerHTML = `
    <div class="lk-row"><b>髮型</b><div class="lk-step"><button type="button" class="btn" data-h="-1">◀</button><span>${st.hair + 1}/${HAIR_STYLES}</span><button type="button" class="btn" data-h="1">▶</button></div></div>
    <div class="lk-row"><b>髮色</b><div class="lk-sw">${HAIR_COLORS.map((c, i) => `<button type="button" data-c="${i}" title="${c.name}" class="${i === st.hairColor ? 'on' : ''}" style="background:${c.hex == null ? 'linear-gradient(135deg,#d9af54 50%,#242c37 50%)' : hex(c.hex)}"></button>`).join('')}</div></div>
    <div class="lk-row"><b>服裝配色</b><div class="lk-sw">${OUTFITS.map((c, i) => { const lock = OUTFIT_LOCKED.includes(i);
      return `<button type="button" data-o="${i}" ${lock ? 'disabled' : ''} title="${lock ? '之後的造型開放' : i ? '' : '原版配色'}" class="${i === st.outfit ? 'on' : ''}" style="background:${i ? hex(c) : `linear-gradient(135deg,${hex(jc)} 50%,#fff 50%)`}">${lock ? '🔒' : ''}</button>`; }).join('')}</div></div>`;
  el.querySelectorAll('[data-h]').forEach(b => b.onclick = () => { st.hair = (st.hair + +b.dataset.h + HAIR_STYLES) % HAIR_STYLES; renderLook(el, st, job, onChange); onChange(); });
  el.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { st.hairColor = +b.dataset.c; renderLook(el, st, job, onChange); onChange(); });
  el.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { st.outfit = +b.dataset.o; renderLook(el, st, job, onChange); onChange(); });
}
