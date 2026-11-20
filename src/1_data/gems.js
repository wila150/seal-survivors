// 項目 28：技能寶石系統（照 PC 原版：2u catid=107&id=1088「技能寶石系統」）
// 前後端共用。PC 規則 → 割草版：
//   - 技能寶石欄 5 格，依角色等級＋花錢開啟；每格放「一招局內技能＋一顆已開放的技能寶石」
//   - 同一招可以裝多顆，但同屬性只能一顆；只能在主城裝／卸
//   - 寶石級別 N／G／DG／XG；要先「開放」才能裝：最多 10 次附魔，太陽 15%／月亮 40%／星星 70%，
//     失敗 8 次以上才能點彗星（100%）；成功加該圖案的數值，失敗不加；總屬性＝基礎屬性＋成功的附魔
//   - 合成：3 顆同級（類型、屬性、有沒有開放都不限）→ 1 顆，成功率 100%：同級 26%／高一級 74%（XG 合成必定 XG；11/20 照 2u id=56 修正，原本誤寫 32%）
//   - 局內技能都是攻擊技，只收攻擊型寶石；遊戲沒有命中率，命中率寶石不收（PC 也是「技能沒有對應屬性就不生效」）
//   - 希望幣 ÷1000；等級門檻 PC 100／150／200／250／300 → Base Lv 33／50／67／83／99（PC 300 等對我們 99 等；11/20 照 2u id=56：第 1 格也要 PC Lv100，原本誤寫 1）
export const GRADES = ['N', 'G', 'DG', 'XG'];
export const GEM_ATTRS = {
  dmg:     { name: '傷害增加',     desc: '該技能傷害',      base: [0, 1, 1.8, 2.6], pat: [[1.8, 1.4, 1, 7], [2.4, 2.1, 1.8, 12.6], [3.2, 2.9, 2.6, 18.2], [4, 3.7, 3.4, 23.8]] },
  crit:    { name: '致命機率增加', desc: '該技能爆擊率',    base: [0, 0.7, 1.5, 2.5], pat: [[1.5, 1.1, 0.7, 4.9], [2.5, 2, 1.5, 10.5], [3.5, 3, 2.5, 17.5], [5, 4.5, 4, 28]] },
  critDmg: { name: '致命係數增加', desc: '該技能爆擊傷害',  base: [0, 0.7, 1.5, 2.5], pat: [[1.5, 1.1, 0.7, 4.9], [2.5, 2, 1.5, 10.5], [3.5, 3, 2.5, 17.5], [5, 4.5, 4, 28]] },
  cd:      { name: '冷卻時間減少', desc: '該技能冷卻',      base: [0, 0.2, 1, 1.6], pat: [[1.2, 0.7, 0.2, 1.4], [1.8, 1.4, 1, 7], [2.4, 2, 1.6, 11.2], [3, 2.6, 2.2, 15.4]] },
};
// 附魔圖案：太陽、月亮、星星、彗星（彗星要失敗 8 次以上才能點）
export const PATTERNS = [{ key: 'sun', name: '太陽', rate: 0.15 }, { key: 'moon', name: '月亮', rate: 0.4 }, { key: 'star', name: '星星', rate: 0.7 }, { key: 'comet', name: '彗星', rate: 1, needFails: 8 }];
export const OPEN_TRIES = 10;
export const OPEN_COST = [35, 80, 160, 250];          // 每次附魔（PC 35000／80000／160000／250000）
export const FUSE_COST = [140, 320, 640, 1000];       // 合成（PC 140000～1000000）
export const FUSE_NEED = 3, FUSE_UP = 0.74;           // PC：同級 26%／高一級 74%
export const SLOT_LV = [33, 50, 67, 83, 99];
export const SLOT_COST = [3500, 7500, 14500, 24500, 50000];
export const GEM_MAX = 200;                            // 寶石袋上限
// 寶石圖示＝PC 原版（2u id=56 的道具圖，assets/gems/<屬性>_<級別>.png：N 三角 → XG 寶石）
export const gemIcon = g => `assets/gems/${g.attr}_${g.grade}.png`;

let seq = 0;
export const newGem = (grade, attr, rand = Math.random) => ({
  id: Date.now() * 100 + (seq++ % 100), grade, attr: attr || Object.keys(GEM_ATTRS)[Math.floor(rand() * 4)],
  opened: false, tries: [], fails: 0,
});
// 寶石目前的總屬性（%）：基礎＋成功的附魔
export const gemValue = g => +(GEM_ATTRS[g.attr].base[g.grade] + g.tries.reduce((t, r) => t + (r.ok ? GEM_ATTRS[g.attr].pat[g.grade][r.p] : 0), 0)).toFixed(2);
export const gemName = g => `${GRADES[g.grade]}級［攻擊］${GEM_ATTRS[g.attr].name}`;
// 首領寶箱掉落：N 70%、G 25%、DG 5%（XG 只能合成）
export function rollGem(rand = Math.random) { const r = rand(); return newGem(r < 0.7 ? 0 : r < 0.95 ? 1 : 2, null, rand); }

// 附魔一次：回傳錯誤訊息或 null（會改 g）
export function enchant(g, p, rand = Math.random) {
  const P = PATTERNS[p]; if (!P) return '沒有這個圖案';
  if (g.opened) return '這顆已經開放了';
  if (g.tries.length >= OPEN_TRIES) return `已經附魔 ${OPEN_TRIES} 次，按「開放」完成`;
  if (P.needFails && g.fails < P.needFails) return `失敗 ${P.needFails} 次以上才能點${P.name}`;
  const ok = rand() < P.rate; g.tries.push({ p, ok }); if (!ok) g.fails++;
  return null;
}

// 裝備檢查：slots＝[{ skill, gem }|null ×5]；回錯誤或 null
export function checkGemSlots(slots, open, gems, skillOk) {
  if (!Array.isArray(slots) || slots.length > 5) return '寶石欄不對';
  const used = new Set(), pair = new Set();
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i]; if (!s) continue;
    if (i >= open) return `第 ${i + 1} 格還沒開啟`;
    const g = gems.find(x => x.id === s.gem); if (!g) return '找不到寶石';
    if (!g.opened) return '還沒開放的技能寶石不能裝';
    if (!skillOk(s.skill)) return '沒有這招技能';
    if (used.has(g.id)) return '同一顆寶石不能裝兩格';
    const k = s.skill + ':' + g.attr; if (pair.has(k)) return `同一招不能裝兩顆「${GEM_ATTRS[g.attr].name}」`;
    used.add(g.id); pair.add(k);
  }
  return null;
}
// 裝好的寶石 → 每招加成 { dmg, crit, critDmg, cd }（小數）
export function gemEffects(slots, gems) {
  const out = {};
  for (const s of slots || []) {
    const g = s && gems?.find(x => x.id === s.gem); if (!g || !g.opened) continue;
    const m = out[s.skill] ??= { dmg: 0, crit: 0, critDmg: 0, cd: 0 }; m[g.attr] += gemValue(g) / 100;
  }
  return out;
}
