// 組隊連線（docs/企劃_組隊副本.md v1.1）：大廳和遊戲共用
// 只有雲端版能組隊（window.SS_CLOUD，src/0_offline/boot.js 設的）；離線模式、本機 Node 伺服器沒有房間伺服器 → partyOK() 為 false
// 隊伍代碼存 sessionStorage ss_party_code（大廳 → 遊戲 → 回大廳都留在同一支隊伍）；開局資料存 ss_party_run
export const PARTY_MAX = 4;
export const partyOK = () => !!window.SS_CLOUD;
const CODE_CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 不用 0／O、1／I 這種容易看錯的
export const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), b => CODE_CH[b % CODE_CH.length]).join('');
export const cleanCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
export const savedCode = () => { try { return sessionStorage.getItem('ss_party_code') || ''; } catch { return ''; } };
export const saveCode = c => { try { c ? sessionStorage.setItem('ss_party_code', c) : sessionStorage.removeItem('ss_party_code'); } catch {} };
export const runInfo = () => { try { return JSON.parse(sessionStorage.getItem('ss_party_run') || 'null'); } catch { return null; } };
export const saveRun = r => { try { r ? sessionStorage.setItem('ss_party_run', JSON.stringify(r)) : sessionStorage.removeItem('ss_party_run'); } catch {} };
export const inviteLink = code => location.href.replace(/\/[^/]*([?#].*)?$/, '/') + 'index.html?join=' + code;

// 一條連線：on(type, fn)；type＝room／start／g／h／err／kicked／idle／hello／close／open
export class PartyConn {
  constructor(code, { token, charId, create = false, name = '', lim = PARTY_MAX, exp = 'own' } = {}) {
    this.code = code; this.token = token; this.charId = charId; this.create = create; this.opt = { name, lim, exp };
    this.fns = {}; this.ws = null; this.closed = false; this.fatal = false; this.tries = 0; this.room = null;
    this.connect();
  }
  on(t, fn) { (this.fns[t] ||= []).push(fn); return this; }
  emit(t, o) { for (const f of this.fns[t] || []) try { f(o); } catch (e) { console.error(e); } }
  connect() {
    const base = window.SS_CLOUD.replace(/^http/, 'ws');
    const ws = this.ws = new WebSocket(`${base}/party/${this.code}?token=${encodeURIComponent(this.token)}&charId=${this.charId}${this.create ? `&create=1&name=${encodeURIComponent(this.opt.name)}&lim=${this.opt.lim}&exp=${this.opt.exp}` : ''}`);
    ws.onopen = () => { this.tries = 0; this.create = false; this.emit('open'); clearInterval(this.pingT); this.pingT = setInterval(() => this.send({ t: 'ping', at: Date.now() }), 25e3); };
    ws.onmessage = e => { let o; try { o = JSON.parse(e.data); } catch { return; }
      if (o.t === 'room') this.room = o; if (o.t === 'pong') this.rtt = Date.now() - o.at;
      if (o.t === 'err' && o.fatal) this.fatal = true; if (o.t === 'kicked' || o.t === 'idle') this.fatal = true;
      this.emit(o.t, o); };
    ws.onclose = e => { clearInterval(this.pingT); this.emit('close', { code: e.code });
      // 網路斷掉（不是被拒絕、被踢、自己離開）→ 自動重連，最多 10 次
      if (!this.closed && !this.fatal && e.code !== 1000 && this.tries++ < 10) setTimeout(() => !this.closed && this.connect(), Math.min(8000, 800 * this.tries)); };
  }
  send(o) { if (this.ws?.readyState === 1) { this.ws.send(JSON.stringify(o)); return true; } return false; }
  get open() { return this.ws?.readyState === 1; }
  leave() { this.closed = true; this.send({ t: 'leave' }); try { this.ws.close(1000); } catch {} clearInterval(this.pingT); }
  drop() { this.closed = true; try { this.ws.close(1000); } catch {} clearInterval(this.pingT); } // 換頁：不送 leave（隊伍還在）
}
