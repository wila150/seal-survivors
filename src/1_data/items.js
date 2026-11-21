// 裝備定義（前端、伺服器、遊戲共用）
import { PC_ITEMS } from './pc-items.js';
// 圖示編號 = assets/items/<編號>.png（取自 GM 工具的道具圖示）

// 項目 32（11/19「照建議」＋使用者：「PC 版裝備只有這三件嗎？」）：部位照 PC（服務端 item.scr 道具分類）
// 武器（4 劍 6 大劍 7 匕首 8 榔頭 9 鎚 11 杖 46 彈弓 51 食具）、盾牌 14（騎士）、頭部 17 盔／18 帽、上衣 15 盔甲／16 上衣、下衣 25 盔甲(下)／26 下褲、鞋子 19 靴／20 鞋、飾品
// 舊資料的「armor」防具：伺服器啟動時自動搬家（盾 → shield、其他 → top）
export const SLOTS = { weapon: '武器', shield: '盾牌', head: '頭部', top: '上衣', bottom: '下衣', shoes: '鞋子', acc: '飾品',
  deco: '頭飾', earring: '耳環', neck: '項鍊', bracelet: '手鐲', ring: '戒指' }; // 11/19 飾品照 PC 第 70 欄（裝備位置）再拆 5 格
export const ARMOR_SLOTS = ['shield', 'head', 'top', 'bottom', 'shoes']; // 防具類（精煉用鋁、可以鑑定）

// 底材：stat 是 +0、普通品質時的數值
export const BASES = {
  weapon: [
    { key: 'sword',  name: '鐵劍',     icon: 117, stat: { atk: 0.08 } },
    { key: 'blade',  name: '精鋼大劍', icon: 122, stat: { atk: 0.12 } },
    { key: 'staff',  name: '魔法杖',   icon: 186, stat: { atk: 0.07, haste: 0.04 } },
    { key: 'hammer', name: '戰錘',     icon: 828, stat: { atk: 0.14 } },
    { key: 'spear',  name: '匕首',     icon: 183, stat: { atk: 0.09, crit: 0.02 } },
    { key: 'mace',   name: '鎚',       icon: 128, stat: { atk: 0.10, haste: 0.02 } }, // 11/19 道具照 PC：補上祭司鎚、獵人彈弓
    { key: 'sling',  name: '彈弓',     icon: 1561, stat: { atk: 0.08, crit: 0.03 } },
    { key: 'spoon',  name: '茶湯匙',   icon: 3652, stat: { atk: 0.09, hp: 10 } }, // 11/21 饕客食具（item.scr 類別 51）；底材加成 🔢 暫定
  ],
  shield: [
    { key: 'shield',  name: '騎士盾', icon: 215, stat: { hp: 25, armor: 3 } },
  ],
  head: [
    { key: 'helm', name: '鐵盔', icon: 292, stat: { hp: 12, armor: 1 } },       // 17 盔（重裝）
    { key: 'cap',  name: '布帽', icon: 497, stat: { hp: 8, crit: 0.015 } },     // 18 帽（輕裝）
  ],
  top: [
    { key: 'leather', name: '皮甲',   icon: 144, stat: { hp: 20, armor: 1 } },
    { key: 'chain',   name: '鎖子甲', icon: 684, stat: { hp: 30, armor: 2 } },
    { key: 'robe',    name: '法袍',   icon: 254, stat: { hp: 18, haste: 0.03 } },
  ],
  bottom: [
    { key: 'greave', name: '盔甲（下）', icon: 239, stat: { hp: 16, armor: 1 } }, // 25 盔甲(下)（重裝）
    { key: 'pants',  name: '下褲',       icon: 2693, stat: { hp: 12, speed: 0.02 } }, // 26 下褲（輕裝）
  ],
  shoes: [
    { key: 'boots', name: '靴子', icon: 498, stat: { armor: 1, speed: 0.03 } },   // 19 靴（重裝）
    { key: 'shoe',  name: '鞋子', icon: 503, stat: { speed: 0.05, magnet: 0.1 } }, // 20 鞋（輕裝）
  ],
  // 11/19：PC 飾品的 5 個裝備位置（服務端 item.scr 分類 21、第 70 欄）
  deco:     [{ key: 'ribbon',  name: '蝴蝶結', icon: 641, stat: { hp: 8, magnet: 0.1 } }],
  earring:  [{ key: 'earring', name: '耳環',   icon: 2255, stat: { crit: 0.015, hp: 6 } }],
  neck:     [{ key: 'neck',    name: '項鍊',   icon: 3873, stat: { hp: 15, haste: 0.02 } }],
  bracelet: [{ key: 'bangle',  name: '手鐲',   icon: 3613, stat: { haste: 0.03, armor: 0.5 } }],
  ring:     [{ key: 'pcring',  name: '戒指',   icon: 2260, stat: { atk: 0.04 } }],
  acc: [
    { key: 'ring',    name: '幸運戒指', icon: 310, stat: { crit: 0.04 } },
    { key: 'feather', name: '疾風之羽', icon: 408, stat: { speed: 0.06 } },
    { key: 'gem',     name: '智慧寶石', icon: 39,  stat: { haste: 0.05 } },
    { key: 'charm',   name: '吸引護符', icon: 45,  stat: { magnet: 0.3, hp: 10 } },
  ],
};

export const RARITY = [
  { name: '普通', color: '#8f8f8f', mult: 1.0, w: 60 }, // 11/19 介面改象牙色底：原本 #c8c8c8 看不清楚
  { name: '精良', color: '#5cd65c', mult: 1.35, w: 25 },
  { name: '稀有', color: '#4fa3ff', mult: 1.75, w: 10 },
  { name: '史詩', color: '#b07cff', mult: 2.3, w: 4 },
  { name: '傳說', color: '#ffa940', mult: 3.0, w: 1 },
];

export const STAT_NAMES = { atk: '攻擊力', hp: '最大 HP', armor: '護甲', crit: '暴擊率', speed: '移動速度', haste: '冷卻縮短', magnet: '吸取範圍',
  str: '力量', agi: '敏捷', int: '智力', vit: '體力', wis: '精神', luk: '感覺', skd: '技能傷害' };
const PCT = new Set(['atk', 'crit', 'speed', 'haste', 'magnet', 'skd']);
// ===== 項目 32 後半（11/19「照建議」）：★ 特性＋依品質的詞綴 =====
// 每件裝備都有 1 個 ★ 特性；詞綴依品質：普通 無／精良 1 項主素質／稀有 ＋爆擊或急速或移速／史詩 2 項主素質＋1 項／傳說 再加「技能傷害 +10～20%」（不含普攻）
// 存在 items.aff：{ t: 特性編號, a: [[屬性, 數值], ...] }；數值不吃品質倍率（已經依品質給）
export const TRAITS = [
  { name: '★ 銳利', k: 'crit', v: 0.02 }, { name: '★ 專注', k: 'haste', v: 0.03 }, { name: '★ 迅捷', k: 'speed', v: 0.03 },
  { name: '★ 鐵壁', k: 'armor', v: 1 }, { name: '★ 堅韌', k: 'hp', v: 12 }, { name: '★ 貪婪', k: 'magnet', v: 0.15 }, { name: '★ 猛擊', k: 'atk', v: 0.03 },
];
const AFF_STATS = ['str', 'agi', 'int', 'vit', 'wis', 'luk'], AFF_EXTRA = [['crit', 0.02, 0.04], ['haste', 0.03, 0.06], ['speed', 0.02, 0.05]];
export function rollAffix(rarity, rand = Math.random) {
  const pick = a => a[Math.floor(rand() * a.length)], a = [], stat = (lo, hi) => { const k = pick(AFF_STATS.filter(x => !a.some(y => y[0] === x))); a.push([k, lo + Math.floor(rand() * (hi - lo + 1))]); };
  const extra = () => { const [k, lo, hi] = pick(AFF_EXTRA); a.push([k, +(lo + rand() * (hi - lo)).toFixed(3)]); };
  if (rarity === 1) stat(1, 3);
  else if (rarity === 2) { stat(2, 4); extra(); }
  else if (rarity >= 3) { stat(3, 5); stat(2, 4); extra(); if (rarity >= 4) a.push(['skd', +(0.10 + rand() * 0.10).toFixed(3)]); }
  return { t: Math.floor(rand() * TRAITS.length), a, r: rarity }; // r＝擲詞綴時的品質（品質之後被改，例：首領寶箱保底精良 → 伺服器 giveItem 會重擲）
}
export const traitOf = it => it?.aff ? TRAITS[it.aff.t] || null : null;
export const fmtStat = (k, v) => PCT.has(k) ? `+${Math.round(v * 1000) / 10}%` : `+${Math.round(v)}`;

// 強化：每 +1 數值多 12%；成功率；失敗時 +7 以上會碎，其他降 1 級
// 11/21 合成照 PC 改 +12（src/1_data/refine.js：2u news id=58）
import { REFINE_MAX, REFINE_RATE, refineBreaks, refineMat, MELT_STONES } from './refine.js';
import { FORTUNE_ORES } from './fortune.js'; // PC 發財遊戲（#10）
import { CHEST_ORES } from './bosschest.js'; // PC 首領寶箱＋鑰匙（企劃_PC系統補齊 #17）
export { REFINE_MAX, REFINE_RATE, refineBreaks };
export const refineCost = lv => 60 * (lv + 1) * (lv + 1);

// ===== 道具照 PC（11/19 使用者：「道具數值也照 pc 去做」）=====
// 每種底材對到一種 PC 道具類別（src/1_data/pc-items.js，tools/build-pc-items.mjs 從服務端 item.scr 轉出）；
// 掉落時依這局的怪物等級挑 PC 原版那件（名稱、圖示、需求等級照 PC），數值＝底材數值 × (那件的 PC 攻擊或防禦 ÷ 該類別入門款)
// 舊裝備（沒有 pc 編號）照舊：底材名稱、倍率 1
export const PC_TYPE_OF = { sword: 4, blade: 6, spear: 7, hammer: 8, mace: 9, staff: 11, sling: 46, spoon: 51, leather: 16, robe: 16, chain: 15, shield: 14, helm: 17, cap: 18, greave: 25, pants: 26, boots: 19, shoe: 20, ribbon: 'a0', earring: 'a8', neck: 'a9', bangle: 'a10', pcring: 'a11' };
const REF = {}; for (const t in PC_ITEMS) { const v = PC_ITEMS[t].slice(0, 5).map(x => x[3]).sort((a, b) => a - b); REF[t] = v[v.length >> 1]; }
export function pcOf(it) { const t = PC_TYPE_OF[it?.base]; return it?.pc && t ? PC_ITEMS[t]?.find(x => x[0] === it.pc) || null : null; }
export const pcTier = it => { const p = pcOf(it); return p ? Math.max(0.5, p[3] / REF[PC_TYPE_OF[it.base]]) : 1; };
export const pcReqLv = it => pcOf(it)?.[2] || 0;
// ===== 11/20 職業與等級限制照 PC（服務端 item.scr 第 71 欄職業位元、第 3 欄需求等級）=====
// 使用者：「PC 那邊沒有裝備的限制嗎？什麼角色穿什麼職業的裝備？」
export const JOB_BIT = { 初心者: 1, 劍士: 2, 騎士: 4, 小丑: 8, 法師: 16, 祭司: 32, 鐵匠: 64, 獵人: 2097152, 饕客: 16777216 };
const FIRST_BITS = 1 | 2 | 4 | 8 | 16 | 32 | 64 | 2097152 | 16777216;
export const pcMask = it => pcOf(it)?.[6] || 0;
// 職業位元能不能穿：0＝全職業；有一轉職業位元＝看自己的職業；只有二轉以上位元的（幻魔、龍皇…套裝）＝二轉以後才能穿
export const maskWearable = (mask, job, job2 = false) => !mask || !!(mask & (JOB_BIT[job] || 0)) || (!(mask & FIRST_BITS) && job2);
export const maskJobs = mask => !mask ? '全職業' : (mask & FIRST_BITS) ? Object.entries(JOB_BIT).filter(([, b]) => mask & b).map(([j]) => j).join('・') : '二轉以上';
// 能不能裝備（回傳不能的原因，可以就回傳空字串）；c＝角色 { job, job2, jobLv }
// 11/21 使用者：「裝備要看 job 等級」→ 需求等級比 Job Lv（原本比 Base Lv）
export function wearBlock(it, c) {
  if (!it || !c) return '';
  if (it.slot === 'shield' && c.job !== '騎士') return '盾牌只有騎士能裝備';
  if (it.slot === 'weapon' && JOB_WEAPON[c.job] && it.base !== JOB_WEAPON[c.job]) return `${c.job}不能裝備這種武器`;
  const m = pcMask(it); if (!maskWearable(m, c.job, !!c.job2)) return `這是${maskJobs(m)}的裝備`;
  const lv = pcReqLv(it); if (lv > (c.jobLv || 1)) return `要 Job Lv ${lv}`;
  return '';
}
// 依怪物等級挑一件：需求等級 ≤ lv 的最高幾件裡隨機（越接近 lv 越常出）；有給職業＝只挑這職業能穿的，沒給＝一轉職業能穿的（不出二轉套裝）
export const DROP_RANGE = [-15, 5]; // 掉落裝備的需求等級區間（相對 Job Lv）
export function pickPc(base, lv, rand = Math.random, job = null) {
  let L = PC_ITEMS[PC_TYPE_OF[base]]; if (!L) return null;
  L = L.filter(x => job ? maskWearable(x[6], job) : (!x[6] || (x[6] & FIRST_BITS))); if (!L.length) return null;
  // 11/21 使用者：「照著 Job，不會一定掉對應等級，是隨機，設定一個區間」→ 需求等級在 [lv−15, lv+5] 裡平均隨機挑一件
  const lo = lv + DROP_RANGE[0], hi = lv + DROP_RANGE[1];
  let ok = L.filter(x => x[2] >= lo && x[2] <= hi);
  if (!ok.length) { const below = L.filter(x => x[2] <= hi); if (!below.length) return null; ok = [below.at(-1)]; } // 區間裡沒有 → 拿區間上限以下最高的那件
  return ok[Math.floor(rand() * ok.length)][0];
}

// 一件裝備實際的數值（含品質與強化）
export function itemStats(it) {
  const base = BASES[it.slot]?.find(b => b.key === it.base); if (!base) return {};
  const m = RARITY[it.rarity].mult * (it.roll || 1) * (1 + 0.12 * (it.refine || 0)) * (GUP[it.gup || 0]?.mult || 1) * pcTier(it);
  const o = Object.fromEntries(Object.entries(base.stat).map(([k, v]) => [k, v * m]));
  // ★ 特性＋詞綴（項目 32）
  const T = traitOf(it); if (T) o[T.k] = (o[T.k] || 0) + T.v;
  for (const [k, v] of it.aff?.a || []) o[k] = (o[k] || 0) + v;
  for (const [k, v] of it.clk || []) o[k] = (o[k] || 0) + v; // 指令 4-2 發條屬性
  return o;
}
const SET_NAME = { chaos: '渾沌的炙卡爾', white: '純白的坦柏特' }; // 賢者之塔艾希頓套裝（tower.js ASHTON_SETS）
export const itemName = it => `${it.refine ? '+' + it.refine + ' ' : ''}${it.setk ? '【' + SET_NAME[it.setk] + '】' : ''}${pcOf(it)?.[1] || BASES[it.slot]?.find(b => b.key === it.base)?.name || '?'}${it.gup ? '.' + GUP[it.gup].tag : ''}`; // 原版寫法：長劍.G
export const itemIcon = it => `assets/items/${pcOf(it)?.[4] ?? BASES[it.slot]?.find(b => b.key === it.base)?.icon ?? 0}.png`;
export const sellPrice = it => Math.round(20 * RARITY[it.rarity].mult * RARITY[it.rarity].mult * (1 + (it.refine || 0) * 0.5) * Math.sqrt(pcTier(it)));

// 隨機產生裝備（伺服器用）：bonus 越高越容易出好品質
// PC 每個職業只能拿自己的武器（11/19 使用者：「小丑不是丟匕首嗎？為甚麼見面禮是長槍」）；盾只有騎士
export const JOB_WEAPON = { 劍士: 'blade', 騎士: 'sword', 小丑: 'spear', 法師: 'staff', 祭司: 'mace', 鐵匠: 'hammer', 獵人: 'sling', 饕客: 'spoon' };
// 11/20 使用者：鑑定要給「這件裝備的職業」的技能（劍士拿騎士武器去鑑定 → 出騎士技能）→ 武器＝武器的職業、盾＝騎士；其他防具沒有職業（null：自己的職業，或花錢選）
export const itemJob = it => it?.slot === 'weapon' ? (Object.entries(JOB_WEAPON).find(([, b]) => b === it.base)?.[0] ?? null) : it?.base === 'shield' ? '騎士' : null;
// 項目 50：非本職業的裝備（別職業的武器、非騎士的盾）→ 一鍵餵寵物／分解的候選
export const offJob = (it, job) => (!!JOB_WEAPON[job] && ((it.slot === 'weapon' && it.base !== JOB_WEAPON[job]) || (it.base === 'shield' && job !== '騎士'))) || !maskWearable(pcMask(it), job, true); // 11/20：防具照 PC 職業位元（二轉套裝不算非本職業）
// 項目 50：分解（強化金屬・一＝1＋品質、+4 以上多 1 個強化金屬・二；希幣＝賣價 60%）
export const dismantleYield = it => ({ ore1: 1 + it.rarity, ore2: (it.refine || 0) >= 4 ? 1 : 0, gold: Math.round(sellPrice(it) * 0.6) });
export function rollItem(rand = Math.random, bonus = 0, slot, lv = 0, job = null) { // lv：角色 Job Lv（11/21 起；有給才挑 PC 原版道具，需求等級在 lv−15～lv+5 隨機）；job：只出這職業能用的武器
  // 部位權重：武器 3、盾 1、頭 2、上衣 2、下衣 2、鞋 2、飾品 2（有給職業而且不是騎士就不出盾）
  const SW = { weapon: 3, shield: 1, head: 2, top: 2, bottom: 2, shoes: 2, acc: 2, deco: 1, earring: 1, neck: 1, bracelet: 1, ring: 1 }, pool = Object.keys(BASES).filter(k => !(k === 'shield' && job && job !== '騎士'));
  let s = slot; if (!s) { let r = rand() * pool.reduce((a, k) => a + SW[k], 0); s = pool.find(k => (r -= SW[k]) < 0) || pool.at(-1); }
  let bases = BASES[s];
  if (job && JOB_WEAPON[job] && s === 'weapon') bases = bases.filter(b => b.key === JOB_WEAPON[job]);
  else if (job && lv > 0) { const ok = bases.filter(b => PC_ITEMS[PC_TYPE_OF[b.key]]?.some(x => maskWearable(x[6], job) && x[2] <= lv + DROP_RANGE[1])); if (ok.length) bases = ok; } // 防具：只挑這職業有得穿的底材（劍士＝皮製、騎士＝盔甲…）
  const b = bases[Math.floor(rand() * bases.length)];
  const ws = RARITY.map((r, i) => r.w * (1 + bonus * i)); let x = rand() * ws.reduce((a, c) => a + c, 0), rarity = 0;
  for (let i = 0; i < ws.length; i++) { x -= ws[i]; if (x <= 0) { rarity = i; break; } }
  const it = { slot: s, base: b.key, rarity, roll: +(0.9 + rand() * 0.2).toFixed(3), refine: 0, aff: rollAffix(rarity, rand) };
  if (lv > 0) { const pc = pickPc(b.key, lv, rand, job); if (pc) it.pc = pc; }
  return it;
}

// 把身上裝備的數值加總
export function totalBonus(items) {
  const t = {}; for (const it of items) for (const [k, v] of Object.entries(itemStats(it))) t[k] = (t[k] || 0) + v; return t;
}

// ===== 精煉礦石（裝備商人販售；強化改成消耗礦石） =====
export const ORES = {
  ore1: { name: '強化金屬・一', icon: 36, price: 75,   desc: '沒有水晶時可代替：+0 → +3' },
  ore2: { name: '強化金屬・二', icon: 37, price: 200,  desc: '沒有紅寶石時可代替：+3 → +6' },
  god:  { name: '神之金屬',     icon: 42, price: 1750, desc: '沒有鑽石／粉紅鑽時可代替：武器 +6 → +12' },
  alu:  { name: '鋁',           icon: 34, price: 1250, desc: '沒有鑽石／粉紅鑽時可代替：防具、飾品 +6 → +12' },
  // 項目 28：不是礦石，但一樣放在 mats、在商人「購買」分頁賣（圖示＝服務端 item.scr 圖示欄：卷軸 2313）
  // 項目 55：防爆石（不在商店賣：釣魚老人用稀有魚換；圖示借服務端 item.scr「受祝福的金符咒」1351）
  abis: { name: '艾彼斯的祝福', icon: 1351, price: 0, desc: '精煉失敗時裝備不會碎掉，只降 1 級（+6 以上才用得到）；跟釣魚老人用稀有魚換', scroll: true, noshop: true },
  reset: { name: '技能屬性初始化卷軸', icon: 2313, price: 2000, desc: '把裝備的技能屬性重置成「尚未鑑定」，可以再鑑定一次', scroll: true },
  // 項目 28 鑲嵌石用的券（PC 是商城道具，售價暫定；圖示＝item.scr：固定券 4256、充值券 4257）
  towerTicket: { name: '賢者之塔入場券', icon: 2313, price: 1500, desc: '每天免費 2 次用完後，可以再入場 1 次（每天最多用 2 張）', scroll: true },
  ashton: { name: '艾希頓之魂', icon: 1352, price: 0, desc: '賢者之塔掉落，找越過次元的修道士製作艾希頓裝備', scroll: true, noshop: true },
  personaTicket: { name: '個性化固定券', icon: 4256, price: 800, desc: '個性化「展現」時鎖定 1 條能力種類（數值等級還是會重擲）', scroll: true },
  fixTicket:    { name: '石頭屬性固定券',       icon: 4256, price: 1000, desc: '變更鑲嵌石屬性時只重抽數值、不換屬性', scroll: true },
  chargeTicket: { name: '石頭屬性變更次數充值券', icon: 4257, price: 3000, desc: '鑲嵌石屬性變更次數 +50（上限 300）', scroll: true },
  // 項目 46 G 化材料（服務端 item.scr：紅寶石 433 售 980000、鑽石 434 售 1000000、粉紅鑽 3981 售 5000000 → 金幣 ÷1000；圖示＝item.scr 圖示欄）
  ruby:    { name: '紅寶石', icon: 618, price: 980,  desc: '合成 +3 → +6；G 化材料：一般 → G', scroll: true },
  diamond: { name: '鑽石',   icon: 341, price: 1000, desc: '合成 +6 → +9；G 化材料：G → DG', scroll: true },
  pinkdia: { name: '粉紅鑽', icon: 380, price: 5000, desc: '合成 +9 → +12；G 化材料：DG → XG', scroll: true },
  gbox80:  { name: '艾彼雷歐的 G 化工具箱 80%',  icon: 3427, price: 3000, desc: 'G 化時一起用：成功率至少 80%', scroll: true },
  gbox100: { name: '艾彼雷歐的 G 化工具箱 100%', icon: 3428, price: 8000, desc: 'G 化時一起用：一定成功', scroll: true },
  // 指令 4-2 發條配件（服務端 item.txt 26731～26733、26948：實習生的發條 N～G、高手的發條 N～XG、武爾坎努斯的發條 N～XG＋可保留原屬性、發條屬性繼承卷軸；
  // 實習生售價 50000 → ÷10；其他三個原版是商城道具（售價 0）→ 暫定）
  clk1: { name: '實習生的發條', icon: 4298, price: 5000, desc: '使用後，賦予裝備 N～G 等級的 3 種隨機屬性（會蓋掉原本的發條屬性）', scroll: true },
  clk2: { name: '高手的發條', icon: 4299, price: 15000, desc: '進階發條：賦予裝備 N～XG 等級的 3 種隨機屬性', scroll: true },
  clk3: { name: '武爾坎努斯的發條', icon: 4300, price: 30000, desc: '最高級的發條：N～XG 等級的 3 種隨機屬性，可以選擇維持使用前的屬性', scroll: true },
  // PC 變身藥水（polymorph.js；item.scr 售價 ÷10，PC 在獅子城道具店 拿坡里 賣）：在背包點藥水「喝下」→ 下一次出征整局變身
  poly1: { name: '小碗豆變身藥水', icon: 2574, price: 1000, desc: '喝了下一次出征變身成小碗豆（名聲 370 以上）：攻擊力 +5、魔法力 +5、防禦力 +5、必殺技 +5、回避率 +5、移動速度 +3、HP +100', scroll: true },
  poly2: { name: '蘑菇妹妹變身藥水', icon: 2574, price: 1600, desc: '喝了下一次出征變身成蘑菇妹妹（名聲 5007 以上）：攻擊力 +8、魔法力 +5、防禦力 +5、必殺技 +7、回避率 +6、移動速度 +4、HP +150', scroll: true },
  poly3: { name: '菜頭王變身藥水', icon: 2574, price: 2400, desc: '喝了下一次出征變身成菜頭王（名聲 8441 以上）：攻擊力 +11、魔法力 +5、防禦力 +5、必殺技 +9、回避率 +7、移動速度 +5、HP +200', scroll: true },
  poly4: { name: '拳擊毛毛蟲變身藥水', icon: 2574, price: 3400, desc: '喝了下一次出征變身成拳擊毛毛蟲（名聲 14280 以上）：攻擊力 +14、魔法力 +5、防禦力 +5、必殺技 +11、回避率 +8、移動速度 +6、HP +250', scroll: true },
  poly5: { name: '熊寶寶變身藥水', icon: 2574, price: 4600, desc: '喝了下一次出征變身成熊寶寶（名聲 24207 以上）：攻擊力 +17、魔法力 +5、防禦力 +5、必殺技 +13、回避率 +9、移動速度 +7、HP +300', scroll: true },
  poly6: { name: '小妖姬變身藥水', icon: 2574, price: 6000, desc: '喝了下一次出征變身成小妖姬（名聲 41082 以上）：攻擊力 +20、魔法力 +5、防禦力 +5、必殺技 +15、回避率 +10、移動速度 +8、HP +350', scroll: true },
  unpoly: { name: '恢復原狀變身藥水', icon: 2575, price: 10, desc: '解除變身（喝了還沒出征的變身藥水也會取消，藥水不退）', scroll: true },
  // PC 在線與簽到獎勵（服務端 Attendance_Reward.scr／Reward_Time.scr；名稱、圖示、售價照 item.scr ÷1000）
  quartz:  { name: '水晶', icon: 39, price: 900, desc: '合成材料：裝備 +0 → +3（item.scr 售價 900000 ÷1000）', scroll: true },
  ...Object.fromEntries(Object.entries(MELT_STONES).map(([k, m]) => [k, { name: m.name, icon: m.icon, price: m.price, desc: `進階合成輔助：+${m.from}→+${m.to + 1} 階段成功率 +${Math.round(m.add * 100)}%（成功失敗都會消失）`, scroll: true }])),
  petMilk: { name: '奶粉', icon: 759, price: 0, desc: '寵物食品：餵出戰中的寵物，經驗 +50、飢餓 −25', scroll: true, noshop: true },
  petBaby: { name: '豪華的嬰兒副食品', icon: 760, price: 0, desc: '寵物食品：餵出戰中的寵物，經驗 +100、飢餓 −25', scroll: true, noshop: true },
  petGugu: { name: '咕咕大力丸', icon: 761, price: 0, desc: '寵物食品：餵出戰中的寵物，經驗 +150、飢餓 −25', scroll: true, noshop: true },
  macaron: { name: '特級全能馬卡龍', icon: 31, price: 0, desc: '寵物食品：餵出戰中的寵物，經驗 +15、飢餓 −25', scroll: true, noshop: true },
  clkInherit: { name: '發條屬性繼承卷軸', icon: 4336, price: 10000, desc: '把一件裝備的發條屬性移到同部位的另一件裝備上（原本那件的發條屬性會消失）', scroll: true },
  ...CHEST_ORES,
  rToken: { name: 'R代幣', icon: 2610, price: 0, desc: '希望藍圖任務獎勵（PC 拿去 R 幣商店換道具；割草版 R 幣商店還沒做）', scroll: true, noshop: true },
  ...FORTUNE_ORES,
};
// ===== 指令 4-2 發條配件：items.clk＝[[屬性, 數值, 等級 0 N／1 G／2 DG／3 XG], ×3]（同一次不重複；數值 🔢 暫定）=====
export const CLK_GRADE = ['N', 'G', 'DG', 'XG'], CLK_COLOR = ['#5a6070', '#1e9e45', '#1f6fd6', '#d9740a'];
export const CLK_POOL = { atk: [0.02, 0.03, 0.045, 0.06], hp: [8, 14, 22, 32], armor: [1, 2, 3, 4], crit: [0.01, 0.02, 0.03, 0.04], haste: [0.02, 0.03, 0.045, 0.06],
  speed: [0.015, 0.025, 0.035, 0.05], magnet: [0.1, 0.15, 0.22, 0.3], skd: [0.03, 0.05, 0.07, 0.1], str: [1, 2, 3, 5], agi: [1, 2, 3, 5], int: [1, 2, 3, 5], vit: [1, 2, 3, 5], wis: [1, 2, 3, 5], luk: [1, 2, 3, 5] };
const CLK_W = { clk1: [70, 30, 0, 0], clk2: [50, 30, 15, 5], clk3: [40, 32, 20, 8] }; // 等級機率
export const CLK_KINDS = ['clk1', 'clk2', 'clk3'];
export function rollClock(kind, rand = Math.random) {
  const W = CLK_W[kind], keys = Object.keys(CLK_POOL), out = [];
  while (out.length < 3) { const k = keys[Math.floor(rand() * keys.length)]; if (out.some(x => x[0] === k)) continue;
    let r = rand() * 100, g = 0; while (g < 3 && r >= W[g]) r -= W[g++]; out.push([k, CLK_POOL[k][g], g]); }
  return out;
}
export const clkText = l => `${STAT_NAMES[l[0]]} ${fmtStat(l[0], l[1])}（${CLK_GRADE[l[2]]}）`;
// ===== 項目 46：G 化（一般 → G → DG → XG）=====
// 照服務端 item.scr 的 .G／.DG／.XG 版本：強化鎚 攻擊 64 → 74 → 79 → 84（×1.16／1.23／1.31）；
// 成功率（第 47 欄）隨裝備等級遞減：低階 97／82／56%、高階 42／29／16% → 我們用品質內插（普通＝低階、傳說＝高階）
// 失敗只消耗寶石（工具箱一起用的話也消耗），裝備不變
export const GUP = [
  { tag: '',   mult: 1 },
  { tag: 'G',  mult: 1.16, gem: 'ruby',    rate: [0.97, 0.42], glow: 0x6fb4ff },
  { tag: 'DG', mult: 1.23, gem: 'diamond', rate: [0.82, 0.29], glow: 0xc07cff },
  { tag: 'XG', mult: 1.31, gem: 'pinkdia', rate: [0.56, 0.16], glow: 0xffc34a },
];
export const GUP_MAX = GUP.length - 1;
export const gupRate = it => { const g = GUP[(it.gup || 0) + 1]; if (!g) return 0; const k = (it.rarity || 0) / (RARITY.length - 1); return g.rate[0] + (g.rate[1] - g.rate[0]) * k; };
// 這件裝備下一次精煉要用哪種礦石
export const oreFor = (it, mats) => refineMat(it, mats); // 先 PC 寶石（水晶／紅寶石／鑽石／粉紅鑽），沒有才用舊強化金屬

// ===== 限量商品：每小時換一批、每天限買 5 件（項目 29）；買到的裝備綁定帳號，不能上架拍賣 =====
export const STOCK_SIZE = 8, STOCK_DAILY = 5;
export const STOCK_PRICE = [120, 390, 720, 1500, 3000];
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function stockFor(charId, hourIndex) {
  const rand = mulberry32(charId * 1000003 + hourIndex * 7919);
  return Array.from({ length: STOCK_SIZE }, () => { const it = rollItem(rand, 0.8); return { ...it, price: STOCK_PRICE[it.rarity] }; });
}

// 11/20 釣魚 v2：PC 道具編號 → 一件本作裝備（釣到裝備用；品質一般、浮動照常）
export function itemFromPc(id, rand = Math.random) {
  for (const [t, list] of Object.entries(PC_ITEMS)) { const x = list.find(v => v[0] === id); if (!x) continue;
    const base = Object.keys(PC_TYPE_OF).find(k => String(PC_TYPE_OF[k]) === String(t)); if (!base) return null;
    const slot = Object.keys(BASES).find(sl => BASES[sl].some(b => b.key === base)); if (!slot) return null;
    return { slot, base, rarity: 0, roll: +(0.9 + rand() * 0.2).toFixed(3), refine: 0, aff: null, pc: id, name: x[1] }; }
  return null;
}
