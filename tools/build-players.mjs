// 組合玩家角色：臉 + 職業初始服裝（頭／身體／腿／腳），男女各一套
// 輸出 assets/models/player_<m|w>_<job>.json，每個部位有自己的貼圖
import fs from 'node:fs'; import path from 'node:path';
import { parseMs1, texToPng } from './seal-model.mjs';
import { parseBn1, parseSkin } from './seal-anim.mjs';
const ACTOR = path.join(process.argv[2], '..', 'actor');
const SKEL = { M: parseBn1(fs.readFileSync(path.join(ACTOR, 'Man_All.bn1'))), W: parseBn1(fs.readFileSync(path.join(ACTOR, 'Woman_all.bn1'))) };
for (const g of ['M', 'W']) fs.writeFileSync(path.join(process.argv[3], `skel_${g.toLowerCase()}.json`), JSON.stringify(SKEL[g].map(b => ({ name: b.name, parent: SKEL[g].findIndex(x => x.name === b.parent), world: b.world.map(v => +v.toFixed(5)) }))));
const [dir, out] = process.argv.slice(2);
const files = fs.readdirSync(dir); const lower = new Map(files.map(f => [f.toLowerCase(), f]));
const JOBSETS = { musa: 'Musa00', knight: 'knight00', magic: 'magic00', cleric: 'cleric', clown: 'clown00', smith: 'smith00', gunner: 'gunner00' }; // gunner＝獵人（項目 45）
const texCache = new Map();
function texFor(msName, buf) {
  const refs = [...buf.toString('latin1', 0, Math.min(buf.length, 20000)).matchAll(/([A-Za-z0-9_\-]+)\.(tga|jpg|bmp|dds|png)/gi)].map(m => m[1]);
  // 一個檔案可能有多個材質：優先挑名字含部位關鍵字（head/body/leg/foot）的
  const kind = (msName.match(/(head|body|leg|foot|face)$/i) || [])[1]?.toLowerCase();
  const score = r => (kind && r.toLowerCase().includes(kind) ? 2 : 0) + (r.toLowerCase().includes('body') ? 1 : 0) - (/head|hat/i.test(r) && kind !== 'head' ? 1 : 0);
  refs.sort((a, b) => score(b) - score(a));
  for (const c of [msName, ...refs]) {
    const real = lower.get(c.toLowerCase() + '.tex'); if (!real) continue;
    if (texCache.has(real)) return texCache.get(real);
    try { const r = texToPng(fs.readFileSync(path.join(dir, real))); const f = 'wear_' + real.replace(/\.tex$/i, '.png'); fs.writeFileSync(path.join(out, f), r.png); texCache.set(real, f); return f; } catch {}
  }
  return null;
}
for (const g of ['M', 'W']) for (const [job, set] of Object.entries(JOBSETS)) {
  const pieces = [`${g}_Face`, ...['head', 'body', 'leg', 'foot'].map(p => `${g}_${set}_${p}`)];
  const parts = [];
  for (const p of pieces) {
    const real = lower.get(p.toLowerCase() + '.ms1'); if (!real) { console.log('缺', p); continue; }
    const buf = fs.readFileSync(path.join(dir, real));
    const tex = texFor(real.slice(0, -4), buf);
    const ps = parseMs1(buf);
    // 蒙皮：檔尾的權重表屬於最後一個不綁骨的部位；綁骨的部位整塊跟著那根骨頭
    const skin = ps.length && !ps[ps.length - 1].bone ? parseSkin(buf, ps[ps.length - 1].pos.length / 3) : null;
    for (const { at, ...pt } of ps) {
      const nv = pt.pos.length / 3, si = [], sw = [];
      let bi = SKEL[g].findIndex(b => b.name.toLowerCase() === (pt.bone || '').toLowerCase()); if (bi < 0) bi = SKEL[g].findIndex(b => b.name === 'Bip01 Pelvis');
      for (let v = 0; v < nv; v++) {
        let inf = (!pt.bone && skin && ps.indexOf(ps.find(q => q.at === at)) === ps.length - 1) ? skin[v].slice().sort((a, b) => b[1] - a[1]).slice(0, 4) : [[bi, 1]];
        const tot = inf.reduce((a, x) => a + x[1], 0);
        for (let k = 0; k < 4; k++) { si.push(inf[k] ? inf[k][0] : 0); sw.push(inf[k] ? +(inf[k][1] / tot).toFixed(3) : 0); }
      }
      if (!pt.bone && !skin) console.log('  沒有權重', p);
      parts.push({ ...pt, tex, piece: p, si, sw });
    }
  }
  const id = `player_${g.toLowerCase()}_${job}`;
  fs.writeFileSync(path.join(out, id + '.json'), JSON.stringify({ name: id, tex: null, skel: `skel_${g.toLowerCase()}`, parts }));
  console.log(id, parts.map(p => `${p.piece}:${p.name}(${p.pos.length / 3}v${p.tex ? '' : ' 無貼圖'})`).join(' '));
}
