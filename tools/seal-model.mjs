// 希望OL 客戶端模型轉檔：.ms1（Grigon 模型）＋ .tex（Grigon 貼圖）→ JSON ＋ PNG
// 用法：node tools/seal-model.mjs <客戶端資料夾/monster> <模型名(不含副檔名)> <輸出資料夾>
//
// 目前解出的 .ms1 結構（每個部位）：
//   name[256] | flag u8（1=綁在骨頭上的硬部位）| bone[256] | nverts u32 | nfaces u32 | skinned u32 | ...header...
//   頂點 nverts × 32 bytes：pos(3f) normal(3f) uv(2f)
//   面   nfaces × 3 × u16
// 部位位置用掃描方式找（名稱＋合理的數量＋頂點驗證），還沒解出整份檔頭。
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// ---------- PNG ----------
const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = b => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
export function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- DXT 解碼 ----------
function c565(c) { return [((c >> 11) & 31) * 255 / 31 | 0, ((c >> 5) & 63) * 255 / 63 | 0, (c & 31) * 255 / 31 | 0]; }
function colorBlock(b, o, out, w, x0, y0, dxt1) {
  const c0 = b.readUInt16LE(o), c1 = b.readUInt16LE(o + 2), bits = b.readUInt32LE(o + 4);
  const p0 = c565(c0), p1 = c565(c1), pal = [p0, p1];
  if (c0 > c1 || !dxt1) { pal.push(p0.map((v, i) => (2 * v + p1[i]) / 3 | 0), p0.map((v, i) => (v + 2 * p1[i]) / 3 | 0)); }
  else { pal.push(p0.map((v, i) => (v + p1[i]) / 2 | 0), [0, 0, 0, -1]); }
  for (let i = 0; i < 16; i++) {
    const c = pal[(bits >>> (2 * i)) & 3], x = x0 + (i & 3), y = y0 + (i >> 2), d = (y * w + x) * 4;
    out[d] = c[0]; out[d + 1] = c[1]; out[d + 2] = c[2]; out[d + 3] = c[3] === -1 ? 0 : 255;
  }
}
function decodeDXT(b, o, w, h, fmt) {
  const out = Buffer.alloc(w * h * 4), bs = fmt === 'DXT1' ? 8 : 16;
  for (let by = 0; by < h; by += 4) for (let bx = 0; bx < w; bx += 4) {
    if (by + 4 > h || bx + 4 > w) { o += bs; continue; }
    if (fmt === 'DXT1') { colorBlock(b, o, out, w, bx, by, true); }
    else {
      colorBlock(b, o + 8, out, w, bx, by, false);
      if (fmt === 'DXT3') { for (let i = 0; i < 16; i++) { const a = (b[o + (i >> 1)] >> ((i & 1) * 4)) & 15; out[((by + (i >> 2)) * w + bx + (i & 3)) * 4 + 3] = a * 17; } }
      else { // DXT5
        const a0 = b[o], a1 = b[o + 1], al = [a0, a1];
        if (a0 > a1) for (let k = 1; k < 7; k++) al.push(((7 - k) * a0 + k * a1) / 7 | 0); else { for (let k = 1; k < 5; k++) al.push(((5 - k) * a0 + k * a1) / 5 | 0); al.push(0, 255); }
        let bits = 0n; for (let k = 0; k < 6; k++) bits |= BigInt(b[o + 2 + k]) << BigInt(8 * k);
        for (let i = 0; i < 16; i++) out[((by + (i >> 2)) * w + bx + (i & 3)) * 4 + 3] = al[Number((bits >> BigInt(3 * i)) & 7n)];
      }
    }
    o += bs;
  }
  return out;
}

// ---------- .tex → PNG ----------
// 檔頭 0x40 bytes 文字 + u32 長度，接著是一個 DDS 檔；DDS 前 18 bytes 跟一個 key 做 XOR（key = 第一個 byte ^ 0x44）
// keepAlpha：原版地圖的草、花、樹葉是挖空貼圖，大部分透明是正常的，不要當成「沒用到透明」
export function texToPng(buf, keepAlpha = false) {
  const dds = Buffer.from(buf.subarray(0x44));
  const key = dds[0] ^ 0x44; // v0.31 用 0xff，v0.3 用 0xf7
  for (let i = 0; i < 18; i++) dds[i] ^= key;
  if (dds.toString('latin1', 0, 4) !== 'DDS ') throw new Error('not dds');
  const h = dds.readUInt32LE(12), w = dds.readUInt32LE(16);
  const pfFlags = dds.readUInt32LE(80), four = dds.toString('latin1', 84, 88), bpp = dds.readUInt32LE(88);
  let rgba;
  if (pfFlags & 4) rgba = decodeDXT(dds, 128, w, h, four);
  else if (bpp === 32 || bpp === 24) {
    const bytes = bpp / 8; rgba = Buffer.alloc(w * h * 4);
    const rm = dds.readUInt32LE(92), hasA = pfFlags & 1;
    for (let i = 0; i < w * h; i++) { const s = 128 + i * bytes, d = i * 4;
      const px = bytes === 4 ? dds.readUInt32LE(s) : dds[s] | dds[s + 1] << 8 | dds[s + 2] << 16;
      const r = rm === 0xff ? px & 255 : (px >> 16) & 255, b = rm === 0xff ? (px >> 16) & 255 : px & 255;
      rgba[d] = r; rgba[d + 1] = (px >> 8) & 255; rgba[d + 2] = b; rgba[d + 3] = hasA && bytes === 4 ? px >>> 24 : 255; }
  } else throw new Error('unsupported pf ' + four + ' ' + bpp);
  // 有些貼圖的 alpha 幾乎全是 0（美術沒用到透明），這種當成不透明
  let clear = 0; for (let i = 3; i < rgba.length; i += 4) if (rgba[i] < 128) clear++;
  if (!keepAlpha && clear / (w * h) > 0.9) for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255;
  return { w, h, rgba, png: png(w, h, rgba) };
}

// ---------- .ms1 → 部位 ----------
const printable = (b, o, max = 256) => { let s = ''; for (let i = o; i < o + max; i++) { const c = b[i]; if (!c) break; if (c < 32 || c > 126) return null; s += String.fromCharCode(c); } return s; };
function vertOk(b, p) {
  if (p + 32 > b.length) return false;
  const nx = b.readFloatLE(p + 12), ny = b.readFloatLE(p + 16), nz = b.readFloatLE(p + 20);
  const n = Math.hypot(nx, ny, nz); return Math.abs(n - 1) < 0.05 && Math.abs(b.readFloatLE(p)) < 1e4;
}
export function parseMs1(b) {
  const parts = [];
  for (let o = 0; o < b.length - 0x220; o++) {
    const flag = b[o + 0x100]; if (flag > 1) continue;
    if (o && b[o - 1] !== 0) continue;
    const name = printable(b, o); if (!name || name.length < 2) continue;
    const nv = b.readUInt32LE(o + 0x201), nf = b.readUInt32LE(o + 0x205);
    if (nv < 3 || nv > 60000 || nf < 1 || nf > 120000) continue;
    // 頂點起點：在檔頭後 150～400 bytes 內找第一個連續 nv 個合法頂點的位置
    let vs = -1, fs_ = 0, idx = null;
    for (let p = o + 0x209 + 100; p < o + 0x209 + 500 && vs < 0; p++) {
      if (!(vertOk(b, p) && vertOk(b, p + 32) && vertOk(b, p + (nv - 1) * 32))) continue;
      const f0 = p + nv * 32; if (f0 + nf * 6 > b.length) continue;
      const ix = new Array(nf * 3); let bad = false;
      for (let i = 0; i < nf * 3; i++) { const v = b.readUInt16LE(f0 + i * 2); if (v >= nv) { bad = true; break; } ix[i] = v; }
      if (!bad) { vs = p; fs_ = f0; idx = ix; }
    }
    if (vs < 0) continue;
    const pos = [], nor = [], uv = [];
    for (let i = 0; i < nv; i++) { const p = vs + i * 32;
      pos.push(+b.readFloatLE(p).toFixed(4), +b.readFloatLE(p + 4).toFixed(4), +b.readFloatLE(p + 8).toFixed(4));
      nor.push(+b.readFloatLE(p + 12).toFixed(3), +b.readFloatLE(p + 16).toFixed(3), +b.readFloatLE(p + 20).toFixed(3));
      uv.push(+b.readFloatLE(p + 24).toFixed(4), +b.readFloatLE(p + 28).toFixed(4)); }
    parts.push({ name, bone: flag ? printable(b, o + 0x101) : null, pos, nor, uv, idx, at: o, end: fs_ + nf * 6 });
    o = fs_ + nf * 6 - 1;
  }
  return parts;
}

// ---------- 材質（.mat）：找出 .tex 名稱 ----------
export function matTextures(buf) { return [...buf.toString('latin1').matchAll(/([A-Za-z0-9_\-]+\.tex)/g)].map(m => m[1]); }

// ---------- CLI ----------
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const [dir, name, out] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  const parts = parseMs1(fs.readFileSync(path.join(dir, name + '.ms1')));
  let texs = []; try { texs = matTextures(fs.readFileSync(path.join(dir, name + '.mat'))); } catch {}
  if (!texs.length && fs.existsSync(path.join(dir, name + '.tex'))) texs = [name + '.tex'];
  const tex = texs.find(t => fs.existsSync(path.join(dir, t)) && t.toLowerCase().startsWith(name.toLowerCase())) || texs.find(t => fs.existsSync(path.join(dir, t)));
  let texFile = null;
  if (tex) { const r = texToPng(fs.readFileSync(path.join(dir, tex))); texFile = name + '.png'; fs.writeFileSync(path.join(out, texFile), r.png); console.log('tex', tex, r.w + 'x' + r.h); }
  fs.writeFileSync(path.join(out, name + '.json'), JSON.stringify({ name, tex: texFile, parts: parts.map(({ at, ...p }) => p) }));
  console.log(name, parts.map(p => `${p.name}(${p.pos.length / 3}v ${p.idx.length / 3}f${p.bone ? ' @' + p.bone : ''})`).join(' '));
}
