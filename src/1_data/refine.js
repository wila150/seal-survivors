// PC 合成系統 +12（2u news id=58）＋熔解（id=59）。照 PC 表，割草版沒有的地方標 🔢
//   合成：+1～+3 水晶、+4～+6 紅寶石、+7～+9 鑽石、+10～+12 粉紅鑽；成功率 100/100/100/70/60/50/40/36/27/15/10/5％
//   失敗：+3～+6 等級不變；+6→+7 降到 +3；+7→+8 降到 +2（G 化以上的裝備直接消失）；+8 以上道具消失
//   熔解石（進階合成）：藍 +5％、紅 +20％（+4～+6）；黑 +10％、白 +20％（+7～+9）；金 +10％（+10～+12）；不同種可同階段一起用；成功失敗都會消失
//   自動合成至 +6：背包有對應寶石就一路合到 +6（+3～+6 失敗不會降級）
//   熔解（鐵匠技能）：+5 以上的裝備 → 水晶（最多 2）、紅寶石（最多 3）、鑽石（最多 3）；機率 ×(1＋裝備等級/50 ％)
//   鑄煉熔解（NPC 雷）：+3 以上的裝備 → 依機率得 1 個熔解石，失敗裝備也會消失
// 舊存檔相容 🔢：沒有 PC 寶石時，原本的強化金屬（一：+1～+3、二：+4～+6、神之金屬／鋁：+7 以上）也可以當同一階的材料
export const REFINE_MAX = 12;
export const REFINE_RATE = [1, 1, 1, 0.7, 0.6, 0.5, 0.4, 0.36, 0.27, 0.15, 0.10, 0.05];
export const AUTO_TO = 6;
export const refineGem = lv => lv < 3 ? 'quartz' : lv < 6 ? 'ruby' : lv < 9 ? 'diamond' : 'pinkdia';
const legacyOre = it => it.refine < 3 ? 'ore1' : it.refine < 6 ? 'ore2' : it.slot === 'weapon' ? 'god' : 'alu';
// 這次要用哪個材料（先 PC 寶石，沒有才用舊強化金屬）
export const refineMat = (it, mats = {}) => { const g = refineGem(it.refine || 0), o = legacyOre(it); return (mats[g] || 0) > 0 ? g : (mats[o] || 0) > 0 ? o : g; };
// 失敗後的等級（-1＝道具消失）
export function refineFail(it) {
  const lv = it.refine || 0;
  if (lv < 6) return lv;
  if (lv === 6) return 3;
  if (lv === 7) return (it.gup || 0) > 0 ? -1 : 2;
  return -1;
}
export const refineBreaks = (lv, gup = 0) => lv >= 8 || (lv === 7 && gup > 0);
export const failText = it => { const f = refineFail(it); return f < 0 ? '失敗道具消失' : f === (it.refine || 0) ? '失敗等級不變' : `失敗降到 +${f}`; };
// 熔解石（item.scr 3693～3696、6859；圖示第 74 欄；售價第 36 欄 ÷1000）
export const MELT_STONES = {
  meltBlue:  { name: '藍色熔解石', icon: 768,  price: 2500,  add: 0.05, from: 3, to: 5 },
  meltRed:   { name: '紅色熔解石', icon: 769,  price: 2500,  add: 0.20, from: 3, to: 5 },
  meltBlack: { name: '黑色熔解石', icon: 770,  price: 3000,  add: 0.10, from: 6, to: 8 },
  meltWhite: { name: '白色熔解石', icon: 771,  price: 3000,  add: 0.20, from: 6, to: 8 },
  meltGold:  { name: '金色熔解石', icon: 1161, price: 10000, add: 0.10, from: 9, to: 11 },
};
export const stonesFor = lv => Object.keys(MELT_STONES).filter(k => lv >= MELT_STONES[k].from && lv <= MELT_STONES[k].to);
export const refineRate = (lv, stones = []) => Math.min(1, REFINE_RATE[lv] + [...new Set(stones)].reduce((t, k) => t + (MELT_STONES[k] && stonesFor(lv).includes(k) ? MELT_STONES[k].add : 0), 0));
// 熔解（2u 表的欄位對不齊 → 照下面解讀 🔢）：
//   +5：水晶 20％ ×2 次、紅寶石 20％×k ×3 次；+6 紅寶石改 30％×k；+7 起加鑽石 10／30／50％×k ×3 次（+7／+8／+9 以上）
export const MELT_MIN = 5, FORGE_MIN = 3;
export function meltYield(it, reqLv, rand = Math.random) {
  const r = it.refine || 0, k = 1 + (reqLv || 0) / 5000, /* 2u「×(1＋裝備等級/50×100%)」讀成多 Lv/50 個百分點 🔢 */ out = { quartz: 0, ruby: 0, diamond: 0 }; if (r < MELT_MIN) return out;
  const roll = (key, n, p) => { for (let i = 0; i < n; i++) if (rand() < Math.min(1, p)) out[key]++; };
  roll('quartz', 2, 0.2);
  roll('ruby', 3, (r >= 6 ? 0.3 : 0.2) * k);
  if (r >= 7) roll('diamond', 3, (r >= 9 ? 0.5 : r >= 8 ? 0.3 : 0.1) * k);
  return out;
}
// 鑄煉熔解：+3～+5 → 藍／紅、+6～+8 → 黑／白、+9 以上 → 金；機率與費用 2u 沒寫 🔢（機率 30％＋每多 1 級 5％、費用 200×強化等級）
export const forgeCost = it => 200 * (it.refine || 0);
export const forgeRate = it => Math.min(0.8, 0.3 + 0.05 * ((it.refine || 0) - FORGE_MIN));
export function forgeStone(it, rand = Math.random) {
  const r = it.refine || 0; if (r < FORGE_MIN || rand() >= forgeRate(it)) return null;
  const pool = r >= 9 ? ['meltGold'] : r >= 6 ? ['meltBlack', 'meltWhite'] : ['meltBlue', 'meltRed'];
  return pool[Math.floor(rand() * pool.length)];
}
