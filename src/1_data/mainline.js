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
// 巡邏：最多累積 12 小時；每小時收益看打到的那張圖（PATROL_STAGE）；每 2 小時 1 件裝備（品質看通關張數 n）
export const PATROL_CAP = 12 * 3600, PATROL_QUICK = [0, 300, 600], PATROL_QUICK_SECS = 2 * 3600;
export const patrolGear = n => [0, 1, 1, 2, 3][n] ?? 1; // 裝備品質（普通→傳說 0～4）
// 11/21 使用者：「打到哪張圖，只有該圖收益，不會所有地圖」→ 每小時收益看「打到的那張圖」（通關 n 張＝正在打第 n+1 張，全通關＝最後一張），不疊加
//   每張圖每小時：金幣 120／190／290／420、強化金屬・一 2／3／5／7、Job 經驗 1200／1900／2900／4200（＝地圖倍率 ×120／×2／×1200 取整；🔢 暫定）
export const PATROL_STAGE = [{ gold: 120, ore1: 2, exp: 1200 }, { gold: 190, ore1: 3, exp: 1900 }, { gold: 290, ore1: 5, exp: 2900 }, { gold: 420, ore1: 7, exp: 4200 }];
export const patrolStage = n => Math.min(Math.max(0, n | 0), STAGES.length - 1); // 打到第幾張（0＝平原）
export function patrolYield(secs, n) {
  const h = Math.min(PATROL_CAP, Math.max(0, secs)) / 3600, R = PATROL_STAGE[patrolStage(n)];
  return { hours: h, stage: patrolStage(n), gold: Math.floor(h * R.gold), ore1: Math.floor(h * R.ore1), jexp: Math.floor(h * R.exp), gear: Math.floor(h / 2) };
}
export const clearedCount = cleared => STAGES.filter(s => (cleared || []).includes(s.key)).length;
