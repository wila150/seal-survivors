// 項目 26：主城「天賦」視窗（參考 RO 倖存者天賦樹結構，內容＝PC 版一轉技能樹）
// 點擊＝加點、右鍵（或手機開「減點模式」）＝減點；按「套用」才存到伺服器
import { checkTalents, talentPoints, spentPoints, talentDesc, treeNodes, boostedAlloc } from '../1_data/talents.js';

const CSS = `
.tl-top{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px}
.tl-top b.pts{font-size:18px;color:#3651a8}
.tl-panel{background:#ddd0c0;border:3px solid #a8978a;border-radius:10px;overflow:hidden}
.tl-head{display:flex;align-items:center;gap:10px;background:#b0a090;color:#fff;font-weight:800;padding:3px 10px;text-shadow:0 1px 0 #0004}
.tl-head small{font-weight:400}
.tl-head .keys{margin-left:auto;font-size:12px;font-weight:700}
.tl-head .keys b{color:#7fd0ff;font-size:15px}.tl-head .keys b.m{color:#ff8a8a}
.tl-wrap{overflow:auto;max-height:46vh}
.tl-tree{position:relative;margin:12px}
.tl-n{position:absolute;width:44px;height:44px;cursor:pointer;z-index:1;border:2px solid #8f7f70;border-radius:3px;background:#5a4e44;box-shadow:2px 2px 0 #0003}
.tl-n i{display:block;width:40px;height:40px;image-rendering:pixelated}
.tl-n.final{border-color:#e0a826;box-shadow:0 0 0 2px #f5d26b,2px 2px 0 #0003}
.tl-n.lock i{filter:grayscale(1) brightness(.75)}
.tl-n.zero i{opacity:.8}
.tl-n.sel{outline:3px solid #ff8a3d;outline-offset:1px}
.tl-n .lv{position:absolute;left:24px;top:30px;background:#fff6dc;color:#4a3a28;border:1px solid #b59a6a;font-size:11px;line-height:14px;padding:0 3px;white-space:nowrap;border-radius:2px}
.tl-n.on .lv{background:#ffe9a8;font-weight:800;color:#2b4bb0}
.tl-n .wp{position:absolute;left:-7px;top:-9px;font-size:12px}
.tl-n .lk{position:absolute;right:-6px;top:-8px;font-size:11px}
.tl-svg{position:absolute;left:0;top:0;pointer-events:none;z-index:0;overflow:visible}
.tl-info{margin-top:8px;padding:8px 10px;border-radius:10px;background:#fff;border:1px solid #c9d5f3;min-height:58px;font-size:13px}
.tl-info small{color:#6b7896}
.tl-msg{color:#c0392b;font-weight:700}
`;

function icon([f, x, y], z = 32) {
  const k = z / 32;
  return `<i style="width:${z}px;height:${z}px;background:url(assets/skill/${f}) -${x * k}px -${y * k}px/${512 * k}px ${512 * k}px no-repeat"></i>`;
}

// ctx：{ char, T（talents.json）, skillName(key), openDlg, call, onSaved(char), tree（1／2） }
export function openTalents(ctx) {
  const { T, openDlg, call } = ctx; let char = ctx.char;
  const J = T.jobs[char.job]; if (!J) return openDlg('天賦', '<p>這個職業沒有天賦樹。</p>', []);
  if (!document.getElementById('tl-css')) { const st = document.createElement('style'); st.id = 'tl-css'; st.textContent = CSS; document.head.appendChild(st); }
  let tree = ctx.tree === 2 && char.job2 ? 2 : 1, sel = null, minus = false, msg = '';
  let nodes, byId, alloc, pos, W, H, total, branch;
  const jobLv = char.jobLv, DX = 72, DY = 58;
  const saved = () => (tree === 2 ? char.talents2 : char.talents) || {};

  // 切換一轉／二轉樹：重算節點、版面（由左往右長，PC 版樣式：第一個子節點接同一列右邊，其他往下排）
  function load() {
    branch = tree === 2 ? char.job2 : null;
    nodes = treeNodes(T, char.job, branch); byId = Object.fromEntries(nodes.map(n => [n.id, n]));
    alloc = { ...saved() }; sel = null; msg = ''; total = talentPoints(jobLv, branch);
    pos = {}; const kids = {}, ord = (a, b) => a.gate - b.gate || (a.col ?? 0) - (b.col ?? 0) || a.id - b.id;
    for (const n of nodes) if (n.pre) (kids[n.pre[0]] ??= []).push(n);
    let maxY = -1;
    const place = (n, x, y) => { pos[n.id] = { x, y }; maxY = Math.max(maxY, y); (kids[n.id] || []).sort(ord).forEach((c, i) => place(c, x + 1, i ? maxY + 1 : y)); };
    for (const r of nodes.filter(n => !n.pre).sort(ord)) place(r, 0, maxY + 1);
    W = Math.max(...Object.values(pos).map(p => p.x)) * DX + 70; H = maxY * DY + 64;
  }
  const valid = a => checkTalents(T, char.job, jobLv, Object.fromEntries(Object.entries(a).filter(([, v]) => v)), branch);
  const locked = n => jobLv < n.gate || (n.pre && (alloc[n.pre[0]] || 0) < n.pre[1]);

  function change(n, d) {
    const a = { ...alloc, [n.id]: Math.max(0, Math.min(n.max, (alloc[n.id] || 0) + d)) };
    if (a[n.id] === (alloc[n.id] || 0)) { msg = d > 0 ? '已經點滿了' : '這個天賦還沒點'; return; }
    const err = valid(a);
    if (err) { msg = d < 0 ? `不能減：有其他天賦需要它（${err}）` : err; return; }
    alloc = a; msg = '';
  }

  function render() {
    const spent = spentPoints(alloc), B = branch && J.branches.find(b => b.key === branch);
    // 項目 28：穿著裝備的技能屬性（鑑定）加成，只顯示、不佔點數
    const [b1, b2] = boostedAlloc(T, char.job, tree === 1 ? alloc : char.talents, char.job2, tree === 2 ? alloc : char.talents2, char.items);
    const boost = id => ((tree === 1 ? b1 : b2)[id] || 0) - (alloc[id] || 0);
    const g = nodes.map(n => {
      const lv = alloc[n.id] || 0, P = pos[n.id], gl = jobLv < n.gate, bo = boost(n.id);
      return `<div class="tl-n ${lv ? 'on' : 'zero'} ${n.final ? 'final' : ''} ${!lv && locked(n) ? 'lock' : ''} ${sel === n.id ? 'sel' : ''}" data-id="${n.id}" title="${n.name}" style="left:${P.x * DX}px;top:${P.y * DY}px">${icon(n.icon, 40)}${n.weapon ? '<span class="wp">⚔</span>' : ''}${gl ? '<span class="lk">🔒</span>' : ''}<span class="lv">${lv}${bo ? `<b style="color:#2b6fd6">+${bo}</b>` : ''}/${n.max}</span></div>`;
    }).join('');
    const n = byId[sel];
    const info = n ? (() => {
      const lv = alloc[n.id] || 0, req = [];
      if (n.gate) req.push(`Job Lv ${n.gate}`);
      if (n.pre) req.push(`${byId[n.pre[0]].name} Lv ${n.pre[1]}`);
      const bo = boost(n.id);
      return (bo ? `<small style="color:#2b6fd6">裝備技能屬性 Lv+${bo}（出征時生效：${talentDesc(T, n, lv + bo, ctx.skillName)}）</small><br>` : '') + `<b>${n.name}</b> ${n.final ? '<small style="color:#c8901a">★ 最終天賦</small>' : ''}${n.weapon ? ' <small>⚔ 限定武器</small>' : ''}　<small>Lv ${lv} / ${n.max}</small><br>`
        + (lv ? `現在：${talentDesc(T, n, lv, ctx.skillName)}<br>` : '') + (lv < n.max ? `<small>${lv ? '下一級' : '點 1 級'}：${talentDesc(T, n, lv + 1, ctx.skillName)}</small><br>` : '')
        + (req.length ? `<small>需要：${req.join('、')}</small>` : '');
    })() : (tree === 2 ? `<small>二轉樹：Job Lv 51 起每升 1 級＝1 點（二轉最多 50 點；三轉後 Job 101～130 再多 30 點，也能補點二轉天賦）。轉職學到的局內技能：${B.skills.map(ctx.skillName).join('、')}。</small>`
      : '<small>點天賦圖示看說明並加點。連線＝前置天賦；金框＝最終天賦；⚔＝限定武器。天賦只加被動數值或強化局內技能。</small>');
    const dirty = JSON.stringify(Object.entries(alloc).filter(([, v]) => v).sort()) !== JSON.stringify(Object.entries(saved()).filter(([, v]) => v).sort());
    const tabs = J.branches && char.job2 ? `<button class="btn ${tree === 1 ? 'primary' : ''}" data-tree="1">一轉：${char.job}</button><button class="btn ${tree === 2 ? 'primary' : ''}" data-tree="2">二轉：${B?.name || J.branches.find(b => b.key === char.job2).name}</button>` : '';
    const html = `<div class="tl-top">${tabs}Job Lv <b>${jobLv}</b>　剩餘點數 <b class="pts">${total - spent}</b> / ${total}
      <span style="flex:1"></span><button class="btn ${minus ? 'primary' : ''}" id="tlMinus">${minus ? '減點模式：開' : '減點模式'}</button></div>
      <small style="color:#6b7896">點擊＝加點、右鍵＝減點（手機用「減點模式」）。${dirty ? '<b style="color:#c8901a">有變更還沒套用</b>' : ''}</small>
      <div class="tl-panel"><div class="tl-head">${B ? B.name : char.job} <small>${B ? '二轉' : '一轉'}</small><span class="keys"><b>＋</b> 左鍵　<b class="m">－</b> 右鍵</span></div>
      <div class="tl-wrap"><div class="tl-tree" id="tlGrid" style="width:${W}px;height:${H}px"><svg class="tl-svg" id="tlSvg" width="${W}" height="${H}">${lines()}</svg>${g}</div></div></div>
      <div class="tl-info">${msg ? `<div class="tl-msg">${msg}</div>` : ''}${info}</div>`;
    openDlg(`${char.jobName || char.job}的天賦（PC 版技能樹）`, html, [
      ['套用', save, true],
      ['重置', () => { alloc = {}; msg = '已全部重置（按「套用」才會存）'; render(); }],
      ['復原', () => { alloc = { ...saved() }; msg = ''; render(); }],
    ], true);
    const grid = document.getElementById('tlGrid');
    grid.querySelectorAll('.tl-n').forEach(el => {
      const node = byId[el.dataset.id];
      el.onclick = () => { sel = node.id; change(node, minus ? -1 : 1); render(); };
      el.oncontextmenu = e => { e.preventDefault(); sel = node.id; change(node, -1); render(); };
    });
    document.getElementById('tlMinus').onclick = () => { minus = !minus; render(); };
    document.querySelectorAll('.tl-top [data-tree]').forEach(b => b.onclick = () => { tree = +b.dataset.tree; load(); render(); });
  }

  // 前置連線（PC 版樣式）：父節點右邊 → 往右半格 → 垂直到子節點那一列 → 接到子節點左邊
  function lines() {
    let out = '';
    for (const n of nodes) {
      if (!n.pre) continue;
      const p = pos[n.pre[0]], c = pos[n.id], on = (alloc[n.pre[0]] || 0) >= n.pre[1];
      const x1 = p.x * DX + 44, y1 = p.y * DY + 22, x2 = c.x * DX, y2 = c.y * DY + 22, xm = x2 - (DX - 44) / 2;
      out += `<path d="M${x1} ${y1}H${xm}V${y2}H${x2}" fill="none" stroke="${on ? '#5d7fd0' : '#9a8574'}" stroke-width="4" stroke-linejoin="round"/>`;
    }
    return out;
  }

  async function save() {
    try {
      const c = await call('POST', '/api/talents', { charId: char.id, alloc, tree });
      char = c; alloc = { ...saved() }; msg = ''; ctx.onSaved?.(c);
      sel = null; render();
      const box = document.querySelector('.tl-info'); if (box) box.innerHTML = `<b style="color:#2e8b57">已套用！下次出征生效。</b>（用了 ${c.spent} / ${total} 點）`;
    } catch (e) { msg = e.message || '存檔失敗'; render(); }
  }
  load(); render();
}
