// 職業與素質定義（前端、伺服器、遊戲共用）

// 素質：建立角色時每項基礎 1 點，另有 FREE_POINTS 點自由分配，單項上限 STAT_MAX
// 項目 35：照 PC 的 6 項素質（順序照 PC：力量、敏捷、智力、體力、精神、感覺；名稱照服務端 GM 工具）
// PC：敏捷＝必殺＋迴避（移速、冷卻不在敏捷）、精神＝魔防／輔助（割草版改冷卻縮短）、感覺＝命中／必殺微幅／掉寶。每點數值暫定
export const STATS = {
  str: { name: '力量', desc: '物理傷害 +3%' },
  agi: { name: '敏捷', desc: '爆擊率 +1%、迴避 +0.5%' },
  int: { name: '智力', desc: '魔法傷害 +3%' },
  vit: { name: '體力', desc: '最大 HP +6、受到傷害 -0.3%' },
  wis: { name: '精神', desc: '冷卻 -1%' },
  luk: { name: '感覺', desc: '寶箱裝備品質提升、爆擊率 +0.3%' },
};
export const FREE_POINTS = 20;
export const STAT_MAX = 15;

// 一轉職業（希望OL原版六職）
// weapon：開局武器；main：主要素質（建立時標星號）
export const JOBS = {
  劍士: { icon: 'assets/fx/vfx_shockwave_fireR.png', color: 0xd9534f, hp: 130, speed: 6.0, armor: 1, weapon: 'slash', main: 'str', model: 'musa', gear: ['wpn_R_Bgaa'], mount: 'G_dark_leopard_stand04',
          desc: '大劍近戰：流雲斬、旋風斬、疾風斬、光速斬；超武劍舞。' },
  騎士: { icon: 'assets/fx/vfx_shockwave_blue.png', color: 0x4f7bd9, hp: 160, speed: 5.4, armor: 3, weapon: 'shock', main: 'vit', model: 'knight', gear: ['wpn_R_Saa', 'wpn_L_Sac'], mount: 'G_Unicon04',
          desc: '最硬的職業：十字攻擊、八方攻擊、盾牌投擲、十字神劍；超武神撼大地。' },
  法師: { icon: 'assets/fx/SFX_ThuA3_Blue.png', color: 0x8e5bd9, hp: 85, speed: 6.0, armor: 0, weapon: 'lightning', main: 'int', model: 'magic', gear: ['wpn_R_Stac'], mount: 'G_flame_dragon04',
          desc: '冰火魔法：冰劍術緩速、火風暴與火精靈碎冰爆擊；超武寒冰炮彈術。' },
  祭司: { icon: 'assets/fx/sfx_magic_cycle_yellow01.png', color: 0xf0e6c8, hp: 100, speed: 6.0, armor: 1, weapon: 'tornado', main: 'int', regen: 1.5, model: 'cleric', gear: ['wpn_R_Mcac'], mount: 'G_Unicon04',
          desc: '光屬性＋每秒回血：譴責、聖光、審判之力緩速、天譴；超武審判。' },
  小丑: { icon: 'assets/fx/vfx_dot10_Blue.png', color: 0xf0a030, hp: 95, speed: 7.2, armor: 0, weapon: 'fireball', main: 'luk', model: 'clown', gear: ['wpn_R_Ssaa'], mount: 'G_water_flog_stand04',
          desc: '跑最快：任意投擲、隨意投擲彈射卡片、毒匕首、催眠曲；超武天女散花。' },
  鐵匠: { icon: 'assets/fx/SFX_Meteo_Fire_Green.png', color: 0x9a7b5a, hp: 120, speed: 5.6, armor: 2, weapon: 'hammer', main: 'str', model: 'smith', gear: ['wpn_R_Bwaa'], mount: 'G_flame_dragon04',
          desc: '單發最痛：致命一擊、投擲炸彈、多重粉碎、一擊毀滅暈眩；超武全面毀滅。' },
  // 項目 45：原版第七職（2u jobid 9）；模型＝客戶端 gunner00 初始服裝＋彈弓 R_gunner_G_normal，動作 hm_／hw_
  獵人: { icon: 'assets/fx/e_fireball_Green.png', color: 0x6aa84f, hp: 100, speed: 6.6, armor: 1, weapon: 'fireball', main: 'agi', model: 'gunner', gear: ['wpn_R_gunner_G_normal'], mount: 'G_dark_leopard_stand04',
          desc: '彈弓遠程：亂射、雙子爆發貫穿、爆彈分裂、纏繞樹根緩速；超武紅心連擊。' },
};

// 玩家模型檔名（assets/models/player_<m|w>_<model>.json）
export const playerModelId = (job, gender) => `player_${gender === '女' ? 'w' : 'm'}_${(JOBS[job] || JOBS['劍士']).model}`;
// 動作組（assets/anims/sets.json 的 key）：每職業用自己的武器動作
// 手上的武器（原版 R_ 右手／L_ 左手模型，tools/batch-models.mjs 加前綴 wpn_）
export const playerGear = job => (JOBS[job] || JOBS['劍士']).gear || [];
export const playerAnimSet = (job, gender) => `${gender === '女' ? 'w' : 'm'}_${(JOBS[job] || JOBS['劍士']).model}`;

// 坐騎：租一次 3000 金幣、48 小時，最多累積 14 天；租約期間五項素質 +5、騎乘時移速 +15% 但不能攻擊
export const MOUNT = { price: 3000, hours: 48, maxDays: 14, stat: 5, speed: 0.15, cd: 2 };
export const MOUNT_NAMES = { G_dark_leopard_stand04: '暗影黑豹', G_Unicon04: '天馬獨角獸', G_flame_dragon04: '火焰飛龍', G_water_flog_stand04: '水晶巨蛙' };

// 服裝顏色
export const OUTFITS = [null, 0xd9534f, 0x4f7bd9, 0x5cb85c, 0xf0a030, 0x8e5bd9, 0x37b7b7, 0xe0e0e0, 0x404050];

// 髮型：原版 M_／W_Hair_Aa～Af 各 6 款（tools/build-hair.mjs）；髮色 9 色＝原版染色貼圖（0 原色＝每款自己的顏色）
export const HAIR_STYLES = 6;
export const HAIR_COLORS = [
  { name: '原色', hex: null }, { name: '藍', hex: 0x0995cf }, { name: '黑', hex: 0x151312 }, { name: '綠', hex: 0x96ce61 }, { name: '灰', hex: 0x5a5856 },
  { name: '橘', hex: 0xf07609 }, { name: '粉紅', hex: 0xfe7490 }, { name: '紅', hex: 0xdf3231 }, { name: '白', hex: 0xc8c7c6 },
];
// 服裝配色上鎖的格子（留給之後的 skin）
export const OUTFIT_LOCKED = [7, 8];
export const validLook = (hair, hairColor, outfit) => Number.isInteger(hair) && hair >= 0 && hair < HAIR_STYLES && Number.isInteger(hairColor) && hairColor >= 0 && hairColor < HAIR_COLORS.length
  && Number.isInteger(outfit) && outfit >= 0 && outfit < OUTFITS.length && !OUTFIT_LOCKED.includes(outfit);
// 角色外觀 → sealActor 的 gear 與 opts：sealActor(playerModelId(...), playerAnimSet(...), 1.7, look.gear, look.opts)
export function playerLook(job, gender, hair = 0, hairColor = 0, outfit = 0) {
  const g = gender === '女' ? 'w' : 'm', s = 'abcdef'[hair] || 'a';
  return { gear: [...playerGear(job), { id: `hair_${g}_${s}`, tex: `../hair/${g}_${s}_${hairColor | 0}.png`, native: true }],
           opts: { tint: OUTFITS[outfit] ?? null } };
}
// 頭髮跟職業帽子／頭盔一起畫（11/18 截圖確認不會穿模，跟 PC 版一樣）

export function validateStats(s) {
  if (!s || typeof s !== 'object') return false;
  let used = 0;
  for (const k in STATS) { const v = s[k]; if (!Number.isInteger(v) || v < 1 || v > STAT_MAX) return false; used += v - 1; }
  return Object.keys(s).length === Object.keys(STATS).length && used <= FREE_POINTS;
}
export const defaultStats = () => Object.fromEntries(Object.keys(STATS).map(k => [k, 1]));
