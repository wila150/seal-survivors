// 項目 30：寵物（割草版，用客戶端 4 隻戰鬥寵物：E_Bpet_fire／water／light／dark；飼育員 N_petbreeder）
// 希望OL 對照表：寵物蛋 → 餵怪物掉落物 → 親密度與等級 → 多階段外觀進化。割草版：
//   取得：寵物飼育員買蛋（金幣）或 MVP 寶箱小機率掉；餵食：把不要的裝備餵給寵物（品質越高經驗越多）
//   等級 1～30；Lv10、Lv20 進化（外觀變大＋發光，名稱加階段）；出征時跟著主角、自動攻擊最近的怪（屬性照原版相剋表）
//   數值暫定（原版 bpet_*.xml／Pet_*.scr 是道具編號與成長表，對不到割草版的系統）
export const PETS = {
  fire:  { name: '火之精靈',   elem: 1, model: 'E_Bpet_fire_stand',  color: 0xff6a3d, fx: 'fire',  bonus: { atk: 0.004 } },
  water: { name: '水之精靈',   elem: 2, model: 'E_Bpet_water_stand', color: 0x4fb4ff, fx: 'ice',   bonus: { hp: 0.005 } },
  light: { name: '光之精靈',   elem: 6, model: 'E_Bpet_light_stand', color: 0xfff3a0, fx: 'holy',  bonus: { regen: 0.05 } },
  dark:  { name: '黑暗精靈',   elem: 7, model: 'E_Bpet_dark',        color: 0xb07cff, fx: 'shock', bonus: { crit: 0.002 } },
};
export const PET_MAX_LV = 30, PET_MAX = 8, EGG_PRICE = 3000, MVP_EGG_RATE = 0.05;
export const STAGE_NAMES = ['', '覺醒的', '真．']; // 進化階段名稱前綴（Lv10、Lv20）
export const petStage = lv => lv >= 20 ? 2 : lv >= 10 ? 1 : 0;
export const petName = p => `${STAGE_NAMES[petStage(p.lv)]}${p.name || PETS[p.kind]?.name || '寵物'}`;
export const petNeed = lv => 100 + 60 * lv;                    // 升到下一級要的經驗
export const FEED_EXP = [20, 45, 100, 220, 500];               // 餵一件裝備（普通～傳說）＋精煉 ×(1＋0.1×精煉)
// 寵物攻擊（出征）：每 1.6 秒打最近的怪一下；傷害隨等級、進化成長
export const petAtk = p => ({ dmg: 6 + p.lv * 1.6 + petStage(p.lv) * 8, cd: Math.max(0.8, 1.6 - petStage(p.lv) * 0.3), range: 9 });
// 被動加成（等級 × 每級值）
export const petBonus = p => Object.fromEntries(Object.entries(PETS[p.kind]?.bonus || {}).map(([k, v]) => [k, v * p.lv]));
const BONUS_TXT = { atk: '傷害', hp: '最大 HP', regen: '每秒回血', crit: '爆擊率' };
export const petBonusText = p => Object.entries(petBonus(p)).map(([k, v]) => k === 'regen' ? `${BONUS_TXT[k]} +${v.toFixed(2)}` : `${BONUS_TXT[k]} +${(v * 100).toFixed(1)}%`).join('、');
// 加經驗 → 升級（回傳升了幾級）
export function addPetExp(p, exp) {
  let ups = 0; p.exp = (p.exp || 0) + exp;
  while (p.lv < PET_MAX_LV && p.exp >= petNeed(p.lv)) { p.exp -= petNeed(p.lv); p.lv++; ups++; }
  if (p.lv >= PET_MAX_LV) p.exp = 0;
  return ups;
}
