// 項目 26／27：局外天賦樹規則（前後端共用）。資料在 assets/data/talents.json（tools/build-talents.mjs 產生）
// alloc＝{ PC技能id: 等級 }。一轉樹點數＝min(Job Lv, 50)；二轉後 Job Lv 接著升到 100，二轉樹點數＝Job Lv − 50
export const JOB1_MAX = 50, JOB2_MAX = 100, JOB3_MAX = 130; // 項目 40：三轉後 Job 101～130（點數跟二轉樹共用，三轉節點門檻 101）

// 二轉分支（branch＝'A'／'B'），沒有就回 null
export const branchOf = (T, job, key) => T.jobs[job]?.branches?.find(b => b.key === key) || null;
// 這棵樹的節點：branch 給 null＝一轉樹
export const treeNodes = (T, job, branch) => (branch ? branchOf(T, job, branch)?.nodes : T.jobs[job]?.nodes) || [];
export const talentPoints = (jobLv, branch = null) => branch ? Math.max(0, (jobLv | 0) - JOB1_MAX) : Math.max(0, Math.min(JOB1_MAX, jobLv | 0));
export const spentPoints = alloc => Object.values(alloc || {}).reduce((t, v) => t + (v | 0), 0);

// 檢查一棵樹的整份配點：回傳錯誤訊息，合法回 null
export function checkTalents(T, job, jobLv, alloc, branch = null) {
  if (!T.jobs[job]) return '這個職業沒有天賦樹';
  if (branch && !branchOf(T, job, branch)) return '還沒有二轉';
  if (!alloc || typeof alloc !== 'object' || Array.isArray(alloc)) return '天賦資料不對';
  const nodes = treeNodes(T, job, branch), byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  for (const [id, lv] of Object.entries(alloc)) {
    const n = byId[id];
    if (!n) return '沒有這個天賦';
    if (!Number.isInteger(lv) || lv < 0 || lv > n.max) return `${n.name} 等級不對`;
    if (!lv) continue;
    if (jobLv < n.gate) return `${n.name} 要 Job Lv ${n.gate}`;
    if (n.pre && (alloc[n.pre[0]] || 0) < n.pre[1]) return `${n.name} 要先把 ${byId[n.pre[0]].name} 點到 ${n.pre[1]}`;
  }
  if (spentPoints(alloc) > talentPoints(jobLv, branch)) return '天賦點數不夠';
  return null;
}

// 配點 → 效果加總（一轉樹＋二轉樹）：stat（atk、hp…）、skill（技能 key → { dmg, cd }）、tag（fire／ice／heavy → 傷害％）
export function talentEffects(T, job, alloc, branch = null, alloc2 = null) {
  const out = { stat: {}, skill: {}, tag: {} };
  const add = (nodes, a) => {
    if (!a) return;
    for (const n of nodes) {
      const lv = a[n.id] | 0; if (!lv) continue;
      for (const [k, v] of Object.entries(n.eff)) {
        if (k.startsWith('skill:')) { const s = out.skill[k.slice(6)] ??= { dmg: 0, cd: 0 }; s.dmg += T.skillMod.dmg * v * lv; s.cd += T.skillMod.cd * v * lv; }
        else if (k.startsWith('tag:')) out.tag[k.slice(4)] = (out.tag[k.slice(4)] || 0) + v * lv;
        else out.stat[k] = (out.stat[k] || 0) + v * lv;
      }
    }
  };
  add(treeNodes(T, job, null), alloc);
  if (branch) add(treeNodes(T, job, branch), alloc2);
  return out;
}

const STAT_TXT = { atk: '所有傷害', phys: '物理傷害', magic: '魔法傷害', hp: '最大 HP', speed: '移動速度', haste: '冷卻縮短', crit: '爆擊率', magnet: '吸取範圍' };
const TAG_TXT = { fire: '火屬性技能傷害', ice: '冰屬性技能傷害', heavy: '重擊技能傷害' };
const pct = v => `+${+(v * 100).toFixed(1)}%`;
// 天賦說明（lv 級時的總效果）；skillName(key) 給技能名
export function talentDesc(T, n, lv, skillName = k => k) {
  const L = Math.max(1, lv);
  return Object.entries(n.eff).map(([k, v]) => {
    if (k.startsWith('skill:')) return `局內「${skillName(k.slice(6))}」傷害 ${pct(T.skillMod.dmg * v * L)}、冷卻 ${+(T.skillMod.cd * v * L * 100).toFixed(1)}%`;
    if (k.startsWith('tag:')) return `${TAG_TXT[k.slice(4)]} ${pct(v * L)}`;
    if (k === 'armor') return `護甲 +${+(v * L).toFixed(1)}`;
    if (k === 'regen') return `每秒回復 HP +${+(v * L).toFixed(2)}`;
    return `${STAT_TXT[k]} ${pct(v * L)}`;
  }).join('、');
}

// ===== 項目 28：技能屬性鑑定（照 PC 原版：2u news_info.php?id=1199）=====
// 主武器、防具可以鑑定；必定出 1 條「某技能 Lv+N」；N 依該技能的最大提升等級查機率表；
// 加上去不能超過技能上限，角色沒點過（沒學）的技能不會提升。費用照 PC 比例 ÷1000（PC：武器 100 萬、防具 150 萬、選擇職業 500 萬希望幣）
export const IDENT_SLOTS = ['weapon', 'armor'];
export const IDENT_COST = { weapon: 1000, armor: 1500 }, IDENT_PICK_COST = 5000;
export const IDENT_PROB = { 2: [0.3, 0.7], 3: [0.3, 0.25, 0.45], 4: [0.3, 0.25, 0.3, 0.15], 5: [0.3, 0.25, 0.3, 0.1, 0.05] };
export const identMax = n => Math.max(2, Math.min(5, n.max));
// 這個職業可以鑑定出的技能＝一轉樹＋兩條二轉樹（PC：該一轉及其所有二轉、三轉職業的技能）
export function identPool(T, job) {
  const J = T.jobs[job]; if (!J) return [];
  return [...J.nodes.map(n => ({ tree: 0, n })), ...(J.branches || []).flatMap(b => b.nodes.map(n => ({ tree: b.key, n })))];
}
export function rollIdent(T, job, rand = Math.random) {
  const pool = identPool(T, job), { tree, n } = pool[Math.floor(rand() * pool.length)];
  const P = IDENT_PROB[identMax(n)]; let r = rand(), lv = 1;
  for (let i = 0; i < P.length; i++) { if (r < P[i]) { lv = i + 1; break; } r -= P[i]; }
  return { job, tree, id: n.id, lv };
}
// 找鑑定結果對應的天賦節點
export function identNode(T, ident) {
  if (!ident) return null;
  const J = T.jobs[ident.job]; if (!J) return null;
  const nodes = ident.tree === 0 ? J.nodes : J.branches?.find(b => b.key === ident.tree)?.nodes;
  return nodes?.find(n => n.id === ident.id) || null;
}
// 穿著的裝備鑑定加成 → 實際生效的配點（只加已點過的天賦、不超過上限；二轉樹要是目前的分支）
export function boostedAlloc(T, job, alloc, branch, alloc2, items) {
  const a1 = { ...(alloc || {}) }, a2 = { ...(alloc2 || {}) };
  for (const it of items || []) {
    const id = it.equipped && it.ident; if (!id || id.job !== job) continue;
    const n = identNode(T, id); if (!n) continue;
    const a = id.tree === 0 ? a1 : id.tree === branch ? a2 : null;
    if (a && a[n.id] > 0) a[n.id] = Math.min(n.max, a[n.id] + id.lv);
  }
  return [a1, a2];
}
