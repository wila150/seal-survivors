// PC 在線與簽到系統（2u news id=72）。資料照服務端，不自己設計：
//   簽到＝Game/scripts/Attendance_Reward.scr（28 天一輪：欄位 編號|第幾天|1|道具|數量|…|附加道具|附加數量）
//   在線＝Game/scripts/Reward_Time.scr 第 1 組（每 30 分鐘一格、最多 180 分鐘：欄位 編號|組|秒數|道具|數量）
// PC 規則：獎勵寄到信箱；在線獎勵每天 0 點（台灣時間）重算；同一個帳號每天只有一個角色能領（＝以帳號為單位）
// 道具換算：寶石類放進材料（mats）；錢包＝希望幣 ÷1000（本作金幣比例）；寵物食品（item.scr 類別 3，第 43 欄＝餵食經驗）可以在寵物管理員餵寵物
export const ATTEND = [ // [道具, 數量, 附加道具, 附加數量]（第 1～28 天）
  [432, 1], [3689, 1], [433, 1], [3690, 2], [434, 1], [3691, 1], [3981, 1, 25807, 30],
  [432, 1], [3689, 1], [433, 1], [3690, 2], [434, 1], [3691, 1], [3981, 1, 25807, 60],
  [432, 1], [3689, 1], [433, 1], [3690, 2], [434, 1], [3691, 1], [3981, 1, 25807, 90],
  [432, 1], [3689, 1], [433, 1], [3690, 2], [434, 1], [3691, 1], [3981, 1, 25807, 120],
];
export const ONLINE = [[1800, 432, 1], [3600, 11835, 1], [5400, 433, 1], [7200, 11836, 1], [9000, 434, 1], [10800, 11837, 1]];
// PC 道具編號 → 本作：{ mat 材料 key } 或 { gold 金幣 }；名稱、圖示照 item.scr
export const PC_REWARD = {
  432:   { mat: 'quartz',  name: '水晶', icon: 39 },
  433:   { mat: 'ruby',    name: '紅寶石', icon: 618 },
  434:   { mat: 'diamond', name: '鑽石', icon: 341 },
  3981:  { mat: 'pinkdia', name: '粉紅鑽', icon: 380 },
  3689:  { mat: 'petMilk', name: '奶粉', icon: 759 },
  3690:  { mat: 'petBaby', name: '豪華的嬰兒副食品', icon: 760 },
  3691:  { mat: 'petGugu', name: '咕咕大力丸', icon: 761 },
  25807: { mat: 'macaron', name: '特級全能馬卡龍', icon: 31 },
  11835: { gold: 150, name: '錢包(15萬)', icon: 2315 },
  11836: { gold: 200, name: '錢包(20萬)', icon: 2315 },
  11837: { gold: 250, name: '錢包(25萬)', icon: 2315 },
};
// 寵物食品：item.scr 第 43 欄（奶粉 50、副食品 100、咕咕大力丸 150、馬卡龍 15）
export const PET_FOOD = { petMilk: 50, petBaby: 100, petGugu: 150, macaron: 15 };
export const ONLINE_CAP = 10800, TICK_MAX = 90; // 一次心跳最多算 90 秒（防止關掉分頁也一直算）
export const twDay = (now = Date.now()) => new Date(now + 8 * 3600e3).toISOString().slice(0, 10); // 台灣時間 0 點換日
export const rewardText = (id, n) => { const R = PC_REWARD[id]; return R ? `${R.name} ×${n}` : `#${id} ×${n}`; };
// 把一筆獎勵換成信件附件 { gold, mats }
export function rewardMail(list) {
  const out = { gold: 0, mats: {} };
  for (const [id, n] of list) { const R = PC_REWARD[id]; if (!R || !n) continue; if (R.gold) out.gold += R.gold * n; else out.mats[R.mat] = (out.mats[R.mat] || 0) + n; }
  return out;
}
