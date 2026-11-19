// 11/20 使用者「照建議做」：技能傷害照 PC 每一級的傷害表（2u 資料站 info-table「伤害力」欄，tools/cache-2u/skill-dmg.json）
// PC 傷害＝攻擊力（或魔法力）× %。換算：PC 100% ＝ 我們 K 點傷害（物理 6、純魔法 7.5，讓整體清怪速度跟冷卻改成 PC 之前差不多）
// 招式之間的強弱、每一級的成長完全照 PC 的 %。環繞類（一直存在、每跳一次）只照 PC 的成長比例，Lv1 維持原本數值
// 不套用：PC 傷害欄是 0／被動加成／固定 100%（普攻、催眠曲、憤怒之力、奮力投擲、制鏈專家、上帝之手…）、投擲類被動（任意／隨意投擲、投擲炸彈）、初心者自訂招（n_*）
import fs from 'node:fs';
const F = 'assets/data/skills.json', S = JSON.parse(fs.readFileSync(F, 'utf8')), D = JSON.parse(fs.readFileSync('tools/cache-2u/skill-dmg.json', 'utf8'));
const SKIP = new Set(['renyi', 'suiyi', 'zhadan', 'k2_fenli', 'k2_shangdi', 'k2_fennu', 'k2_zhilian']);
const K_PHYS = 6, K_MAGIC = 7.5, r1 = v => Math.round(v * 10) / 10;
for (const [k, x] of Object.entries(D)) {
  const d = S.skills[k]; if (!d || SKIP.has(k) || k.startsWith('n_') || d.basic || !d.base?.dmg) continue;
  const pct = x.dmg.map(v => parseFloat(v)); if (!pct.every(v => v > 0) || !x.dmg.every(v => /%$/.test(v))) continue;
  let dm;
  if (d.type === 'ORBIT_AURA') { const b = d.pcBase ?? d.base.dmg; d.pcBase = b; dm = pct.map(p => r1(b * p / pct[0])); }
  else { const K = x.rel === '魔法力' ? K_MAGIC : K_PHYS; dm = pct.map(p => r1(K * p / 100)); }
  d.pcPct = pct; d.pcDmg = dm; d.base.dmg = dm[0]; if (d.per) delete d.per.dmg;
  console.log(k, d.name, x.rel, pct.join('/'), '→', dm.join('/'));
}
fs.writeFileSync(F, JSON.stringify(S, null, 1) + '\n');
