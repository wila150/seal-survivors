// 戰寵原版資料轉換：服務端 Game/scripts/bpet*.xml → src/1_data/pc-bpets.js
// 用法：node tools/build-bpets.mjs <Game/scripts 資料夾>
//   bpet.xml          四隻精靈（DB 1 光、2 黑暗、3 火、4 水）
//   bpet_level.xml    每種 × GRADE（growthtype 0 A／1 AA／2 AAA／3 S）× Lv1～100：升級經驗、復活費用、技能點、HP、攻擊、防禦、必殺
//   bpet_buff.xml     召喚中加給主人的屬性（同上三個維度）
//   bpet_skill.xml    戰寵技能（group＝一招，group_level 1～5；limit_kind 0＝共通；limit_level＝戰寵等級需求）
//   bpet_growthrate / bpet_upgrade / bpet_sys        GRADE 機率、覺醒、親密度／忠誠度／死亡懲罰
import fs from 'node:fs'; import path from 'node:path';
import { S2T } from './s2t.mjs';
// 戰寵技能說明用到、s2t.mjs 還沒收的簡體字
const MORE = '宠寵伤傷触觸仅僅让讓个個终終会會辅輔御禦节節约約数數标標时時减減缩縮连連续續却卻间間衅釁围圍复複范範内內给給拥擁后後惧懼声聲乱亂冲衝边邊满滿啸嘯产產晕暈挥揮为為荡蕩贯貫杀殺于於喷噴暂暫释釋并並临臨凛凜卷捲离離蕴蘊涡渦斩斬点點气氣电電从從获獲处處乌烏云雲';
for (let i = 0; i < MORE.length; i += 2) S2T[MORE[i]] ??= MORE[i + 1];
const t2 = s => [...s].map(c => S2T[c] || c).join('').replace(/([恢回])複/g, '$1復').replace(/Lv1後，即可使用的技能[。，]\s*/, '').replace(/\s*\(最終等級:?\s*\d+\)\s*/g, '').replace(/\s+/g, ' ').trim();
const dir = process.argv[2]; if (!dir) { console.error('用法：node tools/build-bpets.mjs <Game/scripts>'); process.exit(1); }
const rd = f => [...fs.readFileSync(path.join(dir, f + '.xml'), 'utf8').matchAll(/<item ([^>]*?)\/>/g)].map(m => Object.fromEntries([...m[1].matchAll(/(\w+)="([^"]*)"/g)].map(x => [x[1], x[2]])));
const KIND = { 1: 'light', 2: 'dark', 3: 'fire', 4: 'water' };
const n = v => +v || 0;
const LEVEL = {}, BUFF = {};
for (const r of rd('bpet_level')) { const k = KIND[r.kind]; if (!k) continue; ((LEVEL[k] ??= [[], [], [], []])[+r.growthtype])[+r.level - 1] = [n(r.exp), n(r.cost_revive), n(r.get_sp), n(r.hp), n(r.attack), n(r.defense), n(r.attack_critical)]; }
for (const r of rd('bpet_buff')) { const k = KIND[r.pettype]; if (!k) continue; ((BUFF[k] ??= [[], [], [], []])[+r.growthtype])[+r.level - 1] = [n(r.attack), n(r.magic), n(r.defense), n(r.attack_speed), n(r.attack_critical), n(r.movement), n(r.hp)]; }
const BASE = Object.fromEntries(rd('bpet').map(r => [KIND[r.DB], { delay: n(r.delay_action), sight: n(r.radius_sight) }]));
const SKILLS = {};
for (const s of rd('bpet_skill')) {
  const g = +s.group_id, lv = +s.group_level;
  const G = SKILLS[g] ??= { name: t2(s.name.replace(/\(.*\)$/, '')), kind: KIND[s.limit_kind] || null, need: n(s.limit_level), type: n(s.type), shape: n(s.limit_shape), basic: /^基本攻击/.test(s.name), tip: '', lv: [] };
  if (lv === 0 || (G.basic && lv === 1)) G.tip = t2(s.tooltip || '');
  if (lv >= 1) G.lv[lv - 1] = [n(s.need_sp), n(s.damage), n(s.reload), n(s.range), n(s.radius)];
}
const GROWTH = rd('bpet_growthrate').filter(r => +r.type <= 3).map(r => +r.rate / 10000);
const UPGRADE = rd('bpet_upgrade').filter(r => +r.need_level).map(r => ({ lv: n(r.need_level), item: n(r.need_item), gold: n(r.cost), rate: n(r.rate) / 100 }));
const SYS = rd('bpet_sys')[0];
const out = `// 由 tools/build-bpets.mjs 從服務端 bpet*.xml 產生（PC 原版戰寵資料），不要手改
// LEVEL[種類][GRADE 0 A／1 AA／2 AAA／3 S][Lv-1] ＝ [升級經驗, 復活費用, 技能點, HP, 攻擊, 防禦, 必殺]
// BUFF[種類][GRADE][Lv-1] ＝ 召喚中加給主人 [攻擊, 魔法, 防禦, 攻速, 必殺, 移速, HP]
// SKILLS[群組] ＝ { name, kind（null＝共通）, need（戰寵等級）, type（0 攻擊 1 自身增益／挑釁 2 治療 3 直線攻擊 4 永久被動）, lv: [[技能點, 數值, 冷卻ms, 射程, 範圍]…] }
export const PC_BPET = ${JSON.stringify({ BASE, GROWTH, UPGRADE, SYS: { expDown: n(SYS.exp_down), closeUp: n(SYS.close_up), closeDown: n(SYS.close_down), loyalUp: n(SYS.loyalty_up) } })};
export const LEVEL = ${JSON.stringify(LEVEL)};
export const BUFF = ${JSON.stringify(BUFF)};
export const SKILLS = ${JSON.stringify(SKILLS)};
`;
fs.writeFileSync(new URL('../src/1_data/pc-bpets.js', import.meta.url), out);
console.log('→ src/1_data/pc-bpets.js', (out.length / 1024).toFixed(0) + ' KB；技能群組', Object.keys(SKILLS).length);
for (const [g, s] of Object.entries(SKILLS)) console.log(g, s.name, s.kind || '共通', 'Lv' + s.need, 'type' + s.type, s.lv.length + '級', JSON.stringify(s.lv[0]));
