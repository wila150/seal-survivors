// PC 發財遊戲（2u news id=73）＋服務端資料。照 PC，割草版沒有的標 🔢
//   沙包＝item.scr 3794（類別 45、售價 420 → 商店 ÷10＝42 金幣）；寶貝沙包 12912（另有機率得發財寶箱）
//   投擲哈比發財樹：投普通沙包花的錢累積成全服彩金；任何沙包投中都拿走目前彩金的 70％（2u 原文）
//   發財一般寶箱 12924（內容＝drop_1.scr 第 2390 列）、發財銀寶箱 12926（第 2385 列）；要用「發財寶箱鑰匙」12928 開（第 7 欄鑰匙種類 14；售價 10000 ÷1000）
//   寶箱內容只留本作有的：水晶／紅寶石／鑽石／粉紅鑽、鯉魚／綢緞鯉魚（釣魚）、錢包(1萬)→10 金幣、黑／白／金色熔解石、屬性自然石；
//   其他（時裝、PC 武器、寵物、制作書）本作沒有 → 拿掉，剩下的照原表比例，每開一定拿到一樣 🔢（同首領寶箱做法）
//   2u 沒寫的 🔢：中彩金機率 1/200、寶貝沙包價格 1000（一般寶箱有 10％ 粉紅鑽＝5000 金幣，太便宜會變成刷錢）、寶貝沙包得寶箱機率 30％（一般 : 銀 ＝ 4 : 1）、彩金底金 1000
//   必中寶貝沙包（18429）的金寶箱全是時裝 → 等時裝系統（#15）再做
export const BAGS = {
  sandbag: { name: '沙包',     icon: 2739, price: 42,  pc: 3794 },
  babybag: { name: '寶貝沙包', icon: 2885, price: 1000, pc: 12912 },
};
export const JACKPOT_RATE = 1 / 200, JACKPOT_TAKE = 0.7, JACKPOT_SEED = 1000, BABY_CHEST = 0.3, BABY_SILVER = 0.2;
export const KEY = 'fkey';
const W = (pc, w, o) => ({ pc, w, ...o });
// drop_1.scr 累積機率 → 各項權重（差值）
export const CHESTS = {
  fchest1: { name: '發財一般寶箱', icon: 2261, pc: 12924, row: 2390, table: [
    W(3641, 70000, { fish: 'carp', name: '鯉魚' }), W(3642, 70000, { fish: 'silkcarp', name: '綢緞鯉魚' }),
    W(432, 70000, { mat: 'quartz' }), W(433, 30000, { mat: 'ruby' }), W(434, 50000, { mat: 'diamond' }), W(3981, 50000, { mat: 'pinkdia' }),
    W(9249, 150000, { gold: 10, name: '錢包(1萬)' })] },
  fchest2: { name: '發財銀寶箱', icon: 2263, pc: 12926, row: 2385, table: [
    W(3695, 140000, { mat: 'meltBlack' }), W(3696, 140000, { mat: 'meltWhite' }), W(5477, 40000, { nat: 1, name: '屬性自然石' }), W(6859, 59000, { mat: 'meltGold' })] },
};
export function rollChest(key, rand = Math.random) {
  const T = CHESTS[key].table, sum = T.reduce((t, x) => t + x.w, 0); let r = rand() * sum;
  for (const x of T) if ((r -= x.w) < 0) return x;
  return T[T.length - 1];
}
// 投一次：回傳 { win（中彩金）, chest（得到的寶箱 key 或 null） }
export function throwBag(bag, rand = Math.random) {
  const win = rand() < JACKPOT_RATE;
  const chest = bag === 'babybag' && rand() < BABY_CHEST ? (rand() < BABY_SILVER ? 'fchest2' : 'fchest1') : null;
  return { win, chest };
}
export const chestOdds = key => { const T = CHESTS[key].table, s = T.reduce((t, x) => t + x.w, 0); return T.map(x => [x, x.w / s]); };
// 放進 items.js ORES（背包、商人「購買」分頁用）；寶箱在發財遊戲視窗開，不設 chest（那是首領寶箱的開法）
export const FORTUNE_ORES = {
  ...Object.fromEntries(Object.entries(BAGS).map(([k, b]) => [k, { name: b.name, icon: b.icon, price: b.price, desc: k === 'sandbag' ? '發財遊戲：投哈比發財樹，有機會拿走全服彩金的 70%（投的錢會累積進彩金）' : '發財遊戲：除了彩金，還有機會得到發財一般寶箱／銀寶箱', scroll: true }])),
  fkey: { name: '發財寶箱鑰匙', icon: 2269, price: 10, desc: '打開發財一般寶箱／銀寶箱用（PC 12928）', scroll: true },
  ...Object.fromEntries(Object.entries(CHESTS).map(([k, c]) => [k, { name: c.name, icon: c.icon, price: 0, desc: `寶貝沙包投中掉的上鎖寶箱：在「發財遊戲」視窗用發財寶箱鑰匙開啟`, scroll: true, noshop: true }])),
};
