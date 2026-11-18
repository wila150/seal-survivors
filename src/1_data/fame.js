// 項目 47：名聲與稱號（前後端共用）
// 名聲等級表照服務端 Game/scripts/fame.scr（38 段：需要的名聲值 → 名聲等級，原版數值不改）
// 割草版沒有任務系統 → 「解任務」改成成就式條件（打首領次數、塔樓層、轉生、三轉）；
// 稱號加成：原版 TitleExpand.scr 只有數字、欄位意義不明 → 加成是割草版自訂（小幅，數值暫定）
export const FAME_TABLE = [[50, 0], [120, 1], [264, 2], [581, 4], [1220, 5], [2439, 6], [4635, 7], [8806, 8], [15851, 9], [26947, 10],
  [45809, 15], [73295, 20], [117272, 25], [187635, 30], [300216, 35], [480345, 40], [768552, 45], [1229683, 50], [1844525, 55], [2766788, 60],
  [4150182, 65], [6225272, 70], [9337909, 75], [14006863, 80], [21010295, 85], [31515442, 90], [44121618, 95], [61770266, 100], [86478372, 105],
  [121069721, 110], [169497609, 111], [237296653, 112], [332215314, 113], [465101440, 114], [651142016, 115], [911598823, 120], [1276238352, 125], [1786733693, 130]];
// 名聲值 → { lv, next（下一段需要的名聲值，滿了＝null） }
export function fameLevel(f) {
  let lv = -1, next = FAME_TABLE[0][0];
  for (const [need, l] of FAME_TABLE) { if (f >= need) { lv = l; next = null; } else { next = need; break; } }
  return { lv: Math.max(0, lv), next, started: f >= FAME_TABLE[0][0] };
}
// 一局拿到的名聲：小王 ×10、MVP ×50（乘地圖序 1～4）、第一次通關 +100×地圖序、塔每層 +5（數值暫定）
export function runFame({ stageIdx = 0, bosses = [], mvps = 0, firstClear = false, towerFloor = 0 }) {
  const k = stageIdx + 1;
  return bosses.length * 10 * k + mvps * 50 * k + (firstClear ? 100 * k : 0) + towerFloor * 5;
}
// 稱號：cond 型別 fame（名聲等級）／boss（擊敗某首領 n 次）／tower（塔最高樓層）／rebirth（轉生次數）／job3
export const TITLES = [
  { id: 'rookie',   name: '見習冒險者', cond: { fame: 1 },  bonus: { hp: 0.02 },               desc: '名聲 Lv1' },
  { id: 'elim',     name: '艾林守護者', cond: { fame: 5 },  bonus: { atk: 0.02 },              desc: '名聲 Lv5' },
  { id: 'hero',     name: '希爾特英雄', cond: { fame: 10 }, bonus: { atk: 0.03, hp: 0.03 },    desc: '名聲 Lv10' },
  { id: 'legend',   name: '傳說中的勇者', cond: { fame: 20 }, bonus: { atk: 0.05, crit: 0.02 }, desc: '名聲 Lv20' },
  { id: 'radish',   name: '菜頭王剋星', cond: { boss: '菜頭王', n: 10 },   bonus: { speed: 0.03 },  desc: '擊敗菜頭王 10 次' },
  { id: 'bear',     name: '熊爸爸剋星', cond: { boss: '熊爸爸', n: 10 },   bonus: { armor: 2 },     desc: '擊敗熊爸爸 10 次' },
  { id: 'skull',    name: '骷髏王剋星', cond: { boss: '骷髏王', n: 10 },   bonus: { crit: 0.02 },   desc: '擊敗骷髏王 10 次' },
  { id: 'scorpion', name: '魔蠍大帝剋星', cond: { boss: '魔蠍大帝', n: 10 }, bonus: { atk: 0.03 },  desc: '擊敗魔蠍大帝 10 次' },
  { id: 'tower20',  name: '登塔者',     cond: { tower: 20 }, bonus: { haste: 0.02 },             desc: '賢者之塔第 20 層' },
  { id: 'tower50',  name: '賢者',       cond: { tower: 50 }, bonus: { haste: 0.03, magic: 0.03 }, desc: '賢者之塔第 50 層' },
  { id: 'reborn',   name: '輪迴者',     cond: { rebirth: 1 }, bonus: { hp: 0.03 },               desc: '轉生 1 次' },
  { id: 'reborn10', name: '十世輪迴',   cond: { rebirth: 10 }, bonus: { atk: 0.05, hp: 0.05 },   desc: '轉生 10 次' },
  { id: 'master',   name: '宗師',       cond: { job3: true }, bonus: { atk: 0.03 },              desc: '完成三轉' },
];
// 名聲專屬裝備：到達該名聲等級時寄到信箱（品質＝精良以上的固定品質；數值暫定）
export const FAME_GEAR = [[5, 'acc', 2, '艾林守護者的護符'], [10, 'weapon', 3, '希爾特英雄之刃'], [20, 'armor', 4, '傳說勇者的鎧甲']];
// 目前符合的稱號 id 清單；s＝{ fameLv, bossKills, towerBest, rebirth, job3 }
export function earnedTitles(s) {
  return TITLES.filter(({ cond: c }) => c.fame != null ? s.fameLv >= c.fame : c.boss ? (s.bossKills?.[c.boss] || 0) >= c.n : c.tower ? s.towerBest >= c.tower : c.rebirth ? (s.rebirth || 0) >= c.rebirth : c.job3 ? !!s.job3 : false).map(t => t.id);
}
export const titleOf = id => TITLES.find(t => t.id === id) || null;
const BONUS_TXT = { atk: '傷害', hp: '最大 HP', crit: '爆擊率', speed: '移速', haste: '冷卻縮短', magic: '魔法傷害' };
export const bonusText = b => Object.entries(b || {}).map(([k, v]) => k === 'armor' ? `護甲 +${v}` : `${BONUS_TXT[k]} +${+(v * 100).toFixed(1)}%`).join('、');
