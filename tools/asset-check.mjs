// 一鍵素材體檢：node tools/asset-check.mjs
// 把會讓遊戲壞掉的素材問題全部列出來；有錯誤時 exit code = 1（企劃_工程交付.md 第三章）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const A = (...p) => path.join(ROOT, 'assets', ...p);
const { JOBS } = await import(pathToFileURL(path.join(ROOT, 'src/1_data/jobs.js')));
const { STAGES } = await import(pathToFileURL(path.join(ROOT, 'src/1_data/stages.js')));
const { MONSTER_MODELS } = await import(pathToFileURL(path.join(ROOT, 'src/1_data/monsters.js')));

const errors = [], warns = [];
const err = (cat, msg) => errors.push([cat, msg]);
const warn = (cat, msg) => warns.push([cat, msg]);
const readJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const pngSize = f => { try { const b = fs.readFileSync(f); return b.toString('ascii', 1, 4) === 'PNG' ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null; } catch { return null; } };
const jsonCache = new Map();
const model = name => { if (!jsonCache.has(name)) jsonCache.set(name, readJson(A('models', name + '.json'))); return jsonCache.get(name); };
// 原始單位的高度（所有部位頂點的 Y 範圍）
function rawHeight(d) {
  let lo = Infinity, hi = -Infinity;
  for (const p of d.parts || []) for (let i = 1; i < (p.pos || []).length; i += 3) { const y = p.pos[i]; if (y < lo) lo = y; if (y > hi) hi = y; }
  return hi - lo;
}

// ===== 1. 模型 JSON 讀得到、每個部位有頂點和面；貼圖 PNG 存在 =====
const modelFiles = fs.readdirSync(A('models')).filter(f => f.endsWith('.json') && f !== 'index.json');
// index.json：模型瀏覽頁（models.html）的清單，列到的都要存在
for (const it of readJson(A('models', 'index.json')) || []) if (!fs.existsSync(A('models', it.id + '.json'))) err('模型清單', `index.json 列了 ${it.id}，但檔案不存在`);
const skelNames = new Set();
for (const f of modelFiles) { const d = model(f.slice(0, -5)); if (d?.skel) skelNames.add(d.skel); }
let modelCount = 0;
for (const f of modelFiles) {
  const name = f.slice(0, -5);
  if (skelNames.has(name)) continue; // 骨架檔（skel_m／skel_w）另外檢查
  modelCount++;
  const d = model(name);
  if (!d) { err('模型', `${f} 讀不到或不是 JSON`); continue; }
  if (!Array.isArray(d.parts) || !d.parts.length) { err('模型', `${name} 沒有任何部位`); continue; }
  d.parts.forEach((p, i) => {
    if (!p.pos?.length || p.pos.length % 3) err('模型', `${name} 部位 ${i}（${p.name ?? ''}）沒有頂點`);
    if (!p.idx?.length || p.idx.length % 3) err('模型', `${name} 部位 ${i}（${p.name ?? ''}）沒有面`);
    const t = p.tex !== undefined ? p.tex : d.tex;
    if (t && !fs.existsSync(A('models', t))) err('貼圖', `${name} 缺貼圖 ${t}`);
  });
}

// ===== 2. 模型高度異常（玩家 0.5～3、怪物 0.05～50）=====
const players = [];
for (const job of Object.values(JOBS)) for (const g of ['m', 'w']) players.push(`player_${g}_${job.model}`);
for (const name of players) {
  const d = model(name); if (!d) { err('玩家模型', `${name}.json 不存在`); continue; }
  const h = rawHeight(d); if (h < 0.5 || h > 3) warn('模型比例', `玩家 ${name} 高度 ${h.toFixed(2)}（應在 0.5～3）`);
}
for (const [mon, name] of Object.entries(MONSTER_MODELS)) {
  const d = model(name); if (!d) continue; // 第 6 項會報
  const h = rawHeight(d); if (h < 0.05 || h > 50) warn('模型比例', `怪物 ${mon}（${name}）高度 ${h.toFixed(2)}（應在 0.05～50）`);
}

// ===== 3. 玩家蒙皮：每個頂點有權重、加總 ≈ 1、骨頭編號 < 骨頭數 =====
for (const name of players) {
  const d = model(name); if (!d) continue;
  const skel = d.skel ? model(d.skel) : null;
  if (!Array.isArray(skel)) { err('蒙皮', `${name} 的骨架 ${d.skel} 讀不到`); continue; }
  const nb = skel.length;
  d.parts.forEach((p, pi) => {
    const nv = p.pos.length / 3;
    if (p.si?.length !== nv * 4 || p.sw?.length !== nv * 4) { err('蒙皮', `${name} 部位 ${pi} 權重數量不對（頂點 ${nv}）`); return; }
    let noW = 0, badSum = 0, badBone = 0;
    for (let v = 0; v < nv; v++) {
      let s = 0; for (let k = 0; k < 4; k++) { const w = p.sw[v * 4 + k]; s += w; if (w > 0 && !(p.si[v * 4 + k] < nb)) badBone++; }
      if (s <= 0) noW++; else if (Math.abs(s - 1) > 0.02) badSum++;
    }
    if (noW) err('蒙皮', `${name} 部位 ${pi}：${noW} 個頂點沒有權重`);
    if (badSum) err('蒙皮', `${name} 部位 ${pi}：${badSum} 個頂點權重加總不是 1`);
    if (badBone) err('蒙皮', `${name} 部位 ${pi}：${badBone} 個骨頭編號 ≥ 骨頭數 ${nb}`);
  });
}

// ===== 4. 動作組：12 組（6 職 × 男女）都有 pi／rn／f1／f2／f3／dd，而且檔案存在 =====
const sets = readJson(A('anims', 'sets.json'));
const animFiles = fs.readdirSync(A('anims')).filter(f => f.endsWith('.json') && f !== 'sets.json');
if (!sets) err('動作', 'anims/sets.json 讀不到');
else for (const job of Object.values(JOBS)) for (const g of ['m', 'w']) {
  const key = `${g}_${job.model}`, s = sets[key];
  if (!s) { err('動作', `sets.json 缺 ${key} 這組（會用小丑動作代替）`); continue; }
  for (const a of ['pi', 'rn', 'f1', 'f2', 'f3', 'dd']) {
    if (!s[a]) err('動作', `${key} 缺 ${a}（會定住或滑步）`);
    else if (!fs.existsSync(A('anims', s[a] + '.json'))) err('動作', `${key} 的 ${a} 動作檔 ${s[a]}.json 不存在`);
    else if (!readJson(A('anims', s[a] + '.json'))?.tracks?.length) err('動作', `${s[a]}.json 讀不到或沒有軌道`);
  }
}

// ===== 4b. 怪物／NPC 動作（項目 6，tools/build-mobs.mjs）=====
let mobN = 0;
if (sets) for (const [key, s] of Object.entries(sets)) { if (!key.startsWith('mob_')) continue; mobN++;
  const model = key.slice(4), md = readJson(A('models', model.replace(/^/, 'mob_') + '.json'));
  if (!md?.parts?.length) { err('怪物動作', `${model}：assets/models/mob_${model}.json 讀不到或沒有部位`); continue; }
  if (!fs.existsSync(A('models', md.skel + '.json'))) err('怪物動作', `${model}：骨架 ${md.skel}.json 不存在`);
  for (const a of ['pi', 'rn']) if (!s[a]) err('怪物動作', `${model} 缺 ${a}`);
  for (const [a, id] of Object.entries(s)) if (!fs.existsSync(A('anims', id + '.json'))) err('怪物動作', `${model} 的 ${a} 動作檔 ${id}.json 不存在`);
}
if (!mobN) warn('怪物動作', '沒有會動的怪物（node tools/build-mobs.mjs <SealClient>），怪物會用靜態模型');

// ===== 5. skills.json =====
const SK = readJson(A('data', 'skills.json'));
// 出征可用的特效 key：skills.json 的 fx ＋ game.js 的 FX
const gameSrc = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');
const gameFx = {}; for (const m of (gameSrc.match(/const FX = \{([\s\S]*?)\};/)?.[1] || '').matchAll(/(\w+):\s*'([^']+)'/g)) gameFx[m[1]] = m[2];
const skillCount = SK ? Object.keys(SK.skills || {}).length : 0;
if (!SK) err('技能', 'assets/data/skills.json 讀不到');
else {
  const fxAll = { ...SK.fx, ...gameFx };
  for (const [k, url] of Object.entries(fxAll)) if (!fs.existsSync(path.join(ROOT, url))) err('技能特效', `特效 ${k} 的圖 ${url} 不存在`);
  const sheets = {};
  const checkIcon = (who, icon) => {
    if (!Array.isArray(icon) || icon.length < 3) return err('技能圖示', `${who} 沒有圖示`);
    const [f, x, y] = icon; const sz = sheets[f] ??= pngSize(A('skill', f));
    if (!sz) return err('技能圖示', `${who} 的圖示檔 skill/${f} 不存在`);
    if (x < 0 || y < 0 || x + 32 > sz[0] || y + 32 > sz[1]) err('技能圖示', `${who} 圖示座標 (${x},${y}) 超出 ${f}（${sz[0]}×${sz[1]}）`);
  };
  const checkFx = (who, k) => { if (k && !fxAll[k]) err('技能特效', `${who} 的特效 ${k} 沒有對應圖`); };
  for (const [k, s] of Object.entries(SK.skills)) { checkIcon(`${s.name}（${k}）`, s.icon); checkFx(`${s.name}（${k}）`, s.fx); }
  for (const job of Object.keys(JOBS)) {
    const j = SK.jobs?.[job]; if (!j) { err('技能', `${job} 在 skills.json 沒有設定`); continue; }
    if (job !== '初心者' && j.pool?.length !== 4) err('技能', `${job} 的 pool 有 ${j.pool?.length ?? 0} 招（要剛好 4 招）`);
    if (!j.pool?.includes(j.start) && j.start !== j.basic) err('技能', `${job} 的開局技能 ${j.start} 不在 pool 裡、也不是普攻`);
    if (j.basic && !SK.skills?.[j.basic]) err('技能', `${job} 的普攻 ${j.basic} 沒有技能資料`);
    for (const k of j.pool || []) if (!SK.skills[k]) err('技能', `${job} 的 pool 有不存在的技能 ${k}`);
    if (j.musou) { checkIcon(`${job} 無雙 ${j.musou.name}`, j.musou.icon); checkFx(`${job} 無雙 ${j.musou.name}`, j.musou.fx); }
    else err('技能', `${job} 沒有無雙`);
  }
  for (const f of SK.fusions || []) for (const k of ['a', 'b', 'into']) if (!SK.skills[f[k]]) err('超武', `融合 ${f.a}＋${f.b}→${f.into} 的 ${k}（${f[k]}）不存在`);
}

// ===== 6. 遠征地圖的怪物與首領都有模型 =====
// 遊戲內實際用 game.js 的 ENEMY_TYPES；跟 monsters.js 不一致時警告
const enemyModels = {}; for (const m of gameSrc.matchAll(/^\s*([^\s:\/]+):\s*\{\s*model:\s*'([^']+)'/gm)) enemyModels[m[1]] = m[2];
for (const st of STAGES) {
  const names = new Set([...st.monsters, ...st.bosses.map(b => b[1])]);
  for (const n of names) {
    const mm = MONSTER_MODELS[n];
    if (!mm) { err('遠征怪物', `${st.name} 的 ${n} 在 monsters.js 沒有對應模型`); continue; }
    if (!model(mm)) err('遠征怪物', `${st.name} 的 ${n} 模型 ${mm}.json 不存在`);
    if (!enemyModels[n]) err('遠征怪物', `${st.name} 的 ${n} 在 game.js ENEMY_TYPES 沒有資料`);
    else if (enemyModels[n] !== mm) warn('遠征怪物', `${n}：monsters.js 用 ${mm}，game.js 用 ${enemyModels[n]}`);
  }
}

// ===== 6b. 區域地圖：每張圖 4 區、區域的怪都在這張圖的怪物清單、原版地圖檔齊全（項目 10）=====
for (const st of STAGES) {
  if (!Array.isArray(st.zones) || st.zones.length !== 4) { err('區域地圖', `${st.name} 要有 4 個區域（zones）`); continue; }
  st.zones.forEach((z, i) => { if (!z.monsters?.length) err('區域地圖', `${st.name} 第 ${i + 1} 區沒有怪`);
    for (const n of z.monsters || []) if (!st.monsters.includes(n)) err('區域地圖', `${st.name}「${z.name}」的 ${n} 不在這張圖的 monsters 清單`); });
  // 原版地圖（tools/build-map.mjs）：檔案齊全、物件用到的模型都在
  const md = A('maps', String(st.mapId)), mj = readJson(path.join(md, 'map.json'));
  if (!mj) { err('區域地圖', `${st.name} 沒有原版地圖 assets/maps/${st.mapId}/map.json（node tools/build-map.mjs <客戶端 map> ${st.mapId}）`); continue; }
  for (const f of ['height.bin', 'walk.bin', 'color.png', ...mj.tiles]) if (!fs.existsSync(path.join(md, f))) err('區域地圖', `${st.name} 缺 ${st.mapId}/${f}`);
  for (const f of ['height.bin', 'walk.bin']) { try { if (fs.statSync(path.join(md, f)).size !== mj.w * mj.h * (f === 'walk.bin' ? 1 : 2)) err('區域地圖', `${st.mapId}/${f} 大小不對`); } catch {} }
  for (const i of new Set(mj.objects.map(o => o[0]))) if (!model(mj.models[i])) err('區域地圖', `${st.name} 地圖物件 ${mj.models[i]}.json 不存在`);
}

// ===== 6c. 原版技能特效（項目 5，tools/build-skillfx.mjs）：對照表的網格、貼圖都在 =====
{ const ix = readJson(A('skillfx', 'index.json'));
  if (!ix) warn('技能特效', '沒有 assets/skillfx/index.json（node tools/build-skillfx.mjs <SealClient>），會用舊的貼圖特效');
  else for (const [k, e] of Object.entries(ix)) for (const st of ['cast', 'fly', 'hit']) for (const n of e[st]) {
    const j = readJson(A('skillfx', n.mesh + '.json')); if (!j) { err('技能特效', `${k} 的 ${n.mesh}.json 不存在`); continue; }
    for (const m of j.mats) if (m.tex && !fs.existsSync(A('skillfx', 'tex', m.tex))) err('技能特效', `${n.mesh} 缺貼圖 ${m.tex}`); } }

// ===== 7. 艾林主城：原版地圖 32 號（town.html loadSealMap(32)）齊全；town.html 另外用到的模型都存在 =====
{ const mj = readJson(A('maps', '32', 'map.json'));
  if (!mj) err('主城', '沒有原版艾林地圖 assets/maps/32/map.json（node tools/build-map.mjs <客戶端 map> 32）');
  else { for (const f of ['height.bin', 'walk.bin', 'color.png', ...mj.tiles]) if (!fs.existsSync(A('maps', '32', f))) err('主城', `缺 maps/32/${f}`);
    for (const i of new Set(mj.objects.map(o => o[0]))) if (!model(mj.models[i])) err('主城', `艾林地圖物件 ${mj.models[i]}.json 不存在`); } }
const townSrc = fs.readFileSync(path.join(ROOT, 'town.html'), 'utf8');
const townModels = new Set([...townSrc.matchAll(/'((?:house|object)_elim[A-Za-z0-9_]*?)'/g)].map(m => m[1]));
for (const m of townSrc.matchAll(/'((?:house|object)_elim[A-Za-z0-9_]*?)'\s*\+\s*\(i % 2 \? (\d) : (\d)\)/g)) { townModels.delete(m[1]); townModels.add(m[1] + m[2]); townModels.add(m[1] + m[3]); }
for (const m of townSrc.matchAll(/model:\s*'([^']+)'/g)) townModels.add(m[1]);
for (const m of townModels) if (!model(m)) err('主城', `艾林用到的模型 ${m}.json 不存在`);

// ===== 8. 髮型：男女各 HAIR_STYLES 款模型（綁 Bip01 Head）＋每款 HAIR_COLORS 色貼圖 =====
{ const { HAIR_STYLES, HAIR_COLORS } = await import('../src/1_data/jobs.js');
  for (const g of ['m', 'w']) for (let h = 0; h < HAIR_STYLES; h++) {
    const id = `hair_${g}_${'abcdef'[h]}`, d = model(id);
    if (!d) { err('髮型', `${id}.json 不存在（node tools/build-hair.mjs <wear>）`); continue; }
    if (!d.parts?.length || d.parts.some(p => !p.pos?.length || !p.idx?.length)) err('髮型', `${id} 部位沒有頂點或面`);
    if (d.parts?.some(p => p.bone !== 'Bip01 Head')) warn('髮型', `${id} 有部位沒綁在 Bip01 Head`);
    for (let c = 0; c < HAIR_COLORS.length; c++) if (!fs.existsSync(path.join(ROOT, 'assets/hair', `${g}_${'abcdef'[h]}_${c}.png`))) err('髮型', `缺髮色貼圖 assets/hair/${g}_${'abcdef'[h]}_${c}.png`);
  } }

// ===== 輸出 =====
const show = (list, mark) => {
  const by = new Map(); for (const [c, m] of list) (by.get(c) || by.set(c, []).get(c)).push(m);
  for (const [c, ms] of by) { console.log(`${mark} [${c}] ${ms.length} 筆`); for (const m of ms.slice(0, 10)) console.log(`    ${m}`); if (ms.length > 10) console.log(`    …還有 ${ms.length - 10} 筆`); }
};
show(errors, '✗'); show(warns, '!');
console.log(`=== 素材體檢 === 模型 ${modelCount} / 動作 ${animFiles.length} / 技能 ${skillCount} / 主城模型 ${townModels.size}　錯誤 ${errors.length}　警告 ${warns.length}`);
process.exit(errors.length ? 1 : 0);
