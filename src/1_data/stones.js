// 項目 28：鑲嵌石系統（照 PC 原版：2u catid=107&id=735「鑲嵌石系統」）。前後端共用
// PC 規則 → 割草版：
//   - 每個角色有紅色／朱黃色／黃色三顆石頭，各自 +0～+12 強化合成；成功就升一階並出現 1 條屬性（可重複、會疊加）
//   - 每階要閃亮結晶＋七彩粉末＋金幣，成功率照原版；成功失敗材料都會消失
//   - 升到 +3／+6／+9／+12 時屬性池多一條稀有屬性
//   - 變更屬性：重抽「目前這一階」的屬性與數值；用石頭屬性固定券只重抽數值；每次用掉 1 次變更次數（上限 300，充值券 +50）
//   - 初始化：回 +0、屬性全部消失
//   - 材料：分解「合成寶石」得閃亮粉末（必得）、閃亮結晶、七彩粉末（機率）；寶石收藏家扎羅 10 粉末換 1 結晶
//     割草版沒有合成寶石 → 改成分解裝備：普通／精良＝水晶、稀有＝紅寶石、史詩＝鑽石、傳說＝粉紅鑽（掉落表照原版）
//   - 原版屬性有命中率、回避率、AP(%)，割草版沒有這些 → 不出；屬性機率與數值照服務端 Stone_LevelStatus／Stone_StatusGroup（11/18）
//   - 希望幣 ÷1000
export const STONES = {
  red:    { name: '紅色石頭',   color: '#e0483c', extra: 'haste', rare: 'dmgUp' },
  orange: { name: '朱黃色石頭', color: '#f0902c', extra: 'speed', rare: 'dmgDown' },
  yellow: { name: '黃色石頭',   color: '#e8c020', extra: 'crit',  rare: 'hp' },
};
// 屬性（11/18 改照服務端 scripts/Stone_*.scr 原版數值）：
//   pid＝原版屬性編號（Stone_StatusGroup 第 2 欄）；dist＝原版數值分布 [最小, 最大, 累積機率/10000]（Stone_StatusGroup）
//   原版數值是 PC 的屬性點（攻擊力 1～100、攻速／必殺 1～30、稀有 1～5），割草版用 per 換算成效果：效果＝原版值 × per
//   （換算比例是割草版自訂：讓平均值跟之前暫定的差不多）
const D100 = [[1, 15, 3205], [16, 30, 7205], [31, 45, 9205], [46, 60, 9605], [61, 70, 9835], [71, 80, 9935], [81, 90, 9985], [91, 100, 10000]];
const D30 = [[1, 6, 3000], [7, 12, 7000], [13, 18, 9000], [19, 24, 9700], [25, 30, 10000]];
const D5 = [[1, 1, 5870], [2, 2, 9370], [3, 3, 9870], [4, 4, 9995], [5, 5, 10000]];
export const STONE_ATTRS = {
  atk:     { name: '攻擊力',   pid: 1,  dist: D100, per: 0.0005, unit: '傷害' },
  magic:   { name: '魔法力',   pid: 2,  dist: D100, per: 0.0005, unit: '魔法傷害' },
  armor:   { name: '防禦力',   pid: 3,  dist: D100, per: 1 / 30, unit: '護甲', flat: true },
  haste:   { name: '攻擊速度', pid: 7,  dist: D30,  per: 0.001,  unit: '冷卻縮短' },
  speed:   { name: '移動速度', pid: 8,  dist: D30,  per: 0.001,  unit: '移速' },
  crit:    { name: '必殺技',   pid: 9,  dist: D30,  per: 0.0006, unit: '爆擊率' },
  dmgUp:   { name: '增加傷害', pid: 10, dist: D5,   per: 0.01,   unit: '傷害', rare: true },
  dmgDown: { name: '減少傷害', pid: 11, dist: D5,   per: 0.01,   unit: '受到傷害 -', rare: true },
  hp:      { name: 'HP(%)',    pid: 12, dist: D5,   per: 0.01,   unit: '最大 HP', rare: true },
};
// 每階出哪條屬性（Stone_LevelStatus；原版機率 ×100%）：攻擊力 10%、魔法力 10%、其他各 16%、稀有階 稀有屬性 2%
//   原版還有命中率（4）、回避率（5）、AP%（6）各 16%，割草版沒有 → 拿掉後其餘依比例放大
export const LEVEL_STATUS = {
  red:    { normal: { atk: 10, magic: 10, armor: 16, haste: 16 }, rare: { atk: 10, magic: 10, armor: 15, haste: 15, dmgUp: 2 } },
  orange: { normal: { atk: 10, magic: 10, armor: 16, speed: 16 }, rare: { atk: 10, magic: 10, armor: 15, speed: 15, dmgDown: 2 } },
  yellow: { normal: { atk: 10, magic: 10, armor: 16, crit: 16 },  rare: { atk: 10, magic: 10, armor: 15, crit: 15, hp: 2 } },
};
// 強化表：第 i 筆＝+i → +(i+1)：[閃亮結晶, 七彩粉末(紅／朱黃／黃), 成功率, 金幣]
export const STONE_UP = [
  [5, [1, 1, 1], 1.0, 1000], [5, [2, 2, 2], 1.0, 1000], [8, [4, 3, 3], 0.8, 2000], [8, [5, 4, 4], 0.8, 2000],
  [8, [6, 5, 5], 0.8, 2000], [12, [10, 6, 6], 0.6, 4000], [12, [8, 7, 7], 0.5, 4000], [12, [8, 8, 8], 0.5, 4000],
  [16, [12, 9, 9], 0.3, 8000], [16, [10, 10, 10], 0.3, 8000], [16, [10, 11, 11], 0.2, 8000], [20, [15, 12, 12], 0.1, 16000],
];
export const STONE_MAX = 12;
export const RARE_AT = [3, 6, 9, 12];
// 變更屬性：第 i 筆＝目前 +(i+1)：[閃亮結晶, 金幣]
export const STONE_CHANGE = [[1, 200], [1, 200], [2, 500], [2, 200], [2, 200], [4, 500], [4, 200], [4, 200], [8, 500], [8, 200], [8, 200], [16, 500]];
export const CHANGE_START = 50, CHANGE_MAX = 300, CHANGE_CHARGE = 50; // 初始次數原版沒寫，暫定 50
export const STONE_ORDER = Object.keys(STONES);

// 分解：裝備品質 → 原版合成寶石 → [粉末 min, max, 結晶機率, 七彩機率]
export const DECOMPOSE = [
  { gem: '水晶', dust: [1, 3], crystal: 0.01, rainbow: 0.02 },   // 普通
  { gem: '水晶', dust: [1, 3], crystal: 0.01, rainbow: 0.02 },   // 精良
  { gem: '紅寶石', dust: [2, 4], crystal: 0.02, rainbow: 0.025 }, // 稀有
  { gem: '鑽石', dust: [3, 5], crystal: 0.03, rainbow: 0.03 },    // 史詩
  { gem: '粉紅鑽', dust: [4, 6], crystal: 0.04, rainbow: 0.035 }, // 傳說
];
export const DUST_PER_CRYSTAL = 10;

export const newStone = () => ({ lv: 0, attrs: [], changes: CHANGE_START });
export const stoneOf = (stones, k) => stones?.[k] || newStone();
// 這一階（升到 lv）能出現的屬性與權重
export const attrWeights = (k, lv) => LEVEL_STATUS[k][RARE_AT.includes(lv) ? 'rare' : 'normal'];
export const attrPool = (k, lv) => Object.keys(attrWeights(k, lv));
// 照原版：先依權重抽屬性，再依數值分布抽原版值 pv；fixed＝固定券（只重抽數值）
export function rollAttr(k, lv, fixed = null, rand = Math.random) {
  let key = fixed;
  if (!key) { const W = attrWeights(k, lv), tot = Object.values(W).reduce((a, b) => a + b, 0); let r = rand() * tot; for (const [a, w] of Object.entries(W)) { key = a; if ((r -= w) < 0) break; } }
  const A = STONE_ATTRS[key], r = rand() * 10000, band = A.dist.find(d => r < d[2]) || A.dist.at(-1);
  return { k: key, pv: band[0] + Math.floor(rand() * (band[1] - band[0] + 1)) };
}
// 效果值（舊資料只有 v 就直接用）
export const attrValue = a => a.pv != null ? a.pv * STONE_ATTRS[a.k].per : a.v;
export const fmtAttr = a => { const A = STONE_ATTRS[a.k], v = attrValue(a);
  return a.pv != null ? `${A.name} +${a.pv}（${A.unit}${A.flat ? ' +' + +v.toFixed(1) : ' ' + (a.k === 'dmgDown' ? '' : '+') + +(v * 100).toFixed(2) + '%'}）` : `${A.name} +${A.flat ? v : +(v * 100).toFixed(1) + '%'}`; };
// 三顆石頭的屬性加總
export function stoneEffects(stones) {
  const out = {};
  for (const k of STONE_ORDER) for (const a of stoneOf(stones, k).attrs) out[a.k] = (out[a.k] || 0) + attrValue(a);
  return out;
}
