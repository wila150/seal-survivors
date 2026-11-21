// PC 首領寶箱＋鑰匙（企劃_PC系統補齊 #17）。資料照服務端：
//   寶箱＝item.scr 類別 41（例：1182 元素柱守護者BOSS寶箱：第 12 欄 3901＝開出來的掉寶表、第 19 欄＝開啟後的空箱、圖示 2263）
//   鑰匙＝item.scr 類別 42（11071 寶箱鑰匙：第 7 欄鑰匙種類 1＝首領寶箱都用這把；售價 30000，seller.scr 第 44 列 NPC 有賣）
//   內容＝drop_1.scr 第 3901～3903 列（道具編號, 累積機率／1,000,000）
//   掉落率＝首領自己的掉寶表：泰坦 70%、雪之女王 75%、惡魔卡爾 60%（drop_1.scr 第 188／1646／2084 列）
// 割草版：打倒地圖 MVP（通關）→ 70% 掉這張圖的首領寶箱進背包 🔢；在背包用 1 把寶箱鑰匙開啟 → 抽一樣
//   錢袋 → 金幣 ÷1000（跟在線獎勵的錢包一樣）；鑰匙售價 ÷1000 🔢（跟錢袋同比例，PC 鑰匙 3 萬、最小錢袋 100 萬）
//   寵物：本作有的（老鷹 583、水龍獸 563）直接進寵物欄；本作沒有的（黑水龍獸、藍色老鷹、黑帝斯之蛋）拿掉
//   PC 表的總和不到 100%（剩下的不知道是不是「空的」）→ 割草版每開一次一定拿到一樣（照表內比例）🔢
//   BOSS 核心／靈魂／殘骸、殘缺的券、[幻翼]首飾結晶：PC 是任務兌換材料（quest.scr 9059／1801），先收進背包，任務系統做好再用
export const CHEST_DROP = 0.7;
export const KEY = 'chestKey';
const W = (pc, w, o) => ({ pc, w, ...o });
const T3901 = [W(21388, 309800, { gold: 1000 }), W(21389, 150000, { gold: 2500 }), W(21390, 10000, { gold: 5000 }), W(21391, 5000, { gold: 10000 }),
  W(28771, 20000, { mat: 'wingGem' }), W(21476, 100000, { mat: 'bossCore' }), W(583, 8000, { pet: 583 }), W(563, 8000, { pet: 563 }),
  W(21419, 1100, { mat: 'bossSoulT' }), W(21421, 1100, { mat: 'bossRemainT' })];
const T3902 = [W(21388, 308000, { gold: 1000 }), W(21389, 250000, { gold: 2500 }), W(21390, 10000, { gold: 5000 }), W(21391, 5000, { gold: 10000 }), W(21392, 3000, { gold: 25000 }),
  W(28771, 40000, { mat: 'wingGem' }), W(21477, 100000, { mat: 'bossSoul' }), W(583, 8000, { pet: 583 }), W(563, 8000, { pet: 563 }),
  W(21419, 1200, { mat: 'bossSoulT' }), W(21421, 1200, { mat: 'bossRemainT' })]; // 幻翼首飾結晶 PC 表裡出現兩次（各 2%）→ 合併 4%
const T3903 = [W(21389, 450000, { gold: 2500 }), W(21390, 150000, { gold: 5000 }), W(21391, 10000, { gold: 10000 }), W(21392, 5000, { gold: 25000 }), W(21393, 3000, { gold: 50000 }),
  W(28771, 20000, { mat: 'wingGem' }), W(21478, 100000, { mat: 'bossRemain' }), W(563, 8000, { pet: 563 }), W(583, 8000, { pet: 583 }),
  W(21419, 8000, { mat: 'bossSoulT' }), W(21421, 8000, { mat: 'bossRemainT' })];
// 每張地圖的首領寶箱（名稱＝割草版這張圖的 MVP；掉寶表依地圖階段：初階 3901 → 3902 → 3903）
export const CHESTS = {
  chest_hill:   { stage: 'hill',   mvp: '菜頭王',   icon: 2263, table: T3901, row: 3901 },
  chest_forest: { stage: 'forest', mvp: '熊爸爸',   icon: 2263, table: T3901, row: 3901 },
  chest_grave:  { stage: 'grave',  mvp: '骷髏王',   icon: 2265, table: T3902, row: 3902 },
  chest_desert: { stage: 'desert', mvp: '魔蠍大帝', icon: 2265, table: T3903, row: 3903 },
};
export const chestOfStage = st => Object.keys(CHESTS).find(k => CHESTS[k].stage === st) || null;
export function rollChest(key, rand = Math.random) {
  const T = CHESTS[key]?.table; if (!T) return null;
  let r = rand() * T.reduce((a, x) => a + x.w, 0);
  for (const x of T) { if ((r -= x.w) < 0) return x; }
  return T.at(-1);
}
// 放進 ORES（背包「材料」格；名稱、圖示照 item.scr）
export const CHEST_ORES = {
  chestKey: { name: '寶箱鑰匙', icon: 2267, price: 30, desc: '打開首領寶箱用（PC 11071；每個首領寶箱用 1 把）', scroll: true },
  ...Object.fromEntries(Object.entries(CHESTS).map(([k, c]) => [k, { name: `${c.mvp}BOSS寶箱`, icon: c.icon, price: 0, desc: `打倒${c.mvp}掉的上鎖寶箱：用 1 把寶箱鑰匙開啟，隨機拿到錢袋（金幣）、BOSS 材料或寵物`, scroll: true, noshop: true, chest: true }])),
  bossCore:    { name: '初階BOSS核心', icon: 5119, price: 0, desc: '首領寶箱開出的材料（PC 用來在任務兌換；割草版任務系統做好後可用）', scroll: true, noshop: true },
  bossSoul:    { name: '初階BOSS靈魂', icon: 5118, price: 0, desc: '首領寶箱開出的材料（PC 用來在任務兌換；割草版任務系統做好後可用）', scroll: true, noshop: true },
  bossRemain:  { name: '初階BOSS殘骸', icon: 5117, price: 0, desc: '首領寶箱開出的材料（PC 用來在任務兌換；割草版任務系統做好後可用）', scroll: true, noshop: true },
  bossSoulT:   { name: '殘缺的初階BOSS靈魂券', icon: 5018, price: 0, desc: '首領寶箱開出的稀有券（PC 用來在任務兌換；割草版任務系統做好後可用）', scroll: true, noshop: true },
  bossRemainT: { name: '殘缺的初階BOSS殘骸券', icon: 5019, price: 0, desc: '首領寶箱開出的稀有券（PC 用來在任務兌換；割草版任務系統做好後可用）', scroll: true, noshop: true },
  wingGem:     { name: '[幻翼]首飾結晶', icon: 4964, price: 0, desc: '首領寶箱開出的結晶（PC 用來在任務兌換；割草版任務系統做好後可用）', scroll: true, noshop: true },
};
export const WALLET_NAME = { 1000: '沉甸甸的錢袋(100萬)', 2500: '沉甸甸的錢袋(250萬)', 5000: '沉甸甸的錢袋(500萬)', 10000: '沉甸甸的錢袋(1000萬)', 25000: '沉甸甸的錢袋(2500萬)', 50000: '沉甸甸的錢袋(5000萬)' };
