// 組隊副本：局內同步（docs/企劃_組隊副本.md 第 2、5 節，階段三、四）
// 隊長的瀏覽器＝主機：生怪、首領、怪物移動與死亡都由隊長算，每秒 10 次廣播給隊員（g/snap）；
// 隊員畫面上的怪是「鏡像」：位置跟著隊長內插，自己的招式打到就送傷害給隊長（h/hit），死不死隊長決定（g/kill）
// 每個人每秒 10 次廣播自己的位置／血量（g/me）→ 別人畫出隊友模型＋名牌＋血條
// 經驗寶石：每次擊殺大家都掉同一顆（同一個 gid），撿到的人廣播（g/pick），照隊伍的「經驗值分配」給其他人分經驗
// 倒地：HP 歸零不直接結束，30 秒內隊友站旁邊 3 秒扶起（回 30%）；全隊倒下＝結束；MVP 倒＝全隊通關
import { PartyConn, runInfo, saveRun } from './party.js';
import { sealActor } from './seal-model.js';
import { playerModelId, playerAnimSet, playerLook } from '../1_data/jobs.js';

export const PARTY_MUL = n => ({ count: 1 + 0.5 * (n - 1), hp: 1 + 0.6 * (n - 1), dmg: 1 + 0.25 * (n - 1), exp: 1 + 0.1 * (n - 1) }); // v1.1：人越多怪越多、越硬、越痛
const SEND_MS = 100, DOWN_SECS = 30, REVIVE_SECS = 3, REVIVE_R = 2.2, SHARE_R = 15;

export function createPartyGame(G) {
  if (!new URLSearchParams(location.search).has('party')) return null;
  const R = runInfo(); if (!R?.code || !window.SS_CLOUD) return null;
  let token = null; try { token = localStorage.getItem('ss_token'); } catch {}
  const me = G.CHAR.id, host = R.leader === me, n = Math.max(1, R.members?.length || 1), exp = R.exp === 'even' ? 'even' : 'own';
  const NET = { host, guest: !host, me, n, mul: PARTY_MUL(n), exp, seq: 0, remotes: new Map(), over: false };
  const conn = new PartyConn(R.code, { token, charId: me });
  const send = (k, d) => conn.send({ t: 'g', k, d }), toHost = (k, d) => conn.send({ t: 'h', k, d });
  const byNid = new Map(); let newSpawns = [], fullResend = 0, sendAcc = 0, hitQ = [];

  // ---- 隊友模型 ----
  const labelBox = document.createElement('div'); labelBox.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:4'; document.body.appendChild(labelBox);
  function remote(id) {
    let r = NET.remotes.get(id); if (r) return r;
    const m = (R.members || []).find(x => x.charId === id) || { charId: id, name: '隊友', job: '初心者', gender: '男' };
    r = { id, m, x: 0, z: 0, tx: 0, tz: 0, ry: 0, hp: 1, mhp: 1, down: false, dead: false, gone: false, revT: 0, last: performance.now(), g: null, el: document.createElement('div') };
    r.el.className = 'pty-tag'; r.el.innerHTML = `<b>${String(m.name).replace(/[<>&]/g, '')}</b><i><s></s></i><em></em>`; labelBox.appendChild(r.el);
    NET.remotes.set(id, r);
    const L = playerLook(m.job, m.gender, m.hair ?? 0, m.hairColor ?? 0, m.outfit ?? 0, m.items || [], m.costume || null);
    sealActor(playerModelId(m.job, m.gender), playerAnimSet(m.job, m.gender), 1.7, L.gear, L.opts).then(g => { g.children[0].rotation.y = Math.PI; g.position.set(r.x, 0, r.z); G.scene.add(g); r.g = g; }).catch(() => {});
    return r;
  }
  const alive = r => r && !r.down && !r.dead && !r.gone;
  NET.alivePlayers = () => [{ x: G.player.position.x, z: G.player.position.z, me: true, ok: !G.P().down && !G.P().dead }, ...[...NET.remotes.values()].map(r => ({ x: r.x, z: r.z, ok: alive(r) }))].filter(p => p.ok);
  // 隊長：怪物追最近的活著的隊員
  NET.targetFor = p => { let best = null, bd = Infinity; for (const q of NET.alivePlayers()) { const d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2; if (d < bd) { bd = d; best = q; } } return best ? (NET._v ??= new G.THREE.Vector3()).set(best.x, 0, best.z) : G.player.position; };
  NET.spawnCenter = () => { const a = NET.alivePlayers(); const q = a[Math.random() * a.length | 0]; return q ? { x: q.x, z: q.z } : G.player.position; };

  // ---- 隊長：生怪、死亡、快照 ----
  NET.onSpawn = e => { if (!host) return; e.nid = ++NET.seq; byNid.set(e.nid, e); newSpawns.push(e); };
  const spawnInfo = e => [e.nid, e.type, e.elite ? 1 : 0, e.asBoss ? 1 : 0, e.mvp ? 1 : 0, Math.round(e.maxHp), Math.round(e.dmg * 10) / 10, e.boss ? 1 : 0];
  NET.onKill = e => { if (!host || e.nid == null) return; byNid.delete(e.nid); send('kill', { id: e.nid, x: +e.mesh.position.x.toFixed(2), z: +e.mesh.position.z.toFixed(2), xp: e.xp, by: e.by ?? me }); };
  NET.gemId = e => 'k' + e.nid;
  // ---- 隊員：送傷害 ----
  NET.hit = (e, amt) => { if (e.nid != null) hitQ.push([e.nid, Math.round(amt)]); };
  // ---- 經驗寶石：撿到廣播；分經驗照 PC 冒險團公式（2u 遊戲公式 id=169「冒險團」）----
  // 均分：每個人＝[經驗＋經驗×15%×(人數−1)]×(自己等級²／全隊等級²總和)
  // 各自：撿到的人拿全部經驗；另外每個人拿「經驗×15%×(人數−1)×職業係數×(自己等級²／全隊等級²總和)」（職業係數：祭司 2、鐵匠 1.5、其他 1）
  const lvShare = () => { const myLv = G.P().lv || 1; let sum = myLv * myLv; for (const r of NET.remotes.values()) if (!r.gone) sum += (r.lv || 1) ** 2; return myLv * myLv / sum; };
  const liveN = () => 1 + [...NET.remotes.values()].filter(r => !r.gone).length;
  const JOB_K = { 祭司: 2, 鐵匠: 1.5 }, jobK = JOB_K[G.CHAR.job] || 1;
  NET.share = (xp, picker) => { const k = liveN() - 1, L = lvShare();
    if (exp === 'even') return (xp + xp * 0.15 * k) * L;
    return (picker ? xp : 0) + xp * 0.15 * k * jobK * L; };
  NET.pick = g => { if (g.gid) send('pick', { gid: g.gid, xp: g.xp }); return NET.share(g.xp, true) / (g.xp || 1); };
  // ---- 倒地／扶起 ----
  NET.down = () => { const P = G.P(); if (P.down || P.dead) return; P.down = true; P.downT = DOWN_SECS; P.hp = 0; P.inv = 1e9; G.actorPlay('dd');
    G.showBanner(`<small>倒下了</small><b>等隊友來扶</b><span>${DOWN_SECS} 秒內隊友站在旁邊 ${REVIVE_SECS} 秒就能起來</span>`, 2500, true); send('me', meState()); };
  function revived() { const P = G.P(); if (!P.down) return; P.down = false; P.hp = Math.round(P.maxHp * 0.3); P.inv = 2; G.actorPlay('pi'); G.showBanner('<small>隊友扶你起來了</small><b>回到戰鬥！</b>', 1400); }
  // ---- 結束 ----
  NET.end = win => { if (NET.over) return; NET.over = true; if (host) { send('end', { win }); conn.send({ t: 'end', d: { win } }); } setTimeout(() => conn.drop(), 1500); saveRun(null); };

  const meState = () => { const P = G.P(), p = G.player.position; return { x: +p.x.toFixed(2), z: +p.z.toFixed(2), ry: +G.player.rotation.y.toFixed(2), mv: G.moving() ? 1 : 0, hp: Math.max(0, Math.round(P.hp)), mhp: Math.round(P.maxHp), lv: P.lv, down: P.down ? 1 : 0, dead: P.dead ? 1 : 0 }; };

  conn.on('g', o => {
    const d = o.d, from = o.from;
    switch (o.k) {
      case 'me': { const r = remote(from); r.tx = d.x; r.tz = d.z; if (!r.g || r.last === 0) { r.x = d.x; r.z = d.z; } r.ry = d.ry; r.mv = d.mv; r.hp = d.hp; r.mhp = d.mhp; r.lv = d.lv; r.down = !!d.down; r.dead = !!d.dead; r.gone = false; r.last = performance.now(); break; }
      case 'snap': { if (host) break;
        if (Math.abs(G.t() - d.t) > 0.6) G.setT(d.t);
        for (const s of d.s || []) if (!byNid.has(s[0])) { const e = G.spawnMirror(s); if (e) byNid.set(s[0], e); }
        const p = d.p || []; for (let i = 0; i < p.length; i += 4) { const e = byNid.get(p[i]); if (!e || e.dead) continue; e.netX = p[i + 1] / 10; e.netZ = p[i + 2] / 10; const hp = p[i + 3] / 1000 * e.maxHp; if (hp < e.hp || Math.abs(hp - e.hp) > e.maxHp * 0.05) e.hp = Math.max(1, hp); }
        break; }
      case 'kill': { if (host) break; const e = byNid.get(d.id); byNid.delete(d.id); G.guestKill(e, d, d.by === me); break; }
      case 'pick': { if (!G.removeGem(d.gid)) break; const P = G.P(); if (!P.down && !P.dead) { const x = NET.share(d.xp, false); if (x > 0) G.gainXp(x); } break; }
      case 'rev': if (d.to === me) revived(); break;
      case 'end': if (!NET.over) { NET.end(!!d?.win); G.gameOver(!!d?.win, false, d?.reason === 'leader' ? '隊長離開了，這局結束' : null); } break;
      case 'drop': { const r = NET.remotes.get(from); if (r) r.gone = true; break; }
      case 'rejoin': fullResend = 1; break;
    }
  });
  conn.on('h', o => { if (!host || o.k !== 'hit') return; for (const [nid, amt] of o.d || []) { const e = byNid.get(nid); if (!e || e.dead) continue; G.netDamage(e, amt, o.from); } });

  // ---- 每格（game.js update 呼叫）----
  NET.tick = dt => {
    const P = G.P(), pp = G.player.position, now = performance.now();
    // 倒地倒數
    if (P.down) { P.downT -= dt; if (P.downT <= 0) { P.down = false; P.dead = true; G.showBanner('<small>沒有隊友來扶</small><b>只能觀戰了</b><span>隊伍通關時一樣可以結算</span>', 2500, true); } }
    // 隊友：內插、動作、救人
    for (const r of NET.remotes.values()) {
      if (now - r.last > 8000) r.gone = true;
      r.x += (r.tx - r.x) * Math.min(1, dt * 10); r.z += (r.tz - r.z) * Math.min(1, dt * 10);
      if (r.g) { r.g.position.set(r.x, G.groundAt(r.x, r.z), r.z); let dy = r.ry - r.g.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); r.g.rotation.y += dy * Math.min(1, dt * 12); r.g.visible = !r.gone; const A = r.g.userData.actor;
        if (A) { if ((r.down || r.dead) && A.current !== 'dd') A.play('dd'); else if (!r.down && !r.dead && A.current === 'dd') A.play('pi'); A.update(dt, !!r.mv && !r.down); } }
      if (r.down && !P.down && !P.dead && Math.hypot(r.x - pp.x, r.z - pp.z) < REVIVE_R) { r.revT += dt; if (r.revT >= REVIVE_SECS) { r.revT = 0; send('rev', { to: r.id }); } } else r.revT = 0;
    }
    // 隊員：鏡像的怪跟著隊長的位置走、碰到自己就受傷
    if (!host) for (const e of G.enemies()) { if (e.dead || e.netX == null) continue; const p = e.mesh.position, ox = p.x, oz = p.z;
      p.x += (e.netX - p.x) * Math.min(1, dt * 10); p.z += (e.netZ - p.z) * Math.min(1, dt * 10);
      const mv = Math.hypot(p.x - ox, p.z - oz) > dt * 0.2; if (mv) e.mesh.rotation.y = Math.atan2(p.x - ox, p.z - oz);
      e.mesh.userData.actor?.move(mv); p.y = e.fly ? 0.8 + Math.sin(G.t() * 6 + e.ph) * 0.2 : 0;
      e.flash -= dt; const sq = e.flash > 0 ? 1.18 : 1; e.mesh.scale.set(e.s0 * sq, e.s0 * (e.flash > 0 ? 0.85 : 1), e.s0 * sq);
      if (!P.down && !P.dead && Math.hypot(p.x - pp.x, p.z - pp.z) < e.r + 0.5) { G.hitPlayer(e.dmg); e.mesh.userData.actor?.act('f1'); } }
    // 送出：自己的狀態（所有人）、快照（隊長）、傷害（隊員）
    if ((sendAcc += dt * 1000) >= SEND_MS) { sendAcc = 0; send('me', meState());
      if (host) { const list = G.enemies().filter(e => !e.dead && e.nid != null), p = [];
        for (const e of list) p.push(e.nid, Math.round(e.mesh.position.x * 10), Math.round(e.mesh.position.z * 10), Math.round(Math.max(0, e.hp) / e.maxHp * 1000));
        const s = (fullResend ? list : newSpawns.filter(e => !e.dead)).map(spawnInfo); fullResend = 0; newSpawns = [];
        send('snap', { t: +G.t().toFixed(2), s, p });
        // 全隊倒下（隊長自己也倒了／觀戰）＝結束
        if (!NET.alivePlayers().length && G.state() === 'play') { G.gameOver(false); }
      } else if (hitQ.length) { toHost('hit', hitQ); hitQ = []; } }
  };
  // 名牌＋血條（render 時呼叫）
  NET.render = () => {
    const W = innerWidth, H = innerHeight, v = NET._pv ??= new G.THREE.Vector3();
    for (const r of NET.remotes.values()) {
      v.set(r.x, 2.2, r.z).project(G.camera); const vis = !r.gone && v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
      r.el.style.display = vis ? 'block' : 'none'; if (!vis) continue;
      r.el.style.transform = `translate(${(v.x + 1) / 2 * W}px,${(1 - v.y) / 2 * H}px) translate(-50%,-100%)`;
      r.el.querySelector('s').style.width = Math.max(0, Math.min(100, r.hp / (r.mhp || 1) * 100)) + '%';
      r.el.querySelector('em').textContent = r.dead ? '觀戰中' : r.down ? (r.revT > 0 ? `救援中 ${Math.ceil(REVIVE_SECS - r.revT)}…` : '倒地！靠近扶起') : '';
      r.el.classList.toggle('down', r.down || r.dead);
    }
  };
  NET.conn = conn;
  conn.on('err', o => { if (o.fatal) G.showBanner(`<small>組隊</small><b>${o.msg}</b>`, 3000, true); });
  return NET;
}
