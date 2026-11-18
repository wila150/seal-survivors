// 批次轉換資料夾裡所有 .ms1，輸出 assets/models/ 與 index.json
import fs from 'node:fs'; import path from 'node:path';
import { parseMs1, texToPng, matTextures } from './seal-model.mjs';
const [dir, out, prefix = ''] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const files = fs.readdirSync(dir); const lower = new Map(files.map(f => [f.toLowerCase(), f]));
const list = []; let fail = 0;
for (const f of files.filter(f => f.endsWith('.ms1'))) {
  const name = f.slice(0, -4);
  try {
    let parts = parseMs1(fs.readFileSync(path.join(dir, f)));
    // 建築／物件的夜間燈光、特效、光暈片是另一張貼圖，套主體貼圖會變碎片 → 拿掉
    if (/^(house|object)_/i.test(f) && parts.length > 1) { const keep = parts.filter(p => !/effect|night|billboard|shadow/i.test(p.name)); if (keep.length) parts = keep; }
    if (!parts.length) { fail++; continue; }
    let cands = [];
    const mat = lower.get(name.toLowerCase() + '.mat'); if (mat) cands = matTextures(fs.readFileSync(path.join(dir, mat)));
    const buf = fs.readFileSync(path.join(dir, f));
    const refs = [...buf.toString('latin1', 0, Math.min(buf.length, 20000)).matchAll(/([A-Za-z0-9_\-]+)\.(tga|jpg|bmp|dds|png)/gi)].map(m => m[1] + '.tex');
    const base = name.replace(/_(fw|f1|rn|dd|ms|pi|stand|idle|attack|walk|die|ca|sc|fw_sc)$/i, '').toLowerCase();
    refs.sort((a, b) => (b.toLowerCase().startsWith(base) ? 1 : 0) - (a.toLowerCase().startsWith(base) ? 1 : 0));
    // 檔頭材質表第一格（偏移 10）= 主體貼圖；排最前面，避免挑到同名開頭的特效／夜間貼圖（例：艾林武器店變黃色碎片）
    const m0 = buf.toString('latin1', 10, 266).match(/^([A-Za-z0-9_\- ]+)\.(tga|jpg|bmp|dds|png)/i);
    if (m0) refs.unshift(m0[1] + '.tex');
    cands.push(name + '.tex', base + '.tex', ...refs);
    let texFile = null;
    for (const t of cands) { const real = lower.get(t.toLowerCase()); if (!real) continue;
      try { const r = texToPng(fs.readFileSync(path.join(dir, real)), !!process.env.KEEP_ALPHA); texFile = prefix + name + '.png'; fs.writeFileSync(path.join(out, texFile), r.png); break; } catch {} }
    fs.writeFileSync(path.join(out, prefix + name + '.json'), JSON.stringify({ name, tex: texFile, parts: parts.map(({ at, ...p }) => p) }));
    list.push({ id: prefix + name, v: parts.reduce((a, p) => a + p.pos.length / 3, 0), tex: !!texFile });
  } catch (e) { fail++; }
}
const idxFile = path.join(out, 'index.json');
let old = []; try { old = JSON.parse(fs.readFileSync(idxFile)); } catch {}
const merged = [...old.filter(o => !list.find(l => l.id === o.id)), ...list];
fs.writeFileSync(idxFile, JSON.stringify(merged));
console.log('ok', list.length, 'fail', fail, 'no tex', list.filter(l => !l.tex).length);
