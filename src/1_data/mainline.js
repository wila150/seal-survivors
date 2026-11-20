// 主線獎勵（docs/企劃_主線獎勵.md，11/21 使用者「照著建議做」）：時間階段寶箱、巡邏／快速巡邏、高章節保底
import { STAGES, stageTime } from './stages.js';
// 時間階段寶箱：每張地圖 3 個（時長的 1/3、2/3、全程）→ 15 分 5／10／15、11 分 4／8／11（分鐘取整）
export const msTimes = st => { const T = stageTime(st); return [Math.round(T / 3 / 60) * 60, Math.round(T * 2 / 3 / 60) * 60, T]; };
// 第 3 個寶箱的裝備品質（高章節保底）：平原 稀有、森林 稀有、墓地 史詩、紅土 傳說
export const MS_GEAR = [2, 2, 3, 4];
export function msReward(si, m) { // si＝地圖序 0～3、m＝第幾個 0～2
  const k = si + 1, gold = 200 * k * (m + 1);
  const mats = m === 0 ? { ore1: 5, ruby: 1 } : m === 1 ? { ore2: 3, diamond: 1 } : { god: 1, diamond: k };
  return { gold, mats, gear: m === 2 ? MS_GEAR[si] ?? 2 : null };
}
// 巡邏：最多累積 12 小時；每小時 金幣 60＋60n、強化金屬・一 1＋n、經驗＝最高通關地圖 60 隻怪（伺服器算）；每 2 小時 1 件裝備（n＝通關張數）
export const PATROL_CAP = 12 * 3600, PATROL_QUICK = [0, 300, 600], PATROL_QUICK_SECS = 2 * 3600;
export const patrolGear = n => [0, 1, 1, 2, 3][n] ?? 1; // 裝備品質（普通→傳說 0～4）
export function patrolYield(secs, n) {
  const h = Math.min(PATROL_CAP, Math.max(0, secs)) / 3600;
  return { hours: h, gold: Math.floor(h * (60 + 60 * n)), ore1: Math.floor(h * (1 + n)), gear: Math.floor(h / 2) };
}
export const clearedCount = cleared => STAGES.filter(s => (cleared || []).includes(s.key)).length;
