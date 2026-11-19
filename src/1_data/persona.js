// 個性化系統 v2（照台服官方 wiki id=110，docs/參考_官方wiki.md；前後端共用）
// - 貨幣＝名聲：目前名聲＝累積名聲 − 用掉的名聲（稱號照累積名聲算，不會倒退）
// - 主要個性：階段 0～10。展現能力值（消耗名聲，階段越高越貴）：條數依階段 1～4 條、同一次不重複、等級 S／A／B；
//   個性化固定券可以鎖定「能力種類」（不鎖數值，重新展現時等級可能變）；能力種類依階段越高越多
// - 升級：消耗名聲、有成功率（越高越低）；5 階段以後失敗會累積校正值（下次成功率提高），直到成功
// - 次要個性：可強化次數依階段（每階段 3 次），成功率 100%，每次對應素質 +3
// - 初始化：選一項次要個性、自己決定返還幾次，消耗名聲＋希幣（依階段）
// 數值（名聲價格、成功率、能力值）官方 wiki 沒寫 → 🔢 暫定
export const PERSONA_MAX = 10;
export const ABILITIES = [ // 依解鎖順序；值＝[S, A, B]
  { k: 'atk', name: '攻擊力', v: [0.08, 0.05, 0.03], pct: true },
  { k: 'hp', name: '最大 HP', v: [0.1, 0.06, 0.03], pct: true },
  { k: 'crit', name: '爆擊率', v: [0.05, 0.03, 0.015], pct: true },
  { k: 'armor', name: '護甲', v: [4, 2, 1] },
  { k: 'haste', name: '冷卻縮短', v: [0.08, 0.05, 0.03], pct: true },
  { k: 'speed', name: '移動速度', v: [0.06, 0.04, 0.02], pct: true },
  { k: 'magnet', name: '吸取範圍', v: [0.3, 0.2, 0.1], pct: true },
  { k: 'dmgDown', name: '受到傷害減少', v: [0.06, 0.04, 0.02], pct: true },
  { k: 'exp', name: '經驗', v: [0.1, 0.06, 0.03], pct: true },
  { k: 'magic', name: '魔法傷害', v: [0.1, 0.06, 0.03], pct: true },
];
export const GRADE = ['S', 'A', 'B'];
export const lineCount = lv => lv >= 9 ? 4 : lv >= 6 ? 3 : lv >= 3 ? 2 : lv >= 1 ? 1 : 0;
export const kindsAt = lv => ABILITIES.slice(0, Math.min(ABILITIES.length, 4 + lv));
export const rollCost = lv => 100 * (lv + 1);                     // 展現（名聲）
export const upCost = lv => Math.round(400 * Math.pow(lv + 1, 1.5)); // 升級（名聲）
export const UP_RATE = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.25, 0.2];
export const CORR_STEP = 0.05;                                    // 5 階段後每次失敗 +5%
export const subMax = lv => lv * 3;                               // 次要個性可強化次數
export const SUB_GOLD = 300;                                      // 次要個性強化（希幣）
export const initCost = (lv, n) => ({ fame: 30 * (lv + 1) * n, gold: 200 * n });
// 階段 → 稱號顏色
export const STAGE_COLOR = ['#e8e8e8', '#e8e8e8', '#7dff9a', '#7dff9a', '#4fb4ff', '#4fb4ff', '#b07cff', '#b07cff', '#ffa940', '#ffa940', '#ff5a4a'];
// 擲一條等級：S 10%／A 35%／B 55%
export const rollGrade = (r = Math.random()) => r < 0.1 ? 0 : r < 0.45 ? 1 : 2;
export const lineText = l => { const A = ABILITIES.find(a => a.k === l.k); if (!A) return ''; const v = A.v[l.g]; return `${A.name} +${A.pct ? Math.round(v * 1000) / 10 + '%' : v}（${GRADE[l.g]}）`; };
// 角色加成（game.js reset() 用）
export function personaBonus(P) {
  const o = {}; for (const l of P?.lines || []) { const A = ABILITIES.find(a => a.k === l.k); if (A) o[l.k] = (o[l.k] || 0) + A.v[l.g]; } return o;
}
