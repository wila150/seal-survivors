// 寵物 v3（11/20 使用者：「現在的寵物是藍精靈，感覺是自己做的，沒有套用希望本身的寵物系統」「不要保留戰鬥寵物，比照 PC 怎麼做就怎麼做」）
// 全部照 PC：寵物＝道具（服務端 item.txt 類別 22），資料由 tools/build-pc-pets.mjs 產生在 pc-pets.js
// 官方 wiki id=49（docs/參考_官方wiki.md）：
// - 四個系列：植物系、咕咕系、猛禽系、少女系；先得到寵物蛋（道具商店）；高等級的寵物要角色等級夠（item.txt 需求等級）
// - 放進裝備欄（出戰）才會成長；在村莊不長、不餓、不死
// - 餓了要餵食（什麼都能吃；餵牠想吃的東西長 2 倍）；沒東西可以餵就「遊戲」：忘記飢餓但不會成長
// - 挨餓到經驗歸 0 會死掉（剛出生、剛進化的最容易死）
// - 移除：從裝備欄拿下來不會死也不會長，但餵食得到的經驗全部歸回最初（回到這一型的第 1 階段）
// - 成長 9 個階段，第 9 階段再過一段時間可以找寵物管理員進化；最多 10 種材料，依材料的統一性決定進化成哪一隻
//   （例：石頭類 → 傻瓜；鬼點子 → 聰明絕頂）
// 割草版：成長經驗＝出征經驗 30%＋餵裝備；能力值（PC 攻擊／魔攻／防禦）換算：攻擊 ÷1000＝傷害%、魔攻 ÷1000＝技能傷害%、防禦 ÷20＝護甲 🔢
import { PC_PETS } from './pc-pets.js';
export { PC_PETS };
export const PET_MAX = 8, PET_MAX_LV = 27;                    // 9 階段 × 3 級
export const FAM_NAME = { gugu: '咕咕系', girl: '少女系', plant: '植物系', bird: '猛禽系' };
// 道具商店的蛋（PC 售價 ÷10，照金幣慣例）
export const EGGS = Object.entries(PC_PETS).filter(([, p]) => p.tier === 1).map(([id, p]) => ({ id: +id, price: Math.max(10, Math.round(p.price / 10)) }));
export const petDef = p => PC_PETS[p?.pc] || null;
export const petName = p => p?.name || petDef(p)?.name || '寵物';
export const petStage9 = lv => Math.min(9, Math.max(1, Math.ceil(lv / 3)));
export const petNeed = (lv, tier = 1) => Math.round((100 + 60 * lv) * (1 + 0.5 * (tier - 1)));
export const FEED_EXP = [20, 45, 100, 220, 500];               // 餵一件裝備（普通～傳說）＋精煉 ×(1＋0.1×精煉)
export function addPetExp(p, exp) {
  const t = petDef(p)?.tier || 1; let ups = 0; p.exp = (p.exp || 0) + exp;
  while (p.lv < PET_MAX_LV && p.exp >= petNeed(p.lv, t)) { p.exp -= petNeed(p.lv, t); p.lv++; ups++; }
  if (p.lv >= PET_MAX_LV) p.exp = 0;
  return ups;
}
// 能力（PC 數值換算；角色等級不到需求等級不生效）
export const petBonus = p => { const D = petDef(p); if (!D) return {}; return { atk: D.atk / 1000, skd: D.matk / 1000, armor: D.def / 20 }; };
export const petStatText = p => { const D = petDef(p); if (!D) return ''; return [D.atk && `攻擊 ${D.atk}`, D.matk && `魔攻 ${D.matk}`, D.def && `防禦 ${D.def}`].filter(Boolean).join('・') || '（蛋還沒有能力）'; };
export const petBonusText = p => { const b = petBonus(p); return [b.atk && `傷害 +${(b.atk * 100).toFixed(1)}%`, b.skd && `技能傷害 +${(b.skd * 100).toFixed(1)}%`, b.armor && `護甲 +${b.armor}`].filter(Boolean).join('、') || '沒有加成'; };
export const HUNGER_PER_SEC = 1 / 9, FEED_HUNGER = 25, PLAY_HUNGER = 30, EVOLVE_SECS = 1800;
export const WANT_SLOTS = ['weapon', 'shield', 'head', 'top', 'bottom', 'shoes', 'acc'];
export const WANT_NAMES = { weapon: '武器', shield: '盾牌', head: '頭盔', top: '上衣', bottom: '下衣', shoes: '鞋子', acc: '飾品' };
// ===== 進化 =====
// 進化路線：同系列下一階（PC 名稱看得出來的分支照名稱分：菜頭弟弟 → 菜頭辣妹／菜頭王／勇士菜頭…；其他＝同系列下一階全部）
const BRANCH = { 132: [136, 137, 138], 133: [139, 140, 141], 134: [549, 550, 551], 135: [552, 553], 558: [560, 561, 562, 563], 559: [564, 565, 582, 583] };
export function evoTargets(pc) {
  const D = PC_PETS[pc]; if (!D || D.tier >= 5) return [];
  if (BRANCH[pc]) return BRANCH[pc];
  return Object.entries(PC_PETS).filter(([, x]) => x.fam === D.fam && x.tier === D.tier + 1).map(([id]) => +id);
}
// 進化材料類別（mats 的 key）
export const EVO_CAT = { ore1: 'stone', ore2: 'stone', god: 'stone', alu: 'stone', ruby: 'gem', diamond: 'gem', pinkdia: 'gem', dust: 'magic', crystal: 'magic', rainbow: 'magic', abis: 'holy', reset: 'trick', fixTicket: 'trick', chargeTicket: 'trick', personaTicket: 'trick' };
export const CAT_NAME = { stone: '石頭類（→ 傻瓜、能力最低）', gem: '寶石類（→ 防禦最高）', magic: '魔法類（→ 魔攻最高）', holy: '祝福類（→ 攻擊＋魔攻平均）', trick: '鬼點子（→ 聰明絕頂、魔攻最高）', none: '沒有材料' };
// 照官方 wiki：材料「統一性」決定結果 → 最多的那一類決定往哪個方向；全部同一類（5 個以上）＝一定照方向，不然同分隨機
const SCORE = { stone: d => -(d.atk + d.matk + d.def), gem: d => d.def, magic: d => d.matk, holy: d => Math.min(d.atk, d.matk) * 2 + d.atk + d.matk, trick: d => d.matk * 2 + d.def };
export function evolveResult(pc, mats, rand = Math.random) {
  const T = evoTargets(pc); if (!T.length) return null;
  const cnt = {}; let n = 0; for (const [k, v] of Object.entries(mats || {})) { const c = EVO_CAT[k]; if (!c || !(v > 0)) continue; cnt[c] = (cnt[c] || 0) + v; n += v; }
  if (!n) return null; const [cat, top] = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0], perfect = top === n && n >= 5;
  if (T.length === 1) return { pc: T[0], cat, perfect };
  const sc = T.map(id => [id, SCORE[cat](PC_PETS[id])]).sort((a, b) => b[1] - a[1]);
  // 統一性不夠：有一定機率跑去其他分支（越雜越容易）
  const pick = perfect || rand() < top / n ? sc[0][0] : sc[1 + Math.floor(rand() * (sc.length - 1))][0];
  return { pc: pick, cat, perfect };
}
// 舊存檔（戰鬥寵物精靈 kind: fire/water/light/dark）→ 換成天上之蛋（Lv 1 不用等級限制），經驗歸零
export function migratePets(d) {
  let ch = false; for (const p of d.pets || []) if (!p.pc) { p.pc = 121; p.lv = 1; p.exp = 0; delete p.kind; delete p.evo; delete p.trait; delete p.perfect; ch = true; }
  return ch;
}
