// PC 戰鬥力排名 BUFF（2u news id=52；數值照服務端 Game/scripts/Rank.scr）
// 每天 0 點（台灣時間）統計；依「同職業」的戰鬥力排名，前 50 名拿增益（第 1／2／3／4～20／21～50 名）
// Rank.scr 欄位：編號|?|名次起|名次迄|圖示|攻擊力|魔法力|?|?|命中率|?|回避率|移動速度|?|?|道具掉落率
export const RANK_BUFF = [ // [名次起, 名次迄, 攻擊力, 魔法力, 命中率, 回避率, 移動速度, 道具掉落率]
  [1, 1, 30, 30, 50, 50, 20, 15],
  [2, 2, 20, 20, 30, 30, 10, 10],
  [3, 3, 15, 15, 20, 20, 5, 5],
  [4, 20, 10, 10, 10, 10, 0, 0],
  [21, 50, 5, 5, 5, 5, 0, 0],
];
export const rankBuffOf = r => r ? RANK_BUFF.find(b => r >= b[0] && r <= b[1]) || null : null;
// 換算成割草版（🔢 PC 是固定值、本作是倍率）：攻擊力 N → 傷害 +N/10 %、魔法力 N → 技能傷害 +N/10 %、回避率 N → 迴避 +N/10 %、
// 移動速度 N → 移速 +N/10 %、道具掉落率 N → 菁英掉寶箱機率 +N %；命中率：割草版不會打不中 → 不生效（跟技能寶石一樣）
export function applyRankBuff(P, r) {
  const b = rankBuffOf(r); if (!b) return null;
  P.might *= 1 + b[2] / 1000; P.skd = (P.skd || 0) + b[3] / 1000; P.dodge = Math.min(0.4, (P.dodge || 0) + b[5] / 1000);
  P.speed *= 1 + b[6] / 1000; P.pbLoot = (P.pbLoot || 0) + b[7] / 100; return b;
}
export const rankBuffText = r => { const b = rankBuffOf(r); return b ? `攻擊力 +${b[2]}、魔法力 +${b[3]}、命中率 +${b[4]}、回避率 +${b[5]}${b[6] ? `、移動速度 +${b[6]}` : ''}${b[7] ? `、道具掉落率 +${b[7]}%` : ''}` : ''; };
