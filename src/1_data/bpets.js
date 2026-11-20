// 戰寵（戰鬥寵物）——照 PC（2u legacy/news_info.php?id=7&pid=4「戰寵資訊」＋服務端 item.scr 類別 49）。前後端共用
// 11/20 使用者：「說道戰寵」＋2u 戰寵頁 →「加回戰寵」「照著建議做 PC」（跟一般寵物分開的另一套，兩種可以同時帶）
// PC 規則 → 割草版：
//   - 四種：光之精靈、火之精靈、水之精靈、黑暗精靈（客戶端模型 E_Bpet_*；服務端 item.scr 13525／13527／13528，需求等級 70）
//   - 取得：PC 是任務「尋找○之精靈」→ 割草版：Base Lv 70 找寵物管理員免費領（每種一隻）
//   - 裝備＋召喚才會跟著打怪；戰寵自己殺怪才拿經驗（角色殺的不算），戰寵殺怪時角色也多拿一點經驗
//   - 戰寵經驗＝怪物經驗 × 10% ×（角色等級 ÷ 250）（PC 公式；割草版怪物經驗很小 → 再 ×30 🔢）
//   - 等級越高、GRADE 越高，升級要的經驗越多
//   - 覺醒：Lv35／55／75／95 找寵物管理員（PC 是賽尼布蘭博士），屬性自然石 ×1＋希望幣（PC 100 萬／200 萬／500 萬／1000 萬 ÷1000），
//     成功率 100／70／25／7%；失敗不消失、階段不變，材料照扣；覺醒後外觀變大變亮、能力大幅提升
//   - GRADE：Lv35 第一次覺醒時決定（之後不會變）：S 1%／AAA 4%／AA 65%／A 30%；
//     基礎屬性 S +120%／AAA +100%／AA 基準／A −100%；輔助屬性 S +210%／AAA +110%／AA 基準／A −110%
//     （割草版解讀：套在「成長」部分；A 的 −100% 直接做成不成長太傷 → A 成長 ×0.5、輔助 ×0.3 🔢）
//   - 死掉：經驗懲罰（掉這一級 10% 🔢）、親密度歸 0、忠誠度不變；找寵物管理員花希望幣復活（等級越高越貴 🔢）
//   - 親密度 0～100：召喚中每 2 分鐘 +1（出征時間）、離線每 30 分鐘 −1；100% 時能力 +10%、戰寵經驗 +20% 🔢、忠誠度開始累積
//   - 忠誠度：親密度 100% 時野外每 15 分鐘 +1（PC 用來穿戰寵裝備；割草版先只顯示）
//   - 輔助屬性（戰寵增益）：召喚中依種類加角色能力（2u 頁面主要提升屬性的紅字沒抓到 → 種類對應暫定 🔢）
export const BPETS = {
  light: { name: '光之精靈', item: 13525, icon: 3142, elem: 6, color: 0xfff3a0, fx: 'holy',  aux: 'hp',    auxName: '最大 HP',  auxMax: 0.12 },
  fire:  { name: '火之精靈', item: 13527, icon: 3144, elem: 1, color: 0xff6a3d, fx: 'fire',  aux: 'atk',   auxName: '傷害',     auxMax: 0.10 },
  water: { name: '水之精靈', item: 13528, icon: 3145, elem: 2, color: 0x4fb4ff, fx: 'ice',   aux: 'haste', auxName: '冷卻縮短', auxMax: 0.08 },
  dark:  { name: '黑暗精靈', item: 0,     icon: 3143, elem: 7, color: 0xb07cff, fx: 'shock', aux: 'crit',  auxName: '爆擊率',   auxMax: 0.05 },
};
export const BPET_REQ_LV = 70, BPET_MAX_LV = 100;
export const STONE = { name: '屬性自然石', icon: 1715, price: 20000 };   // 服務端 item 5477，售價 20,000,000 ÷1000
export const AWAKEN = [ // 第 i 筆＝第 i 階段 → 第 i+1 階段
  { lv: 35, gold: 1000, rate: 1.0 }, { lv: 55, gold: 2000, rate: 0.7 }, { lv: 75, gold: 5000, rate: 0.25 }, { lv: 95, gold: 10000, rate: 0.07 },
];
export const STAGE_NAME = ['元素期', '幼生期', '成長期', '茁壯期', '終極形態期'];
export const GRADES = { S: { rate: 0.01, base: 2.2, aux: 3.1, exp: 1.6 }, AAA: { rate: 0.04, base: 2.0, aux: 2.1, exp: 1.4 }, AA: { rate: 0.65, base: 1.0, aux: 1.0, exp: 1.0 }, A: { rate: 0.3, base: 0.5, aux: 0.3, exp: 0.9 } };
export const rollGrade = (r = Math.random()) => r < 0.01 ? 'S' : r < 0.05 ? 'AAA' : r < 0.7 ? 'AA' : 'A';
const G = b => GRADES[b.grade] || GRADES.AA;
export const bpetNeed = b => Math.round((60 + 25 * b.lv + 1.2 * b.lv * b.lv) * G(b).exp);
export const bpetName = b => (b.stage ? STAGE_NAME[b.stage] + '・' : '') + (BPETS[b.kind]?.name || '戰寵');
const close = b => (b.close ?? 0) >= 100 ? 1.1 : 1;
// 戰寵自己的能力（出征時）：傷害、攻擊間隔、射程、HP
export const STAGE_MUL = [1, 1.3, 1.6, 2.0, 2.6];
export function bpetStats(b) {
  const m = STAGE_MUL[b.stage || 0] * close(b), g = G(b).base;
  return { dmg: Math.round((10 + 1.6 * b.lv * g) * m), cd: Math.max(0.6, 1.4 - 0.15 * (b.stage || 0)), range: 9 + (b.stage || 0), hp: Math.round((80 + 14 * b.lv * g) * m) };
}
// 輔助屬性（召喚中加給角色）：Lv100 AA＝auxMax；GRADE 倍率；覺醒每階 +10% 🔢
export function bpetAux(b) {
  const D = BPETS[b.kind]; if (!D) return {};
  return { [D.aux]: +(D.auxMax * b.lv / BPET_MAX_LV * G(b).aux * (1 + 0.1 * (b.stage || 0)) * close(b)).toFixed(4) };
}
export const bpetAuxText = b => { const D = BPETS[b.kind], v = bpetAux(b)[D?.aux] || 0; return D ? `${D.auxName} +${(v * 100).toFixed(1)}%` : ''; };
export const reviveCost = b => 100 * b.lv;
// 經驗（戰寵自己殺的怪）：xp＝怪物經驗總和
export const bpetExpFrom = (xp, charLv, b) => Math.floor(xp * 0.1 * Math.max(1, charLv) / 250 * 30 * ((b.close ?? 0) >= 100 ? 1.2 : 1));
export function addBpetExp(b, exp) {
  let ups = 0; b.exp = (b.exp || 0) + exp;
  while (b.lv < BPET_MAX_LV && b.exp >= bpetNeed(b)) { b.exp -= bpetNeed(b); b.lv++; ups++; }
  if (b.lv >= BPET_MAX_LV) b.exp = 0;
  return ups;
}
// 親密度：離線每 30 分鐘 −1（seen＝上次結算時間）；召喚出征每 2 分鐘 +1；忠誠度：親密度 100 時野外每 15 分鐘 +1
export function bpetTime(b, now, runSecs = 0) {
  if (b.seen) b.close = Math.max(0, (b.close ?? 0) - Math.floor((now - b.seen) / 1800000));
  b.close = Math.min(100, (b.close ?? 0) + Math.floor(runSecs / 120));
  if (b.close >= 100) b.loyal = (b.loyal || 0) + Math.floor(runSecs / 900);
  b.seen = now;
}
// 死掉：經驗懲罰＋親密度歸 0
export function bpetDie(b) { b.dead = true; b.exp = Math.max(0, (b.exp || 0) - Math.round(bpetNeed(b) * 0.1)); b.close = 0; }
