// 把希望 OL 的 tga / ico 轉成 png，產生素材總覽頁
import fs from 'fs'; import path from 'path'; import zlib from 'zlib';
const [SRC, OUT] = process.argv.slice(2);
const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = b => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
function png(w, h, rgba) { // rgba top-down
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function tga(b) {
  const idl = b[0], type = b[2], w = b.readUInt16LE(12), h = b.readUInt16LE(14), bpp = b[16] / 8, top = b[17] & 0x20;
  let p = 18 + idl; const px = Buffer.alloc(w * h * bpp);
  if (type === 2 || type === 3) b.copy(px, 0, p, p + px.length);
  else if (type === 10) { let o = 0; while (o < px.length) { const c = b[p++], n = (c & 127) + 1; if (c & 128) { for (let i = 0; i < n; i++) b.copy(px, o + i * bpp, p, p + bpp); p += bpp; } else { b.copy(px, o, p, p + n * bpp); p += n * bpp; } o += n * bpp; } }
  else throw 'tga type ' + type;
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = ((top ? y : h - 1 - y) * w + x) * bpp, d = (y * w + x) * 4;
    out[d] = px[s + 2]; out[d + 1] = px[s + 1]; out[d + 2] = px[s]; out[d + 3] = bpp === 4 ? px[s + 3] : 255;
  }
  return png(w, h, out);
}
function ico(b) {
  const n = b.readUInt16LE(4); let best = null;
  for (let i = 0; i < n; i++) { const e = 6 + i * 16, w = b[e] || 256; if (!best || w > best.w) best = { w, size: b.readUInt32LE(e + 8), off: b.readUInt32LE(e + 12) }; }
  const d = b.subarray(best.off, best.off + best.size);
  if (d[0] === 0x89) return Buffer.from(d);
  const w = d.readInt32LE(4), h = d.readInt32LE(8) / 2, bpp = d.readUInt16LE(14), hs = d.readUInt32LE(0);
  if (bpp !== 32) throw 'ico bpp ' + bpp;
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const s = hs + ((h - 1 - y) * w + x) * 4, o = (y * w + x) * 4; out[o] = d[s + 2]; out[o + 1] = d[s + 1]; out[o + 2] = d[s]; out[o + 3] = d[s + 3]; }
  return png(w, h, out);
}
const groups = { fx: ['tga', tga], icon: ['iocn', ico] }; const list = {};
for (const [g, [dir, fn]] of Object.entries(groups)) {
  fs.mkdirSync(path.join(OUT, g), { recursive: true }); list[g] = [];
  for (const f of fs.readdirSync(path.join(SRC, dir)).sort()) {
    try { const name = f.replace(/\.\w+$/, '') + '.png'; fs.writeFileSync(path.join(OUT, g, name), fn(fs.readFileSync(path.join(SRC, dir, f)))); list[g].push(name); }
    catch (e) { console.log('skip', f, e); }
  }
}
const sec = (g, t) => `<h2>${t}（${list[g].length}）</h2><div class=g>` + list[g].map(n => `<figure><img loading=lazy src="${g}/${n}"><figcaption>${n.replace('.png', '')}</figcaption></figure>`).join('') + '</div>';
fs.writeFileSync(path.join(OUT, 'index.html'), `<!doctype html><meta charset=utf-8><title>希望素材總覽</title><style>body{background:#222;color:#ddd;font:13px sans-serif;margin:16px}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px}figure{margin:0;background:repeating-conic-gradient(#333 0 25%,#2a2a2a 0 50%) 0 0/16px 16px;padding:4px;text-align:center}img{width:100%;aspect-ratio:1;object-fit:contain}figcaption{font-size:10px;word-break:break-all}</style>${sec('fx', '技能特效 tga')}${sec('icon', '圖示 ico')}`);
console.log('fx', list.fx.length, 'icon', list.icon.length);
