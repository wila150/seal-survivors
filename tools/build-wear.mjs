// 穿裝備同步換外觀（11/19 使用者：「穿著甚麼東西就會改變角色穿著嗎？」→ 照 PC）
// 用法：node tools/build-wear.mjs <客戶端 wear 資料夾>
// PC 的對照：服務端 item.scr 第 72 欄＝外觀編號＝客戶端 wear/cha.dat（Seal Online Cha_Grapic File v1）該部位清單的「序號＋1」
//   cha.dat：檔頭 64 bytes；之後每段 u32 筆數 N ＋ N×32 bytes 名稱（第 1 筆是段名：M_body、W_body、M_head、W_head、M_Leg、W_Leg、M_Foot、W_Foot、L_、R_、A_、G_…）
//   驗證：木製大劍 22 → R_Bgaa、木製匕首 38 → R_Ssaa、鎚 73 → R_Mcac（跟角色本來拿的原版武器一樣）；皮製上衣 16 → M_Body_Ag、皮衣下褲 15 → M_Leg_Ag（同一套）
// 輸出：
//   assets/models/pcw_<模型>.json  身上部位（跟 player_*.json 同格式，骨架 skel_m／skel_w，部位帶蒙皮）
//   assets/models/wpn_<模型>.json  武器／盾（綁骨頭，跟現有 wpn_R_Bgaa 同格式）
//   src/1_data/pc-wear.js          PC 道具編號 → [男模型, 女模型]
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { parseMs1, texToPng } from './seal-model.mjs';
import { parseBn1, parseSkin } from './seal-anim.mjs';
import { PC_ITEMS } from '../src/1_data/pc-items.js';
import { COSTUMES } from '../src/1_data/costumes.js'; // 11/21 PC 時裝（tools/build-costumes.mjs）

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), OUT = path.join(ROOT, 'assets/models');
const dir = process.argv[2]; if (!dir) { console.log('用法：node tools/build-wear.mjs <wear 資料夾>'); process.exit(1); }
const files = fs.readdirSync(dir), lower = new Map(files.map(f => [f.toLowerCase(), f]));
const ACTOR = path.join(dir, '..', 'actor');
const SKEL = { M: parseBn1(fs.readFileSync(path.join(ACTOR, 'Man_All.bn1'))), W: parseBn1(fs.readFileSync(path.join(ACTOR, 'Woman_all.bn1'))) };

// cha.dat
const cb = fs.readFileSync(path.join(dir, lower.get('cha.dat'))); let o = 0x40; const CHA = {};
while (o + 4 <= cb.length) { const n = cb.readUInt32LE(o); if (n <= 0 || n > 5000) break; o += 4; const l = []; for (let i = 0; i < n; i++) { l.push(cb.toString('latin1', o, o + 32).split('\0')[0]); o += 32; } CHA[l[0]] = l.slice(1); }
// PC 道具類別 → cha.dat 段（男, 女）
const SEC = { 15: ['M_body', 'W_body'], 16: ['M_body', 'W_body'], 25: ['M_Leg', 'W_Leg'], 26: ['M_Leg', 'W_Leg'], 19: ['M_Foot', 'W_Foot'], 20: ['M_Foot', 'W_Foot'],
  17: ['M_head', 'W_head'], 18: ['M_head', 'W_head'], 14: ['L_', 'L_'], 4: ['R_', 'R_'], 6: ['R_', 'R_'], 7: ['R_', 'R_'], 8: ['R_', 'R_'], 9: ['R_', 'R_'], 11: ['R_', 'R_'], 46: ['R_', 'R_'], 51: ['R_', 'R_'] };

const texCache = new Map();
function texFor(msName, buf) {
  const refs = [...buf.toString('latin1', 0, Math.min(buf.length, 20000)).matchAll(/([A-Za-z0-9_\-]+)\.(tga|jpg|bmp|dds|png|psd)/gi)].map(m => m[1]);
  for (const c of [msName, ...refs]) {
    const real = lower.get(c.toLowerCase() + '.tex'); if (!real) continue;
    if (texCache.has(real)) return texCache.get(real);
    try { const r = texToPng(fs.readFileSync(path.join(dir, real))); const f = 'wear_' + real.replace(/\.tex$/i, '.png'); if (!fs.existsSync(path.join(OUT, f))) fs.writeFileSync(path.join(OUT, f), r.png); texCache.set(real, f); return f; } catch {}
  }
  return null;
}
// 身上部位：跟 build-players.mjs 一樣（檔尾權重屬於最後一個不綁骨的部位，其他整塊跟骨頭）
function bodyPiece(name, g) {
  const real = lower.get(name.toLowerCase() + '.ms1'); if (!real) return null;
  const buf = fs.readFileSync(path.join(dir, real)), tex = texFor(name, buf), ps = parseMs1(buf); if (!ps.length) return null;
  const skin = !ps[ps.length - 1].bone ? parseSkin(buf, ps[ps.length - 1].pos.length / 3) : null, S = SKEL[g], parts = [];
  ps.forEach(({ at, ...pt }, idx) => {
    if (/^tag/i.test(pt.name)) return;
    const nv = pt.pos.length / 3, si = [], sw = [];
    let bi = S.findIndex(b => b.name.toLowerCase() === (pt.bone || '').toLowerCase()); if (bi < 0) bi = S.findIndex(b => b.name === (/head|hat|hair/i.test(name) ? 'Bip01 Head' : 'Bip01 Pelvis'));
    for (let v = 0; v < nv; v++) {
      const inf = (!pt.bone && skin && idx === ps.length - 1) ? skin[v].slice().sort((a, b) => b[1] - a[1]).slice(0, 4) : [[bi, 1]], tot = inf.reduce((a, x) => a + x[1], 0) || 1;
      for (let k = 0; k < 4; k++) { si.push(inf[k] ? inf[k][0] : 0); sw.push(inf[k] ? +(inf[k][1] / tot).toFixed(3) : 0); }
    }
    parts.push({ ...pt, tex, piece: name, si, sw });
  });
  return { name: `pcw_${g.toLowerCase()}_${name}`, tex: null, skel: `skel_${g.toLowerCase()}`, parts }; // 檔名帶性別：H_ 帽子類男女同名但骨架不同
}
// 武器／盾：綁骨頭的模型（跟現有 wpn_*.json 一樣：部位帶 bone）
function gearPiece(name) {
  const real = lower.get(name.toLowerCase() + '.ms1'); if (!real) return null;
  const buf = fs.readFileSync(path.join(dir, real)), ps = parseMs1(buf); if (!ps.length) return null;
  const tex = texFor(name, buf);
  return { name: 'wpn_' + name, tex, parts: ps.map(({ at, ...p }) => p) };
}

const MAP = {}, done = new Map(); let nb = 0, ng = 0, miss = 0;
for (const [t, list] of Object.entries(PC_ITEMS)) {
  const sec = SEC[t]; if (!sec) continue;
  for (const it of list) {
    const idx = it[5]; if (!idx) continue;
    const names = sec.map(s => CHA[s]?.[idx - 1] || null), out = [];
    for (let k = 0; k < 2; k++) {
      const n = names[k]; if (!n) { out.push(null); continue; }
      const gear = sec[k] === 'R_' || sec[k] === 'L_', key = (gear ? 'wpn_' : 'pcw_') + n + (gear ? '' : '|' + 'MW'[k]);
      if (!done.has(key)) {
        const d = gear ? gearPiece(n) : bodyPiece(n, 'MW'[k]);
        if (d) { fs.writeFileSync(path.join(OUT, d.name + '.json'), JSON.stringify(d)); gear ? ng++ : nb++; } else miss++;
        done.set(key, d ? d.name : null);
      }
      out.push(done.get(key));
    }
    if (out[0] || out[1]) MAP[it[0]] = out;
  }
}
// 11/21 PC 時裝：部位 → cha.dat 段（外觀編號規則跟一般裝備一樣）
const CSEC = { head: ['M_head', 'W_head'], top: ['M_body', 'W_body'], bottom: ['M_Leg', 'W_Leg'], shoes: ['M_Foot', 'W_Foot'] };
let nc = 0;
for (const [id, x] of Object.entries(COSTUMES)) {
  const sec = CSEC[x[1]], idx = x[2], out = [];
  for (let k = 0; k < 2; k++) {
    const n = CHA[sec[k]]?.[idx - 1]; if (!n) { out.push(null); continue; }
    const key = 'pcw_' + n + '|' + 'MW'[k];
    if (!done.has(key)) { const d = bodyPiece(n, 'MW'[k]); if (d) { fs.writeFileSync(path.join(OUT, d.name + '.json'), JSON.stringify(d)); nb++; } else miss++; done.set(key, d ? d.name : null); }
    out.push(done.get(key));
  }
  if (out[0] || out[1]) { MAP[id] = out; nc++; }
}
console.log(`時裝有外觀 ${nc} 件`);
fs.writeFileSync(path.join(ROOT, 'src/1_data/pc-wear.js'), `// 自動產生，不要手改（node tools/build-wear.mjs <wear 資料夾>）\n// PC 道具編號 → [男角外觀模型, 女角外觀模型]（assets/models/<名>.json；pcw_＝身上部位、wpn_＝武器／盾）\nexport const PC_WEAR = ${JSON.stringify(MAP)};\n`);
console.log(`外觀：身上部位 ${nb}、武器／盾 ${ng}、找不到模型 ${miss}；有外觀的道具 ${Object.keys(MAP).length}`);
