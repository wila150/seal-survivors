// 原版髮型：wear/M_Hair_Aa～Af、W_Hair_Aa～Af（綁 Bip01 Head）＋ 9 色原版染色貼圖
// 用法：node tools/build-hair.mjs <客戶端 wear 資料夾> → assets/models/hair_<m|w>_<a..f>.json、assets/hair/<m|w>_<a..f>_<色>.png
import fs from 'node:fs'; import path from 'node:path';
import { parseMs1, texToPng } from './seal-model.mjs';
const dir = process.argv[2], OUT_M = 'assets/models', OUT_T = 'assets/hair';
const files = fs.readdirSync(dir); const lower = new Map(files.map(f => [f.toLowerCase(), f]));
export const HAIR_COLORS = ['', 'b', 'bl', 'g', 'gr', 'or', 'pi', 'r', 'wh'];
for (const g of ['m', 'w']) for (const s of 'abcdef') {
  const ms = lower.get(`${g}_hair_a${s}.ms1`); if (!ms) { console.log('缺', g, s); continue; }
  const parts = parseMs1(fs.readFileSync(path.join(dir, ms))).map(({ at, ...p }) => ({ ...p, bone: p.bone || 'Bip01 Head' }));
  const id = `hair_${g}_${s}`;
  fs.writeFileSync(path.join(OUT_M, id + '.json'), JSON.stringify({ name: id, tex: `../hair/${g}_${s}_0.png`, parts }));
  HAIR_COLORS.forEach((c, i) => {
    const t = lower.get(`${g}_hair_a${s}${c ? '_' + c : ''}.tex`); if (!t) { console.log('  缺色', g, s, c); return; }
    fs.writeFileSync(path.join(OUT_T, `${g}_${s}_${i}.png`), texToPng(fs.readFileSync(path.join(dir, t))).png);
  });
  console.log(id, parts.map(p => `${p.name}@${p.bone}(${p.pos.length / 3}v)`).join(' '));
}
