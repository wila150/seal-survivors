// 項目 22：賢者之塔（企劃的「無盡之塔」；希望OL 對照表 → 用 PC 副本名「賢者之塔」）。前後端共用
// 規則：無限樓層、每 1 分鐘上一層；開打前選 4 招技能＋用塔點數強化＋可選 1 個「塔之詛咒」換分數；
// 樓層分段對應遠征地圖（1～10 平原、11～20 森林、21～30 墓地、31 以上紅土）；最佳分數／樓層、本月排行；
// 開放條件：完成二轉＋通關主線（四張遠征地圖都通關）
export const TOWER_NAME = '賢者之塔';
export const FLOOR_SECS = 60;
export const towerFloor = secs => 1 + Math.floor(secs / FLOOR_SECS);
export const towerSeg = floor => Math.min(3, Math.floor((floor - 1) / 10)); // → STAGES 索引
// 怪物強度：每層 +18% HP、+8% 傷害（取代一般地圖隨時間變強；數值暫定）
export const towerHpMul = floor => 1 + 0.18 * (floor - 1);
export const towerDmgMul = floor => 1 + 0.08 * (floor - 1);
// 每 5 層出小王、每 10 層出該段地圖的 MVP（塔裡打倒 MVP 不會結束）
export const towerBossAt = floor => floor % 10 === 0 ? 'mvp' : floor % 5 === 0 ? 'mini' : null;

// 塔之詛咒：選 1 個（或不選），分數乘倍率
export const CURSES = {
  none:   { name: '不選詛咒',   desc: '一般難度',                   mult: 1 },
  tough:  { name: '堅韌之咒',   desc: '怪物 HP +50%',               mult: 1.3, hp: 1.5 },
  swift:  { name: '迅捷之咒',   desc: '怪物移動速度 +30%',          mult: 1.3, speed: 1.3 },
  horde:  { name: '群聚之咒',   desc: '生怪速度 +50%',              mult: 1.3, spawn: 1.5 },
  wither: { name: '枯竭之咒',   desc: '不會自然回血',               mult: 1.25, noRegen: true },
  dull:   { name: '遲鈍之咒',   desc: '局內經驗 -30%',              mult: 1.2, xp: 0.7 },
};
// 分數＝樓層 ×1000＋擊殺，乘詛咒倍率（伺服器自己算，不信任前端）
export const towerScore = (floor, kills, curse) => Math.floor((floor * 1000 + kills) * (CURSES[curse]?.mult || 1));
// 塔點數：歷史最高樓層每 5 層 1 點；開打前每 1 點讓一招選好的技能起始等級 +1（最高 Lv5）
export const towerPoints = bestFloor => Math.floor((bestFloor || 0) / 5);
export const PICK = 4;
export const towerOpen = (char, stages) => !!char.job2 && stages.every(s => (char.cleared || []).includes(s.key));
// 檢查開打設定：skills＝4 招（要在可用清單裡）、boost＝{ 技能: 點數 }、curse
export function checkTowerSetup(setup, allowed, points) {
  if (!setup || !Array.isArray(setup.skills) || setup.skills.length !== PICK || new Set(setup.skills).size !== PICK) return `要選 ${PICK} 招技能`;
  if (setup.skills.some(k => !allowed.includes(k))) return '有不能用的技能';
  if (!CURSES[setup.curse || 'none']) return '沒有這個詛咒';
  let used = 0;
  for (const [k, v] of Object.entries(setup.boost || {})) { if (!setup.skills.includes(k) || !Number.isInteger(v) || v < 0 || v > 4) return '強化點數不對'; used += v; }
  if (used > points) return '塔點數不夠';
  return null;
}

// ===== 賢者之塔 Another（照台服官方 wiki id=83）=====
// 入場：找主城「越過次元的修道士」；每天免費 2 次（早上 06:00 換日），入場券每天最多再用 2 張（一天最多 4 次）
// 建議戰鬥力（本作用裝備分數 GS）：1～10 層 60、11～20 層 80、21 層以上 100；開場低於第 1 段建議值 → 懲罰（怪物攻擊 ×1.3、自己傷害 ×0.85）
// 艾希頓裝備：用「艾希頓之魂」（塔裡每 3 層 1 個）找修道士製作兩套：渾沌的炙卡爾（攻擊）／純白的坦柏特（防禦）；只有艾希頓裝備能分解回艾希頓之魂（花希幣）
export const ENTRY_FREE = 2, TICKET_MAX = 2, REC_GS = [60, 80, 100];
export const towerDay = (now = Date.now()) => { const d = new Date(now - 6 * 3600e3); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
export const ASHTON_SLOTS = ['weapon', 'head', 'top', 'bottom', 'shoes'];
export const ASHTON_SETS = {
  chaos: { name: '渾沌的炙卡爾', b2: { atk: 0.08 }, b4: { atk: 0.12, crit: 0.05 }, desc: '2 件：傷害 +8%｜4 件：再傷害 +12%、爆擊 +5%' },
  white: { name: '純白的坦柏特', b2: { hp: 0.1 }, b4: { hp: 0.15, dmgDown: 0.08 }, desc: '2 件：最大 HP +10%｜4 件：再 HP +15%、受到傷害 −8%' },
};
export const ASH_CRAFT = { souls: 20, gold: 5000 };
export const ashBreakCost = it => 500 + 200 * (it.refine || 0);
export const ashBreakSouls = (it, r = Math.random) => 3 + Math.floor(r() * 4) + (it.refine || 0) + (it.rarity || 0);
export function setBonus(items) {
  const n = {}; for (const i of items || []) if (i.equipped && i.setk) n[i.setk] = (n[i.setk] || 0) + 1;
  const o = {}; for (const [k, c] of Object.entries(n)) { const S = ASHTON_SETS[k]; if (!S) continue; for (const b of [c >= 2 && S.b2, c >= 4 && S.b4]) if (b) for (const [x, v] of Object.entries(b)) o[x] = (o[x] || 0) + v; }
  return o;
}
