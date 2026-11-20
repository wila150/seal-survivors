// 組隊 BUFF（11/20 使用者貼 PC「3.組隊BUFF效果」）：根據職業給整隊不同的增益，所以隊伍可以挑職業搭配
// PC 規則：同地區至少 1 名隊員才有效、隊員越多效果越強；每職業還附「持續恢復 AP」
// 割草版：組隊副本 2 人以上生效；隊上每有一種職業就給全隊那一種增益（同職業不重複疊）；強度 × 隊友人數（自己以外，1～3）🔢
//   - 原版效果數值沒有公開資料（服務端腳本找不到），每位隊友的量是暫定 🔢
//   - 持續恢復 AP：割草版技能沒有 AP，不做
//   - 獵人「命中率」：割草版不會打不中 → 換成對精英／首領傷害（原版命中就是打高等怪才重要）
//   - 鐵匠「道具掉落機率」→ 精英掉一般寶箱的機率；饕客：割草版沒有這個職業
export const PARTY_BUFF = {
  劍士: { name: '劍士的鼓舞', desc: k => `攻擊力 +${Math.round(k * 4)}%`, apply: (P, k) => { P.might *= 1 + 0.04 * k; } },
  騎士: { name: '騎士的智慧', desc: k => `護甲 +${k * 2}`, apply: (P, k) => { P.armor += 2 * k; } },
  法師: { name: '法師的策略', desc: k => `技能傷害 +${k * 4}%`, apply: (P, k) => { P.skd = (P.skd || 0) + 0.04 * k; } },
  祭司: { name: '祭司的激勵', desc: k => `最大 HP +${k * 5}%`, apply: (P, k) => { P.maxHp = Math.round(P.maxHp * (1 + 0.05 * k)); P.hp = P.maxHp; } },
  小丑: { name: '小丑的催促', desc: k => `移動速度 +${k * 3}%`, apply: (P, k) => { P.speed *= 1 + 0.03 * k; } },
  鐵匠: { name: '鐵匠的眼光', desc: k => `爆擊率 +${(k * 1.5).toFixed(1)}%、精英掉寶箱機率 +${k * 5}%`, apply: (P, k) => { P.crit += 0.015 * k; P.pbLoot = (P.pbLoot || 0) + 0.05 * k; } },
  獵人: { name: '獵人的知識', desc: k => `對精英／首領傷害 +${k * 5}%（原版：命中率）`, apply: (P, k) => { P.pbHit = (P.pbHit || 0) + 0.05 * k; } },
};
// 這隊有哪些組隊 BUFF：jobs＝全隊職業（含自己）
export function partyBuffs(jobs = []) {
  const n = jobs.length, k = Math.min(3, n - 1); if (k < 1) return [];
  return [...new Set(jobs)].filter(j => PARTY_BUFF[j]).map(j => ({ job: j, k, ...PARTY_BUFF[j], text: PARTY_BUFF[j].desc(k) }));
}
