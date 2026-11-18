// 怪物／NPC 轉成會動的模型（企劃_工程交付 項目 6）：node tools/build-mobs.mjs <SealClient> [模型名…]
// 沒給模型名＝遊戲用到的全部（game.js 的 ENEMY_TYPES、monsters.js、town.html 的 NPC、boss 模型）
// 每隻怪在客戶端 monster/ 有自己的 .bn1 骨架＋ .act 動作清單（Ta<代碼>pi 站、fw 走、rn 跑、f1 攻擊、dd 倒下、ms 受擊；
// 首領／NPC 用 _stand、_attack、_die 之類的名字）
// 蒙皮權重不在檔尾：在「沒綁骨的部位」面資料後面某處 → skinAt() 往後找一段讀得通的 (B, B×(n, n×權重, n×頂點))
// 輸出（跟玩家同格式，seal-model.js 的 sealActor／sealMob 直接用）：
//   assets/models/mob_<模型>.json { name, skel, parts:[{pos,nor,uv,idx,tex,si,sw}] }、assets/models/skel_<模型>.json
//   assets/anims/<動作檔>.json、assets/anims/sets.json 加 mob_<模型>：{ pi, rn, f1, dd, ms }
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { parseMs1 } from './seal-model.mjs';
import { parseBn1, parseAn1 } from './seal-anim.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const [client, ...want] = process.argv.slice(2);
if (!client) { console.log('用法：node tools/build-mobs.mjs <SealClient> [模型名…]'); process.exit(1); }
const DIRS = ['monster', 'npc'].map(d => path.join(client, d)).filter(d => fs.existsSync(d));
const index = new Map(); for (const d of DIRS) for (const f of fs.readdirSync(d)) if (!index.has(f.toLowerCase())) index.set(f.toLowerCase(), path.join(d, f));
const find = n => index.get(n.toLowerCase());

function usedModels() {
  const src = ['game.js', 'src/1_data/monsters.js', 'town.html', 'src/2_core/game-manager.js'].map(f => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } }).join('\n');
  return [...new Set([...src.matchAll(/(?:model:\s*|:\s*)'((?:T|N|M|boss)_[A-Za-z0-9_]+)'/g)].map(m => m[1]))];
}

export function skinAt(b, from, to, nv, NB) {
  for (let s = from; s < to - 4; s++) {
    const B = b.readUInt32LE(s); if (B < 1 || B > NB) continue;
    let o = s + 4, ok = true; const w = Array.from({ length: nv }, () => []);
    for (let k = 0; k < B && ok; k++) {
      if (o + 4 > b.length) { ok = false; break; }
      const n = b.readUInt32LE(o); o += 4; if (n > nv || o + n * 8 > b.length) { ok = false; break; }
      for (let i = 0; i < n; i++) { const v = b.readUInt32LE(o + (n + i) * 4), wt = b.readFloatLE(o + i * 4); if (v >= nv || !(wt >= 0 && wt <= 1.001)) { ok = false; break; } w[v].push([k, wt]); }
      o += n * 8;
    }
    if (ok && w.every(x => x.length)) return w;
  }
  return null;
}

// 動作名稱 → 用途
const KIND = [['pi', /(pi|stand|wait)$/i], ['fw', /(fw|walk)$/i], ['rn', /(rn|run)$/i], ['f1', /(f1|attack|att0?1)$/i], ['dd', /(dd|die|dead)$/i], ['ms', /(ms|damage|hit)$/i]];
const kindOf = n => KIND.find(([, r]) => r.test(n))?.[0];

const SND = path.join(client, 'sound'), sndIndex = new Map(fs.readdirSync(SND).map(f => [f.toLowerCase(), f]));
fs.mkdirSync(path.join(ROOT, 'assets/sfx/mob'), { recursive: true });
const mobSounds = {}; // 模型 → { f1 攻擊, dd 倒下, ms 受擊 } 原版音效
const setsFile = path.join(ROOT, 'assets/anims/sets.json');
const sets = JSON.parse(fs.readFileSync(setsFile, 'utf8'));
const T = 160 * 30;
let ok = 0;
for (const model of (want.length ? want : usedModels())) {
  const msF = find(model + '.ms1'), bnF = find(model + '.bn1');
  if (!msF || !bnF) { console.log(`${model}：沒有骨架／模型，維持靜態`); continue; }
  const skel = parseBn1(fs.readFileSync(bnF)); const buf = fs.readFileSync(msF), ps = parseMs1(buf);
  // 動作檔：.act 清單＋同名開頭的 .an1
  const base = model.replace(/_(stand|attack|walk|pi)$/i, '');
  const names = new Set();
  // .act：動作名後面的 [xxx] 是這個動作的音效（sound/xxx.wav），例：Tabyf1 [monster7001]
  const sndOf = {};
  for (const a of [model, base, base.replace(/^T_/i, 't_')]) { const f = find(a + '.act'); if (!f) continue; let curAn = null;
    for (const m of fs.readFileSync(f, 'latin1').matchAll(/(\[)?([A-Za-z0-9_]{3,})/g)) {
      if (m[1]) { if (curAn && !sndOf[curAn] && sndIndex.has(m[2].toLowerCase() + '.wav')) sndOf[curAn] = m[2].toLowerCase(); continue; }
      const an = find(m[2] + '.an1'); if (an) { names.add(an); curAn = path.basename(an, path.extname(an)).toLowerCase(); } } }
  // 沒寫在 .act 的：<模型>_xx.an1、或原版縮寫 Ta<名>xx／Na<名>xx（例：飛天豬 Taba1pi、強化師 Naoldminer）
  const short = base.replace(/^([TN])_/i, (m, c) => c.toLowerCase() + 'a').toLowerCase();
  for (const [k, f] of index) if (k.endsWith('.an1') && (k.startsWith(base.toLowerCase() + '_') || k === model.toLowerCase() + '.an1' || (k.startsWith(short) && /^(pi|fw|rn|f1|dd|ms)?\.an1$/.test(k.slice(short.length))))) names.add(f);
  const set = {};
  for (const f of names) {
    const id = path.basename(f, path.extname(f));
    let k = kindOf(id) || ([model.toLowerCase(), short].includes(id.toLowerCase()) ? (/attack$/i.test(model) ? 'f1' : 'pi') : null); if (!k || set[k]) continue;
    const an = parseAn1(fs.readFileSync(f));
    const tracks = Object.entries(an.nodes).map(([bone, n]) => ({ bone,
      pt: n.pos.map(q => +(q[0] / T).toFixed(4)), p: n.pos.flatMap(q => q.slice(1).map(v => +v.toFixed(4))),
      qt: n.rot.map(q => +(q[0] / T).toFixed(4)), q: n.rot.flatMap(q => q.slice(1).map(v => +v.toFixed(5))) })).filter(t => t.pt.length || t.qt.length);
    if (!tracks.length) continue;
    fs.writeFileSync(path.join(ROOT, 'assets/anims', id + '.json'), JSON.stringify({ name: id, dur: an.endFrame / 30, tracks }));
    set[k] = id;
  }
  const snd = {}; for (const k of ['f1', 'dd', 'ms']) { const w = set[k] && sndOf[set[k].toLowerCase()]; if (w) { const o = path.join(ROOT, 'assets/sfx/mob', w + '.wav'); if (!fs.existsSync(o)) fs.copyFileSync(path.join(SND, sndIndex.get(w + '.wav')), o); snd[k] = w + '.wav'; } }
  if (Object.keys(snd).length) mobSounds[model] = snd;
  if (!set.pi) set.pi = set.fw || set.rn; if (!set.rn) set.rn = set.fw || set.pi; delete set.fw;
  if (!set.pi) { console.log(`${model}：找不到動作，維持靜態`); continue; }
  // 網格＋權重
  let old = null; try { old = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/models', model + '.json'))); } catch {}
  const parts = []; let noSkin = 0;
  ps.forEach((p, i) => {
    const nv = p.pos.length / 3, si = [], sw = [];
    let bi = skel.findIndex(b => b.name.toLowerCase() === (p.bone || '').toLowerCase()); if (bi < 0) bi = 0;
    const w = p.bone ? null : skinAt(buf, p.end, i + 1 < ps.length ? ps[i + 1].at : buf.length, nv, skel.length);
    if (!p.bone && !w) noSkin++;
    for (let v = 0; v < nv; v++) {
      // 沒有權重的「沒綁骨部位」（例：咕咕 T_by）：每個頂點綁到站姿時最近的骨頭（翅膀、嘴巴才會動）
      const near = !w && !p.bone ? (() => { const x = p.pos[v * 3], y = p.pos[v * 3 + 1], z = p.pos[v * 3 + 2]; let best = 0, bd = Infinity;
        const dist = k => (skel[k].world[12] - x) ** 2 + (skel[k].world[13] - y) ** 2 + (skel[k].world[14] - z) ** 2;
        skel.forEach((b, k) => { const d = dist(k); if (d < bd) { bd = d; best = k; } });
        return best !== bi && bd < dist(bi) * 0.25 ? best : bi; })() : bi; // 明顯比較靠近別根骨頭（距離不到身體骨頭的一半）才綁過去，其他留在身體
      const inf = w ? w[v].slice().sort((a, b) => b[1] - a[1]).slice(0, 4) : [[near, 1]], tot = inf.reduce((a, x) => a + x[1], 0) || 1;
      for (let k = 0; k < 4; k++) { si.push(inf[k] ? inf[k][0] : 0); sw.push(inf[k] ? +(inf[k][1] / tot).toFixed(3) : 0); }
    }
    if (/^tag/i.test(p.name)) return; // tag_＝掛點輔助三角形，不畫
    const tex = old?.parts?.[i]?.tex ?? old?.tex ?? null;
    parts.push({ name: p.name, pos: p.pos, nor: p.nor, uv: p.uv, idx: p.idx, tex, si, sw });
  });
  fs.writeFileSync(path.join(ROOT, 'assets/models', `skel_${model}.json`), JSON.stringify(skel.map(b => ({ name: b.name, parent: skel.findIndex(x => x.name === b.parent), world: b.world.map(v => +v.toFixed(5)) }))));
  fs.writeFileSync(path.join(ROOT, 'assets/models', `mob_${model}.json`), JSON.stringify({ name: model, tex: null, skel: `skel_${model}`, parts }));
  sets['mob_' + model] = set; ok++;
  console.log(`${model}：骨頭 ${skel.length}、部位 ${parts.length}${noSkin ? `（${noSkin} 個找不到權重→每個點綁最近的骨頭）` : ''}、動作 ${Object.entries(set).map(([k, v]) => k + '=' + v).join(' ')}`);
}
fs.writeFileSync(setsFile, JSON.stringify(sets));
fs.writeFileSync(path.join(ROOT, 'assets/sfx/mob/index.json'), JSON.stringify(mobSounds));
console.log(`完成 ${ok} 隻`);
