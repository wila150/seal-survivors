// 原版介面圖 .tga（未壓縮或 RLE，24／32 bit）→ PNG；也能依 .spr 的方框切成小圖
// 用法：node tools/tga2png.mjs <in.tga> <out.png> [<in.spr> <輸出資料夾>]
// .spr 格式（11/18 解）：u32 ?＋圖檔名 char[200]＋從 0xCC 起每格 4 個 i32：x1, x2, y1, y2（像素，含右下）
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function readTga(buf) {
  const idLen = buf[0], cmapType = buf[1], type = buf[2], w = buf.readUInt16LE(12), h = buf.readUInt16LE(14), bpp = buf[16], desc = buf[17];
  if (cmapType) throw new Error('不支援色盤 TGA');
  const B = bpp / 8, px = Buffer.alloc(w * h * 4); let p = 18 + idLen, o = 0;
  const put = s => { px[o] = buf[s + 2]; px[o + 1] = buf[s + 1]; px[o + 2] = buf[s]; px[o + 3] = B === 4 ? buf[s + 3] : 255; o += 4; };
  if (type === 2) for (let i = 0; i < w * h; i++, p += B) put(p);
  else if (type === 10) while (o < px.length) { const c = buf[p++], n = (c & 127) + 1; if (c & 128) { for (let i = 0; i < n; i++) put(p); p += B; } else for (let i = 0; i < n; i++, p += B) put(p); }
  else throw new Error('不支援的 TGA 類型 ' + type);
  // 預設左下原點 → 翻成上到下
  if (!(desc & 0x20)) { const row = w * 4, t = Buffer.alloc(row); for (let y = 0; y < h / 2; y++) { const a = y * row, b = (h - 1 - y) * row; px.copy(t, 0, a, a + row); px.copy(px, a, b, b + row); t.copy(px, b); } }
  return { w, h, px };
}
const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = b => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
export function png({ w, h, px }) {
  const raw = Buffer.alloc((w * 4 + 1) * h); for (let y = 0; y < h; y++) px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
export function readSpr(buf) {
  const rects = []; for (let p = 0xcc; p + 16 <= buf.length; p += 16) rects.push([buf.readInt32LE(p), buf.readInt32LE(p + 4), buf.readInt32LE(p + 8), buf.readInt32LE(p + 12)]);
  return rects;
}
export function crop(img, [x1, x2, y1, y2]) {
  const w = x2 - x1 + 1, h = y2 - y1 + 1, px = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) img.px.copy(px, y * w * 4, ((y1 + y) * img.w + x1) * 4, ((y1 + y) * img.w + x1 + w) * 4);
  return { w, h, px };
}

if (path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [, , inp, out, spr, dir] = process.argv;
  const img = readTga(fs.readFileSync(inp)); fs.writeFileSync(out, png(img)); console.log(`${out}（${img.w}×${img.h}）`);
  if (spr) { const R = readSpr(fs.readFileSync(spr)); fs.mkdirSync(dir, { recursive: true });
    R.forEach((r, i) => { if (r[1] <= r[0] || r[3] <= r[2] || r[1] >= img.w || r[3] >= img.h) return; fs.writeFileSync(path.join(dir, `${i}.png`), png(crop(img, r))); });
    console.log(`${R.length} 格 → ${dir}`); }
}
