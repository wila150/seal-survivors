// 主城同步（11/20 使用者：「上線還看不到對方」）：希望之城一個房間，進主城的人都連進來，看得到彼此走動
// 休眠 WebSocket：沒人動就不算時間；每個連線的角色資料（名字、職業、外觀）放 attachment
// 訊息：客戶端 → { t:'p', x, z, ry, mv }（有動才送，每秒最多 4 次）；房間 → { t:'p', id, ... } 轉送給其他人
//       進來時房間送 { t:'all', list } 目前所有人的外觀＋最後位置；有人進來 { t:'join', m }、離開 { t:'leave', id }
import { DurableObject } from 'cloudflare:workers';
const TOWN_MAX = 60;

export class Town extends DurableObject {
  socks() { return this.ctx.getWebSockets().filter(w => { try { return w.readyState === 1 && w.deserializeAttachment()?.m; } catch { return false; } }); }
  bcast(o, except) { const s = JSON.stringify(o); for (const w of this.socks()) if (w !== except) try { w.send(s); } catch {} }
  async fetch(request) {
    if (request.headers.get('upgrade') !== 'websocket') return new Response('websocket only', { status: 426 });
    const m = JSON.parse(decodeURIComponent(request.headers.get('x-member') || 'null')); if (!m) return new Response('no member', { status: 400 });
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    for (const w of this.socks()) if (w.deserializeAttachment().m.charId === m.charId) { try { w.close(4002, 'dup'); } catch {} } // 同一隻角色重連：踢掉舊的
    if (this.socks().length >= TOWN_MAX) { server.send(JSON.stringify({ t: 'full' })); server.close(4001, 'full'); return new Response(null, { status: 101, webSocket: client }); }
    server.serializeAttachment({ m, p: null });
    server.send(JSON.stringify({ t: 'all', list: this.socks().filter(w => w !== server).map(w => { const a = w.deserializeAttachment(); return { m: a.m, p: a.p }; }) }));
    this.bcast({ t: 'join', m }, server);
    return new Response(null, { status: 101, webSocket: client });
  }
  async webSocketMessage(ws, raw) {
    let o; try { o = JSON.parse(raw); } catch { return; } const a = ws.deserializeAttachment(); if (!a?.m) return;
    if (o.t === 'p') { const p = { x: +o.x || 0, z: +o.z || 0, ry: +o.ry || 0, mv: o.mv ? 1 : 0, rd: o.rd ? 1 : 0 }; a.p = p; ws.serializeAttachment(a); this.bcast({ t: 'p', id: a.m.charId, ...p }, ws); }
    else if (o.t === 'e') { const e = o.e | 0, now = Date.now(); if (e < 0 || e >= 64 || now - (a.eAt || 0) < 1500) return; a.eAt = now; ws.serializeAttachment(a); this.bcast({ t: 'e', id: a.m.charId, e }, ws); } // PC 表情（客戶端 Emoticon.tex），每 1.5 秒最多一次
    else if (o.t === 'ping') ws.send(JSON.stringify({ t: 'pong' }));
  }
  async webSocketClose(ws) { this.gone(ws); }
  async webSocketError(ws) { this.gone(ws); }
  gone(ws) { let a; try { a = ws.deserializeAttachment(); } catch {} if (!a?.m) return; try { ws.serializeAttachment({}); } catch {} this.bcast({ t: 'leave', id: a.m.charId }); }
}
