// 讀取轉檔後的希望OL 模型（assets/models/<名稱>.json）
import * as THREE from 'three';

const cache = new Map();
// 載入失敗：發出 seal-model-error 事件（看門狗會顯示模型名，不要靜默吞掉）
function reportFail(name, e) { try { dispatchEvent(new CustomEvent('seal-model-error', { detail: { name, message: e?.message || String(e) } })); } catch {} throw e; }
const texLoader = new THREE.TextureLoader();

async function loadData(name) {
  if (!cache.has(name)) cache.set(name, fetch(`assets/models/${name}.json`).then(r => { if (!r.ok) throw new Error('沒有模型 ' + name); return r.json(); }).then(async d => {
    // 貼圖：整個模型一張（d.tex），或每個部位各自一張（part.tex）
    const mats = new Map();
    async function matFor(t) {
      if (!mats.has(t)) mats.set(t, (async () => {
        let map = null;
        if (t) { map = await texLoader.loadAsync(`assets/models/${t}`).catch(() => null); if (map) { map.colorSpace = THREE.SRGBColorSpace; map.flipY = false; } }
        return new THREE.MeshLambertMaterial({ map, color: map ? 0xffffff : 0xcccccc, alphaTest: 0.5, side: THREE.DoubleSide });
      })());
      return mats.get(t);
    }
    const geos = [], partMats = [];
    for (const p of d.parts) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(p.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(p.nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(p.uv, 2));
      g.setIndex(p.idx); g.computeBoundingBox(); geos.push(g);
      partMats.push(await matFor(p.tex !== undefined ? p.tex : d.tex));
    }
    const mat = partMats[0];
    // 整體大小（給縮放用）
    const box = new THREE.Box3(); for (const g of geos) box.union(g.boundingBox);
    return { geos, mat, partMats, box };
  }));
  return cache.get(name);
}

// 回傳一個 Group；模型轉成 Y 朝上、腳底在 0、高度 = height
export async function sealModel(name, height = 1.8) {
  const { geos, mat, partMats, box } = await loadData(name).catch(e => reportFail(name, e));
  const inner = new THREE.Group();
  geos.forEach((g, i) => { const m = new THREE.Mesh(g, partMats[i]); m.castShadow = true; inner.add(m); });
  // 原檔就是 Y 朝上、面向 -Z
  const size = box.getSize(new THREE.Vector3());
  const s = height / (size.y || 1);
  inner.scale.setScalar(s);
  inner.position.y = -box.min.y * s;
  const g = new THREE.Group(); g.add(inner); g.userData.mat = mat;
  return g;
}

// 場景物件（建築、樹…）：用原始比例 × scale，水平置中、底部貼地
export async function sealProp(name, scale = 1) {
  const { geos, partMats, box } = await loadData(name).catch(e => reportFail(name, e));
  const inner = new THREE.Group();
  geos.forEach((g, i) => { const m = new THREE.Mesh(g, partMats[i]); m.castShadow = m.receiveShadow = true; inner.add(m); });
  const c = box.getCenter(new THREE.Vector3());
  inner.scale.setScalar(scale);
  inner.position.set(-c.x * scale, -box.min.y * scale, -c.z * scale);
  const g = new THREE.Group(); g.add(inner);
  const size = box.getSize(new THREE.Vector3()).multiplyScalar(scale); g.userData.size = size;
  return g;
}

// ===== 會動的玩家角色（骨架＋蒙皮＋原版動作）=====
const jsonCache = new Map();
const getJson = url => { if (!jsonCache.has(url)) jsonCache.set(url, fetch(url).then(r => { if (!r.ok) throw new Error('讀不到 ' + url); return r.json(); })); return jsonCache.get(url); };
// 骨頭名稱一律小寫比對（部分原版動作檔／武器檔的骨頭名是小寫，例如騎士劍盾動作）
const boneKey = n => n.toLowerCase().replace(/[^a-z0-9_]/g, '_');
const clipCache = new Map();
async function loadClip(id, all = false) {
  // 長度用「最後一個關鍵格」：原版檔頭的長度常比關鍵格長（例：跑步關鍵格到 0.8 秒、檔頭寫 1 秒），
  // 循環播放時會停在最後一格再跳回開頭 → 角色一直抽動（使用者 11/18 回報）
  const keyEnd = a => { let m = 0; for (const t of a.tracks) { if (t.pt.length) m = Math.max(m, t.pt[t.pt.length - 1]); if (t.qt.length) m = Math.max(m, t.qt[t.qt.length - 1]); } return m > 0 ? m : a.dur; };
  // 循環動作（站姿 w1／pi、跑步 rn）：原版有些檔頭尾姿勢不一樣（例：騎士待機左手），循環接回時會跳一格 → 最後一格設成跟第一格一樣
  const fixLoop = a => { if (!/(pi|rn|w1|fw|stand|walk)$/i.test(id)) return a;
    for (const t of a.tracks) for (const [tt, v, w] of [[t.qt, t.q, 4], [t.pt, t.p, 3]]) { const n = tt.length; if (n < 3) continue;
      for (let c = 0; c < w; c++) v[(n - 1) * w + c] = v[c]; }
    return a; };
  // all＝怪物／NPC：骨頭不一定叫 bip01，全部軌跡都留；玩家只留 bip01（鐵匠動作有 Cylinder01 之類的多餘軌跡）
  const ck = id + (all ? '|all' : '');
  if (!clipCache.has(ck)) clipCache.set(ck, getJson(`assets/anims/${id}.json`).then(a => structuredClone(a)).then(a => ({ ...a, tracks: all ? a.tracks : a.tracks.filter(t => /^bip01/i.test(t.bone)) })).then(fixLoop).then(a => new THREE.AnimationClip(id, keyEnd(a), a.tracks.flatMap(t => [
    ...(t.pt.length ? [new THREE.VectorKeyframeTrack(boneKey(t.bone) + '.position', t.pt, t.p)] : []),
    // 只有頭尾 2 格、頭尾又不一樣的軌跡（例：法師待機的手指），循環時會整圈慢慢轉再瞬間轉回 → 固定在第一格
    ...(t.qt.length ? [t.qt.length === 2 ? new THREE.QuaternionKeyframeTrack(boneKey(t.bone) + '.quaternion', [0], t.q.slice(0, 4)) : new THREE.QuaternionKeyframeTrack(boneKey(t.bone) + '.quaternion', t.qt, t.q)] : []),
  ]))));
  return clipCache.get(ck);
}

// sealActor('player_m_musa', 'm_musa', 1.7, ['wpn_R_Bgaa']) → Group；group.userData.actor 有 play(動作)、attack()、update(dt, moving)
// 動作：pi 站立、rn 跑、f1~f3 攻擊、dd 倒下；gear = 武器／盾模型（綁在 Bip01 Sword／Bip01 L Hand 骨頭上）
// gear 項目也可以是 { id, tex, native }：tex 換貼圖（髮色）、native = 模型本來就照這個性別的骨架擺（髮型），不做男→女換算
// opts.tint = 服裝配色（身體／腿／腳乘上淡色）；opts.hide = 不畫的部位（piece 名稱比對的正規式，例：戴頭髮時藏帽子）
export async function sealActor(modelName, setKey, height = 1.7, gear = [], opts = {}) {
  const [d, sets] = await Promise.all([getJson(`assets/models/${modelName}.json`), getJson('assets/anims/sets.json')]).catch(e => reportFail(modelName, e));
  const skel = await getJson(`assets/models/${d.skel}.json`).catch(e => reportFail(modelName, e));
  // 骨頭
  const worlds = skel.map(b => new THREE.Matrix4().fromArray(b.world));
  const bones = skel.map((b, i) => {
    const bone = new THREE.Bone(); bone.name = boneKey(b.name);
    const local = b.parent >= 0 ? worlds[b.parent].clone().invert().multiply(worlds[i]) : worlds[i].clone();
    local.decompose(bone.position, bone.quaternion, bone.scale); return bone;
  });
  const inner = new THREE.Group();
  skel.forEach((b, i) => (b.parent >= 0 ? bones[b.parent] : inner).add(bones[i]));
  const skeleton = new THREE.Skeleton(bones, worlds.map(m => m.clone().invert()));
  // 網格
  const mats = new Map();
  const texWait = []; // 貼圖載入（拍頭像前要等，不然新裝備是灰白的）
  const matFor = t => { if (!mats.has(t)) { const m = new THREE.MeshLambertMaterial({ color: t ? 0xffffff : 0xcccccc, alphaTest: 0.5, side: THREE.DoubleSide });
    if (t) texWait.push(texLoader.loadAsync(`assets/models/${t}`).then(map => { map.colorSpace = THREE.SRGBColorSpace; map.flipY = false; m.map = map; m.needsUpdate = true; }).catch(() => {})); mats.set(t, m); } return mats.get(t); };
  const box = new THREE.Box3();
  const tintMats = new Map();
  const tintFor = t => { if (!tintMats.has(t)) { const m = matFor(t).clone(); m.color.set(0xffffff).lerp(new THREE.Color(opts.tint), 0.55);
    if (t) texWait.push(texLoader.loadAsync(`assets/models/${t}`).then(map => { map.colorSpace = THREE.SRGBColorSpace; map.flipY = false; m.map = map; m.needsUpdate = true; }).catch(() => {})); tintMats.set(t, m); } return tintMats.get(t); };
  // 穿裝備換外觀（opts.swap：{ head／body／leg／foot: 'pcw_…' }）：拿掉職業初始服裝的那個部位、換成原版裝備的模型
  let allParts = d.parts;
  if (opts.swap && Object.keys(opts.swap).length) {
    const extra = await Promise.all(Object.entries(opts.swap).map(([k, id]) => getJson(`assets/models/${id}.json`).then(x => [k, x]).catch(() => [k, null])));
    const ok = extra.filter(([, x]) => x?.parts?.length), drop = new RegExp(`_(${ok.map(([k]) => k === 'foot' ? 'foot' : k).join('|')})$`, 'i');
    if (ok.length) allParts = [...d.parts.filter(p => !drop.test(p.piece || '')), ...ok.flatMap(([, x]) => x.parts)];
  }
  for (const p of allParts) {
    if (opts.hide && opts.hide.test(p.piece || '')) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(p.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(p.uv, 2));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(p.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(p.sw, 4));
    g.setIndex(p.idx); g.computeBoundingBox(); box.union(g.boundingBox);
    const tinted = opts.tint != null && /_(body|leg|foot)$/i.test(p.piece || '');
    const m = new THREE.SkinnedMesh(g, tinted ? tintFor(p.tex) : matFor(p.tex)); m.castShadow = true; m.frustumCulled = false;
    inner.add(m); m.bind(skeleton, new THREE.Matrix4());
  }
  // 武器：原版 R_／L_ 模型，每個部位整塊跟著自己的骨頭（Tag 開頭是掛點輔助，不畫）
  const boneIdx = n => skel.findIndex(b => b.name.toLowerCase() === String(n || '').toLowerCase());
  // 武器檔是照男角骨架擺的：女角要把頂點從男角骨頭位置換到女角骨頭位置
  const maleSkel = d.skel === 'skel_m' ? skel : await getJson('assets/models/skel_m.json').catch(() => skel);
  for (const gw of gear) {
    const w = typeof gw === 'string' ? gw : gw.id;
    const wd = await getJson(`assets/models/${w}.json`).catch(() => null); if (!wd) continue;
    for (const p of wd.parts) {
      if (/^tag/i.test(p.name)) continue;
      const bi = boneIdx(p.bone); if (bi < 0) continue;
      const nv = p.pos.length / 3, g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(p.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(p.nor, 3));
      const mi = maleSkel.findIndex(b => b.name.toLowerCase() === String(p.bone).toLowerCase());
      if (maleSkel !== skel && mi >= 0 && !gw.native) g.applyMatrix4(worlds[bi].clone().multiply(new THREE.Matrix4().fromArray(maleSkel[mi].world).invert()));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(p.uv, 2));
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(nv * 4).fill(0).map((_, i) => i % 4 ? 0 : bi), 4));
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Array(nv * 4).fill(0).map((_, i) => i % 4 ? 0 : 1), 4));
      g.setIndex(p.idx);
      const m = new THREE.SkinnedMesh(g, matFor(gw.tex || (p.tex !== undefined ? p.tex : wd.tex))); m.castShadow = true; m.frustumCulled = false; m.userData.gear = w;
      inner.add(m); m.bind(skeleton, new THREE.Matrix4());
    }
  }
  const s = height / ((box.max.y - box.min.y) || 1);
  inner.scale.setScalar(s); inner.position.y = -box.min.y * s;
  const group = new THREE.Group(); group.add(inner);
  // 動作
  const mixer = new THREE.AnimationMixer(inner);
  const set = sets[setKey] || sets.m_clown;
  const clips = {}; await Promise.all(Object.entries(set).map(async ([k, id]) => { clips[k] = await loadClip(id).catch(() => null); }));
  // 只留骨架裡有的骨頭（獵人動作有 bip01_sword01 之類骨架沒有的骨頭，不然 three 一直警告）；clip 是共用的，用 filter 結果覆蓋不影響其他角色（同一套骨架）
  { const names = new Set(skel.map(b => boneKey(b.name))); for (const c of Object.values(clips)) if (c) c.tracks = c.tracks.filter(t => names.has(t.name.slice(0, t.name.lastIndexOf('.')))); }
  let cur = null, curKey = '', busy = 0, combo = 0, resume = 'pi';
  function play(key, fade = 0.15) {
    if (busy > 0 && key !== 'dd') return; if (key === curKey) return;
    const clip = clips[key]; if (!clip) return;
    const a = mixer.clipAction(clip); a.reset(); a.setLoop(key === 'dd' ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = key === 'dd';
    a.timeScale = key === 'rn' ? runScale : 1;
    if (key === 'rpi' || key === 'rrn') { a.time = 0.3; a.timeScale = 0; } // 騎乘坐姿定格（原版騎馬動作手腳一直揮，坐在坐騎上像在打拳），起伏交給坐騎
    a.play(); if (cur && cur !== a) cur.crossFadeTo(a, fade, false); cur = a; curKey = key;
  }
  // 攻擊：f1→f2→f3 輪流，播完回到原本動作。移動中不播全身攻擊（不然腳會停住、看起來在原地卡頓）
  // skill＝原版技能動作 'p1'～'p4'（放技能時用，照原速播；沒有就退回普攻）
  function attack(speed = 1.6, skill = null) {
    if (moving || riding) return 0; // 騎坐騎時不播站姿攻擊（會從坐騎上站起來穿模）
    if (skill && clips[skill]) speed = 1.15;
    const key = skill && clips[skill] ? skill : ['f1', 'f2', 'f3'][combo++ % 3]; const clip = clips[key] || clips.f1; if (!clip) return 0;
    const a = mixer.clipAction(clip); a.reset(); a.setLoop(THREE.LoopOnce); a.timeScale = speed; a.play();
    if (cur && cur !== a) cur.crossFadeTo(a, 0.08, false); cur = a; curKey = key;
    busy = clip.duration / speed - 0.12; resume = 'pi'; return clip.duration / speed;
  }
  // 移動狀態加一點緩衝：搖桿小抖動不會在站／跑之間一直切（每次切換都會從第一格重播）
  let moving = false, moveT = 0, runScale = 1.25;
  // 站久了偶爾播一次等待動作（伸懶腰、東張西望：原版 w2），播完回到站姿；移動或攻擊就重新計時
  let idleT = 0, idleNext = 6 + Math.random() * 4;
  function fidget() {
    const clip = clips.fid; if (!clip) return;
    const a = mixer.clipAction(clip); a.reset(); a.setLoop(THREE.LoopOnce); a.timeScale = 1; a.play();
    if (cur && cur !== a) cur.crossFadeTo(a, 0.3, false); cur = a; curKey = 'fid';
    busy = clip.duration - 0.25; resume = 'pi';
  }
  function update(dt, wantMove, speedRatio = 1) {
    if (moving || busy > 0 || curKey !== 'pi' || riding) idleT = 0;
    else if ((idleT += dt) > idleNext) { idleT = 0; idleNext = 8 + Math.random() * 7; fidget(); }
    moveT = wantMove ? Math.max(0, moveT) + dt : Math.min(0, moveT) - dt;
    if (!moving && moveT > 0.05) moving = true; else if (moving && moveT < -0.12) moving = false;
    runScale = 1.25 * speedRatio; if (curKey === 'rn' && cur) cur.timeScale = runScale;
    if (moving && busy > 0) { busy = 0; curKey = ''; } // 開始移動就中斷攻擊動作
    if (busy > 0) { busy -= dt; if (busy <= 0) { curKey = ''; play(resume, 0.25); } }
    else if (curKey !== 'dd') play(riding && clips.rpi ? (moving ? 'rrn' : 'rpi') : (moving ? 'rn' : 'pi'));
    mixer.update(dt);
  }
  play('pi', 0);
  group.userData.texReady = Promise.all(texWait);
  // 騎坐騎：站／跑改播 PC 騎馬坐姿（rpi／rrn＝客戶端 GRHMpi／GRHMrn）
  let riding = false;
  const setRiding = on => { if (!!on === riding) return; riding = !!on; busy = 0; curKey = ''; };
  group.userData.actor = { play, attack, update, mixer, setRiding, get riding() { return riding; }, get busy() { return busy > 0; }, get current() { return curKey; } };
  return group;
}

// 原始資料（不縮放、不置中）：原版地圖物件用，位置／轉向／縮放照地圖檔
export async function sealModelData(name) { return loadData(name).catch(e => reportFail(name, e)); }

// ===== 會動的怪物／NPC（企劃_工程交付 項目 6；資料由 tools/build-mobs.mjs 轉出）=====
// sealMob(模型, 高度) → 工廠（沒有骨架／動作就回傳 null，呼叫端改用靜態模型）
// 幾何、材質、動作只載一次；factory.create() 每隻怪只新建骨頭＋SkinnedMesh（共用幾何）＋自己的 mixer
// actor：update(dt)、move(on) 走／站、act('f1'|'ms') 播一次再回去、die() 倒下停在最後一格
const mobCache = new Map();
export function sealMob(model, height = 1) {
  const key = model + '|' + height;
  if (!mobCache.has(key)) mobCache.set(key, (async () => {
    const sets = await getJson('assets/anims/sets.json').catch(() => ({}));
    const set = sets['mob_' + model]; if (!set) return null;
    const d = await getJson(`assets/models/mob_${model}.json`).catch(() => null); if (!d) return null;
    const skel = await getJson(`assets/models/${d.skel}.json`).catch(() => null); if (!skel) return null;
    const worlds = skel.map(b => new THREE.Matrix4().fromArray(b.world)), inverses = worlds.map(m => m.clone().invert());
    const locals = skel.map((b, i) => { const l = b.parent >= 0 ? worlds[b.parent].clone().invert().multiply(worlds[i]) : worlds[i].clone(); const r = { p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3() }; l.decompose(r.p, r.q, r.s); return r; });
    const mats = new Map(), matFor = t => { if (!mats.has(t)) { const m = new THREE.MeshLambertMaterial({ color: t ? 0xffffff : 0xcccccc, alphaTest: 0.5, side: THREE.DoubleSide });
      if (t) texLoader.loadAsync(`assets/models/${t}`).then(map => { map.colorSpace = THREE.SRGBColorSpace; map.flipY = false; m.map = map; m.needsUpdate = true; }).catch(() => {}); mats.set(t, m); } return mats.get(t); };
    const box = new THREE.Box3();
    const geos = d.parts.map(p => { const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(p.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(p.nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(p.uv, 2));
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(p.si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(p.sw, 4)); g.setIndex(p.idx); g.computeBoundingBox(); box.union(g.boundingBox); return { g, m: matFor(p.tex) }; });
    const clips = {}; await Promise.all(Object.entries(set).map(async ([k, id]) => { clips[k] = await loadClip(id, true).catch(() => null); }));
    // 動作檔也有網格節點（例：t_mu1）的軌跡 → 只留骨架裡有的骨頭，不然 three 一直警告
    const boneNames = new Set(skel.map(b => boneKey(b.name)));
    for (const c of Object.values(clips)) if (c) c.tracks = c.tracks.filter(t => boneNames.has(t.name.slice(0, t.name.lastIndexOf('.'))));
    const sc = height / ((box.max.y - box.min.y) || 1), y0 = -box.min.y * sc;
    const sphere = box.getBoundingSphere(new THREE.Sphere()); sphere.radius *= 1.6;
    const create = () => {
      const bones = skel.map((b, i) => { const bone = new THREE.Bone(); bone.name = boneKey(b.name); bone.position.copy(locals[i].p); bone.quaternion.copy(locals[i].q); bone.scale.copy(locals[i].s); return bone; });
      const inner = new THREE.Group(); skel.forEach((b, i) => (b.parent >= 0 ? bones[b.parent] : inner).add(bones[i]));
      const skeleton = new THREE.Skeleton(bones, inverses);
      // 鏡頭外不畫（項目 7）：包圍球用站姿的 1.6 倍（動作會伸手伸腳），不讓 three 每次照骨架重算
      for (const { g, m } of geos) { const mesh = new THREE.SkinnedMesh(g, m); inner.add(mesh); mesh.bind(skeleton, new THREE.Matrix4()); mesh.boundingSphere = sphere.clone(); }
      inner.scale.setScalar(sc); inner.position.y = y0;
      const group = new THREE.Group(); group.add(inner);
      const mixer = new THREE.AnimationMixer(inner);
      let cur = null, curKey = '', once = 0, moving = false, dead = false;
      const play = (k, fade = 0.15, loop = true) => { const c = clips[k]; if (!c) return 0; const a = mixer.clipAction(c); a.reset(); a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce); a.clampWhenFinished = !loop; a.play();
        if (cur && cur !== a) cur.crossFadeTo(a, fade, false); cur = a; curKey = k; return c.duration; };
      const base = () => moving && clips.rn ? 'rn' : 'pi';
      const actor = {
        mixer, get current() { return curKey; },
        // 重用（物件池拿出來）時回到初始狀態，每隻怪的動作起點錯開
        reset() { dead = false; once = 0; moving = false; mixer.stopAllAction(); cur = null; curKey = ''; play('pi', 0); mixer.update(Math.random() * 2); },
        move(on) { moving = on; if (!dead && once <= 0 && curKey !== base()) play(base()); },
        act(k) { if (dead || !clips[k] || (once > 0 && curKey === 'f1')) return; once = play(k, 0.1, false) - 0.1; },
        die() { if (dead) return 0; dead = true; once = 0; return play('dd', 0.1, false) || 0; },
        update(dt) { mixer.update(dt); if (once > 0 && (once -= dt) <= 0 && !dead) play(base(), 0.2); },
      };
      group.userData.actor = actor; group.userData.mob = true; actor.reset();
      return group;
    };
    return { create, clips, height };
  })());
  return mobCache.get(key);
}

// 坐騎：有骨架動作就用會動的版本（站／走，actor.move(on)＋actor.update(dt)），沒有就退回靜態模型（11/20 使用者：坐騎移動沒有動畫像在飛）
// 原版走路動作套上去會壞的（水晶巨蛙翻過來、火焰飛龍 run 是往上飛 → 人物脫離）：改播站姿＋起伏（蛙用跳、龍用浮），actor.bob＝這一格的高度，人物也加同樣高度
const MOUNT_HOP = { G_water_flog_stand04: [0.16, 7, true], G_flame_dragon04: [0.1, 4, false] }; // [高度, 速度, 跳(取絕對值)]
export async function sealMount(name, height = 1.5) {
  const f = await sealMob(name, height).catch(() => null);
  if (!f) return sealModel(name, height);
  const g = f.create(), a = g.userData.actor, hop = MOUNT_HOP[name];
  a.bob = 0;
  if (!hop) { // 會走路的坐騎：人物跟著步伐小幅起伏（坐騎本身的走路動作已經有起伏，這裡只給人物）
    const om = a.move, ou = a.update; let mv = false, t = 0;
    a.move = on => { mv = on; om(on); };
    a.update = dt => { ou(dt); t = mv ? t + dt : 0; a.bob = mv ? Math.abs(Math.sin(t * 9)) * 0.05 : 0; };
  } else {
    const inner = g.children[0], y0 = inner.position.y, om = a.move, ou = a.update; let mv = false, t = 0;
    a.move = on => { mv = on; om(false); };
    a.update = dt => { ou(dt); t = mv ? t + dt : 0; const s = Math.sin(t * hop[1]); a.bob = mv ? (hop[2] ? Math.abs(s) : (s + 1) / 2) * hop[0] : 0; inner.position.y = y0 + a.bob; };
  }
  return g;
}

// 項目 46：G 化武器發光——角色手上的武器（gear id 以 wpn_ 開頭）材質加自發光；color＝null 取消
export function glowGear(group, color) {
  group.traverse(o => { if (!o.isMesh || !/^wpn_/i.test(o.userData.gear || '')) return;
    if (!o.userData.baseMat) o.userData.baseMat = o.material;
    if (color == null) { o.material = o.userData.baseMat; return; }
    const m = o.userData.baseMat.clone(); m.emissive = new THREE.Color(color).multiplyScalar(0.6); o.material = m; });
}
