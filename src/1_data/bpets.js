// 戰寵（戰鬥寵物）v2——數值全部照服務端 bpet*.xml（tools/build-bpets.mjs → pc-bpets.js）＋2u 戰寵資訊頁。前後端共用
// 11/20 使用者：「加回戰寵」「照著建議做 PC」「繼續完成」
// PC 規則 → 割草版：
//   - 四種：光之精靈、黑暗精靈、火之精靈、水之精靈（bpet.xml DB 1～4；道具需求 Lv 70；客戶端圖示 3142／3143／3144／3145）
//   - 能力（HP／攻擊／防禦／必殺）、升級經驗、復活費用、每級技能點：bpet_level.xml（種類 × GRADE × Lv1～100）
//   - 召喚中加給主人：bpet_buff.xml（攻擊／魔法／防禦／攻速／必殺／移速／HP）
//   - GRADE：Lv35 第一次覺醒決定（bpet_growthrate：A 30%／AA 65%／AAA 4%／S 1%）；覺醒前照 AA 算
//   - 覺醒：bpet_upgrade（Lv35／55／75／95、屬性自然石 5477 ×1、100 萬／200 萬／500 萬／1000 萬希望幣 ÷1000、100／70／25／7%）
//   - 親密度／忠誠度／死亡：bpet_sys（召喚中每 108 秒親密度 +1、離線每 1800 秒 −1；親密度 100 時每 600 秒忠誠度 +1；死亡經驗懲罰 30%）
//   - 戰寵經驗（2u）：怪物經驗 × 10% ×（角色等級 ÷ 250），只算戰寵自己殺的怪（割草版：本局經驗 × 戰寵擊殺比例）
//   - 技能：bpet_skill.xml（每級拿技能點去學；攻擊技自動施放、被動永久加能力、增益技定時放）
// 割草版換算（PC 數值 → 割草版）🔢：戰寵攻擊 × 0.06 × 技能傷害% ＝ 每下傷害；HP × 0.06；防禦：受到傷害 × 100 ÷（100＋防禦 ÷ 10）
//   主人增益：攻擊 ÷1000＝傷害%、魔法 ÷1000＝技能傷害%、防禦 ÷20＝護甲、攻速 ÷2＝急速、必殺 ×0.06%＝爆擊率、移速 ÷1000＝移速%、HP ÷10000＝最大 HP%
import { PC_BPET, LEVEL, BUFF, SKILLS } from './pc-bpets.js';
import { PC_BPET_EQUIP } from './pc-bpet-equip.js';
export { SKILLS as BPET_SKILLS };
export const BPETS = {
  light: { name: '光之精靈', item: 13525, icon: 3142, elem: 6, color: 0xfff3a0, fx: 'holy' },
  dark:  { name: '黑暗精靈', item: 0,     icon: 3143, elem: 7, color: 0xb07cff, fx: 'shock' },
  fire:  { name: '火之精靈', item: 13527, icon: 3144, elem: 1, color: 0xff6a3d, fx: 'fire' },
  water: { name: '水之精靈', item: 13528, icon: 3145, elem: 2, color: 0x4fb4ff, fx: 'ice' },
};
export const BPET_REQ_LV = 70, BPET_MAX_LV = 100;
export const STONE = { name: '屬性自然石', icon: 1715, price: 20000 }; // 服務端 item 5477，售價 20,000,000 ÷1000
export const AWAKEN = PC_BPET.UPGRADE.map(u => ({ lv: u.lv, gold: Math.round(u.gold / 1000), rate: u.rate }));
export const STAGE_NAME = ['元素期', '幼生期', '成長期', '茁壯期', '終極形態期'];
export const GRADE_NAMES = ['A', 'AA', 'AAA', 'S'];
export const SYS = PC_BPET.SYS;
export function rollGrade(r = Math.random()) { let a = 0; for (let i = 0; i < 4; i++) { a += PC_BPET.GROWTH[i]; if (r < a) return GRADE_NAMES[i]; } return 'AA'; }
const gi = b => Math.max(0, GRADE_NAMES.indexOf(b.grade || 'AA'));
const row = b => LEVEL[b.kind]?.[gi(b)]?.[Math.min(BPET_MAX_LV, Math.max(1, b.lv)) - 1] || [0, 0, 0, 0, 0, 0, 0];
const brow = b => BUFF[b.kind]?.[gi(b)]?.[Math.min(BPET_MAX_LV, Math.max(1, b.lv)) - 1] || [0, 0, 0, 0, 0, 0, 0];
export const bpetNeed = b => row(b)[0];
export const reviveCost = b => Math.max(1, Math.round(row(b)[1] / 1000));
export const bpetName = b => (b.stage ? STAGE_NAME[b.stage] + '・' : '') + (BPETS[b.kind]?.name || '戰寵');
// ===== 技能 =====
// 這隻能學的技能群組（共通＋自己種類，基本攻擊天生就會）
export const skillsFor = kind => Object.entries(SKILLS).filter(([, s]) => !s.basic && (!s.kind || s.kind === kind)).map(([g, s]) => ({ g: +g, ...s })).sort((a, b) => a.need - b.need);
export const basicOf = kind => Object.values(SKILLS).find(s => s.basic && s.kind === kind);
export const spTotal = b => { let t = 0; const L = LEVEL[b.kind]?.[gi(b)] || []; for (let i = 0; i < Math.min(b.lv, BPET_MAX_LV); i++) t += L[i]?.[2] || 0; return t; };
export const spUsed = b => Object.entries(b.skills || {}).reduce((t, [g, lv]) => { const s = SKILLS[g]; for (let i = 0; i < lv; i++) t += s?.lv[i]?.[0] || 0; return t; }, 0);
// 學下一級：回傳錯誤或 null
export function learnCheck(b, g) {
  const s = SKILLS[g]; if (!s || s.basic || (s.kind && s.kind !== b.kind)) return '這隻戰寵不能學這招';
  const cur = b.skills?.[g] || 0; if (cur >= s.lv.length) return '已經學到最高級了';
  if (b.lv < s.need) return `戰寵要 Lv ${s.need}`;
  const cost = s.lv[cur][0]; if (spTotal(b) - spUsed(b) < cost) return `技能點不夠（要 ${cost}）`;
  return null;
}
const passive = (b, g) => { const lv = b.skills?.[g] || 0; return lv ? SKILLS[g].lv[lv - 1][1] : 0; };
// ===== 能力（割草版換算後）=====
const close = b => (b.close ?? 0) >= 100 ? 1.1 : 1; // 2u：親密度 100% 能力提升（幅度原版沒寫，暫定 +10% 🔢）
export function bpetStats(b) {
  const [, , , hp, atk, def, crit] = row(b), m = close(b), base = PC_BPET.BASE[b.kind] || { delay: 800 };
  const E = equipSum(b), A = atk + passive(b, 20) + E.atk, H = hp + passive(b, 40), Df = def + passive(b, 30) + E.def, cdCut = passive(b, 70) / 100; // 鬥志激發／生命增幅／鐵壁／集中
  return { atk: A * m, dmg: Math.round(A * 0.06 * m), hp: Math.round(H * 0.06 * m), def: Df, crit: crit * 0.0006, delay: base.delay, cdCut, range: 9 };
}
// ===== 裝備（服務端 item.scr 類別 50；tools/build-bpet-equip.mjs → pc-bpet-equip.js）=====
// PC：每隻戰寵 5 格（武器或頭盔／上衣／下褲／精靈石Ⅰ／精靈石Ⅱ）；限定種類、戰寵等級、忠誠度
// 割草版：在寵物管理員買了直接穿上，換下來的舊裝備照 PC 賣店價（售價 10%）退錢；售價 ÷100 換金幣 🔢
export { PC_BPET_EQUIP };
export const EQUIP_SLOTS = ['武器／頭盔', '上衣', '下褲', '精靈石Ⅰ', '精靈石Ⅱ'];
export const equipPrice = e => Math.max(10, Math.round(e.price / 100));
export const equipRefund = e => Math.round(equipPrice(e) / 10);
export const equipFor = (kind, slot) => Object.entries(PC_BPET_EQUIP).filter(([, e]) => e.slot === slot && (!e.kind || e.kind === kind)).map(([id, e]) => ({ id: +id, ...e })).sort((a, b) => a.req - b.req || a.loyal - b.loyal || a.price - b.price);
// 能不能穿：回傳錯誤或 null
export function equipCheck(b, id) {
  const e = PC_BPET_EQUIP[id]; if (!e) return '沒有這件裝備';
  if (e.kind && e.kind !== b.kind) return '這隻戰寵不能穿';
  if (b.lv < e.req) return `戰寵要 Lv ${e.req}`;
  if ((b.loyal || 0) < e.loyal) return `忠誠度要 ${e.loyal}`;
  if (b.equip?.[e.slot] === +id) return '已經穿著了';
  return null;
}
function equipSum(b) { const o = { atk: 0, def: 0 }; for (const id of b.equip || []) { const e = PC_BPET_EQUIP[id]; if (e && (!e.kind || e.kind === b.kind)) { o.atk += e.atk; o.def += e.def; } } return o; }
// 主人增益（bpet_buff）
export function bpetAux(b) {
  const [atk, mag, def, aspd, crit, move, hp] = brow(b), m = close(b);
  return { atk: atk / 1000 * m, skd: mag / 1000 * m, armor: def / 20 * m, haste: aspd / 2 * m, crit: crit * 0.0006 * m, speed: move / 1000 * m, hp: hp / 10000 * m };
}
const AUX_TXT = { atk: ['傷害', 1], skd: ['技能傷害', 1], armor: ['護甲', 0], haste: ['急速', 0], crit: ['爆擊率', 1], speed: ['移速', 1], hp: ['最大 HP', 1] };
export const bpetAuxText = b => Object.entries(bpetAux(b)).filter(([, v]) => v > 0.0005).map(([k, v]) => `${AUX_TXT[k][0]} +${AUX_TXT[k][1] ? (v * 100).toFixed(1) + '%' : v.toFixed(1)}`).join('、');
// 局內會自動放的技能（攻擊、治療、增益）：[{ g, name, type, dmg%, cd 秒, range, radius }]
export function bpetActives(b) {
  const out = []; const B = basicOf(b.kind); if (B) out.push({ g: 0, name: B.name, type: 0, pct: B.lv[0][1], cd: B.lv[0][2] / 1000, range: B.lv[0][3], rad: 0, basic: true });
  for (const [g, lv] of Object.entries(b.skills || {})) { const s = SKILLS[g]; if (!s || !lv || s.type === 4) continue; const L = s.lv[lv - 1];
    out.push({ g: +g, name: s.name, type: s.type, pct: L[1], cd: L[2] / 1000, range: L[3], rad: L[4], tip: s.tip }); }
  return out;
}
// ===== 經驗、時間、死亡 =====
// 戰寵經驗：本局經驗 × 戰寵擊殺比例 × 10% ×（角色等級 ÷ 250）；親密度 100% 再 +20%（2u：親密度 100% 增加擊殺經驗，幅度暫定 🔢）
export const bpetExpFrom = (gain, share, charLv, b) => Math.floor(gain * Math.max(0, Math.min(1, share)) * 0.1 * Math.max(1, charLv) / 250 * ((b.close ?? 0) >= 100 ? 1.2 : 1));
export function addBpetExp(b, exp) {
  let ups = 0; b.exp = (b.exp || 0) + exp;
  while (b.lv < BPET_MAX_LV && bpetNeed(b) > 0 && b.exp >= bpetNeed(b)) { b.exp -= bpetNeed(b); b.lv++; ups++; }
  if (b.lv >= BPET_MAX_LV) b.exp = 0;
  return ups;
}
export function bpetTime(b, now, runSecs = 0) {
  if (b.seen) b.close = Math.max(0, (b.close ?? 0) - Math.floor(Math.max(0, now - b.seen - runSecs * 1000) / 1000 / SYS.closeDown));
  b.close = Math.min(100, (b.close ?? 0) + Math.floor(runSecs / SYS.closeUp));
  if (b.close >= 100) b.loyal = (b.loyal || 0) + Math.floor(runSecs / SYS.loyalUp);
  b.seen = now;
}
export function bpetDie(b) { b.dead = true; b.exp = Math.max(0, (b.exp || 0) - Math.round(bpetNeed(b) * SYS.expDown / 100)); b.close = 0; }
