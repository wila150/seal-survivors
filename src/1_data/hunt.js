// PC 狩獵系統（2u news id=65）：照階段擊殺數量，完成後「再擊殺的那隻怪」經驗加倍，再進下一階段
//   個人（紅點）：第 1～5 階段 20／40／60／80／100 隻 → ×2／×4／×6／×8／×10；第 5 階段完成後隨機從第 1～4 階段重新開始
//   冒險團（藍點）：160／120／80／40 隻 → ×4（2u 表只寫第 1 階段 ×4，其他階段沿用 ×4）；第 4 階段完成後固定從第 1 階段開始
//   可以和其他經驗加倍疊加；離線（割草版＝每局重新開始）擊殺數歸零
export const HUNT_SOLO = [[20, 2], [40, 4], [60, 6], [80, 8], [100, 10]];
export const HUNT_PARTY = [[160, 4], [120, 4], [80, 4], [40, 4]];
// 狀態機：st＝{ i 階段, n 已殺, ready 下一隻加倍 }；kill() 回傳這隻的倍率（1＝沒加倍）
export function createHunt(party = false, rand = Math.random) {
  const T = party ? HUNT_PARTY : HUNT_SOLO, st = { i: 0, n: 0, ready: false, party, T };
  st.kill = () => {
    if (st.ready) { const m = T[st.i][1]; st.ready = false; st.n = 0; st.i = st.i + 1 < T.length ? st.i + 1 : party ? 0 : Math.floor(rand() * 4); return m; }
    if (++st.n >= T[st.i][0]) st.ready = true; return 1;
  };
  return st;
}
// 伺服器結算用：這局 kills 隻怪多出來的經驗（換算成「多殺幾隻」）；個人第 5 階段後的隨機用固定序列（第 1 階段）避免結果不穩
export function huntExtra(kills, party = false) {
  const h = createHunt(party, () => 0); let extra = 0;
  for (let k = 0; k < kills; k++) extra += h.kill() - 1;
  return extra;
}
