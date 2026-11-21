// PC 時裝（企劃_PC系統補齊 #15）：能力、價格、套用。資料＝src/1_data/costumes.js（tools/build-costumes.mjs 從 item.scr 類別 12／13 產生）
//   穿法：衣櫥（造型師）。分件時裝放頭／上衣／下衣／鞋；一件式（類別 13，PC「ALL IN ONE」）放上衣欄
//   能力換算 🔢 同變身／戰鬥力 BUFF：防禦 N→護甲 +N/50（時裝防禦動輒幾百，護甲是扣固定傷害、高級防禦力藥水才 +3）、攻速 N→急速 +N（急速 12 ≈ 冷卻 −10％）、必殺 N→爆擊 +N/10％、回避 N→迴避 +N/10％（總上限 40％）、
//     移速 N→移動 +N/10％、HP N→最大 HP +N/100％（PC 高等級 HP 上萬，+1000 ≈ +10％）；命中、AP 割草版沒有 → 不生效
//   取得 🔢：PC 時裝幾乎都是商城道具（item.scr 售價 0）→ 造型師「時裝商店」用金幣買：500＋40×能力總和（HP、AP 每 100 算 1），買了永久收進衣櫥
import { COSTUMES } from './costumes.js';
export { COSTUMES };
export const FASHION_SLOTS = { head: '頭部', top: '上衣', bottom: '下衣', shoes: '鞋子' };
export const isCostume = id => !!COSTUMES[id];
export const isOnePiece = id => COSTUMES[id]?.[6] === 13;
const statSum = s => Object.entries(s || {}).reduce((t, [k, v]) => t + (k === 'hp' || k === 'ap' ? v / 100 : v), 0);
export const fashionPrice = id => { const x = COSTUMES[id]; return x ? Math.round(500 + 40 * statSum(x[4])) : 0; };
export const STAT_LABEL = { def: '防禦', aspd: '攻擊速度', hit: '命中率', crit: '必殺技', dodge: '回避率', move: '移動速度', hp: 'HP', ap: 'AP' };
export const fashionText = id => { const s = COSTUMES[id]?.[4] || {}; const t = Object.entries(s).map(([k, v]) => `${STAT_LABEL[k]} +${v}`).join('、'); return t || '只改外觀'; };
// 目前穿的時裝能力加總（costume＝{ head, top, bottom, shoes: PC 編號 }；原版裝備外觀不算）
export function costumeStats(costume) {
  const out = {}; for (const id of Object.values(costume || {})) for (const [k, v] of Object.entries(COSTUMES[id]?.[4] || {})) out[k] = (out[k] || 0) + v;
  return out;
}
export function applyCostume(P, costume) {
  const s = costumeStats(costume); if (!Object.keys(s).length) return null;
  if (s.def) P.armor += s.def / 50;
  if (s.aspd) P.hasteV = (P.hasteV || 0) + s.aspd;
  if (s.crit) P.crit += s.crit / 1000;
  if (s.dodge) P.dodge = Math.min(0.4, (P.dodge || 0) + s.dodge / 1000);
  if (s.move) P.speed *= 1 + s.move / 1000;
  if (s.hp) { P.maxHp = Math.round(P.maxHp * (1 + s.hp / 10000)); P.hp = P.maxHp; }
  return s;
}
// 商店清單（依部位；一件式另外一頁）
export const shopList = (slot, q = '') => Object.entries(COSTUMES).filter(([, x]) => (slot === 'one' ? x[6] === 13 : x[1] === slot && x[6] !== 13) && (!q || x[0].includes(q))).map(([id]) => +id);
