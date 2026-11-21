// PC 表情（客戶端 interface/Emoticon.tex → assets/ui/emo.png；EMOTION 視窗分「感情／記號／特殊」三頁，mainblue_skill_emoticon.tex）
// 圖集 32px 一格：感情＝第 1 列 16 個（臉、！？♪、汗滴、燈泡、愛心…）、記號＝第 3 列 12 個（剪刀石頭布、骰子、OX、劍盾、GoGo、Wait、Help）、特殊＝第 5 列 10 個（徽章、書…）
export const EMO_TABS = [['感情', 0, 16, 0], ['記號', 16, 12, 64], ['特殊', 28, 10, 128]]; // [名稱, 起始編號, 數量, 圖集 y]
const SPECIAL_X = [0, 32, 64, 96, 128, 160, 192, 224, 384, 416];
export function emoXY(e) {
  for (const [, s, n, y] of EMO_TABS) if (e >= s && e < s + n) { const i = e - s; return [y === 128 ? SPECIAL_X[i] : i * 32, y]; }
  return [0, 0];
}
export const EMO_MAX = 38;
export const emoPos = e => { const [x, y] = emoXY(e); return `-${x}px -${y}px`; };
// PC 動作系統（2u news id=71）：13 個動作，男女不同；動作檔＝客戶端 actor/M_／W_social_*、*_bow（tools/build-anims.mjs SOCIAL → 動作組 s_*）
export const ACTIONS = [['s_bow', '拜年', '/拜年'], ['s_scare', '驚訝', '/驚訝'], ['s_doze', '打瞌睡', '/打瞌睡'], ['s_anger', '發怒', '/怒'], ['s_grats', '恭喜', '/恭喜'], ['s_sulk', '生氣', '/生氣'], ['s_agree', '同意', '/同意'],
  ['s_greet', '打招呼', '/打招呼'], ['s_cute', '撒嬌', '/撒嬌'], ['s_frustrated', '挫折', '/挫折'], ['s_whine', '賴皮', '/賴皮'], ['s_threat', '威脅', '/威脅'], ['s_cry', '哭', '/哭']];
export const isAction = k => ACTIONS.some(a => a[0] === k);
