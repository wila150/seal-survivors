// 原版技能特效轉檔（企劃_工程交付 項目 5）：node tools/build-skillfx.mjs <客戶端 SealClient 資料夾>
// 讀 skill/skillScript.dat（每招：施放 NodeType 0、飛行 1、命中 2 各用哪個網格＋動畫），
// 轉出我們技能用到的特效：assets/skillfx/<網格>.json＋貼圖 assets/skillfx/tex/*.png，對照表 assets/skillfx/index.json
//
// 格式（11/18 解出）：
//   .ms1 檔頭：u32 版本, u32 材質數 M；材質記錄 587 bytes（第一筆從 0x0a 起）：貼圖檔名（256）、材質名 +256（128）、套用的材質腳本名 +384
//   部位檔頭（頂點前）：u32 材質編號、u32 −1、f32、接著 4×4 放置矩陣（D3D 列優先，THREE.fromArray 直接用）；頂點是世界座標
//   .an1：節點名＝部位名（大小寫不同），位置／旋轉／縮放是絕對值（沒有父節點）
//   材質腳本 skill/*.shader、sfx/*.shader（Quake 風格）：map／animmap、blendfunc、rgbGen、alphaGen、tcMod
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { parseMs1, texToPng, png } from './seal-model.mjs';
import { parseAn1 } from './seal-anim.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLIENT = process.argv[2];
if (!CLIENT) { console.log('用法：node tools/build-skillfx.mjs <SealClient 資料夾>'); process.exit(1); }
const OUT = path.join(ROOT, 'assets/skillfx'), TEXOUT = path.join(OUT, 'tex');
fs.mkdirSync(TEXOUT, { recursive: true });

// 我們的技能 → 原版腳本名稱（? ＝照名稱猜的，待使用者確認）
export const MAP = {
  // 劍士
  liuyun: 'SkillGgang?', xuanfeng: 'SkillGiantSwing?', jifeng: 'SkillSplashSword?', guangsu: 'SkillLightingSlash',
  // 騎士
  shizi: 'SkillGrandSword', bafang: 'SkillDotImpact', dunpai: 'SkillThrowShield', shenjian: 'SkillSouthernCross',
  // 小丑
  renyi: 'SkillAnyThrow', suiyi: 'SkillJumpDeager?', duzhi: 'SkillPoisonDagger', cuimian: 'SkillConfusion?',
  // 法師
  bingjian: 'SkillIceEger', huofeng: 'SkillFireStorm', bingzhu: 'SkillIceDrill', huojing: 'SkillDancingflame?',
  // 祭司
  qianze: 'SkillBlessSwing?', shengguang: 'SkillBless?', shenpan: 'SkillMight?', tianqian: 'SkillStunSword?',
  // 鐵匠
  zhiming: 'SkillStrike', zhadan: 'SkillBombing', duozhong: 'SkillMultyGrinding', huimie: 'SkillABlowDestroy',
  // 二轉（舊的 6 招）
  jianwu: 'SkillBladedance', shenhan: 'SkillShockwave', tiannv: 'SkillCardtrick', hanbing: 'SkillIcecannon', shenpan2: 'SkillJudgement', quanmian: 'SkillFullsmash',
  // 二轉 24 招
  k2_yiwang: 'SkillIlmang', k2_fennu: 'SkillMadness', k2_tuji: 'SkillCharge', k2_xixue: 'SkillBloodSucking',
  k2_chongji: 'SkillShockimpact', k2_quanli: 'SkillDeathcrash', k2_baofeng: 'SkillTornado', k2_tianbeng: 'SkillCrusade',
  k2_anying: 'SkillSlug', k2_judu: 'SkillPoisonCrush', k2_fenli: 'SkillAllin', k2_heijieke: 'SkillBlackjack',
  k2_bingfeng: 'SkillMegafreeze', k2_qixuan: 'SkillIcecoil', k2_huochong: 'SkillGigaflame', k2_dihuo: 'SkillEarthquake',
  k2_chanhui: 'SkillRepentance', k2_shangdi: 'SkillHandOfGod', k2_qumo: 'SkillExorcism', k2_tianshi: 'SkillAngelsWhisper',
  k2_dingshi: 'SkillTimebomb', k2_zhiming2: 'SkillMortalstrike', k2_jiangchui: 'SkillHammerpolishing', k2_zhilian: 'SkillImprovedweapon?',
  // 三轉（項目 40，claude-13 對：英文名對中文名；? ＝猜的）神的加護、全壘打擊、飛天槌擊找不到對應腳本 → 用一般特效
  k3_yuanhua: 'SkillBladerondo', k3_bingleng: 'SkillFrozengale', k3_huoyan: 'SkillFlamegale', k3_shengyu: 'SkillSanctuary', k3_weixie: 'SkillMenacingdraw',
  k3_heizhou: 'SkillDamnation', k3_duanjue: 'SkillMutilate', k3_renjian: 'SkillTranscendentblades?', k3_tianfa: 'SkillScourge?', // k3_feitian：試過 SkillBomberman，腳本裡沒有
  // 項目 45 獵人：一轉／二轉弓箭手（Arrow）／二轉槍手（Shot）照技能名稱對原版腳本，? ＝猜的
  b_hunter: 'Hunter_Attack_00', luanshe: 'SkillMultiShot', shuangzi: 'SkillDoubleshot', baodan: 'SkillBuckshot?', hongxin: 'SkillPowershot?',
  k2_guanchuan: 'SkillPiercingArrow', k2_baoyu: 'SkillBombArrow?', k3_jianshi: 'SkillArrowsquall', k2_zhimiao: 'SkillAimingShot', k2_hunxuan: 'SkillChargeShot?', k3_huoli: 'SkillHeadShot?',
  levelup: 'LevelUP', // 不是技能：升級時在玩家身上播（sfx/levelUP）
  monrejen: 'MonReJen', bigkill: 'BigKill', bigitem: 'BigItem', // 不是技能：首領／菁英出現、打倒首領、撿到首領寶箱
};

// ---------- 技能腳本 ----------
const script = new TextDecoder('euc-kr').decode(fs.readFileSync(path.join(CLIENT, 'skill/skillScript.dat')));
function scriptNodes(name) {
  const lines = script.split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '').trim());
  let i = lines.findIndex(l => l.split(/\s+/)[0] === name); if (i < 0) return null;
  let depth = 0, node = null; const nodes = [];
  for (i++; i < lines.length; i++) {
    const l = lines[i]; if (!l) continue;
    if (l.startsWith('{')) { depth++; if (depth === 2) node = { type: 0, time: 0, delay: 0, mesh: null, ani: null, pos: [0, 0, 0], billboard: 0, loop: 1 }; continue; }
    if (l.startsWith('}')) { if (depth === 2 && node) nodes.push(node); depth--; if (depth <= 0) break; continue; }
    if (depth !== 2 || !node) continue;
    const [k, ...v] = l.split(/\s+/);
    if (k === 'NodeType') node.type = +v[0]; else if (k === 'NodeTime') node.time = Math.max(node.time, +v[0] || 0); else if (k === 'DelayTime') node.delay = +v[0] || 0;
    else if (k === 'SoundName') node.sound = v[0];
    else if (k === 'MeshName') node.mesh = v[0]; else if (k === 'AniName') node.ani = v[0]; else if (k === 'Position') node.pos = v.slice(0, 3).map(Number);
    else if (k === 'Billboard' || k === 'ViewSet') node.billboard = +v[0] || 0; else if (k === 'Loop') node.loop = +v[0];
  }
  const r = nodes.filter(n => n.mesh && n.mesh !== 'MeshName'); r.sounds = nodes.filter(n => n.sound && n.sound !== 'SoundName'); return r;
}

// ---------- 材質腳本 ----------
const shaders = new Map();
for (const dir of ['skill', 'sfx']) for (const f of fs.readdirSync(path.join(CLIENT, dir)).filter(f => /\.(shader|sha)$/i.test(f))) {
  const txt = fs.readFileSync(path.join(CLIENT, dir, f), 'latin1').replace(/\r/g, '').replace(/\/\/.*$/gm, '');
  const re = /([^\s{}]+)\s*\{([\s\S]*?\{[\s\S]*?\})\s*\}/g; let m;
  while ((m = re.exec(txt))) {
    const body = m[2], sh = { name: m[1] };
    const g = (rx) => body.match(rx);
    let x;
    if ((x = g(/\banimmap\s+([\d.]+)\s+([^\n]+)/i))) { sh.fps = +x[1]; sh.frames = x[2].trim().split(/\s+/).map(s => s.replace(/\.\w+$/, '').split(/[\\/]/).pop()); }
    else if ((x = g(/\b(?:clamp)?map\s+([^\s]+)/i))) sh.map = x[1].replace(/\.\w+$/, '').split(/[\\/]/).pop();
    if ((x = g(/\bblendfunc\s+([^\n]+)/i))) { const b = x[1].trim().toLowerCase(); sh.blend = /^(add|gl_one gl_one|gl_src_alpha gl_one|gl_src_color gl_one)/.test(b) ? 'add' : /^(blend|gl_src_alpha gl_one_minus_src_alpha)/.test(b) ? 'blend' : /filter|gl_dst_color|gl_zero gl_src_color/.test(b) ? 'mul' : 'add'; }
    if ((x = g(/\brgbGen\s+const\s*\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/i))) sh.color = [+x[1], +x[2], +x[3]];
    if ((x = g(/\brgbGen\s+wave\s+(\w+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/i))) sh.rgbWave = [x[1].toLowerCase(), +x[2], +x[3], +x[4], +x[5]];
    if ((x = g(/\balphaGen\s+wave\s+(\w+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/i))) sh.alphaWave = [x[1].toLowerCase(), +x[2], +x[3], +x[4], +x[5]];
    if ((x = g(/\btcMod\s+scroll\s+([-\d.]+)\s+([-\d.]+)/i))) sh.scroll = [+x[1], +x[2]];
    if ((x = g(/\btcMod\s+rotate\s+([-\d.]+)/i))) sh.rotate = +x[1];
    if ((x = g(/\btcMod\s+scale\s+([-\d.]+)\s+([-\d.]+)/i))) sh.tscale = [+x[1], +x[2]];
    if (/\balphaFunc\b/i.test(body)) sh.cutout = true;
    shaders.set(sh.name.toLowerCase(), sh);
  }
}

// ---------- 貼圖 ----------
const texIndex = new Map();
for (const dir of ['skill', 'sfx', 'etc', 'interface', 'monster', 'map', 'actor', 'item', 'resource', 'wear']) {
  let files = []; try { files = fs.readdirSync(path.join(CLIENT, dir)); } catch { continue; }
  // 同名時優先 .tex，再來 .dds、.tga
  const rank = e => ({ tex: 0, dds: 1, tga: 2 })[e.toLowerCase()];
  for (const f of files) { const m = f.match(/^(.*)\.(tex|dds|tga)$/i); if (!m) continue; const k = m[1].toLowerCase(), old = texIndex.get(k);
    if (!old || rank(m[2]) < rank(path.extname(old).slice(1))) texIndex.set(k, path.join(CLIENT, dir, f)); }
}
// TGA（未壓縮 type 2／RLE type 10，24／32 bit）
function tgaToPng(b) {
  const idl = b[0], type = b[2], w = b.readUInt16LE(12), h = b.readUInt16LE(14), bpp = b[16] / 8, top = b[17] & 0x20;
  if (![2, 10].includes(type) || ![3, 4].includes(bpp)) return null;
  const px = Buffer.alloc(w * h * 4); let o = 18 + idl, i = 0;
  const put = s => { const y = Math.floor(i / w), x = i % w, row = top ? y : h - 1 - y, d = (row * w + x) * 4; px[d] = b[s + 2]; px[d + 1] = b[s + 1]; px[d + 2] = b[s]; px[d + 3] = bpp === 4 ? b[s + 3] : 255; i++; };
  if (type === 2) while (i < w * h) { put(o); o += bpp; }
  else while (i < w * h) { const c = b[o++], n = (c & 127) + 1; if (c & 128) { for (let k = 0; k < n; k++) put(o); o += bpp; } else for (let k = 0; k < n; k++) { put(o); o += bpp; } }
  let clear = 0; for (let k = 3; k < px.length; k += 4) if (px[k] < 128) clear++;
  if (bpp === 4 && clear === w * h) for (let k = 3; k < px.length; k += 4) px[k] = 255; // alpha 全 0＝沒用透明
  return { w, h, png: png(w, h, px) };
}
const texDone = new Map();
function texture(base) {
  if (!base) return null; const key = base.split(/[\\/]/).pop().toLowerCase(); if (texDone.has(key)) return texDone.get(key);
  let out = null; const f = texIndex.get(key);
  if (f) try {
    const buf = fs.readFileSync(f), ext = path.extname(f).toLowerCase();
    const r = ext === '.tex' ? texToPng(buf, true) : ext === '.dds' ? texToPng(Buffer.concat([Buffer.alloc(0x44), buf]), true) : tgaToPng(buf);
    if (r) { out = key.replace(/[^a-z0-9_\-]/g, '_') + '.png'; fs.writeFileSync(path.join(TEXOUT, out), r.png); }
  } catch {}
  texDone.set(key, out); return out;
}
function material(b, i) {
  const o = 10 + i * 587;
  const tex = b.toString('latin1', o, o + 256).split('\0')[0].replace(/\.\w+$/, ''), n1 = b.toString('latin1', o + 256, o + 384).split('\0')[0], n2 = b.toString('latin1', o + 384, o + 448).split('\0')[0];
  // 第三個名稱（+386）才是真正套用的材質腳本（例：E_Wind_A002_Red 紅色版），其次材質名、貼圖名
  const sh = shaders.get(n2.toLowerCase()) || shaders.get(n1.toLowerCase()) || shaders.get(tex.toLowerCase()) || {};
  const m = { blend: sh.blend || 'add' };
  if (sh.frames) { m.frames = sh.frames.map(texture).filter(Boolean); m.fps = sh.fps; }
  m.tex = texture(sh.map) || texture(tex) || texture(n1) || texture(n2) || m.frames?.[0] || null;
  for (const k of ['color', 'rgbWave', 'alphaWave', 'scroll', 'rotate', 'tscale', 'cutout']) if (sh[k] !== undefined) m[k] = sh[k];
  return m;
}

// ---------- 特效網格＋動畫 ----------
const meshDone = new Map();
function buildMesh(name) {
  if (meshDone.has(name)) return meshDone.get(name);
  // skill/ 找不到就找 sfx/（升級特效 levelUP 在 sfx/）
  const dir = ['skill', 'sfx'].find(d => fs.existsSync(path.join(CLIENT, d, name + '.ms1'))); if (!dir) { meshDone.set(name, false); return false; }
  const f = path.join(CLIENT, dir, name + '.ms1');
  const b = fs.readFileSync(f), nm = b.readUInt32LE(4), mats = []; for (let i = 0; i < nm; i++) mats.push(material(b, i));
  let an = null; try { an = parseAn1(fs.readFileSync(path.join(CLIENT, dir, name + '.an1'))); } catch {}
  const nodes = new Map(Object.entries(an?.nodes || {}).map(([k, v]) => [k.toLowerCase(), v]));
  const T = 4800; let dur = 0;
  const parts = parseMs1(b).filter(p => !/^tag/i.test(p.name)).map(p => {
    const h = p.at + 0x209, mat = b.readUInt32LE(h);
    const rest = []; for (let i = 0; i < 16; i++) rest.push(+b.readFloatLE(h + 12 + i * 4).toFixed(5));
    const n = nodes.get(p.name.toLowerCase()), anim = {};
    if (n) {
      if (n.pos.length) { anim.pt = n.pos.map(k => +(k[0] / T).toFixed(4)); anim.p = n.pos.flatMap(k => k.slice(1).map(v => +v.toFixed(4))); }
      if (n.rot.length) { anim.qt = n.rot.map(k => +(k[0] / T).toFixed(4)); anim.q = n.rot.flatMap(k => k.slice(1).map(v => +v.toFixed(5))); }
      if (n.scl?.length) { anim.st = n.scl.map(k => +(k[0] / T).toFixed(4)); anim.s = n.scl.flatMap(k => k.slice(1).map(v => +v.toFixed(4))); }
      for (const t of [anim.pt, anim.qt, anim.st]) if (t?.length) dur = Math.max(dur, t[t.length - 1]);
    }
    return { name: p.name, mat: Math.min(mat, nm - 1), rest, pos: p.pos, uv: p.uv, idx: p.idx, anim, billboard: /billboard/i.test(p.name) || undefined };
  });
  if (!parts.length) { meshDone.set(name, false); return false; }
  fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify({ name, dur: dur || 1, mats, parts }));
  meshDone.set(name, true); return true;
}

const SND = path.join(CLIENT, 'sound'), sndIndex = new Map(fs.readdirSync(SND).map(f => [f.toLowerCase(), f]));
const SOUT = path.join(OUT, '..', 'sfx', 'skill'); fs.mkdirSync(SOUT, { recursive: true });
const SFXDIR = path.join(CLIENT, 'sfx'), sfxIndex = new Map(fs.readdirSync(SFXDIR).map(f => [f.toLowerCase(), f]));
function soundFile(n) { const k = n.toLowerCase() + '.wav', src = sndIndex.has(k) ? path.join(SND, sndIndex.get(k)) : sfxIndex.has(k) ? path.join(SFXDIR, sfxIndex.get(k)) : null; if (!src) return null;
  if (!fs.existsSync(path.join(SOUT, k))) fs.copyFileSync(src, path.join(SOUT, k)); return k; }
const index = {}, missing = [];
for (const [key, raw] of Object.entries(MAP)) {
  const sname = raw.replace('?', ''), nodes = scriptNodes(sname);
  if (!nodes) { missing.push(`${key}：腳本沒有 ${sname}`); continue; }
  const pick = t => nodes.filter(n => n.type === t && buildMesh(n.mesh)).map(n => ({ mesh: n.mesh, time: n.time || undefined, delay: n.delay || undefined, y: n.pos[1] || undefined, billboard: n.billboard || undefined }));
  const e = { script: sname, guess: raw.endsWith('?') || undefined, cast: pick(0), fly: pick(1), hit: pick(2) };
  if (!e.cast.length && !e.fly.length && !e.hit.length) { missing.push(`${key}：${sname} 的網格都轉不出來`); continue; }
  // 原版音效（腳本 SoundName）：每段取第一個，抄到 assets/sfx/skill/
  const snd = {}; for (const [st, ty] of [['cast', 0], ['fly', 1], ['hit', 2]]) { const n = nodes.sounds.find(x => x.type === ty); const f = n && soundFile(n.sound); if (f) snd[st] = f; }
  if (key === 'levelup' && !snd.cast) { const f = soundFile('levelup'); if (f) snd.cast = f; } // 升級音效在 sfx/levelup.wav，腳本沒寫
  if (Object.keys(snd).length) e.sound = snd;
  index[key] = e;
}
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 1));
console.log(`技能特效：${Object.keys(index).length}/${Object.keys(MAP).length} 招、網格 ${[...meshDone.values()].filter(Boolean).length}、貼圖 ${[...texDone.values()].filter(Boolean).length}（找不到 ${[...texDone.values()].filter(v => !v).length}）`);
console.log('缺貼圖：' + [...texDone].filter(([, v]) => !v).map(([k]) => k).slice(0, 40).join(' '));
if (missing.length) console.log('沒轉到：\n  ' + missing.join('\n  '));
