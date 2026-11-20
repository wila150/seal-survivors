// 組隊房間（docs/企劃_組隊副本.md 第 5 節）：一支隊伍＝一個 Durable Object，瀏覽器用 WebSocket 連進來
// 用「休眠 WebSocket」（ctx.acceptWebSocket）：沒有訊息時不算時間；每個連線的隊員資料放在 attachment，房間設定放 storage
// 房間只做：成員名單、隊長、準備、地圖難度、開始；局內訊息轉送（隊長算怪，隊員送自己的動作）；閒置 5 分鐘踢出
import { DurableObject } from 'cloudflare:workers';

export const PARTY_MAX = 4;          // v1.1 使用者：組隊 3～4 個
const IDLE_MS = 5 * 60e3;            // 閒置 5 分鐘離開隊伍（使用者 11/20 截圖：RO Survivors 也這樣）
const RECONNECT_MS = 60e3;           // 局內隊員斷線 60 秒內可以回來
const LEADER_GRACE = 25e3;           // 隊長斷線（含換頁：大廳 → 遊戲 → 大廳都會斷一下）25 秒沒回來才算離開
const LOBBY_GRACE = 25e3;            // 大廳斷線（換頁）25 秒內回來還在隊伍裡

export class Party extends DurableObject {
  constructor(ctx, env) { super(ctx, env); this.meta = null; }
  async load() { this.meta ??= (await this.ctx.storage.get('meta')) || { leader: null, phase: 'lobby', setup: null, seed: 0, roster: [], left: {}, name: '', lim: PARTY_MAX, exp: 'own', code: '' }; return this.meta; }
  async save() { await this.ctx.storage.put('meta', this.meta); }
  socks() { return this.ctx.getWebSockets().filter(w => { try { return w.readyState === 1 && w.deserializeAttachment()?.m; } catch { return false; } }); }
  members() { return this.socks().map(w => { const a = w.deserializeAttachment(); return { ...a.m, ready: !!a.ready }; }); }
  send(ws, o) { try { ws.send(JSON.stringify(o)); } catch {} }
  bcast(o, except = null) { const s = JSON.stringify(o); for (const w of this.socks()) if (w !== except) try { w.send(s); } catch {} }
  async room() { const M = await this.load(), ms = this.members(); this.bcast({ t: 'room', members: ms, away: Object.keys(M.left || {}).map(Number), leader: M.leader, setup: M.setup, phase: M.phase, max: Math.min(PARTY_MAX, M.lim || PARTY_MAX), name: M.name, exp: M.exp }); await this.reg(); }
  // 回報公開隊伍列表（server.mjs /api/partyreg，直接打 Game Durable Object，帶 x-internal）
  async reg() {
    const M = this.meta, ms = this.members(); if (!M?.code || !this.env.GAME) return;
    const lead = ms.find(x => x.charId === M.leader);
    const body = JSON.stringify({ code: M.code, name: M.name, leader: lead?.name || '', lim: M.lim, exp: M.exp, count: ms.length + Object.keys(M.left || {}).length, place: M.phase === 'game' ? (M.setup?.name || '野外') : '主城', phase: M.phase });
    try { await this.env.GAME.get(this.env.GAME.idFromName('main')).fetch(new Request('https://x/api/partyreg', { method: 'POST', headers: { 'content-type': 'application/json', 'x-internal': '1' }, body })); } catch {}
  }

  async fetch(request) {
    if (request.headers.get('upgrade') !== 'websocket') return new Response('websocket only', { status: 426 });
    const M = await this.load(); const m = JSON.parse(decodeURIComponent(request.headers.get('x-member') || 'null')); if (!m) return new Response('no member', { status: 400 });
    const U = new URL(request.url), create = U.searchParams.get('create') === '1';
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    const fail = msg => { this.send(server, { t: 'err', msg, fatal: true }); server.close(4001, 'refused'); return new Response(null, { status: 101, webSocket: client }); };
    const others = this.socks().filter(w => w !== server), dup = others.find(w => w.deserializeAttachment().m.charId === m.charId);
    if (dup) { this.send(dup, { t: 'err', msg: '你在別的地方連進這支隊伍了', fatal: true }); try { dup.close(4002, 'dup'); } catch {} }
    const count = others.filter(w => w !== dup).length + Object.keys(M.left || {}).filter(k => +k !== m.charId).length; // 換頁中（寬限時間內）的人也佔位子
    if (create && count > 0) return fail('這個隊伍代碼有人在用了，請再按一次「建立隊伍」');
    if (!create && count === 0 && !M.roster.includes(m.charId)) return fail('找不到這支隊伍（代碼打錯，或隊伍已經解散）');
    if (count >= Math.min(PARTY_MAX, M.lim || PARTY_MAX)) return fail(`隊伍滿了（最多 ${Math.min(PARTY_MAX, M.lim || PARTY_MAX)} 人）`);
    if (M.phase === 'game' && !M.roster.includes(m.charId)) return fail('這支隊伍正在打，等他們回主城再加入');
    { const lvs = others.filter(w => w !== dup).map(w => w.deserializeAttachment().m.baseLv || 1); if (lvs.some(l => Math.abs(l - (m.baseLv || 1)) > 40)) return fail('等級差超過 40，不能組同一隊（照 PC 冒險團）'); }
    if (count === 0 && !M.roster.includes(m.charId)) { this.meta = { leader: m.charId, phase: 'lobby', setup: null, seed: 0, roster: [], left: {}, name: '', lim: PARTY_MAX, exp: 'own', code: '' }; }
    const R = this.meta; if (!R.roster.includes(m.charId)) R.roster.push(m.charId); delete R.left[m.charId];
    R.code = U.pathname.split('/').pop();
    if (create) { R.name = (U.searchParams.get('name') || '').slice(0, 20) || `${m.name}的隊伍`; R.lim = Math.max(2, Math.min(PARTY_MAX, +U.searchParams.get('lim') || PARTY_MAX)); R.exp = U.searchParams.get('exp') === 'even' ? 'even' : 'own'; }
    const live = others.filter(w => w !== dup).map(w => w.deserializeAttachment().m.charId);
    if (!R.leader || (!live.includes(R.leader) && !R.left[R.leader] && R.leader !== m.charId)) R.leader = m.charId; // 隊長不在線也不在寬限時間內 → 新進來的當隊長
    server.serializeAttachment({ m, ready: false, act: Date.now() });
    await this.save(); await this.ensureAlarm();
    this.send(server, { t: 'hello', you: m.charId, phase: R.phase, seed: R.seed, setup: R.setup, leader: R.leader });
    await this.room();
    if (R.phase === 'game') this.bcast({ t: 'g', k: 'rejoin', from: m.charId }, server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, raw) {
    let o; try { o = JSON.parse(raw); } catch { return; }
    const a = ws.deserializeAttachment(); if (!a?.m) return; const me = a.m.charId, M = await this.load();
    if (o.t !== 'ping' && o.t !== 'g' && o.t !== 'h') { a.act = Date.now(); ws.serializeAttachment(a); }
    else if (o.t === 'g' || o.t === 'h') { if (Date.now() - a.act > 30e3) { a.act = Date.now(); ws.serializeAttachment(a); } }
    const lead = M.leader === me;
    switch (o.t) {
      case 'ping': return this.send(ws, { t: 'pong', at: o.at });
      case 'ready': a.ready = !!o.v; ws.serializeAttachment(a); return this.room();
      case 'setup': if (!lead || M.phase !== 'lobby') return; M.setup = o.setup && typeof o.setup === 'object' ? o.setup : null; await this.save(); return this.room();
      case 'kick': { if (!lead || o.charId === me) return; const w = this.socks().find(x => x.deserializeAttachment().m.charId === o.charId);
        if (w) { this.send(w, { t: 'kicked' }); const b = w.deserializeAttachment(); b.leaving = true; w.serializeAttachment(b); try { w.close(4003, 'kicked'); } catch {} } M.roster = M.roster.filter(x => x !== o.charId); await this.save(); return this.room(); }
      case 'lead': { if (!lead || !this.members().some(x => x.charId === o.charId)) return; M.leader = o.charId; await this.save(); return this.room(); }
      case 'start': {
        if (!lead || M.phase !== 'lobby') return; const ms = this.members();
        if (!M.setup) return this.send(ws, { t: 'err', msg: '先選地圖' });
        if (ms.some(x => !x.ready && x.charId !== me)) return this.send(ws, { t: 'err', msg: '還有隊員沒按準備' });
        M.phase = 'game'; M.seed = (Math.random() * 2 ** 31) | 0; M.roster = ms.map(x => x.charId); M.left = {}; await this.save();
        for (const w of this.socks()) { const b = w.deserializeAttachment(); b.ready = false; w.serializeAttachment(b); }
        return this.bcast({ t: 'start', seed: M.seed, setup: M.setup, members: ms, leader: M.leader });
      }
      case 'end': { // 隊長：這局結束（通關／全滅）→ 回到大廳狀態
        if (!lead) return; M.phase = 'lobby'; await this.save(); this.bcast({ t: 'g', k: 'end', from: me, d: o.d ?? null }); return this.room(); }
      case 'g': o.from = me; return this.bcast(o, ws);                  // 局內：給其他所有人（隊長廣播怪物、隊員廣播自己的動作）
      case 'h': { o.from = me; const w = this.socks().find(x => x.deserializeAttachment().m.charId === M.leader); if (w && w !== ws) this.send(w, o); return; } // 只給隊長（傷害回報、撿東西）
      case 'leave': a.leaving = true; ws.serializeAttachment(a); try { ws.close(1000, 'leave'); } catch {} return;
    }
  }

  async webSocketClose(ws) { await this.gone(ws); }
  async webSocketError(ws) { await this.gone(ws); }
  async gone(ws) {
    let a; try { a = ws.deserializeAttachment(); } catch {} if (!a?.m) return; const me = a.m.charId, M = await this.load();
    try { ws.serializeAttachment({}); } catch {}
    if (a.leaving) { M.roster = M.roster.filter(x => x !== me); delete M.left[me]; } // 自己按「離開隊伍」：馬上移除
    else M.left[me] = Date.now();                                                    // 斷線／換頁：先保留，寬限時間過了才移除（alarm）
    if (a.leaving && M.leader === me) { const rest = this.members(); if (M.phase === 'game') { M.phase = 'lobby'; this.bcast({ t: 'g', k: 'end', from: me, d: { reason: 'leader' } }); } M.leader = rest[0]?.charId ?? null; }
    await this.save();
    if (M.phase === 'game' && !a.leaving) this.bcast({ t: 'g', k: 'drop', from: me });
    await this.ctx.storage.setAlarm(Date.now() + 5e3);
    return this.room();
  }

  async ensureAlarm() { if (!(await this.ctx.storage.getAlarm())) await this.ctx.storage.setAlarm(Date.now() + 60e3); }
  async alarm() {
    const now = Date.now(), M = await this.load(), liveIds = this.members().map(x => x.charId);
    for (const w of this.socks()) { const a = w.deserializeAttachment();
      if (M.phase === 'lobby' && now - a.act > IDLE_MS) { this.send(w, { t: 'idle' }); a.leaving = true; w.serializeAttachment(a); try { w.close(4004, 'idle'); } catch {} } }
    let changed = false;
    for (const [k, t] of Object.entries(M.left || {})) { const id = +k; if (liveIds.includes(id)) { delete M.left[k]; changed = true; continue; }
      const grace = M.leader === id ? LEADER_GRACE : M.phase === 'game' ? RECONNECT_MS : LOBBY_GRACE;
      if (now - t < grace) continue;
      delete M.left[k]; M.roster = M.roster.filter(x => x !== id); changed = true;
      if (M.leader === id) { if (M.phase === 'game') { M.phase = 'lobby'; this.bcast({ t: 'g', k: 'end', from: id, d: { reason: 'leader' } }); } M.leader = liveIds[0] ?? null; } // v1.1 決定 3：隊長離開＝這局結束
    }
    if (!liveIds.length && !Object.keys(M.left).length) { this.meta = { leader: null, phase: 'lobby', setup: null, seed: 0, roster: [], left: {}, name: '', lim: PARTY_MAX, exp: 'own', code: '' }; changed = true; }
    if (changed) { await this.save(); await this.room(); } else await this.reg(); // 每分鐘回報一次，列表才不會過期
    if (liveIds.length || Object.keys(this.meta.left).length) await this.ctx.storage.setAlarm(now + (Object.keys(this.meta.left).length ? 5e3 : 60e3));
  }
}
