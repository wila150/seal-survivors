// 裝備定義（前端、伺服器、遊戲共用）
// 圖示編號 = assets/items/<編號>.png（取自 GM 工具的道具圖示）

export const SLOTS = { weapon: '武器', armor: '防具', acc: '飾品' };

// 底材：stat 是 +0、普通品質時的數值
export const BASES = {
  weapon: [
    { key: 'sword',  name: '鐵劍',     icon: 117, stat: { atk: 0.08 } },
    { key: 'blade',  name: '精鋼大劍', icon: 122, stat: { atk: 0.12 } },
    { key: 'staff',  name: '魔法杖',   icon: 186, stat: { atk: 0.07, haste: 0.04 } },
    { key: 'hammer', name: '戰錘',     icon: 828, stat: { atk: 0.14 } },
    { key: 'spear',  name: '長槍',     icon: 183, stat: { atk: 0.09, crit: 0.02 } },
  ],
  armor: [
    { key: 'leather', name: '皮甲',   icon: 144, stat: { hp: 20, armor: 1 } },
    { key: 'chain',   name: '鎖子甲', icon: 684, stat: { hp: 30, armor: 2 } },
    { key: 'robe',    name: '法袍',   icon: 254, stat: { hp: 18, haste: 0.03 } },
    { key: 'shield',  name: '騎士盾', icon: 215, stat: { hp: 25, armor: 3 } },
  ],
  acc: [
    { key: 'ring',    name: '幸運戒指', icon: 310, stat: { crit: 0.04 } },
    { key: 'feather', name: '疾風之羽', icon: 408, stat: { speed: 0.06 } },
    { key: 'gem',     name: '智慧寶石', icon: 39,  stat: { haste: 0.05 } },
    { key: 'charm',   name: '吸引護符', icon: 45,  stat: { magnet: 0.3, hp: 10 } },
  ],
};

export const RARITY = [
  { name: '普通', color: '#c8c8c8', mult: 1.0, w: 60 },
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

// 一件裝備實際的數值（含品質與強化）
export function itemStats(it) {
  const base = BASES[it.slot]?.find(b => b.key === it.base); if (!base) return {};
  const m = RARITY[it.rarity].mult * (it.roll || 1) * (1 + 0.12 * (it.refine || 0)) * (GUP[it.gup || 0]?.mult || 1);
  return Object.fromEntries(Object.entries(base.stat).map(([k, v]) => [k, v * m]));
}
export const itemName = it => `${it.refine ? '+' + it.refine + ' ' : ''}${BASES[it.slot]?.find(b => b.key === it.base)?.name || '?'}${it.gup ? '.' + GUP[it.gup].tag : ''}`; // 原版寫法：長劍.G
export const itemIcon = it => `assets/items/${BASES[it.slot]?.find(b => b.key === it.base)?.icon ?? 0}.png`;
export const sellPrice = it => Math.round(20 * RARITY[it.rarity].mult * RARITY[it.rarity].mult * (1 + (it.refine || 0) * 0.5));

// 隨機產生裝備（伺服器用）：bonus 越高越容易出好品質
export function rollItem(rand = Math.random, bonus = 0, slot) {
  const slots = Object.keys(BASES); const s = slot || slots[Math.floor(rand() * slots.length)];
  const bases = BASES[s]; const b = bases[Math.floor(rand() * bases.length)];
  const ws = RARITY.map((r, i) => r.w * (1 + bonus * i)); let x = rand() * ws.reduce((a, c) => a + c, 0), rarity = 0;
  for (let i = 0; i < ws.length; i++) { x -= ws[i]; if (x <= 0) { rarity = i; break; } }
  return { slot: s, base: b.key, rarity, roll: +(0.9 + rand() * 0.2).toFixed(3), refine: 0 };
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
