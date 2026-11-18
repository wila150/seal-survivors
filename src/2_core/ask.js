// 遊戲內確認框（11/18 使用者：不要跳瀏覽器的視窗，直接在遊戲裡）：取代 confirm()／prompt()
// await askConfirm('確定？', { ok: '確定', danger: true }) → true／false
// await askText('新的名稱', '預設值', { max: 10 }) → 字串或 null（取消）
const CSS = `#ssAsk{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:#0006;font-family:system-ui,"Noto Sans TC",sans-serif}
#ssAsk .box{width:min(380px,92vw);border-radius:14px;overflow:hidden;background:linear-gradient(#f4f7ff,#dfe7fb);border:1px solid #9db4ee;box-shadow:0 10px 40px #0008;color:#26324d}
#ssAsk header{background:linear-gradient(#6f8fd8,#3a5bbf);color:#fff;font-weight:800;padding:10px 14px;font-size:15px}
#ssAsk .msg{padding:16px 16px 6px;font-size:14px;line-height:1.6;white-space:pre-line;text-align:center;font-weight:600}
#ssAsk input{display:block;width:calc(100% - 32px);margin:8px 16px 0;padding:8px 10px;font:inherit;font-size:14px;border:1px solid #9db4ee;border-radius:8px;box-sizing:border-box}
#ssAsk .row{display:flex;gap:10px;padding:14px 16px 16px}
#ssAsk button{flex:1;font:inherit;font-weight:700;font-size:15px;padding:10px;border-radius:10px;border:1px solid #9db4ee;background:linear-gradient(#fff,#e6ecfa);color:#26324d;cursor:pointer}
#ssAsk button.ok{background:linear-gradient(#7f9ff0,#3a5bbf);color:#fff;border-color:#3a5bbf}
#ssAsk button.ok.danger{background:linear-gradient(#f7a4a4,#e06666);border-color:#c94f4f}`;
function open(msg, { ok = '確定', cancel = '取消', danger = false, title = '確認', input = null, max = 40 } = {}) {
  if (!document.getElementById('ssAskCss')) { const st = document.createElement('style'); st.id = 'ssAskCss'; st.textContent = CSS; document.head.appendChild(st); }
  document.getElementById('ssAsk')?.remove();
  const el = document.createElement('div'); el.id = 'ssAsk';
  el.innerHTML = `<div class="box"><header>◆ ${title}</header><div class="msg"></div>${input != null ? `<input maxlength="${max}">` : ''}<div class="row"><button type="button" class="ok${danger ? ' danger' : ''}">${ok}</button><button type="button" class="no">${cancel}</button></div></div>`;
  el.querySelector('.msg').textContent = msg;
  const inp = el.querySelector('input'); if (inp) inp.value = input;
  document.body.appendChild(el); (inp || el.querySelector('.ok')).focus();
  return new Promise(res => {
    const done = v => { el.remove(); removeEventListener('keydown', key, true); res(v); };
    const key = e => { if (e.key === 'Escape') { e.stopPropagation(); done(null); } else if (e.key === 'Enter') { e.stopPropagation(); e.preventDefault(); done(inp ? inp.value : true); } };
    addEventListener('keydown', key, true);
    el.querySelector('.ok').onclick = () => done(inp ? inp.value : true);
    el.querySelector('.no').onclick = () => done(null);
    el.onclick = e => { if (e.target === el) done(null); };
  });
}
export const askConfirm = async (msg, o) => !!(await open(msg, o));
export const askText = (msg, def = '', o = {}) => open(msg, { title: '輸入', ...o, input: def ?? '' });
