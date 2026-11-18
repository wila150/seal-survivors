// 原版技能特效播放（企劃_工程交付 項目 5；資料由 tools/build-skillfx.mjs 從客戶端 skill/ 轉出）
// 一個特效＝幾個網格部位＋各自的位移／旋轉／縮放動畫＋原版材質（加亮混合、顏色呼吸、貼圖捲動／旋轉、連續貼圖）
// 每招三段：cast 施放（自己身上）、fly 飛行（投射物）、hit 命中（目標身上）
// 物件池：每種特效最多 MAX_EACH 個同時存在、全部最多 MAX_ALL 個，超過就不播（不影響傷害）
import * as THREE from 'three';

const MAX_EACH = 10, MAX_ALL = 70, SCALE = 1.15, ADD_GAIN = 0.75; // 原版角色約 1.47 公尺、我們 1.7 → 特效放大一點
const texLoader = new THREE.TextureLoader();
const texCache = new Map();
function tex(f) {
  if (!texCache.has(f)) { const t = texLoader.load('assets/skillfx/tex/' + f); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.wrapS = t.wrapT = THREE.RepeatWrapping; texCache.set(f, t); }
  return texCache.get(f);
}
// Quake 風格 wave：base + amp × f(phase + t × freq)
function wave([fn, base, amp, phase, freq], t) {
  let x = (phase + t * freq) % 1; if (x < 0) x += 1;
  const f = fn === 'sin' ? Math.sin(x * 6.283) : fn === 'sawtooth' ? x : fn === 'inversesawtooth' ? 1 - x : fn === 'triangle' ? (x < 0.5 ? x * 2 : 2 - x * 2) : fn === 'square' ? (x < 0.5 ? 1 : -1) : 1;
  return Math.max(0, Math.min(1, base + amp * f));
}

export class SealFx {
  constructor(scene, camera) {
    this.scene = scene; this.camera = camera; this.index = null; this.tpl = new Map(); this.done = new Map(); this.live = []; this.free = new Map();
    this.ready = fetch('assets/skillfx/index.json').then(r => r.ok ? r.json() : {}).then(j => { this.index = j; }).catch(() => { this.index = {}; });
  }
  // 預先載入這些技能的特效（進戰場前呼叫）
  async preload(keys) {
    await this.ready;
    const names = new Set(); for (const k of keys) { const e = this.index[k]; if (e) for (const s of ['cast', 'fly', 'hit']) for (const n of e[s]) names.add(n.mesh); }
    await Promise.all([...names].map(n => this.load(n)));
  }
  has(k, stage) { return !!this.index?.[k]?.[stage]?.length; }
  load(name) {
    if (!this.tpl.has(name)) this.tpl.set(name, fetch(`assets/skillfx/${name}.json`).then(r => r.json()).then(d => this.build(d)).catch(e => { console.warn('技能特效', name, e.message); return null; })
      .then(T => { this.done.set(name, T); return T; }));
    return this.tpl.get(name);
  }
  build(d) {
    const mats = d.mats.map(m => {
      if (!m.tex) return null;
      const mt = new THREE.MeshBasicMaterial({ map: tex(m.tex), transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
        blending: m.blend === 'blend' ? THREE.NormalBlending : THREE.AdditiveBlending, alphaTest: m.cutout ? 0.4 : 0 });
      if (m.color) mt.color.setRGB(...m.color);
      if (m.blend !== 'blend') mt.color.multiplyScalar(ADD_GAIN); // 加亮材質疊在一起會白成一團 → 稍微調暗
      mt.userData.def = m; return mt;
    });
    const parts = [], inv = new THREE.Matrix4(), rest = new THREE.Matrix4(), tracks = [];

    d.parts.forEach((p, i) => {
      const mat = mats[p.mat]; if (!mat) return;
      rest.fromArray(p.rest); inv.copy(rest).invert();
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p.pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(p.uv, 2)); g.setIndex(p.idx);
      g.applyMatrix4(inv); g.computeBoundingSphere(); // 頂點是世界座標 → 換成部位自己的座標
      const r = { pos: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3() }; rest.decompose(r.pos, r.q, r.s);
      const nm = 'p' + i, a = p.anim;
      if (a.pt) tracks.push(new THREE.VectorKeyframeTrack(nm + '.position', a.pt, a.p));
      if (a.qt) tracks.push(new THREE.QuaternionKeyframeTrack(nm + '.quaternion', a.qt, a.q));
      if (a.st) tracks.push(new THREE.VectorKeyframeTrack(nm + '.scale', a.st, a.s));
      parts.push({ nm, g, mat, r, billboard: p.billboard });
    });
    if (!parts.length) return null;
    const T = { name: d.name, dur: d.dur, parts, clip: new THREE.AnimationClip(d.name, d.dur, tracks), waves: mats.some(m => m && (m.userData.def.rgbWave || m.userData.def.alphaWave || m.userData.def.frames)) };
    // 特效的水平半徑：實際播放 8 個時間點量（很多部位靠動畫放大幾十倍、或先藏在地底再升上來），取地面以上部位的最大值
    const g = this.instance(T), a = g.userData.action, box = new THREE.Box3(), c = new THREE.Vector3(); a.play(); let radius = 0;
    for (let i = 1; i <= 8; i++) { g.userData.mixer.setTime(T.dur * i / 8); g.updateMatrixWorld(true);
      for (const m of g.children) { box.setFromObject(m); if (box.max.y < -0.5) continue; box.getCenter(c); radius = Math.max(radius, Math.hypot(c.x, c.z) + Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2); } }
    T.radius = Math.max(0.5, radius || 1);
    return T;
  }
  instance(T) {
    const g = new THREE.Group(); g.userData.T = T;
    for (const p of T.parts) {
      // 有顏色呼吸／連續貼圖的材質每個特效自己一份（時間各自算），其他共用
      const m = new THREE.Mesh(p.g, T.waves && (p.mat.userData.def.rgbWave || p.mat.userData.def.alphaWave || p.mat.userData.def.frames) ? p.mat.clone() : p.mat);
      m.userData.shared = p.mat; m.name = p.nm; m.position.copy(p.r.pos); m.quaternion.copy(p.r.q); m.scale.copy(p.r.s); m.frustumCulled = false; m.userData.bb = p.billboard; m.renderOrder = 5;
      g.add(m);
    }
    g.userData.mixer = new THREE.AnimationMixer(g); g.userData.action = g.userData.mixer.clipAction(T.clip);
    return g;
  }
  // 播放：k＝技能、stage＝'cast'|'fly'|'hit'；回傳播出的特效（fly 要自己移動、用完呼叫 stop）
  play(k, stage, pos, face = 0, opts = {}) {
    const list = this.index?.[k]?.[stage]; if (!list?.length) return null;
    let first = null;
    for (const n of list) {
      if (!this.done.has(n.mesh)) { this.load(n.mesh); continue; } // 還在載入
      const T = this.done.get(n.mesh); if (!T) continue;
      // 腳本的延遲是從施法開始算；命中／飛行我們在真的打中／射出時才播，所以不再延遲
      const fx = this.spawn(T, stage === 'cast' ? n : { ...n, delay: 0 }, pos, face, opts, stage === 'fly'); if (fx && !first) first = fx;
    }
    return first;
  }
  spawn(T, n, pos, face, opts, loop) {
    if (this.live.length >= MAX_ALL) return null;
    const pool = this.free.get(T) || this.free.set(T, []).get(T);
    if (this.live.filter(f => f.userData.T === T).length >= MAX_EACH && !loop) return null;
    const g = pool.pop() || this.instance(T);
    const a = g.userData.action; a.reset(); a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce); a.clampWhenFinished = true; a.play();
    g.userData.t = 0; g.userData.life = loop ? Infinity : Math.max(T.dur, n.time || 0, 0.3) + (n.delay || 0); g.userData.delay = n.delay || 0;
    g.position.set(pos.x, opts.y || 0, pos.z); g.userData.follow = opts.follow || null; g.userData.y = opts.y || 0; // follow：施放特效跟著角色走（原版 TargetType 1）
    g.rotation.set(0, Math.atan2(-Math.cos(face), -Math.sin(face)), 0); // 原版特效朝 −Z → 轉到朝 face 方向
    // 原版大小照播（11/18 使用者：技能要像 PC；之前依招式範圍縮放，大招常被縮到 1/4 → 不像原版）；opts.fit 只用來把太小的特效放大一點
    const k = opts.fit && T.radius * SCALE < opts.fit * 0.5 ? Math.min(1.6, opts.fit * 0.5 / (T.radius * SCALE)) : 1;
    g.scale.setScalar(SCALE * k * (opts.scale || 1)); g.visible = g.userData.delay <= 0;
    this.scene.add(g); this.live.push(g);
    return g;
  }
  stop(g) { if (g) g.userData.life = 0; }
  update(dt) {
    const camQ = this.camera.quaternion, inv = new THREE.Quaternion(), moved = new Set(); // 共用貼圖的捲動／旋轉每幀只算一次
    for (let i = this.live.length - 1; i >= 0; i--) {
      const g = this.live[i], u = g.userData;
      u.t += dt;
      if (u.t >= u.life) { this.scene.remove(g); this.live.splice(i, 1); (this.free.get(u.T) || []).push(g); continue; }
      if (u.follow) g.position.set(u.follow.position.x, u.y, u.follow.position.z);
      if (u.t < u.delay) continue; g.visible = true;
      u.mixer.update(dt);
      for (const m of g.children) {
        const def = m.material.userData.def;
        if (m.userData.bb) { inv.copy(g.quaternion).invert(); m.quaternion.copy(inv).multiply(camQ); } // 看板：永遠面向鏡頭
        if (!def) continue;
        const t = m.material.map;
        const once = t && !moved.has(t); if (t) moved.add(t);
        if (def.scroll && once) { t.offset.x = (t.offset.x + def.scroll[0] * dt) % 1; t.offset.y = (t.offset.y + def.scroll[1] * dt) % 1; }
        if (def.rotate && once) { t.center.set(0.5, 0.5); t.rotation += def.rotate * dt * Math.PI / 180; }
        if (m.material !== m.userData.shared) {
          if (def.rgbWave) { const v = wave(def.rgbWave, u.t) * (def.blend !== 'blend' ? ADD_GAIN : 1); m.material.color.setScalar(v); if (def.color) m.material.color.multiply(new THREE.Color(...def.color)); }
          if (def.alphaWave) m.material.opacity = wave(def.alphaWave, u.t);
          if (def.frames?.length) { const f = def.frames[Math.floor(u.t * (def.fps || 10)) % def.frames.length]; if (f) m.material.map = tex(f); }
        }
      }
    }
  }
  clear() { for (const g of this.live) { this.scene.remove(g); (this.free.get(g.userData.T) || []).push(g); } this.live.length = 0; }
}
