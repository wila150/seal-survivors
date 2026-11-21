// PC 希望藍圖（2u news id=78）成長型任務。PC 規則：依等級顯示可接的任務 → 收取任務 → 畫面顯示進度 → 完成後收取獎勵；
//   成長型任務每個只能完成一次；「移動」＝快速傳送到任務地圖；獎勵＝經驗、名聲、希望幣、R 代幣、道具（拉迪克斯系列防具）
// 割草版：
//   等級＝Job Lv（裝備、掉寶都看 Job）；本作 Job 上限 70 → 只收 Lv20～40（Lv50 以上 PC 任務的怪本作都沒有）
//   只收本作地圖有的怪（PC「大號法師咕咕」等對到本作「法師咕咕」）；本作沒有的怪的任務拿掉（空手道毛毛蟲、藍瓢蟲、大盜羊咩咩、南瓜小丸子、黃金瓢蟲、幽靈魔法師）
//   擊殺數在出征結算時算（只算收取任務之後、自己打死的）；「移動」＝打開出征視窗選好那張地圖
//   經驗：PC 是 Base 經驗 → 換算成「升幾級的量」再乘本作 Job 升級經驗（PC 經驗 ÷ PC 那級升級經驗 × 本作那級 Job 升級經驗）
//   名聲照 PC（名聲表也是 PC 原版）；希望幣 ÷1000 → 金幣 🔢（跟在線獎勵錢包同比例）
//   R 代幣：先存進背包（R 幣商店 2u 沒列內容 → 未做）
//   拉迪克斯防具：本作沒有這個系列 → 送同部位、任務等級的精良裝備 🔢
//   Lv40「拉迪克斯的強化用木劍＋水晶合成」→ 割草版改成「身上或背包有一件 +1 以上的裝備」（合成系統照 PC，木劍道具本作沒有）
import { NEED } from './pc-level.js';
const R20 = { exp: 116565, fame: 40, coin: 16000, r: 3 }, R30 = { exp: 274113, fame: 80, coin: 31000, r: 5 }, R40 = { exp: 1034865, fame: 120, coin: 46000, r: 7 };
export const BP_TASKS = [
  { id: 'g20a', lv: 20, kill: [['法師咕咕', 10]], pc: '擊殺 10 隻 [Lv28] 大號法師咕咕', stage: 'forest', ...R20, gear: 'bottom', gearName: '拉迪克斯的輕便下褲' },
  { id: 'g20b', lv: 20, kill: [['護士咕咕', 10]], pc: '擊殺 10 隻 [Lv29] 大號護士咕咕', stage: 'grave', ...R20, gear: 'shoes', gearName: '拉迪克斯的輕便靴子' },
  { id: 'g30a', lv: 30, kill: [['戰士咕咕', 10]], pc: '擊殺 10 隻 [Lv30] 大號戰士咕咕', stage: 'grave', ...R30 },
  { id: 'g30b', lv: 30, kill: [['南瓜舞者', 10]], pc: '擊殺 10 隻 [Lv30] 南瓜舞者', stage: 'grave', ...R30 },
  { id: 'g30c', lv: 30, kill: [['熊寶寶', 10]], pc: '擊殺 10 隻 [Lv31] 熊寶寶', stage: 'desert', ...R30 },
  { id: 'g40a', lv: 40, refine: 1, pc: '找拉迪克斯拿強化用木劍＋水晶，合成強化後完成', stage: null, ...R40, gear: 'head', gearName: '拉迪克斯的精心頭盔' },
  { id: 'g40b', lv: 40, kill: [['熊爸爸', 10], ['熊媽媽', 10]], pc: '擊殺 10 隻 [Lv40] 熊爸爸、10 隻 [Lv33] 熊媽媽', stage: 'forest', ...R40, gear: 'top', gearName: '拉迪克斯的精心盔甲' },
  { id: 'g40c', lv: 40, kill: [['幽靈戰士', 3]], pc: '擊殺 3 隻 [Lv45] 幽靈戰士（PC 還要 10 隻幽靈魔法師，本作沒有）', stage: 'grave', ...R40, gear: 'shoes', gearName: '拉迪克斯的精心靴子' },
];
export const BP_LEVELS = [...new Set(BP_TASKS.map(t => t.lv))];
export const bpTask = id => BP_TASKS.find(t => t.id === id) || null;
export const bpGold = t => Math.round(t.coin / 1000);
export const bpJobExp = (t, jobNeed) => Math.round(t.exp / NEED[t.lv - 1] * jobNeed(t.lv));
export const bpGoalText = t => t.refine ? `合成：擁有一件 +${t.refine} 以上的裝備` : t.kill.map(([m, n]) => `擊殺 ${m} ×${n}`).join('、');
// 進度：d.bp = { cur: 任務 id | null, prog: { 怪名: 數量 }, done: [id...] }
export function bpAddKills(bp, mobKills) {
  const t = bpTask(bp?.cur); if (!t?.kill || !mobKills || typeof mobKills !== 'object') return false;
  let ch = false; for (const [m, n] of t.kill) { const k = Math.max(0, Math.min(500, +mobKills[m] | 0)); if (!k) continue; bp.prog ??= {}; const v = Math.min(n, (bp.prog[m] || 0) + k); if (v !== bp.prog[m]) { bp.prog[m] = v; ch = true; } }
  return ch;
}
export const bpKillDone = (t, bp) => !!t.kill && t.kill.every(([m, n]) => (bp?.prog?.[m] || 0) >= n);
