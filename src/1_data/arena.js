// PC 對戰系統（2u news id=66）古代競技場：
//   PC：角色 Lv30 以上找古代競技場管理員進場；場內自由對戰（單對單／多人混戰）、沒有任何對戰懲罰、死了在場內復活、不會拿到 PK 值；
//       PVP 對戰模式持續 300 秒；勝利一次 WIN 值 +1，勝利點數在「聯盟」排名
// 割草版：用組隊房間開打（隊長選地圖「古代競技場」），場上沒有怪；其他隊員＝對手；擊倒一次＝WIN +1（存角色 pvpWins，排行榜 PVP 分頁）
//   局內等級：沒有怪可以打 → 每 ARENA_XP_SECS 秒自動升一級（讓技能長起來）🔢；PVP 傷害 × ARENA_DMG_K（割草版技能是打怪用的數值）🔢
export const ARENA_LV = 30, ARENA_SECS = 300, ARENA_RESPAWN = 3, ARENA_XP_SECS = 10, ARENA_DMG_K = 0.35, ARENA_NAME = '古代競技場';
