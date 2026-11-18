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
