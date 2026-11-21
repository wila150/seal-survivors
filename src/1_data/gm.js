// GM 指令（只限本機：伺服器只接受 127.0.0.1／::1 的請求，主城只有在 localhost 才顯示 GM 按鈕）
// 前端面板用 GM_CMDS 列清單；伺服器用 parseGm 解析
// 11/21：面板多一欄「對象」＝角色名，空白＝自己；填別人就改那個角色（出征類 /stage /boss /tower 只對自己）
export const GM_CATS = ['角色', '物品', '系統／出征'];
export const GM_CMDS = [
  ['角色', '/lv 70', '設定 Base 等級（1～99，經驗歸零）'],
  ['角色', '/job 50', '設定 Job 等級（一轉最高 50、二轉 100、三轉 130）'],
  ['角色', '/gold 100000', '金幣加這麼多（負數＝扣）'],
  ['系統／出征', '/resetpw 帳號 新密碼', '幫忘記密碼的玩家重設密碼（舊的登入全部登出）'],
  ['角色', '/points 30', '素質點加這麼多'],
  ['角色', '/job2 A', '直接二轉：A／B 分支（none＝取消二轉）'],
  ['角色', '/job3', '直接三轉（要先二轉；/job3 none＝取消）'],
  ['角色', '/fame 50000', '名聲加這麼多（名聲 Lv 照原版 fame.scr）'],
  ['角色', '/bosskill 菜頭王 10', '首領擊殺次數加這麼多（稱號條件用）'],
  ['角色', '/rebirth 0', '設定轉生次數（0～10，不動等級）'],
  ['角色', '/clear', '四張遠征地圖全部標成已通關（開放賢者之塔用）'],
  ['角色', '/talentreset', '一轉、二轉（含三轉節點）天賦全部重置'],
  ['物品', '/item weapon 4 7', '給裝備：部位（weapon／armor／acc）品質（0 普通～4 傳說）精煉（0～10）'],
  ['物品', '/mat ore1 10', '給道具：ore1／ore2／god／alu／reset／fixTicket／chargeTicket／dust／crystal／rainbow'],
  ['物品', '/gem 0 3', '給技能寶石：級別（0 N～3 XG）數量'],
  ['物品', '/stone red 6', '設定鑲嵌石階段（red／orange／yellow／green，0～12，每階照原版機率抽屬性）'],
  ['物品', '/bagclear', '清空背包裡沒穿的裝備'],
  ['系統／出征', '/mail 測試信 500', '寄一封系統信給自己（附金幣）'],
  ['系統／出征', '/welcome', '重新寄開服見面禮'],
  ['系統／出征', '/stage 0', '直接出征第 n 張地圖（0 平原～3 紅土）'],
  ['系統／出征', '/boss 4', '出征並跳到第 n 隻首領（4＝MVP）'],
  ['系統／出征', '/tower', '直接進賢者之塔（用上次的塔設定）'],
  ['系統／出征', '/help', '列出所有指令'],
];
export function parseGm(line) {
  const parts = String(line || '').trim().replace(/^\//, '').split(/\s+/);
  return { cmd: (parts.shift() || '').toLowerCase(), args: parts };
}
