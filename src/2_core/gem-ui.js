// 項目 28：主城「技能寶石」視窗（照 PC：裝備／開放／合成三個分頁）
import { askConfirm } from './ask.js';
import { itemName, itemIcon, RARITY } from '../1_data/items.js';
import { STONES, STONE_UP, STONE_MAX, STONE_CHANGE, STONE_ORDER, CHANGE_MAX, RARE_AT, fmtAttr, attrWeights, STONE_ATTRS } from '../1_data/stones.js';
import { GRADES, GEM_ATTRS, PATTERNS, OPEN_TRIES, OPEN_COST, FUSE_COST, FUSE_NEED, FUSE_UP, SLOT_LV, SLOT_COST, gemValue, gemName, gemIcon } from '../1_data/gems.js';

const GC = ['#9a9a9a', '#5cd65c', '#4fa3ff', '#ffa940']; // N／G／DG／XG 顏色
const CSS = `
.gm-list{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0;max-height:150px;overflow:auto}
.gm{width:46px;height:46px;border:2px solid #9db4ee;border-radius:8px;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;font-size:10px;line-height:1.1;position:relative}
.gm img{width:28px;height:28px}.gm b{font-size:10px;position:absolute;left:2px;top:0}.gm.sel{outline:3px solid #ff8a3d}.gm.off{opacity:.45}
.gm .tag{position:absolute;right:-4px;top:-6px;font-size:10px;background:#3651a8;color:#fff;border-radius:6px;padding:0 3px}
.gm-slot{display:flex;gap:8px;align-items:center;padding:6px 8px;border:1px solid #c9d5f3;border-radius:10px;background:#fff;margin-bottom:6px;flex-wrap:wrap}
.gm-pats{display:flex;gap:8px;margin:8px 0;flex-wrap:wrap}
.gm-tries{display:flex;gap:4px;margin:6px 0}
.gm-tries i{width:22px;height:22px;border-radius:50%;border:1px solid #9db4ee;display:inline-flex;align-items:center;justify-content:center;font-style:normal;font-size:12px;background:#fff}
/* PC GEM SETTING：魔法陣（中間放寶石①、10 個附魔位置⑤、右邊圖案③＋成功率②、所需希幣④、開放⑥） */
.gs-wrap{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-start}
.gs-circle{position:relative;width:min(300px,100%);aspect-ratio:1;border-radius:12px;background:radial-gradient(circle at 50% 45%,#22437c,#0b1630 72%);overflow:hidden;flex:none}
.gs-circle svg{position:absolute;inset:0;width:100%;height:100%}
.gs-mk{position:absolute;width:14%;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;border:2px solid #8fb3ff77;background:#0f1f44cc;display:flex;align-items:center;justify-content:center;color:#fff;font-size:15px;line-height:1}
.gs-mk small{font-size:10px;position:absolute;bottom:-14px;color:#ffe9a8;white-space:nowrap;text-shadow:0 0 3px #000,0 0 3px #000}
.gs-mk.ok{background:#ffe08a;color:#7a4a00;border-color:#ffd24d;box-shadow:0 0 10px #ffd24d}
.gs-mk.ng{background:#3a3f4f;color:#ff7b7b;border-color:#777}
.gs-mk.next{border-color:#fff;animation:gsp 1s infinite}
@keyframes gsp{50%{box-shadow:0 0 14px #fff}}
.gs-ctr{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);text-align:center;color:#fff;width:40%}
.gs-slot{width:50px;height:50px;margin:0 auto;border-radius:8px;background:#e9edf5;border:2px solid #c9d1e4;display:flex;align-items:center;justify-content:center}
.gs-slot img{width:34px;height:34px}
.gs-val{font-size:11px;background:#fffffff0;color:#223;border-radius:6px;padding:1px 5px;margin:3px 0;display:inline-block;white-space:nowrap}
.gs-side{flex:1;min-width:170px;display:flex;flex-direction:column;gap:6px}
.gs-pat{display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:10px;background:#fff;border:1px solid #c9d5f3;cursor:pointer;text-align:left;font:inherit;color:#223}
.gs-pat:disabled{opacity:.45;cursor:default}
.gs-pat .pi{width:40px;height:40px;border-radius:50%;background:radial-gradient(#fff,#cfd8ec);display:flex;align-items:center;justify-content:center;font-size:21px;flex:none;border:2px solid #9db4ee}
.gs-cost{background:#eef2fb;border-radius:8px;padding:5px 8px;font-size:13px}
.gs-item{margin-top:8px;padding:6px 8px;border-radius:10px;background:#f1f4fb}
/* PC GEM EQUIP：左邊技能②、右邊寶石③、鎖住的格子顯示開放條件①、下方套用④ */
.ge-row{display:flex;align-items:center;gap:8px;padding:6px;border-radius:10px;background:#e6e1d5;margin-bottom:6px}
.ge-row.lock{background:#4b4b4b;color:#fff}.ge-row.lock small{color:#eee}
.ge-box{width:46px;height:46px;border-radius:8px;background:#f8f6f0;border:2px solid #b9b2a2;display:flex;align-items:center;justify-content:center;flex:none;position:relative}
.ge-box img{width:32px;height:32px}.ge-box.x{color:#b9b2a2;font-size:22px}.ge-box.can{cursor:pointer;border-color:#ff8a3d}
.ge-mid{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;align-items:flex-start}
.ge-mid select{max-width:100%}
.ge-need{color:#fff;background:#d9534f;border-radius:4px;padding:0 6px;font-size:12px}
.ge-note{font-size:12px;color:#556;margin:6px 0;line-height:1.5}
/* PC GEM COMPOSE：3 格①→RESULT、級別＋一併登錄③、目前／所需希幣④、合成② */
.gc-top{background:#c6d94a;border-radius:12px;padding:12px;display:flex;flex-direction:column;align-items:center;gap:4px}
.gc-slots{display:flex;gap:14px}
.gc-box{width:52px;height:52px;border-radius:8px;background:#dfe8a8;border:2px solid #9aae2a;display:flex;align-items:center;justify-content:center;cursor:pointer}
.gc-box img{width:34px;height:34px}
.gc-res{font-size:10px;color:#556;font-weight:bold;text-align:center}
.gc-grades{display:flex;gap:10px;justify-content:center;margin:8px 0;flex-wrap:wrap}
.gc-grades label{display:inline-flex;align-items:center;gap:3px;font-weight:bold}
.gc-gold{display:grid;grid-template-columns:auto 1fr;gap:4px 8px;align-items:center;font-size:13px;margin:6px 0}
.gc-gold span{background:#f1f1f1;border-radius:6px;padding:2px 8px;text-align:right}
`;
const PAT_ICON = ['☀', '🌙', '★', '☄'];

// ctx：{ char, D（skills.json）, T（talents.json）, openDlg, call, onSaved(char), toast }
// mode＝'stone'：官方 wiki 87「石頭鑲嵌」——左側 UI 石頭圖示進入，只有「強化」「分解」兩頁
export function openGems(ctx, tab = 'equip', mode = 'gem') {
  if (!document.getElementById('gm-css')) { const st = document.createElement('style'); st.id = 'gm-css'; st.textContent = CSS; document.head.appendChild(st); }
  const { D, T, openDlg, call, toast } = ctx; let c = ctx.char, sel = null, fuseGrade = null, lastFuse = null, picks = new Set(), slots = (c.gemSlots || []).slice(), brk = new Set();
  const J = D.jobs[c.job], B = c.job2 && T.jobs[c.job]?.branches?.find(b => b.key === c.job2);
  const skills = [J.basic, ...J.pool, ...(B?.skills || []), ...D.fusions.filter(f => J.pool.includes(f.a)).map(f => f.into)];
  const ico = k => { const sk = D.skills[k]; if (!sk?.icon) return '?'; const [f, x, y] = sk.icon; return `<i style="display:inline-block;width:32px;height:32px;background:url(assets/skill/${f}) -${x}px -${y}px no-repeat"></i>`; };
  const inUse = () => new Set(slots.filter(Boolean).map(x => x.gem));
  const chip = (g, extra = '') => `<div class="gm ${extra}" data-g="${g.id}" style="border-color:${GC[g.grade]}" title="${gemName(g)}"><b style="color:${GC[g.grade]}">${GRADES[g.grade]}</b><img src="${gemIcon(g)}" alt=""><span>${g.opened ? gemValue(g) + '%' : `${g.tries.length}/${OPEN_TRIES}`}</span>${inUse().has(g.id) ? '<span class="tag">裝</span>' : ''}</div>`;
  const save = async (url, data, msg) => { try { const r = await call('POST', url, data); const ch = r.char || r; c = ch; ctx.onSaved?.(ch); if (msg) toast(typeof msg === 'function' ? msg(r) : msg); return r; } catch (e) { toast(e.message); return null; } };

  function render() {
    const gems = c.gems || [];
    let h = `<div class="tabs2">${(mode === 'stone' ? [['stone', '強化'], ['break', '分解']] : [['equip', '裝備'], ['open', '開放'], ['fuse', '合成']]).map(([k, v]) => `<button class="btn ${tab === k ? 'primary' : ''}" data-tab="${k}">${v}</button>`).join('')}<span style="flex:1"></span><span class="gold" style="align-self:center">💰 ${c.gold}</span></div>`;
    if (tab === 'equip') { // PC GEM EQUIP
      for (let i = 0; i < 5; i++) {
        if (i >= (c.gemOpen || 0)) {
          const nx = i === (c.gemOpen || 0);
          h += `<div class="ge-row lock"><div class="ge-box x">🔒</div><div class="ge-mid"><b style="color:#ff8a80">開放條件</b><small>希幣：${SLOT_COST[i].toLocaleString()}</small></div>${nx ? `<button class="btn primary" id="gmSlot" ${c.gold < SLOT_COST[i] ? 'disabled' : ''}>欄位開放</button>` : ''}</div>`; continue;
        }
        const s = slots[i], g = s && gems.find(x => x.id === s.gem);
        h += `<div class="ge-row"><div class="ge-box">${s?.skill ? ico(s.skill) : ''}</div><div class="ge-mid"><select data-sk="${i}"><option value="">（選技能）</option>${skills.map(k => `<option value="${k}" ${s?.skill === k ? 'selected' : ''}>${D.skills[k].name}</option>`).join('')}${s?.skill && !skills.includes(s.skill) ? `<option value="${s.skill}" selected>${D.skills[s.skill]?.name || s.skill}（目前不能用：換了二轉）</option>` : ''}</select>
          ${!s?.skill ? '<span class="ge-need">需要裝備技能</span>' : g ? `<small>${gemName(g)} <b>+${gemValue(g)}%</b> <a href="#" data-off="${i}">卸下</a></small>` : `<small>${sel ? '點右邊格子放入選好的寶石' : '在下面點一顆寶石'}</small>`}</div>
          <div class="ge-box ${g ? '' : 'x'} ${s?.skill && sel && !g ? 'can' : ''}" ${s?.skill && !g ? `data-put="${i}"` : ''} style="${g ? `border-color:${GC[g.grade]}` : ''}">${g ? `<img src="${gemIcon(g)}" alt="">` : '✕'}</div></div>`;
      }
      const ok = gems.filter(g => g.opened);
      h += `<div class="ge-note">・一個技能中無法裝備同種類的技能寶石<br>・開放的欄位將會永遠開放<br>・技能寶石裝備只可在村莊進行（出征時生效）</div>
        <div><small>已開放的寶石（${ok.length}）：</small></div><div class="gm-list">${ok.map(g => chip(g, sel === g.id ? 'sel' : '')).join('') || '<small>還沒有。去「開放」分頁開放寶石（首領寶箱會掉）。</small>'}</div>
        <div style="display:flex;gap:8px;justify-content:center"><button class="btn primary" id="gmSave">套用</button><button class="btn" id="gmCancel">取消</button></div>`;
    } else if (tab === 'open') { // PC GEM SETTING 魔法陣
      const list = gems.filter(x => !x.opened); if (!list.find(x => x.id === sel)) sel = list[0]?.id ?? null;
      const g = gems.find(x => x.id === sel), A = g && GEM_ATTRS[g.attr];
      const R = 38, mk = Array.from({ length: OPEN_TRIES }, (_, i) => { const t = g?.tries[i], an = (i / OPEN_TRIES) * Math.PI * 2 - Math.PI / 2;
        return `<div class="gs-mk ${t ? (t.ok ? 'ok' : 'ng') : g && i === g.tries.length ? 'next' : ''}" style="left:${50 + R * Math.cos(an)}%;top:${50 + R * Math.sin(an)}%">${t ? (t.ok ? PAT_ICON[t.p] : '✕') : ''}${t?.ok ? `<small>+${A.pat[g.grade][t.p]}%</small>` : ''}</div>`; }).join('');
      const svg = `<svg viewBox="0 0 100 100" fill="none" stroke="#9fc0ff" stroke-opacity=".55" stroke-width=".4"><circle cx="50" cy="50" r="47"/><circle cx="50" cy="50" r="44.5"/><circle cx="50" cy="50" r="30"/><circle cx="50" cy="50" r="22"/>${[0, 1].map(k => `<polygon points="${Array.from({ length: 5 }, (_, i) => { const an = (i * 2 / 5 + k / 5) * Math.PI * 2 - Math.PI / 2; return `${50 + 44.5 * Math.cos(an)},${50 + 44.5 * Math.sin(an)}`; }).join(' ')}"/>`).join('')}<g fill="#fff" stroke="none" opacity=".7"><circle cx="12" cy="10" r=".5"/><circle cx="88" cy="16" r=".4"/><circle cx="8" cy="80" r=".4"/><circle cx="92" cy="90" r=".5"/><path d="M84 6 l-10 9" stroke="#fff" stroke-width=".4"/></g><text x="10" y="95" fill="#fff" stroke="none" font-size="5" opacity=".7">☾</text></svg>`;
      const dis = P => !g || g.tries.length >= OPEN_TRIES || (P.needFails && g.fails < P.needFails) || c.gold < OPEN_COST[g.grade];
      h += `<div class="gs-wrap"><div class="gs-circle">${svg}${mk}<div class="gs-ctr">${g ? `<span class="gs-val">${gemValue(g)}%</span>` : ''}<div class="gs-slot" style="${g ? `border-color:${GC[g.grade]}` : ''}">${g ? `<img src="${gemIcon(g)}" alt="">` : ''}</div>
          <button class="btn primary" id="gmOpen" style="margin-top:4px;padding:2px 10px" ${!g || g.tries.length < OPEN_TRIES ? 'disabled' : ''}>開放</button></div></div>
        <div class="gs-side">${g ? `<div><b style="color:${GC[g.grade]}">${gemName(g)}</b><br><small>基礎 ${A.base[g.grade]}%・總屬性 <b>${gemValue(g)}%</b>（${A.desc}）・${g.tries.length}/${OPEN_TRIES} 次・失敗 ${g.fails} 次</small></div>` : '<small>下面 ITEM 沒有未開放的寶石（首領寶箱會掉）</small>'}
          ${PATTERNS.map((P, i) => `<button class="gs-pat" data-pat="${i}" ${dis(P) ? 'disabled' : ''}><span class="pi">${PAT_ICON[i]}</span><span>${P.name}　成功率：<b>${Math.round(P.rate * 100)}%</b><br><small>${g ? `成功 +${A.pat[g.grade][i]}%` : ''}${P.needFails ? `（失敗 ${P.needFails} 次以上才能點）` : ''}</small></span></button>`).join('')}
          <div class="gs-cost">所需希幣：<b>${g ? OPEN_COST[g.grade].toLocaleString() : '-'}</b>　<small>目前 ${c.gold.toLocaleString()}</small></div></div></div>
        <div class="gs-item"><small><b>ITEM</b>　未開放的寶石（點一顆放到中間）</small><div class="gm-list">${list.map(x => chip(x, sel === x.id ? 'sel' : '')).join('') || '<small>沒有</small>'}</div>
        <small>成功：該位置出現圖案並加屬性；失敗：出現失敗圖案、不加屬性。10 次都點完才能按「開放」。</small></div>`;
    } else if (tab === 'break') { // 分解：放入裝備 → 分解成石頭強化素材（閃亮粉末、閃亮結晶、七彩粉末）
      const its = (c.items || []).filter(i => !i.equipped && !i.locked);
      h += `<p><small>放入不要的裝備按「分解」，會得到石頭強化素材（閃亮粉末、閃亮結晶、七彩粉末；品質越高越容易出結晶）。<b>分解後裝備會全部消失</b>。鎖定、穿著的不能放。</small></p>
        <div class="bag" style="grid-template-columns:repeat(auto-fill,minmax(44px,1fr));gap:4px">${its.map(i => `<div class="cell ${brk.has(i.id) ? 'sel' : ''}" data-bk="${i.id}" title="${itemName(i)}" style="border-color:${RARITY[i.rarity]?.color}"><img src="${itemIcon(i)}" alt=""></div>`).join('') || '<small>背包沒有可以分解的裝備</small>'}</div>
        <div style="margin-top:8px"><button class="btn primary" id="gmBreak" ${brk.size ? '' : 'disabled'}>分解 ${brk.size} 件</button></div>`;
    } else if (tab === 'stone') {
      const M = c.mats || {};
      h += `<p><small>四顆石頭（紅／朱黃／黃／綠）各自 +0～+12 強化合成，成功就多 1 條屬性（會疊加，直接加到角色）；+3／+6／+9／+12 可能出稀有屬性。成功失敗材料都會消失。
        材料：分解裝備（找廣場的寶石收藏家 扎羅）。</small><br>持有：閃亮結晶 <b>${M.crystal || 0}</b>　七彩粉末 <b>${M.rainbow || 0}</b>　閃亮粉末 ${M.dust || 0}　固定券 ${M.fixTicket || 0}　充值券 ${M.chargeTicket || 0}</p>`;
      for (const k of STONE_ORDER) {
        const S = STONES[k], st = c.stones?.[k] || { lv: 0, attrs: [], changes: 50 }, up = STONE_UP[st.lv], i = STONE_ORDER.indexOf(k);
        const can = up && (M.crystal || 0) >= up[0] && (M.rainbow || 0) >= up[1][i] && c.gold >= up[3], ch = st.lv ? STONE_CHANGE[st.lv - 1] : null;
        h += `<div class="gm-slot" style="display:block"><b style="color:${S.color};font-size:15px">◆ ${S.name} +${st.lv}</b>
          <small>　${st.lv < STONE_MAX ? `下一階可出：${(W => { const t = Object.values(W).reduce((a, b) => a + b, 0); return Object.entries(W).map(([a, w]) => `${STONE_ATTRS[a].rare ? '<b style="color:#c0392b">' : ''}${STONE_ATTRS[a].name} ${(w / t * 100).toFixed(1)}%${STONE_ATTRS[a].rare ? '</b>' : ''}`).join('、'); })(attrWeights(k, st.lv + 1))}` : ''}</small><br>
          <small>${st.attrs.map((a, j) => `+${j + 1} ${STONE_ATTRS[a.k].rare ? `<b style="color:#c0392b">${fmtAttr(a)}</b>` : fmtAttr(a)}`).join('　') || '還沒有屬性'}</small><br>
          ${up ? `<button class="btn primary" data-sup="${k}" ${can ? '' : 'disabled'}>強化合成 +${st.lv}→+${st.lv + 1}（${Math.round(up[2] * 100)}%・結晶 ${up[0]}・七彩 ${up[1][i]}・${up[3]} 金幣）</button>` : '<small>已經 +12</small>'}
          ${ch ? `<button class="btn" data-sch="${k}">變更 +${st.lv} 屬性（結晶 ${ch[0]}・${ch[1]} 金幣）</button><label style="display:inline"><input type="checkbox" data-fix="${k}"> 用固定券（只換數值）</label>` : ''}
          <small>　變更次數 ${st.changes} / ${CHANGE_MAX}</small> <button class="btn" data-scg="${k}" ${(M.chargeTicket || 0) ? '' : 'disabled'}>充值 +50</button>
          ${st.lv ? `<button class="btn" data-srs="${k}">初始化</button>` : ''}</div>`;
      }
    } else { // PC GEM COMPOSE
      const free = gems.filter(g => !inUse().has(g.id)), pk = [...picks].map(id => gems.find(g => g.id === id)).filter(Boolean), grade = pk[0]?.grade ?? fuseGrade;
      h += `<div class="gc-top"><div class="gc-slots">${[0, 1, 2].map(i => `<div class="gc-box" ${pk[i] ? `data-g="${pk[i].id}" style="border-color:${GC[pk[i].grade]}"` : ''}>${pk[i] ? `<img src="${gemIcon(pk[i])}" alt="">` : ''}</div>`).join('')}</div>
          <div style="font-size:26px;color:#fff;line-height:1">⬇</div><div class="gc-box" style="cursor:default;${lastFuse ? `border-color:${GC[lastFuse.grade]}` : ''}">${lastFuse ? `<img src="${gemIcon(lastFuse)}" alt="" title="${gemName(lastFuse)}">` : ''}</div><div class="gc-res">RESULT${lastFuse ? `：${gemName(lastFuse)}` : ''}</div></div>
        <div class="gc-grades">${GRADES.map((G, i) => `<label style="color:${GC[i]}"><input type="radio" name="gcg" data-fg="${i}" ${grade === i ? 'checked' : ''}>${G}</label>`).join('')}<button class="btn" id="gmAuto" ${grade == null ? 'disabled' : ''}>一併登錄</button></div>
        <div class="gc-gold"><b>目前希幣</b><span>${c.gold.toLocaleString()}</span><b>所需希幣</b><span>${grade != null && pk.length ? FUSE_COST[grade].toLocaleString() : 0}</span></div>
        <div class="ge-note">只可合成同等級的技能寶石（屬性、有沒有開放都不限），合成後是未開放。約 ${Math.round(FUSE_UP * 100)}% 機率變成高一級（XG 合成還是 XG）。裝備中的不能合成。</div>
        <div class="gm-list">${free.map(g => chip(g, (picks.has(g.id) ? 'sel ' : '') + (grade != null && g.grade !== grade ? 'off' : ''))).join('') || '<small>沒有寶石</small>'}</div>
        <div style="display:flex;gap:8px;justify-content:center"><button class="btn primary" id="gmFuse" ${picks.size === FUSE_NEED ? '' : 'disabled'}>合成</button><button class="btn" id="gmClr">取消</button></div>`;
    }
    openDlg(mode === 'stone' ? '石頭鑲嵌' : '技能寶石', h, [], true);
    const b = document.getElementById('dlgBody');
    b.querySelectorAll('[data-tab]').forEach(x => x.onclick = () => { tab = x.dataset.tab; sel = null; picks.clear(); slots = (c.gemSlots || []).slice(); render(); });
    b.querySelectorAll('[data-g]').forEach(x => x.onclick = () => {
      const id = +x.dataset.g;
      if (tab === 'fuse') { const g = (c.gems || []).find(y => y.id === id), first = [...picks][0], fg = first && (c.gems || []).find(y => y.id === first);
        if (picks.has(id)) picks.delete(id); else if (picks.size < FUSE_NEED && (!fg || fg.grade === g.grade)) picks.add(id); }
      else sel = sel === id ? null : id;
      render();
    });
    b.querySelectorAll('[data-bk]').forEach(x => x.onclick = () => { const id = +x.dataset.bk; brk.has(id) ? brk.delete(id) : brk.add(id); render(); });
    b.querySelector('#gmBreak')?.addEventListener('click', async () => { if (!(await (ctx.askConfirm || (async () => true))(`分解 ${brk.size} 件裝備？分解後會全部消失。`, { ok: '分解', danger: true }))) return; const r = await save('/api/decompose', { charId: c.id, itemIds: [...brk] }, r => `分解完成：閃亮粉末 +${r.got?.dust || 0}、閃亮結晶 +${r.got?.crystal || 0}、七彩粉末 +${r.got?.rainbow || 0}`); if (r) { brk.clear(); render(); } });
    b.querySelectorAll('[data-sk]').forEach(x => x.onchange = () => { const i = +x.dataset.sk; slots[i] = x.value ? { skill: x.value, gem: slots[i]?.gem ?? null } : null; render(); });
    b.querySelectorAll('[data-put]').forEach(x => x.onclick = () => { const i = +x.dataset.put; if (!sel) return toast('先在下面點一顆已開放的寶石'); if (!slots[i]?.skill) return toast('先選這格要強化的技能'); if (inUse().has(sel)) return toast('這顆已經裝在別格'); slots[i] = { ...slots[i], gem: sel }; sel = null; render(); });
    b.querySelector('#gmCancel')?.addEventListener('click', () => { slots = (c.gemSlots || []).slice(); sel = null; render(); });
    b.querySelectorAll('[data-fg]').forEach(x => x.onchange = () => { fuseGrade = +x.dataset.fg; picks.clear(); render(); });
    b.querySelector('#gmAuto')?.addEventListener('click', () => { const gr = [...picks].map(id => (c.gems || []).find(g => g.id === id)?.grade)[0] ?? fuseGrade; const use = inUse(); picks.clear(); for (const g of (c.gems || [])) if (g.grade === gr && !use.has(g.id) && picks.size < FUSE_NEED) picks.add(g.id); if (picks.size < FUSE_NEED) toast(`${GRADES[gr]} 級沒有 ${FUSE_NEED} 顆可以合成`); render(); });
    b.querySelector('#gmClr')?.addEventListener('click', () => { picks.clear(); render(); });
    b.querySelectorAll('[data-off]').forEach(x => x.onclick = e => { e.preventDefault(); const i = +x.dataset.off; slots[i] = { ...slots[i], gem: null }; render(); });
    b.querySelector('#gmSlot')?.addEventListener('click', async () => { if (await save('/api/gemslot', { charId: c.id }, '開啟了一格')) { slots = (c.gemSlots || []).slice(); render(); } });
    b.querySelector('#gmSave')?.addEventListener('click', async () => {
      const out = Array.from({ length: c.gemOpen || 0 }, (_, i) => slots[i]?.skill && slots[i]?.gem ? { skill: slots[i].skill, gem: slots[i].gem } : null);
      if (await save('/api/gemequip', { charId: c.id, slots: out }, '技能寶石裝好了！下次出征生效')) { slots = (c.gemSlots || []).slice(); render(); }
    });
    b.querySelectorAll('[data-pat]').forEach(x => x.onclick = async () => { const r = await save('/api/gemenchant', { charId: c.id, gemId: sel, p: +x.dataset.pat }, r => r.ok ? '附魔成功！' : '附魔失敗…'); if (r) render(); });
    b.querySelector('#gmOpen')?.addEventListener('click', async () => { if (await save('/api/gemopen', { charId: c.id, gemId: sel }, '開放完成！可以裝備了')) { sel = null; render(); } });
    b.querySelectorAll('[data-sup]').forEach(x => x.onclick = async () => { const r = await save('/api/stoneup', { charId: c.id, stone: x.dataset.sup }, r => r.ok ? `強化合成成功！出現 ${fmtAttr(r.attr)}` : '強化合成失敗，材料消失了…'); if (r) render(); });
    b.querySelectorAll('[data-sch]').forEach(x => x.onclick = async () => { const k = x.dataset.sch, fix = b.querySelector(`[data-fix="${k}"]`)?.checked; const r = await save('/api/stonechange', { charId: c.id, stone: k, fix }, r => `變成 ${fmtAttr(r.attr)}`); if (r) render(); });
    b.querySelectorAll('[data-scg]').forEach(x => x.onclick = async () => { if (await save('/api/stonecharge', { charId: c.id, stone: x.dataset.scg }, '變更次數 +50')) render(); });
    b.querySelectorAll('[data-srs]').forEach(x => x.onclick = async () => { if (!(await askConfirm('初始化會回到 +0、所有屬性消失，確定？', { danger: true }))) return; if (await save('/api/stonereset', { charId: c.id, stone: x.dataset.srs }, '已初始化')) render(); });
    b.querySelector('#gmFuse')?.addEventListener('click', async () => { const r = await save('/api/gemfuse', { charId: c.id, gemIds: [...picks] }, r => r.up ? `合成成功，升級成 ${gemName(r.gem)}！` : `合成出 ${gemName(r.gem)}`); if (r) { lastFuse = r.gem; picks.clear(); render(); } });
  }
  render();
}
