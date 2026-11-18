// 裝備定義（前端、伺服器、遊戲共用）
import { PC_ITEMS } from './pc-items.js';
// 圖示編號 = assets/items/<編號>.png（取自 GM 工具的道具圖示）

// 項目 32（11/19「照建議」＋使用者：「PC 版裝備只有這三件嗎？」）：部位照 PC（服務端 item.scr 道具分類）
// 武器（4 劍 6 大劍 7 匕首 8 榔頭 9 鎚 11 杖 46 彈弓）、盾牌 14（騎士）、頭部 17 盔／18 帽、上衣 15 盔甲／16 上衣、下衣 25 盔甲(下)／26 下褲、鞋子 19 靴／20 鞋、飾品
// 舊資料的「armor」防具：伺服器啟動時自動搬家（盾 → shield、其他 → top）
export const SLOTS = { weapon: '武器', shield: '盾牌', head: '頭部', top: '上衣', bottom: '下衣', shoes: '鞋子', acc: '飾品' };
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

export const STAT_NAMES = { atk: '攻擊力', hp: '最大 HP', armor: '護甲', crit: '暴擊率', speed: '移動速度', haste: '冷卻縮短', magnet: '吸取範圍' };
const PCT = new Set(['atk', 'crit', 'speed', 'haste', 'magnet']);
export const fmtStat = (k, v) => PCT.has(k) ? `+${Math.round(v * 1000) / 10}%` : `+${Math.round(v)}`;

// 強化：每 +1 數值多 12%；成功率；失敗時 +7 以上會碎，其他降 1 級
export const REFINE_MAX = 10;
export const REFINE_RATE = [1, 1, 1, 0.9, 0.8, 0.7, 0.55, 0.45, 0.35, 0.25];
export const refineCost = lv => 60 * (lv + 1) * (lv + 1);
export const refineBreaks = lv => lv >= 6; // 從 +6 往 +7 開始失敗會碎

// ===== 道具照 PC（11/19 使用者：「道具數值也照 pc 去做」）=====
// 每種底材對到一種 PC 道具類別（src/1_data/pc-items.js，tools/build-pc-items.mjs 從服務端 item.scr 轉出）；
// 掉落時依這局的怪物等級挑 PC 原版那件（名稱、圖示、需求等級照 PC），數值＝底材數值 × (那件的 PC 攻擊或防禦 ÷ 該類別入門款)
// 舊裝備（沒有 pc 編號）照舊：底材名稱、倍率 1
export const PC_TYPE_OF = { sword: 4, blade: 6, spear: 7, hammer: 8, mace: 9, staff: 11, sling: 46, leather: 16, robe: 16, chain: 15, shield: 14, helm: 17, cap: 18, greave: 25, pants: 26, boots: 19, shoe: 20 };
const REF = {}; for (const t in PC_ITEMS) { const v = PC_ITEMS[t].slice(0, 5).map(x => x[3]).sort((a, b) => a - b); REF[t] = v[v.length >> 1]; }
export function pcOf(it) { const t = PC_TYPE_OF[it?.base]; return it?.pc && t ? PC_ITEMS[t]?.find(x => x[0] === it.pc) || null : null; }
export const pcTier = it => { const p = pcOf(it); return p ? Math.max(0.5, p[3] / REF[PC_TYPE_OF[it.base]]) : 1; };
export const pcReqLv = it => pcOf(it)?.[2] || 0;
// 依怪物等級挑一件：需求等級 ≤ lv 的最高幾件裡隨機（越接近 lv 越常出）
export function pickPc(base, lv, rand = Math.random) {
  const L = PC_ITEMS[PC_TYPE_OF[base]]; if (!L) return null;
  const ok = L.filter(x => x[2] <= Math.max(lv, L[0][2])); const top = ok.slice(-4);
  const w = top.map((_, i) => i + 1); let r = rand() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < top.length; i++) { r -= w[i]; if (r <= 0) return top[i][0]; }
  return top.at(-1)[0];
}

// 一件裝備實際的數值（含品質與強化）
export function itemStats(it) {
  const base = BASES[it.slot]?.find(b => b.key === it.base); if (!base) return {};
  const m = RARITY[it.rarity].mult * (it.roll || 1) * (1 + 0.12 * (it.refine || 0)) * (GUP[it.gup || 0]?.mult || 1) * pcTier(it);
  return Object.fromEntries(Object.entries(base.stat).map(([k, v]) => [k, v * m]));
}
export const itemName = it => `${it.refine ? '+' + it.refine + ' ' : ''}${pcOf(it)?.[1] || BASES[it.slot]?.find(b => b.key === it.base)?.name || '?'}${it.gup ? '.' + GUP[it.gup].tag : ''}`; // 原版寫法：長劍.G
export const itemIcon = it => `assets/items/${pcOf(it)?.[4] ?? BASES[it.slot]?.find(b => b.key === it.base)?.icon ?? 0}.png`;
export const sellPrice = it => Math.round(20 * RARITY[it.rarity].mult * RARITY[it.rarity].mult * (1 + (it.refine || 0) * 0.5) * Math.sqrt(pcTier(it)));

// 隨機產生裝備（伺服器用）：bonus 越高越容易出好品質
// PC 每個職業只能拿自己的武器（11/19 使用者：「小丑不是丟匕首嗎？為甚麼見面禮是長槍」）；盾只有騎士
export const JOB_WEAPON = { 劍士: 'blade', 騎士: 'sword', 小丑: 'spear', 法師: 'staff', 祭司: 'mace', 鐵匠: 'hammer', 獵人: 'sling' };
// 項目 50：非本職業的裝備（別職業的武器、非騎士的盾）→ 一鍵餵寵物／分解的候選
export const offJob = (it, job) => !!JOB_WEAPON[job] && ((it.slot === 'weapon' && it.base !== JOB_WEAPON[job]) || (it.base === 'shield' && job !== '騎士'));
// 項目 50：分解（強化金屬・一＝1＋品質、+4 以上多 1 個強化金屬・二；希幣＝賣價 60%）
export const dismantleYield = it => ({ ore1: 1 + it.rarity, ore2: (it.refine || 0) >= 4 ? 1 : 0, gold: Math.round(sellPrice(it) * 0.6) });
export function rollItem(rand = Math.random, bonus = 0, slot, lv = 0, job = null) { // lv：這局怪物等級（有給才挑 PC 原版道具）；job：只出這職業能用的武器
  // 部位權重：武器 3、盾 1、頭 2、上衣 2、下衣 2、鞋 2、飾品 2（有給職業而且不是騎士就不出盾）
  const SW = { weapon: 3, shield: 1, head: 2, top: 2, bottom: 2, shoes: 2, acc: 2 }, pool = Object.keys(BASES).filter(k => !(k === 'shield' && job && job !== '騎士'));
  let s = slot; if (!s) { let r = rand() * pool.reduce((a, k) => a + SW[k], 0); s = pool.find(k => (r -= SW[k]) < 0) || pool.at(-1); }
  let bases = BASES[s];
  if (job && JOB_WEAPON[job] && s === 'weapon') bases = bases.filter(b => b.key === JOB_WEAPON[job]);
  const b = bases[Math.floor(rand() * bases.length)];
  const ws = RARITY.map((r, i) => r.w * (1 + bonus * i)); let x = rand() * ws.reduce((a, c) => a + c, 0), rarity = 0;
  for (let i = 0; i < ws.length; i++) { x -= ws[i]; if (x <= 0) { rarity = i; break; } }
  const it = { slot: s, base: b.key, rarity, roll: +(0.9 + rand() * 0.2).toFixed(3), refine: 0 };
  if (lv > 0) { const pc = pickPc(b.key, lv, rand); if (pc) it.pc = pc; }
  return it;
}

// 把身上裝備的數值加總
export function totalBonus(items) {
  const t = {}; for (const it of items) for (const [k, v] of Object.entries(itemStats(it))) t[k] = (t[k] || 0) + v; return t;
}

// ===== 精煉礦石（裝備商人販售；強化改成消耗礦石） =====
export const ORES = {
  ore1: { name: '強化金屬・一', icon: 36, price: 75,   desc: '可將任何裝備從 +0 精煉至 +4' },
  ore2: { name: '強化金屬・二', icon: 37, price: 200,  desc: '可將任何裝備從 +4 精煉至 +7' },
  god:  { name: '神之金屬',     icon: 42, price: 1750, desc: '可將武器從 +7 精煉至 +10' },
  alu:  { name: '鋁',           icon: 34, price: 1250, desc: '可將防具、飾品從 +7 精煉至 +10' },
  // 項目 28：不是礦石，但一樣放在 mats、在商人「購買」分頁賣（圖示＝服務端 item.scr 圖示欄：卷軸 2313）
  // 項目 55：防爆石（不在商店賣：釣魚老人用稀有魚換；圖示借服務端 item.scr「受祝福的金符咒」1351）
  abis: { name: '艾彼斯的祝福', icon: 1351, price: 0, desc: '精煉失敗時裝備不會碎掉，只降 1 級（+6 以上才用得到）；跟釣魚老人用稀有魚換', scroll: true, noshop: true },
  reset: { name: '技能屬性初始化卷軸', icon: 2313, price: 2000, desc: '把裝備的技能屬性重置成「尚未鑑定」，可以再鑑定一次', scroll: true },
  // 項目 28 鑲嵌石用的券（PC 是商城道具，售價暫定；圖示＝item.scr：固定券 4256、充值券 4257）
  fixTicket:    { name: '石頭屬性固定券',       icon: 4256, price: 1000, desc: '變更鑲嵌石屬性時只重抽數值、不換屬性', scroll: true },
  chargeTicket: { name: '石頭屬性變更次數充值券', icon: 4257, price: 3000, desc: '鑲嵌石屬性變更次數 +50（上限 300）', scroll: true },
  // 項目 46 G 化材料（服務端 item.scr：紅寶石 433 售 980000、鑽石 434 售 1000000、粉紅鑽 3981 售 5000000 → 金幣 ÷1000；圖示＝item.scr 圖示欄）
  ruby:    { name: '紅寶石', icon: 618, price: 980,  desc: 'G 化材料：一般 → G', scroll: true },
  diamond: { name: '鑽石',   icon: 341, price: 1000, desc: 'G 化材料：G → DG', scroll: true },
  pinkdia: { name: '粉紅鑽', icon: 380, price: 5000, desc: 'G 化材料：DG → XG', scroll: true },
  gbox80:  { name: '艾彼雷歐的 G 化工具箱 80%',  icon: 3427, price: 3000, desc: 'G 化時一起用：成功率至少 80%', scroll: true },
  gbox100: { name: '艾彼雷歐的 G 化工具箱 100%', icon: 3428, price: 8000, desc: 'G 化時一起用：一定成功', scroll: true },
};
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
export const oreFor = it => it.refine < 4 ? 'ore1' : it.refine < 7 ? 'ore2' : it.slot === 'weapon' ? 'god' : 'alu';

// ===== 限量商品：每小時換一批、每天限買 5 件（項目 29）；買到的裝備綁定帳號，不能上架拍賣 =====
export const STOCK_SIZE = 8, STOCK_DAILY = 5;
export const STOCK_PRICE = [120, 390, 720, 1500, 3000];
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function stockFor(charId, hourIndex) {
  const rand = mulberry32(charId * 1000003 + hourIndex * 7919);
  return Array.from({ length: STOCK_SIZE }, () => { const it = rollItem(rand, 0.8); return { ...it, price: STOCK_PRICE[it.rarity] }; });
}
