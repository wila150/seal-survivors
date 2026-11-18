// 希望OL 原版地圖轉檔：node tools/build-map.mjs <客戶端 map 資料夾> <地圖編號> [...更多編號]
// 輸出 assets/maps/<編號>/：
//   map.json   名稱、大小、地表磚貼圖、物件清單 [模型索引, x, y, z, 轉向, 縮放]、模型名稱
//   height.bin Int16 × 512²（高度 ×100，列＝z、行＝x，1 格＝1 單位）
//   walk.bin   Uint8 × 512²（1＝可以走）
//   color.png  整張地圖的光影／色調圖（RGB）＋泥土路遮罩（A：黑＝第一張地表磚）
//   tile_*.png 地表磚
// 物件用到的模型轉進 assets/models（同 batch-models.mjs）
//
// .map 格式（v.10，11/18 解出）：
//   0x40 地名（cp949）、0x100 u32 寬, u32 高, u32 地表磚數
//   f32 高度 × 寬×高；接著 u32 可走（1＝擋）× 寬×高；接著 u32 物件數 N + N×(u32 模型, f32 x, y, z, 轉向(×π), …, 縮放)（v.10／11 每筆 28 bytes，v.12／14 每筆 32）；接著 u32 模型數 M + M×204 bytes 檔名
// .mdt：u32 數量 + 數量×(name[100], u32 大小, u32 位移)，DDS 在「位移＋4」；最後一張是整張地圖的色調圖（32 bit ARGB）
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { texToPng, png } from './seal-model.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const [dir, ...ids] = process.argv.slice(2);
if (!dir || !ids.length) { console.log('用法：node tools/build-map.mjs <map 資料夾> <編號>...'); process.exit(1); }
const files = fs.readdirSync(dir), lower = new Map(files.map(f => [f.toLowerCase(), f]));
const real = n => lower.get(n.toLowerCase());

function ddsToPng(dds) {
  const pf = dds.readUInt32LE(80), bpp = dds.readUInt32LE(88);
  if (pf & 4) return texToPng(Buffer.concat([Buffer.alloc(0x44), dds])).png;
  // 32 bit ARGB：保留 alpha（泥土路遮罩）
  const w = dds.readUInt32LE(16), h = dds.readUInt32LE(12), out = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) { const p = dds.readUInt32LE(128 + i * 4); out[i * 4] = (p >> 16) & 255; out[i * 4 + 1] = (p >> 8) & 255; out[i * 4 + 2] = p & 255; out[i * 4 + 3] = bpp === 32 ? p >>> 24 : 255; }
  return png(w, h, out);
}

for (const id of ids) {
  const m = fs.readFileSync(path.join(dir, real(id + '.map')));
  const name = new TextDecoder('euc-kr').decode(m.subarray(0x40, 0x54)).replace(/\0.*$/s, '').trim();
  const W = m.readUInt32LE(0x100), H = m.readUInt32LE(0x104), N = W * H;
  // 檔頭長度依版本不同（v.10～v.14）→ 從檔尾的模型名稱表往回推：名稱表前面是物件、再前面是可走、再前面是高度
  const firstName = m.indexOf('.ms1', N * 8, 'latin1'); let ns = firstName; while (ns > 0 && m[ns - 1] >= 32 && m[ns - 1] < 127) ns--;
  // 物件每筆 28 bytes（v.10、v.11）或 32 bytes（v.12、v.14 多一個欄位）；對得上的條件：筆數吻合、前面是可走區（0／1）、高度區在檔頭之後
  const mPos = ns - 4; let objPos = -1, RS = 28;
  for (const rs of [28, 32]) for (let n = 1; n < 60000 && objPos < 0; n++) {
    const q = mPos - 4 - n * rs; if (q - N * 8 < 0x400) break;
    if (m.readUInt32LE(q) === n && [4, 8, 12, 16].every(k => m.readUInt32LE(q - k) <= 1)) { objPos = q; RS = rs; }
  }
  if (objPos < 0) { console.log(id, '找不到物件區塊'); continue; }
  let o = objPos - N * 8;
  const height = new Int16Array(N); for (let i = 0; i < N; i++, o += 4) height[i] = Math.round(m.readFloatLE(o) * 100);
  const walk = new Uint8Array(N); for (let i = 0; i < N; i++, o += 4) walk[i] = m.readUInt32LE(o) ? 0 : 1; // 原檔 1＝擋住，存成 1＝能走
  const nObj = m.readUInt32LE(o); o += 4;
  const objs = []; for (let k = 0; k < nObj; k++, o += RS) objs.push([m.readUInt32LE(o), ...[4, 8, 12, 16, RS - 4].map(d => +m.readFloatLE(o + d).toFixed(3))]); // 縮放在最後一欄；轉向單位是 π（0～2）
  const nModel = m.readUInt32LE(o); o += 4;
  const models = []; for (let k = 0; k < nModel; k++) models.push(m.toString('latin1', o + k * 204, o + k * 204 + 204).split('\0')[0].replace(/\.ms1$/i, ''));

  const out = path.join(ROOT, 'assets/maps', id); fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'height.bin'), Buffer.from(height.buffer));
  fs.writeFileSync(path.join(out, 'walk.bin'), Buffer.from(walk.buffer));
  // 地表貼圖
  const d = fs.readFileSync(path.join(dir, real(id + '.mdt'))), nt = d.readUInt32LE(0), tiles = [];
  for (let k = 0, q = 4; k < nt; k++, q += 108) {
    const tn = d.toString('latin1', q, q + 100).split('\0')[0].replace(/\.\w+$/, ''), size = d.readUInt32LE(q + 100), off = d.readUInt32LE(q + 104) + 4;
    const file = k === nt - 1 ? 'color.png' : `tile_${tn}.png`;
    fs.writeFileSync(path.join(out, file), ddsToPng(d.subarray(off, off + size)));
    if (k < nt - 1) tiles.push(file);
  }
  // 物件模型：抄到暫存資料夾（含貼圖）再用 batch-models 轉
  const used = [...new Set(objs.map(x => x[0]))].map(i => models[i]).filter(Boolean);
  const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'map' + id + '-'));
  for (const mn of used) {
    const f = real(mn + '.ms1'); if (!f) continue;
    fs.copyFileSync(path.join(dir, f), path.join(tmp, f));
    const mat = real(mn + '.mat'); if (mat) fs.copyFileSync(path.join(dir, mat), path.join(tmp, mat));
    const buf = fs.readFileSync(path.join(dir, f)), refs = [...buf.toString('latin1', 0, Math.min(buf.length, 20000)).matchAll(/([A-Za-z0-9_\- ]+)\.(tga|jpg|bmp|dds|png)/gi)].map(r => r[1]);
    for (const t of [mn, ...refs]) { const tf = real(t + '.tex'); if (tf) fs.copyFileSync(path.join(dir, tf), path.join(tmp, tf)); }
  }
  execFileSync('node', [path.join(ROOT, 'tools/batch-models.mjs'), tmp, path.join(ROOT, 'assets/models')], { stdio: 'inherit', env: { ...process.env, KEEP_ALPHA: '1' } });
  fs.rmSync(tmp, { recursive: true });
  const have = models.map(mn => fs.existsSync(path.join(ROOT, 'assets/models', mn + '.json')));
  const keep = objs.filter(x => have[x[0]]);
  fs.writeFileSync(path.join(out, 'map.json'), JSON.stringify({ id: +id, name, w: W, h: H, tiles, models, objects: keep }));
  console.log(`${id} ${name}：${W}×${H}、地表磚 ${tiles.length}、物件 ${keep.length}/${objs.length}、模型 ${used.length}`);
}
