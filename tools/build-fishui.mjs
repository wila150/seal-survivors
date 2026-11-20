// 原版手動釣魚台介面（interface/mainblue_skill_fish02.tex、fish03.tex）→ assets/ui/pc/wf_*.png
// 這兩張不是 DDS：0x44 起是 TGA（檔頭 18 bytes 跟 0xff XOR，像素是一般 BGRA、由下往上）——11/20 解出
// 用法：node tools/build-fishui.mjs <客戶端 interface 資料夾>
import fs from 'node:fs';
import path from 'node:path';
import { png } from './seal-model.mjs';
const dir = process.argv[2];
if (!dir) { console.error('用法：node tools/build-fishui.mjs <客戶端 interface 資料夾>'); process.exit(1); }
function tga(name) {
  const r = fs.readFileSync(path.join(dir, name)).subarray(0x44), h = Buffer.from(r.subarray(0, 18)).map(x => x ^ 0xff);
  const w = h.readUInt16LE(12), H = h.readUInt16LE(14), top = h[17] & 32, rgba = Buffer.alloc(w * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < w; x++) { const s = 18 + (y * w + x) * 4, d = ((top ? y : H - 1 - y) * w + x) * 4; rgba[d] = r[s + 2]; rgba[d + 1] = r[s + 1]; rgba[d + 2] = r[s]; rgba[d + 3] = r[s + 3]; }
  return { w, rgba };
}
const CUT = {
  'mainblue_skill_fish02.tex': { base: [0, 0, 511, 399], wave: [213, 402, 401, 507], splash: [4, 406, 108, 508] }, // 釣竿＋河＋招牌、右邊浪、左邊木樁浪
  'mainblue_skill_fish03.tex': { gauge: [12, 12, 54, 164], gauge0: [66, 12, 108, 164], hook: [115, 14, 162, 93], fish: [171, 15, 226, 94], dcur: [133, 111, 184, 126],
    spot1: [252, 11, 303, 55], spot2: [252, 63, 327, 107], spot3: [250, 116, 359, 160], dz1: [16, 174, 55, 218], dz2: [16, 224, 82, 268], dz3: [16, 274, 109, 318], dz4: [16, 324, 122, 368] },
};
const out = new URL('../assets/ui/pc/', import.meta.url); let n = 0;
for (const [file, cuts] of Object.entries(CUT)) { const { w, rgba } = tga(file);
  for (const [name, [x1, y1, x2, y2]] of Object.entries(cuts)) { const cw = x2 - x1 + 1, ch = y2 - y1 + 1, px = Buffer.alloc(cw * ch * 4);
    for (let y = 0; y < ch; y++) rgba.copy(px, y * cw * 4, ((y1 + y) * w + x1) * 4, ((y1 + y) * w + x2 + 1) * 4);
    fs.writeFileSync(new URL(`wf_${name}.png`, out), png(cw, ch, px)); n++; } }
console.log(`${n} 張 → assets/ui/pc/wf_*.png`);
