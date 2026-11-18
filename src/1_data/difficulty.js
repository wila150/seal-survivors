// 項目 41 v1.1：難度（11/18 使用者：「進場雖然是同一個關卡，但可以自己調整遊戲難易度，照 PC 數值去做」）
// 同一張地圖，自己選「怪物等級」：怪物 HP／攻擊照 PC 一般野外怪的等級曲線（pc-curve.js，tools/build-pc-curve.mjs 從服務端 monster.scr 產生）
//   倍率＝曲線(選的等級) ÷ 曲線(地圖本身等級)；預設＝地圖本身等級＝×1，跟原本完全一樣
// 另外保留 敵人數量、事件數量（精英頻率）×1～×20（不是怪物數值）；經驗與金幣不受難度影響；難度越高，結算寶箱裝備品質越好
import { RARITY } from './items.js';
import CURVE from './pc-curve.js';
export { CURVE };
export const DIFF_KEYS = [['count', '敵人數量'], ['event', '事件數量']];
export const DIFF_MAX = 20, LV_MAX = CURVE.max;
// 地圖本身的怪物等級＝stages.js 的 lv 字串開頭數字（1–8 → 1、9–15 → 9…）
export const stageBaseLv = st => Math.max(1, parseInt(String(st?.lv ?? '1'), 10) || 1);
export const defaultDiff = base => ({ count: 1, event: 1, monLv: base || 1 });
export function cleanDiff(d, base = 1) {
  const o = defaultDiff(base); if (!d || typeof d !== 'object') return o;
  for (const [k] of DIFF_KEYS) o[k] = Math.max(1, Math.min(DIFF_MAX, Math.round(+d[k] || 1)));
  o.monLv = Math.max(base, Math.min(LV_MAX, Math.round(+d.monLv || base)));
  return o;
}
const at = (arr, lv) => arr[Math.max(1, Math.min(LV_MAX, lv)) - 1];
// 實際乘在怪物身上的倍率
export function diffMods(d, base = 1) {
  const x = cleanDiff(d, base);
  return { spawn: x.count, event: x.event, speed: 1, hp: at(CURVE.hp, x.monLv) / at(CURVE.hp, base), dmg: at(CURVE.atk, x.monLv) / at(CURVE.atk, base), monLv: x.monLv };
}
// 難度分數＝等級差＋(數量−1)＋(事件−1) → 裝備倍率（一般寶箱，最高 ×20）、掉寶倍率（首領寶箱，最高 ×12.5）
export function diffLoot(d, base = 1) {
  const x = cleanDiff(d, base), score = (x.monLv - base) + (x.count - 1) + (x.event - 1);
  return { score, gear: +Math.min(20, 1 + score / 10).toFixed(1), boss: +Math.min(12.5, 1 + score / 16).toFixed(1) };
}
export const lootBonus = (mult, base) => base + 0.35 * (mult - 1);
export function legendRate(bonus) {
  const ws = RARITY.map((r, i) => r.w * (1 + bonus * i)); return ws.at(-1) / ws.reduce((a, b) => a + b, 0);
}
// PC 該等級一般野外怪的參考數值（顯示用）
export const pcRef = lv => ({ hp: at(CURVE.hp, lv), atk: at(CURVE.atk, lv) });
