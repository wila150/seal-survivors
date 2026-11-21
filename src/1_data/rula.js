// PC 飛越廣場・嚕啦生死鬥（企劃_PC系統補齊 #22；2u news id=77）。照 PC，割草版沒有的標 🔢
//   單人、每個角色每天 1 次；最多 200 關，每 5 關是首領關；每關 600 秒內打完全部怪而且「次元控制器」沒被打壞 → 自動進下一關
//   失敗：時間到還沒打完、或次元控制器被打壞（割草版：自己倒下也算結束）
//   分數：每過 2 關得分，第 (2k−1)～2k 關＝12k 分（1～2 關 12 分 … 199～200 關 1200 分）；每天每個帳號第一個進場的角色先送 100 分
//   已經過的關卡可以從最高關接著打；排名看最高關卡＋花的時間
//   割草版換算 🔢：怪物種類照關卡段（1～50 平原、51～100 森林、101～150 墓地、151～ 紅土），強度照賢者之塔每層公式（HP +18％／關、攻擊 +8％／關）；
//     每關怪數 12＋每 5 關 +2（最多 40），首領關＝1 隻首領＋6 隻小怪；次元控制器 HP 100、怪貼著它每隻每秒 −4，每關開始補滿；
//     獎勵：Job 經驗照擊殺數算（同出征）、分數記在角色上（排名用），另外每 1 分＝1 金幣寄信箱
export const RULA_NAME = '嚕啦生死鬥', RULA_MAX = 200, RULA_BOSS_EVERY = 5, RULA_SECS = 600, RULA_ENTRY_BONUS = 100;
export const CTRL_HP = 100, CTRL_DPS = 4, CTRL_AGGRO = 10;
export const rulaSeg = s => Math.min(3, Math.floor((s - 1) / 50));
export const rulaHpMul = s => 1 + 0.18 * (s - 1);
export const rulaDmgMul = s => 1 + 0.08 * (s - 1);
export const isBossStage = s => s % RULA_BOSS_EVERY === 0;
export const rulaCount = s => isBossStage(s) ? 6 : Math.min(40, 12 + Math.floor(s / 5) * 2);
// 打過 from（不含）到 to（含）之間得到的分數：每打完偶數關 2k 得 12k
export function rulaScore(from, to) { let p = 0; for (let s = from + 1; s <= to; s++) if (s % 2 === 0) p += 6 * s; return p; }
