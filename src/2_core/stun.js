// 元素屬性 × 首領昏厥破韌（使用者 11/21 企劃：素材/20261121-045442_seal_online_elemental_stun_system.txt）
// 割草版對應：
//   - 小王（mini）＝「中小型副本」固定單一弱點；MVP＝「大型團本」3 段屬性封印鎖（0～30％／30～70％／70～100％ 各一個弱點）
//   - 弱點＝能剋這隻首領本身屬性的元素（element.js 相剋表 ≥1.2）；首領無屬性 → 照名字固定挑一個五行（每次一樣）
//   - 實際累積昏厥值＝技能基礎昏厥力（普攻 7、技能 30）× 屬性倍率 × 寶石階級係數 ×（1＋元素侵蝕層數×2％）
//     屬性倍率：打中弱點 1.3、光暗互剋 1.6、無屬性 0.15（單人遊玩＝「希望藍圖」新手共鳴，無屬性 0.6）、其他屬性 0
//     寶石階級（局內屬性寶石等級）：Lv1～3 ×1、4～6 ×1.15、7～9 ×1.3、10 ×1.5
//     元素侵蝕：打中弱點疊 1 層，滿 5 層瞬間多推昏厥上限的 10％ 後歸零
//   - 首領昏厥值上限：小王 1000、MVP 4500（3 段各 1500）；第 N 次 ×[1＋0.3×(N−1)]（N 最多算到 4）
//   - 昏厥（元素崩解）7 秒：不能移動、不能攻擊；受到的傷害 ×1.5（企劃：全屬性視為弱點＋防禦 −60％ → 割草版沒有怪物防禦，合成 ×1.5）
//   - 醒來後 10 秒無敵保護：昏厥條變灰，不累積
//   - 同一招打同一隻首領每 1 秒最多算一次昏厥（割草版技能一秒打很多下）🔢
//   - 破韌寶箱：每觸發一次昏厥，掉一個首領寶箱（一局最多 3 個）
//   - 元素支配者：昏厥期間把首領從 30％ 以上直接打死 → 這局掉寶率提升（菁英寶箱機率 +10％）
//   - 光／暗雙刃劍：拿光或暗屬性武器打弱點是相反屬性的首領 → 被這隻首領打到的傷害 +20％
// 組隊：昏厥由隊長那台計算（隊員的傷害本來就送給隊長）
import { ELEMS, ELEM_COLOR, MULT, MONSTER_ELEM } from '../1_data/element.js';

export const STUN = { mini: 1000, mvp: 4500, secs: 7, guard: 10, dmgMul: 1.5, powBasic: 7, powSkill: 30, chestMax: 3, stepUp: 0.3, stepMax: 4 };
const FIVE = [1, 2, 3, 4, 5]; // 火 水 木 金 土
const hash = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
// 這隻首領的弱點（剋它的元素）
export function weakOf(type) {
  const d = MONSTER_ELEM[type] ?? 0;
  if (d === 6) return 7; if (d === 7) return 6;                                  // 光暗互剋
  const c = FIVE.filter(a => MULT[a][d] >= 1.2);                                 // 五行剋它的
  return c.length ? c[hash(type) % c.length] : FIVE[hash(type) % 5];             // 無屬性／魔法型／物理型 → 照名字固定一個
}
export function weakList(type, mvp) {
  const w = weakOf(type); if (!mvp) return [w];
  const rest = [...FIVE, 6].filter(x => x !== w), a = rest[hash(type + 'a') % rest.length], b = rest.filter(x => x !== a)[hash(type + 'b') % (rest.length - 1)];
  return [w, a, b];
}
export const gemTier = lv => !lv ? 1 : lv >= 10 ? 1.5 : lv >= 7 ? 1.3 : lv >= 4 ? 1.15 : 1;
export function elemRate(atk, weak, solo) {
  if (!atk) return solo ? 0.6 : 0.15;
  if (atk === weak) return (atk === 6 || atk === 7) ? 1.6 : 1.3;
  return 0;
}
export const elemName = e => ELEMS[e] || '無', elemColor = e => ELEM_COLOR[e] || '#fff';

export function createStun({ solo, onBreak, onText }) {
  const S = { chests: 0, master: false };
  function init(e) {
    const mvp = !!e.mvp, max = mvp ? STUN.mvp : STUN.mini;
    e.brk = { weak: weakList(e.type, mvp), seg: 0, mvp, base: max, n: 1, v: 0, stunT: 0, guardT: 0, ero: 0, cd: {}, hpAt: 1 };
  }
  const cap = b => b.base * (1 + STUN.stepUp * (Math.min(STUN.stepMax, b.n) - 1));
  const segCap = b => b.mvp ? cap(b) * [0.3, 0.4, 0.3][b.seg] : cap(b);
  const curWeak = b => b.weak[b.mvp ? b.seg : 0];
  // 命中：回傳這下的傷害倍率（昏厥中 ×1.5）
  function hit(e, src, atkE, gemLv, isBasic, now) {
    const b = e.brk; if (!b) return 1;
    if (b.stunT > 0) return STUN.dmgMul;
    if (b.guardT > 0) return 1;
    const k = src || '_'; if ((b.cd[k] || 0) > now) return 1; b.cd[k] = now + 1;
    const r = elemRate(atkE, curWeak(b), solo);
    if (r <= 0) { onText?.(e, 'RESIST', '#9aa0a8'); return 1; }
    let add = (isBasic ? STUN.powBasic : STUN.powSkill) * r * gemTier(gemLv) * (1 + b.ero * 0.02);
    if (atkE && atkE === curWeak(b)) { b.ero++; onText?.(e, 'BREAK!', '#ffd34f'); if (b.ero >= 5) { b.ero = 0; add += cap(b) * 0.1; } }
    b.v += add;
    // MVP 三段：打滿這一段 → 換下一個弱點；三段都滿（或小王滿條）→ 昏厥
    while (b.v >= segCap(b)) {
      b.v -= segCap(b);
      if (b.mvp && b.seg < 2) { b.seg++; b.ero = 0; onText?.(e, `弱點變成【${elemName(curWeak(b))}】`, elemColor(curWeak(b))); continue; }
      b.v = 0; b.seg = 0; b.stunT = STUN.secs; b.hpAt = e.hp / e.maxHp; b.n++;
      const chest = S.chests < STUN.chestMax; if (chest) S.chests++;
      onBreak?.(e, chest); break;
    }
    return 1;
  }
  function tick(e, dt) { const b = e.brk; if (!b) return; if (b.stunT > 0 && (b.stunT -= dt) <= 0) { b.stunT = 0; b.guardT = STUN.guard; } else if (b.guardT > 0) b.guardT = Math.max(0, b.guardT - dt); }
  // 首領死掉時：昏厥中、而且這次昏厥開始時血量 ≥30％ → 元素支配者
  function died(e) { const b = e.brk; if (b?.stunT > 0 && b.hpAt >= 0.3 && !S.master) { S.master = true; return true; } return false; }
  const stunned = e => (e?.brk?.stunT || 0) > 0;
  // 介面：{ pct, color, label, weak, locked, stun, segs }
  function view(e) {
    const b = e?.brk; if (!b) return null;
    if (b.stunT > 0) return { pct: b.stunT / STUN.secs * 100, color: '#ffd34f', label: `元素崩解 ${b.stunT.toFixed(1)}s`, weak: null, stun: true, mvp: b.mvp, seg: 0 };
    if (b.guardT > 0) return { pct: 100, color: '#6b6f78', label: `🔒 無敵免疫 ${b.guardT.toFixed(0)}s`, weak: null, locked: true, mvp: b.mvp, seg: 0 };
    const pre = b.mvp ? [0, 0.3, 0.7][b.seg] : 0, w = curWeak(b);
    return { pct: (pre + (b.v / segCap(b)) * (b.mvp ? [0.3, 0.4, 0.3][b.seg] : 1)) * 100, color: elemColor(w), label: `弱點【${elemName(w)}】${b.ero ? `　侵蝕 ${b.ero}/5` : ''}`, weak: w, mvp: b.mvp, seg: b.seg };
  }
  return { S, init, hit, tick, died, stunned, view, curWeak };
}
