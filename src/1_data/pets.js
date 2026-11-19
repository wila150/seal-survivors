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
export const petName = p => `${p.trait ? (TRAITS[p.trait]?.name || '') + '的' : ''}${p.evo ? '進化' + (p.evo > 1 ? p.evo : '') + '・' : ''}${STAGE_NAMES[petStage(p.lv)]}${p.name || PETS[p.kind]?.name || '寵物'}`;
export const petNeed = lv => 100 + 60 * lv;                    // 升到下一級要的經驗
export const FEED_EXP = [20, 45, 100, 220, 500];               // 餵一件裝備（普通～傳說）＋精煉 ×(1＋0.1×精煉)
// 寵物攻擊（出征）：每 1.6 秒打最近的怪一下；傷害隨等級、進化成長
export const petAtk = p => ({ dmg: 6 + p.lv * 1.6 + petStage(p.lv) * 8, cd: Math.max(0.8, 1.6 - petStage(p.lv) * 0.3), range: 9 });
// 被動加成（等級 × 每級值）
export const petBonus = p => { const o = Object.fromEntries(Object.entries(PETS[p.kind]?.bonus || {}).map(([k, v]) => [k, v * p.lv * petMul(p)])); for (const [k, v] of Object.entries(petTraitBonus(p))) o[k] = (o[k] || 0) + v * petMul(p); return o; }; // v2：進化次數、性格加成
const BONUS_TXT = { atk: '傷害', hp: '最大 HP', regen: '每秒回血', crit: '爆擊率' };
export const petBonusText = p => Object.entries(petBonus(p)).map(([k, v]) => k === 'regen' ? `${BONUS_TXT[k]} +${v.toFixed(2)}` : `${BONUS_TXT[k]} +${(v * 100).toFixed(1)}%`).join('、');
// 加經驗 → 升級（回傳升了幾級）
export function addPetExp(p, exp) {
  let ups = 0; p.exp = (p.exp || 0) + exp;
  while (p.lv < PET_MAX_LV && p.exp >= petNeed(p.lv)) { p.exp -= petNeed(p.lv); p.lv++; ups++; }
  if (p.lv >= PET_MAX_LV) p.exp = 0;
  return ups;
}

// ===== 寵物 v2（照台服官方 wiki id=49，docs/參考_官方wiki.md）=====
// - 9 個成長階段（Lv1～30 換算）；第 9 階段（Lv27+）再過 30 分鐘遊戲時間（出征秒數）就能找飼育員進化
// - 飢餓：只有出征時會餓（每局結算：出征秒數 ÷ 9）；主城不餓、不長、不死。飢餓 100＝挨餓：不長經驗、還會掉經驗；第 1 階段（剛出生／剛進化）挨餓掉到 0 經驗會死掉
// - 餵食：餵裝備（什麼都能吃）降飢餓 25／件；寵物「想吃」的部位會 ×2 經驗（吃到後換一個想吃的）
// - 遊戲：陪牠玩，飢餓 −30，不會長經驗
// - 進化：最多 10 個材料，依材料「統一性」決定性格（最多的那一類＝性格；全部同一類＝完美，加成更高）；進化後回到 Lv1、進化次數 +1（加成 ×(1＋0.5×次數)）
export const petStage9 = lv => Math.min(9, Math.max(1, Math.ceil(lv / 3.34)));
export const HUNGER_PER_SEC = 1 / 9, FEED_HUNGER = 25, PLAY_HUNGER = 30, EVOLVE_SECS = 1800;
export const WANT_SLOTS = ['weapon', 'shield', 'head', 'top', 'bottom', 'shoes', 'acc'];
export const WANT_NAMES = { weapon: '武器', shield: '盾牌', head: '頭盔', top: '上衣', bottom: '下衣', shoes: '鞋子', acc: '飾品' };
// 進化材料類別（對應 mats 的 key）→ 性格
export const EVO_CAT = { ore1: 'stone', ore2: 'stone', god: 'stone', alu: 'stone', ruby: 'gem', diamond: 'gem', pinkdia: 'gem', dust: 'magic', crystal: 'magic', rainbow: 'magic', abis: 'holy', reset: 'trick', fixTicket: 'trick', chargeTicket: 'trick', personaTicket: 'trick' };
export const TRAITS = {
  stone: { name: '傻瓜', bonus: { hp: 0.006 }, desc: '石頭類材料多：耐打（HP）' },
  gem:   { name: '高貴', bonus: { crit: 0.003 }, desc: '寶石類材料多：爆擊' },
  magic: { name: '神秘', bonus: { atk: 0.005 }, desc: '魔法材料多：傷害' },
  holy:  { name: '虔誠', bonus: { regen: 0.07 }, desc: '祝福類材料多：回血' },
  trick: { name: '聰明絕頂', bonus: { atk: 0.003, crit: 0.002 }, desc: '鬼點子（卷軸、券）多：傷害＋爆擊' },
};
export function evolveResult(mats) {
  const cnt = {}; let n = 0; for (const [k, v] of Object.entries(mats || {})) { const c = EVO_CAT[k]; if (!c || !(v > 0)) continue; cnt[c] = (cnt[c] || 0) + v; n += v; }
  if (!n) return null; const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
  return { trait: top[0], perfect: top[1] === n && n >= 5, n };
}
// 進化與性格加成（套在原本的寵物加成上）
export const petMul = p => (1 + 0.5 * (p.evo || 0)) * (p.perfect ? 1.2 : 1);
export const petTraitBonus = p => { const T = TRAITS[p.trait]; if (!T) return {}; return Object.fromEntries(Object.entries(T.bonus).map(([k, v]) => [k, v * p.lv])); };
