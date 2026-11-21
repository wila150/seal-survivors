// PC 交易＋擺攤（企劃_PC系統補齊 #18；2u news id=75 交易／郵件、id=64 擺攤）。照 PC，割草版沒有的標 🔢
//   交易：發起 → 對方同意 → 雙方放道具／希望幣 → 雙方「鎖定」→ 雙方「確認」才成交；放的東西改了鎖定就取消；綁定（不能交易）的道具灰色不能放
//     割草版沒有同畫面即時連線 → 交易視窗每 2 秒更新一次（主城或好友名單發起，對方要在線上：2 分鐘內有動作）🔢
//   擺攤＝本作「拍賣所」（販賣攤）；PC 成交收 3％ 手續費（本來 5％ → 照 PC 改 3％）
//   收購攤：放「想收購的材料×數量×單價」，希望幣先扣起來；別人把材料賣進來就自動成交（扣 3％ 給賣的人）；一般道具一次最多 300 個、佔一個收購攤位
//   搜索擺攤：PC 每次 1,000 希望幣；本作拍賣所的搜尋／篩選在自己畫面上做，不另收 🔢
//   郵件寄送（PC 銀行職員菲利）：文字 100 希望幣、道具 1,000 希望幣、希望幣依金額 1％；每天最多寄 20 次（帳號）；保存 30 天 → 本作金幣比例 ÷1000：文字／道具 1 金幣 🔢（÷1000 後 100 希望幣不到 1，至少 1）
export const TRADE_FEE = 0.03, BUY_MAX = 300, BUY_SLOTS = 5; // 收購攤位數 2u 沒寫 🔢
export const MAIL_FEE = { text: 1, item: 1, goldPct: 0.01 }, MAIL_DAILY = 20, MAIL_KEEP_DAYS = 30;
export const TRADE_ITEMS = 6, TRADE_ONLINE_MS = 120e3, TRADE_TTL_MS = 10 * 60e3; // 🔢 一次最多 6 件裝備（PC 交易視窗格數 2u 沒寫）、對方 2 分鐘內有動作才算在線、交易 10 分鐘沒完成自動取消
export const mailCost = ({ gold = 0, items = 0, mats = 0 }) => (items || mats ? MAIL_FEE.item : MAIL_FEE.text) + Math.ceil(gold * MAIL_FEE.goldPct);
export const afterFee = gold => Math.floor(gold * (1 - TRADE_FEE));
