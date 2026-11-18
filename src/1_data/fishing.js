// 項目 48：釣魚（主城水池旁的釣魚老人）。資料照服務端 item.scr：釣竿／魚的名稱、圖示、售價（售價 ÷10 換成本作金幣）
// 玩法：買釣竿（永久，好竿子稀有魚比較多）＋魚餌（每拋一次用 1 個）→ 浮標下沉時按「拉竿」→ 釣到魚／寶石；魚拿去賣
export const RODS = [
  null,
  { name: '釣竿',       icon: 264, price: 300,  rare: 1 },   // item 47：售 3000
  { name: '碳纖維釣竿', icon: 264, price: 1000, rare: 2 },   // item 59：售 10000
  { name: '太公望釣竿', icon: 264, price: 3000, rare: 4 },   // item 64：售 30000
];
export const BAIT = { name: '魚餌', icon: 2545, price: 10 };
// w＝基本權重；rare＝稀有魚，權重乘上釣竿的 rare；sell＝賣價；mat＝不是魚，直接進材料（G 化寶石）
export const CATCH = [
  { key: 'copper',   name: '銅魚',     icon: 429, sell: 3,    w: 40 },   // item 42：30
  { key: 'carp_s',   name: '小鯉魚',   icon: 377, sell: 5,    w: 22 },   // 3638：50
  { key: 'silver',   name: '銀魚',     icon: 430, sell: 8,    w: 16 },   // 43：80
  { key: 'gold',     name: '金魚',     icon: 431, sell: 20,   w: 9 },    // 44：200
  { key: 'catfish',  name: '鯰魚',     icon: 373, sell: 30,   w: 7 },    // 3640：300
  { key: 'platinum', name: '白金金魚', icon: 371, sell: 1000, w: 0.4, rare: true }, // 3637：10000
  { key: 'carp',     name: '鯉魚',     icon: 374, sell: 1000, w: 0.4, rare: true }, // 3641：10000
  { key: 'silkcarp', name: '綢緞鯉魚', icon: 375, sell: 1000, w: 0.3, rare: true }, // 3642：10000
  { key: 'ruby',     name: '紅寶石',   icon: 618, mat: 'ruby',    w: 0.6, rare: true }, // 項目 46 G 化材料
  { key: 'diamond',  name: '鑽石',     icon: 341, mat: 'diamond', w: 0.3, rare: true },
];
export function rollCatch(rod, rand = Math.random) {
  const k = RODS[rod]?.rare || 1, ws = CATCH.map(c => c.w * (c.rare ? k : 1)), tot = ws.reduce((a, b) => a + b, 0);
  let r = rand() * tot; for (let i = 0; i < CATCH.length; i++) { r -= ws[i]; if (r < 0) return CATCH[i]; } return CATCH[0];
}
