// 項目 28：主城「技能寶石」視窗（照 PC：裝備／開放／合成三個分頁）
import { askConfirm } from './ask.js';
import { itemName, itemIcon, RARITY } from '../1_data/items.js';
import { STONES, STONE_UP, STONE_MAX, STONE_CHANGE, STONE_ORDER, CHANGE_MAX, RARE_AT, fmtAttr, attrWeights, STONE_ATTRS } from '../1_data/stones.js';
import { GRADES, GEM_ATTRS, PATTERNS, OPEN_TRIES, OPEN_COST, FUSE_COST, FUSE_NEED, FUSE_UP, SLOT_LV, SLOT_COST, gemValue, gemName } from '../1_data/gems.js';

const GC = ['#c8c8c8', '#5cd65c', '#4fa3ff', '#ffa940']; // N／G／DG／XG 顏色
const CSS = `
.gm-list{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0;max-height:150px;overflow:auto}
.gm{width:46px;height:46px;border:2px solid #9db4ee;border-radius:8px;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;font-size:10px;line-height:1.1;position:relative}
.gm b{font-size:13px}.gm.sel{outline:3px solid #ff8a3d}.gm.off{opacity:.45}
.gm .tag{position:absolute;right:-4px;top:-6px;font-size:10px;background:#3651a8;color:#fff;border-radius:6px;padding:0 3px}
.gm-slot{display:flex;gap:8px;align-items:center;padding:6px 8px;border:1px solid #c9d5f3;border-radius:10px;background:#fff;margin-bottom:6px;flex-wrap:wrap}
.gm-pats{display:flex;gap:8px;margin:8px 0;flex-wrap:wrap}
.gm-tries{display:flex;gap:4px;margin:6px 0}
.gm-tries i{width:22px;height:22px;border-radius:50%;border:1px solid #9db4ee;display:inline-flex;align-items:center;justify-content:center;font-style:normal;font-size:12px;background:#fff}
`;
const PAT_ICON = ['☀', '🌙', '★', '☄'];

// ctx：{ char, D（skills.json）, T（talents.json）, openDlg, call, onSaved(char), toast }
// mode＝'stone'：官方 wiki 87「石頭鑲嵌」——左側 UI 石頭圖示進入，只有「強化」「分解」兩頁
export function openGems(ctx, tab = 'equip', mode = 'gem') {
  if (!document.getElementById('gm-css')) { const st = document.createElement('style'); st.id = 'gm-css'; st.textContent = CSS; document.head.appendChild(st); }
  const { D, T, openDlg, call, toast } = ctx; let c = ctx.char, sel = null, picks = new Set(), slots = (c.gemSlots || []).slice(), brk = new Set();
  const J = D.jobs[c.job], B = c.job2 && T.jobs[c.job]?.branches?.find(b => b.key === c.job2);
  const skills = [J.basic, ...J.pool, ...(B?.skills || []), ...D.fusions.filter(f => J.pool.includes(f.a)).map(f => f.into)];
  const inUse = () => new Set(slots.filter(Boolean).map(x => x.gem));
  const chip = (g, extra = '') => `<div class="gm ${extra}" data-g="${g.id}" style="border-color:${GC[g.grade]}" title="${gemName(g)}"><b style="color:${GC[g.grade]}">${GRADES[g.grade]}</b>${GEM_ATTRS[g.attr].name.slice(0, 2)}<span>${g.opened ? gemValue(g) + '%' : `${g.tries.length}/${OPEN_TRIES}`}</span>${inUse().has(g.id) ? '<span class="tag">裝</span>' : ''}</div>`;
  const save = async (url, data, msg) => { try { const r = await call('POST', url, data); const ch = r.char || r; c = ch; ctx.onSaved?.(ch); if (msg) toast(typeof msg === 'function' ? msg(r) : msg); return r; } catch (e) { toast(e.message); return null; } };

  function render() {
    const gems = c.gems || [];
    let h = `<div class="tabs2">${(mode === 'stone' ? [['stone', '強化'], ['break', '分解']] : [['equip', '裝備'], ['open', '開放'], ['fuse', '合成']]).map(([k, v]) => `<button class="btn ${tab === k ? 'primary' : ''}" data-tab="${k}">${v}</button>`).join('')}<span style="flex:1"></span><span class="gold" style="align-self:center">💰 ${c.gold}</span></div>`;
    if (tab === 'equip') {
      h += `<p><small>每格放「一招技能＋一顆已開放的寶石」。同一招可以裝多顆，但同一種屬性只能一顆。出征時生效。</small></p>`;
      for (let i = 0; i < 5; i++) {
        if (i >= (c.gemOpen || 0)) {
          h += `<div class="gm-slot">🔒 第 ${i + 1} 格　<small>要 Base Lv ${SLOT_LV[i]}・${SLOT_COST[i]} 金幣</small>${i === (c.gemOpen || 0) ? `<button class="btn primary" id="gmSlot" ${c.baseLv < SLOT_LV[i] || c.gold < SLOT_COST[i] ? 'disabled' : ''}>開啟</button>` : ''}</div>`; continue;
        }
        const s = slots[i], g = s && gems.find(x => x.id === s.gem);
        h += `<div class="gm-slot">第 ${i + 1} 格　<select data-sk="${i}"><option value="">（選技能）</option>${skills.map(k => `<option value="${k}" ${s?.skill === k ? 'selected' : ''}>${D.skills[k].name}</option>`).join('')}${s?.skill && !skills.includes(s.skill) ? `<option value="${s.skill}" selected>${D.skills[s.skill]?.name || s.skill}（目前不能用：換了二轉）</option>` : ''}</select>
          ${g ? `${chip(g)}<small>${gemName(g)} +${gemValue(g)}%</small><button class="btn" data-off="${i}">卸下</button>` : `<small>${sel ? '' : '在下面點一顆已開放的寶石，再點這格「放入」'}</small><button class="btn" data-put="${i}" ${sel ? '' : 'disabled'}>放入</button>`}</div>`;
      }
      const ok = gems.filter(g => g.opened);
      h += `<div><small>已開放的寶石（${ok.length}）：</small></div><div class="gm-list">${ok.map(g => chip(g, sel === g.id ? 'sel' : '')).join('') || '<small>還沒有。去「開放」分頁開放寶石（首領寶箱會掉）。</small>'}</div>
        <button class="btn primary" id="gmSave">確認</button>`;
    } else if (tab === 'open') {
      const g = gems.find(x => x.id === sel && !x.opened), list = gems.filter(x => !x.opened);
      h += `<div class="gm-list">${list.map(x => chip(x, sel === x.id ? 'sel' : '')).join('') || '<small>沒有未開放的寶石。首領寶箱會掉。</small>'}</div>`;
      if (!g) h += '<p><small>點一顆未開放的寶石。每顆最多附魔 10 次：太陽 15%、月亮 40%、星星 70%；失敗 8 次以上才能點彗星（必成）。成功加數值，失敗不加。10 次後按「開放」。</small></p>';
      else {
        const A = GEM_ATTRS[g.attr];
        h += `<p><b style="color:${GC[g.grade]}">${gemName(g)}</b>　基礎 ${A.base[g.grade]}%　目前 <b>${gemValue(g)}%</b>（${A.desc}）　<small>每次 ${OPEN_COST[g.grade]} 金幣・失敗 ${g.fails} 次</small></p>
          <div class="gm-tries">${Array.from({ length: OPEN_TRIES }, (_, i) => { const t = g.tries[i]; return `<i style="${t ? (t.ok ? 'background:#ffe9a8' : 'background:#eee;color:#999') : ''}">${t ? (t.ok ? PAT_ICON[t.p] : '✕') : ''}</i>`; }).join('')}</div>
          <div class="gm-pats">${PATTERNS.map((P, i) => `<button class="btn" data-pat="${i}" ${g.tries.length >= OPEN_TRIES || (P.needFails && g.fails < P.needFails) || c.gold < OPEN_COST[g.grade] ? 'disabled' : ''}>${PAT_ICON[i]} ${P.name} ${Math.round(P.rate * 100)}%<br><small>+${A.pat[g.grade][i]}%${P.needFails ? `（失敗 ${P.needFails} 次）` : ''}</small></button>`).join('')}</div>
          <button class="btn primary" id="gmOpen" ${g.tries.length < OPEN_TRIES ? 'disabled' : ''}>開放（${g.tries.length}/${OPEN_TRIES}）</button>`;
      }
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
    } else {
      const free = gems.filter(g => !inUse().has(g.id)), grade = [...picks].map(id => gems.find(g => g.id === id)?.grade)[0];
      h += `<p><small>選 ${FUSE_NEED} 顆<b>同級</b>的技能寶石（屬性、有沒有開放都不限），合成 1 顆新的；約 ${Math.round(FUSE_UP * 100)}% 機率變成高一級。裝備中的寶石不能合成。</small></p>
        <div class="gm-list">${free.map(g => chip(g, (picks.has(g.id) ? 'sel ' : '') + (grade != null && g.grade !== grade ? 'off' : ''))).join('') || '<small>沒有寶石</small>'}</div>
        <button class="btn primary" id="gmFuse" ${picks.size === FUSE_NEED ? '' : 'disabled'}>合成（${picks.size}/${FUSE_NEED}${grade != null ? `・${FUSE_COST[grade]} 金幣` : ''}）</button>`;
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
    b.querySelectorAll('[data-put]').forEach(x => x.onclick = () => { const i = +x.dataset.put; if (!slots[i]?.skill) return toast('先選這格要強化的技能'); if (inUse().has(sel)) return toast('這顆已經裝在別格'); slots[i] = { ...slots[i], gem: sel }; sel = null; render(); });
    b.querySelectorAll('[data-off]').forEach(x => x.onclick = () => { const i = +x.dataset.off; slots[i] = { ...slots[i], gem: null }; render(); });
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
    b.querySelector('#gmFuse')?.addEventListener('click', async () => { const r = await save('/api/gemfuse', { charId: c.id, gemIds: [...picks] }, r => r.up ? `合成成功，升級成 ${gemName(r.gem)}！` : `合成出 ${gemName(r.gem)}`); if (r) { picks.clear(); render(); } });
  }
  render();
}
