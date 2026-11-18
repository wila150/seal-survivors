// 職業技能系統（企劃_技能系統.md）：資料在 assets/data/skills.json
// 四種類型：MELEE_ARC 扇形近戰、PROJECTILE_BOUNCE 彈射投射物、ORBIT_AURA 環繞光環、ZONE_AOE 區域轟炸
import * as THREE from 'three';

export const TYPE_NAMES = { MELEE_ARC: '扇形近戰', PROJECTILE_BOUNCE: '彈射投射', ORBIT_AURA: '環繞光環', ZONE_AOE: '區域轟炸' };
export const TAG_NAMES = { ice: '冰', fire: '火', heavy: '重擊' };
const STAT_NAMES = { dmg: '傷害', cd: '冷卻', range: '範圍', arc: '角度', count: '數量', radius: '範圍', bounce: '彈射', pierce: '穿透', spin: '轉速' };

// 平面距離平方（只看 X、Z；投射物在半空、怪在地上）
const d2 = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;

export async function loadSkills() { const r = await fetch('assets/data/skills.json'); return r.json(); }

// 圖示（32px 圖示表）→ 指定大小的 HTML
export function iconHtml(icon, size = 32, cls = '') {
  const [f, x, y] = icon, k = size / 32;
  return `<i class="skico ${cls}" style="width:${size}px;height:${size}px;background:url(assets/skill/${f}) -${x * k}px -${y * k}px/${512 * k}px ${512 * k}px no-repeat"></i>`;
}

// ===== 特效物件池：sprite 與貼地平面都重複使用，不在戰鬥中一直建立／銷毀 =====
export class FxPool {
  constructor(scene, tex) { this.scene = scene; this.tex = tex; this.free = { s: [], f: [] }; this.live = []; this.geo = new THREE.PlaneGeometry(1, 1); }
  get(flat) {
    let m = this.free[flat ? 'f' : 's'].pop();
    if (!m) {
      m = flat ? new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }))
        : new THREE.Sprite(new THREE.SpriteMaterial({ blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
      if (flat) m.rotation.x = -Math.PI / 2;
      m.userData.flat = flat; this.scene.add(m);
    }
    m.visible = true; return m;
  }
  release(m) { m.visible = false; this.free[m.userData.flat ? 'f' : 's'].push(m); }
  // 一次性特效：放大淡出
  spawn(texKey, pos, { scale = 2, scaleY, life = 0.35, grow = 1, color, flat = false, y = 1, spin = 0 } = {}) {
    const m = this.get(flat); const mat = m.material;
    mat.map = this.tex[texKey] || null; mat.color.set(color ?? 0xffffff); mat.opacity = 1; mat.needsUpdate = true; if (!flat) mat.rotation = Math.random() * 6.28;
    m.position.set(pos.x, flat ? 0.05 + Math.random() * 0.02 : y, pos.z); m.scale.set(scale, scaleY ?? scale, 1);
    this.live.push({ m, life, max: life, base: scale, baseY: scaleY ?? scale, grow, spin });
    return m;
  }
  update(dt) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const f = this.live[i]; f.life -= dt; const k = 1 - f.life / f.max;
      f.m.material.opacity = Math.max(0, f.life / f.max);
      const s = 1 + (f.grow - 1) * k; f.m.scale.set(f.base * s, f.baseY * s, 1);
      if (f.spin) { if (f.m.userData.flat) f.m.rotation.z += f.spin * dt; else f.m.material.rotation += f.spin * dt; }
      if (f.life <= 0) { this.release(f.m); this.live.splice(i, 1); }
    }
  }
  clear() { for (const f of this.live) this.release(f.m); this.live.length = 0; }
}

// ===== 技能管理器 =====
// ctx：{ data, job, fx, player, P, enemies()、nearest(pos, maxD, skip)、hurt(e, dmg, from, kind, src, opts)、onCast(face)、sound(name) }
export class SkillManager {
  constructor(ctx) {
    Object.assign(this, ctx);
    this.J = this.data.jobs[this.job] || this.data.jobs['劍士'];
    // 項目 27：二轉分支的 2 招加進這個職業的技能池
    if (ctx.extraPool?.length) this.J = { ...this.J, pool: [...this.J.pool, ...ctx.extraPool.filter(k => this.data.skills[k])] };
    // 項目 22：賢者之塔開打前選的 4 招＝這一局唯一的技能池
    if (ctx.pool?.length) this.J = { ...this.J, pool: ctx.pool.filter(k => this.data.skills[k]) };
    this.skills = {}; // key → { lv, cd, ang, tick, orbs:[] }
    this.shots = []; this.combo = 0; this.comboT = 0; this.bestCombo = 0; this.musouCount = 0; this.musouCd = 0; this.nextMusou = this.data.status.combo.musouEvery;
    this.add(this.J.start);
  }
  def(k) { return this.data.skills[k]; }
  // 原版特效（seal-fx.js；this.pcfx 有給、而且這招轉得出來才用；沒有就用原本的貼圖特效）
  pc(k, stage) { return !!this.pcfx?.has(k, stage); }
  pcPlay(k, stage, pos, face, opts) { const r = this.pcfx?.play(k, stage, pos, face, stage === 'cast' && pos === this.player.position ? { ...opts, follow: this.player } : opts); if (r && stage !== 'cast') { const f = this.pcfx.index?.[k]?.sound?.[stage]; if (f) this.sound?.(f); } return r; }
  // 出招音效：這招有原版施放音效就播原版的，沒有就播通用的（hit／zap／boom）
  castSound(k, generic) { const f = this.pcfx?.index?.[k]?.sound?.cast; this.sound?.(f || generic); }
  // 放技能時角色播原版技能動作 p1～p4（原版技能對動作的表在加密的 Skill.edt 讀不到 → 依這職業技能順序輪流分配）；普攻用 f1～f3
  motion(k) { if (this.def(k)?.motion) return this.def(k).motion; // 有專屬動作（獵人 hm_multishot…）就用
    if (this.def(k)?.basic || !this.pcfx) return null; const i = this.J.pool.filter(x => !this.def(x)?.basic).indexOf(k); return i < 0 ? null : 'p' + (i % 4 + 1); }
  // 第 lv 級的數值
  stat(k, lv) {
    const d = this.def(k), o = {};
    for (const s in d.base) o[s] = d.base[s] + (d.per?.[s] || 0) * (lv - 1);
    if (o.count) o.count = Math.floor(o.count + 1e-6); if (o.bounce) o.bounce = Math.floor(o.bounce + 1e-6); if (o.pierce) o.pierce = Math.floor(o.pierce + 1e-6);
    // 項目 26：局外天賦改造（該招傷害／冷卻＋屬性標籤傷害）
    const T = this.P?.talent;
    if (T) { const m = T.skill[k]; let dm = 1 + (m?.dmg || 0); for (const t of d.tags || []) dm += T.tag[t] || 0; if (o.dmg) o.dmg *= dm; if (o.cd && m?.cd) o.cd *= 1 + m.cd; }
    // 項目 28：技能寶石（傷害增加、冷卻時間減少）
    const G = this.P?.gem?.[k]; if (G) { if (o.dmg) o.dmg *= 1 + G.dmg; if (o.cd) o.cd *= 1 - G.cd; }
    // 項目 23：局內屬性寶石 每級傷害 +10%
    const EG = this.P?.egem?.[k]; if (EG && o.dmg) o.dmg *= 1 + 0.1 * EG.lv;
    if (o.cd) o.cd = Math.max(0.3, o.cd);
    return o;
  }
  add(k) {
    const s = this.skills[k] ??= { lv: 0, cd: 0.3, ang: 0, tick: 0, orbs: [] };
    s.lv++;
  }
  remove(k) { const s = this.skills[k]; if (!s) return; for (const o of s.orbs) this.fx.release(o); delete this.skills[k]; }
  // 可以融合的超武（兩招都 Lv5，而且還沒融合）
  readyFusions() { return this.data.fusions.filter(f => this.skills[f.a]?.lv >= 5 && this.skills[f.b]?.lv >= 5 && !this.skills[f.into]); }
  fusionFor(k) { if (this.def(k)?.basic) return null; return this.data.fusions.find(f => (f.a === k || f.b === k) && this.J.pool.includes(f.a) && this.J.pool.includes(f.b)); } // 兩招都在技能池才提示（塔只選 4 招時可能缺一招）
  fuse(f) { this.remove(f.a); this.remove(f.b); this.add(f.into); }
  // 三選一：只出自己職業的技能
  choices(passives) {
    const pool = [];
    for (const f of this.readyFusions()) pool.push({ kind: 'f', f, k: f.into, weight: 99 });
    const fused = new Set(this.data.fusions.filter(f => this.skills[f.into]).flatMap(f => [f.a, f.b]));
    // 最多帶 4 招（三轉 6 招，項目 40）；滿了就只出已有技能的升級
    const owned = Object.keys(this.skills).filter(k => !this.def(k).basic).length, cap = this.maxCarry || 4;
    for (const k of this.J.pool) { if (fused.has(k)) continue; const lv = this.skills[k]?.lv ?? 0; if (!lv && owned >= cap) continue; if (lv < 5) pool.push({ kind: 's', k, lv }); }
    // 開局只有普攻：第一次升級只出技能卡，讓玩家先選第一招
    if (!owned) { const first = pool.filter(p => p.kind === 's'); for (let i = first.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [first[i], first[j]] = [first[j], first[i]]; } return first.slice(0, 3); }
    if (this.J.basic && (this.skills[this.J.basic]?.lv ?? 0) < 5) pool.push({ kind: 's', k: this.J.basic, lv: this.skills[this.J.basic].lv });
    for (const k in passives) pool.push({ kind: 'p', k });
    const fus = pool.filter(p => p.kind === 'f'), rest = pool.filter(p => p.kind !== 'f');
    for (let i = rest.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [rest[i], rest[j]] = [rest[j], rest[i]]; }
    // 技能卡優先：至少 2 張技能（有的話）
    const sk = rest.filter(p => p.kind === 's'), pa = rest.filter(p => p.kind === 'p');
    return [...fus, ...sk.slice(0, 2), ...pa, ...sk.slice(2)].slice(0, 3);
  }
  // 卡片說明：數值變化
  diffLines(k, lv) {
    const a = lv ? this.stat(k, lv) : null, b = this.stat(k, lv + 1), out = [];
    for (const s in b) { if (!STAT_NAMES[s] || s === 'at' || s === 'size' || s === 'speed') continue;
      const f = v => s === 'cd' ? v.toFixed(1) + '秒' : s === 'arc' ? Math.round(Math.min(v, 6.283) * 57.3) + '°' : (Number.isInteger(v) ? v : v.toFixed(1));
      if (!a) out.push(`${STAT_NAMES[s]} ${f(b[s])}`); else if (Math.abs(a[s] - b[s]) > 1e-6) out.push(`${STAT_NAMES[s]} ${f(a[s])} → <b>${f(b[s])}</b>`); }
    return out;
  }

  // ===== 每幀更新 =====
  update(dt, canAttack = true) {
    const pp = this.player.position;
    for (const k in this.skills) {
      const s = this.skills[k], d = this.def(k), st = this.stat(k, s.lv);
      if (d.type === 'ORBIT_AURA') { this.orbit(k, s, d, st, dt, canAttack); continue; }
      if (!canAttack) continue;
      if ((s.cd -= dt) > 0) continue;
      const ok = this[d.type]?.(k, s, d, st, pp);
      s.cd = ok === false ? 0.2 : st.cd * this.P.haste;
      if (ok !== false) s.cdMax = s.cd; // 技能列冷卻遮罩用（這次冷卻的總長）
    }
    this.updateShots(dt);
    this.musouCd -= dt;
    if (this.combo && (this.comboT -= dt) <= 0) { this.combo = 0; this.nextMusou = this.data.status.combo.musouEvery; }
  }

  // 傷害＋屬性狀態
  hit(e, k, dmg, from) {
    const d = this.def(k);
    // 普攻打中：PC 原版打擊火花（白色爆光＋星芒；鐵匠／祭司鎚類加金色火花）
    if (d.basic && this.fx.tex.pchit_k) { const p = e.mesh.position, c = new THREE.Color(d.color).getHex();
      this.fx.spawn('pchit_k', p, { y: 1, scale: 1.7, life: 0.16, grow: 1.5, color: 0xffffff });
      this.fx.spawn(d.kind === 'magic' ? 'pchit_b' : 'pchit_a', p, { y: 1, scale: 2.2, life: 0.22, grow: 1.3, color: c });
      if (d.fx === 'bomb' || d.fx === 'holy') this.fx.spawn('pcspark', p, { y: 1, scale: 1.8, life: 0.25, grow: 1.4, color: c }); }
    this.hurt(e, dmg, from, d.kind, k, { tags: d.tags, status: d.status });
  }
  comboHit() {
    this.combo++; this.comboT = this.data.status.combo.breakSecs; if (this.combo > this.bestCombo) this.bestCombo = this.combo;
    // 每滿 50 連擊放一次無雙；最快 6 秒一次（太密時延到冷卻結束後的下一次命中）
    if (this.combo >= this.nextMusou) { if (this.musouCd > 0) return; this.nextMusou = (Math.floor(this.combo / this.data.status.combo.musouEvery) + 1) * this.data.status.combo.musouEvery; this.musouCd = 6; this.musou(); }
  }
  // 職業無雙：以自己為中心的大範圍傷害
  musou() {
    const m = this.J.musou, pp = this.player.position, c = new THREE.Color(m.color).getHex(); this.musouCount++;
    this.onMusou?.(m);
    this.fx.spawn(m.fx, pp, { flat: true, scale: m.radius * 2.4, life: 0.9, grow: 1.3, color: c, spin: 2 });
    this.fx.spawn('circle', pp, { flat: true, scale: m.radius * 1.6, life: 1.1, grow: 1.6, color: c, spin: -3 });
    for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283, r = m.radius * 0.7; this.fx.spawn(m.fx, { x: pp.x + Math.cos(a) * r, z: pp.z + Math.sin(a) * r }, { scale: 2.2, scaleY: 4, y: 2, life: 0.6, grow: 1.4, color: c }); }
    for (const e of this.enemies()) if (!e.dead && d2(e.mesh.position, pp) < m.radius * m.radius)
      this.hurt(e, m.dmg * (1 + this.musouCount * 0.05), pp, 'phys', 'musou', { tags: ['heavy'], noCombo: true });
    this.sound?.('boom');
  }

  // ----- MELEE_ARC：朝最近敵人揮出扇形 -----
  MELEE_ARC(k, s, d, st, pp) {
    const R = st.range, tg = this.nearest(pp, R + 2);
    if (!tg && st.arc < 6) return false;
    const face = tg ? Math.atan2(tg.mesh.position.z - pp.z, tg.mesh.position.x - pp.x) : this.P.face;
    this.onCast?.(face, this.motion(k)); this.castSound(k, 'hit');
    const c = new THREE.Color(d.color).getHex(), full = st.arc >= 6;
    const hits = st.hits || 1, pc = this.pc(k, 'hit') || this.pc(k, 'cast');
    if (pc) this.pcPlay(k, 'cast', pp, face, { fit: 2.5 });
    for (let h = 0; h < hits; h++) setTimeout(() => {
      const p = this.player.position;
      if (pc) { if (h === 0) this.pcPlay(k, 'hit', full ? p : { x: p.x + Math.cos(face) * R * 0.55, z: p.z + Math.sin(face) * R * 0.55 }, face, { fit: full ? R : R * 0.7 }); }
      else if (full) { this.fx.spawn(d.fx, p, { flat: true, scale: R * 2.2, life: 0.3, grow: 1.25, color: c, spin: 8 }); }
      else { const cx = p.x + Math.cos(face) * R * 0.55, cz = p.z + Math.sin(face) * R * 0.55;
        this.fx.spawn(d.fx, { x: cx, z: cz }, { flat: true, scale: R * 1.5, life: 0.25, grow: 1.3, color: c });
        for (let i = 0; i < 5; i++) { const a = face + (i - 2) / 4 * st.arc; this.fx.spawn('dot', { x: p.x + Math.cos(a) * R * 0.9, z: p.z + Math.sin(a) * R * 0.9 }, { scale: 0.7, life: 0.3, grow: 0.3, color: c }); } }
      for (const e of this.enemies()) { if (e.dead) continue; const dx = e.mesh.position.x - p.x, dz = e.mesh.position.z - p.z, dd = Math.hypot(dx, dz);
        if (dd > R + e.r) continue;
        let da = Math.abs(Math.atan2(dz, dx) - face); if (da > Math.PI) da = 2 * Math.PI - da;
        if (full || da < st.arc / 2 || dd < 1.2) this.hit(e, k, st.dmg, p); }
    }, h * 160);
  }

  // ----- PROJECTILE_BOUNCE：射出後彈到下一隻 -----
  PROJECTILE_BOUNCE(k, s, d, st, pp) {
    const tg = this.nearest(pp, 22);
    if (!tg && !st.ring) return false;
    const base = tg ? Math.atan2(tg.mesh.position.z - pp.z, tg.mesh.position.x - pp.x) : this.P.face;
    this.onCast?.(base, this.motion(k)); this.castSound(k, 'zap');
    const c = new THREE.Color(d.color).getHex(), n = st.count, pcFly = this.pc(k, 'fly');
    this.pcPlay(k, 'cast', pp, base, { fit: 2.5 });
    for (let i = 0; i < n; i++) {
      const a = st.ring ? base + i / n * 6.283 : base + (i - (n - 1) / 2) * 0.2;
      const m = this.fx.get(false); m.material.map = this.fx.tex[d.fx]; m.material.color.set(c); m.material.opacity = 1; m.material.needsUpdate = true;
      m.position.set(pp.x, 1, pp.z); m.scale.setScalar(st.size || 1.2);
      // 原版飛行特效：跟著投射物走、朝飛行方向；原本的光球藏起來
      const pcm = pcFly ? this.pcPlay(k, 'fly', pp, a, { y: 1, fit: (st.size || 1.2) * 1.2 }) : null; if (pcm) m.visible = false;
      this.shots.push({ m, k, pcm, vx: Math.cos(a) * st.speed, vz: Math.sin(a) * st.speed, life: 1.6, dmg: st.dmg, bounce: st.bounce || 0, pierce: st.pierce || 0, blast: st.blast || 0, hit: new Set(), trail: 0, c });
    }
  }
  updateShots(dt) {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i], p = s.m.position; s.life -= dt;
      p.x += s.vx * dt; p.z += s.vz * dt; s.m.material.rotation += dt * 10;
      if (s.pcm) { s.pcm.position.set(p.x, 1, p.z); s.pcm.rotation.y = Math.atan2(-s.vx, -s.vz); }
      // 粒子拖尾（有原版飛行特效就不畫）
      else if ((s.trail -= dt) <= 0) { s.trail = 0.035; this.fx.spawn('dot', p, { scale: 0.7, life: 0.28, grow: 0.3, color: s.c, y: 1 }); }
      for (const e of this.enemies()) {
        if (e.dead || s.hit.has(e)) continue;
        if (d2(e.mesh.position, p) > (e.r + 0.5) ** 2) continue;
        s.hit.add(e); this.hit(e, s.k, s.dmg, p); this.pcPlay(s.k, 'hit', p, Math.atan2(s.vz, s.vx), { fit: s.blast || 1.6 });
        if (s.blast) { this.fx.spawn(this.def(s.k).fx, p, { flat: true, scale: s.blast * 2, life: 0.3, grow: 1.3, color: s.c });
          for (const o of this.enemies()) if (o !== e && !o.dead && d2(o.mesh.position, p) < s.blast * s.blast) this.hit(o, s.k, s.dmg * 0.5, p); }
        if (s.bounce > 0) { // 彈到附近下一隻
          const nx = this.nearest(p, 9, s.hit);
          if (nx) { s.bounce--; const a = Math.atan2(nx.mesh.position.z - p.z, nx.mesh.position.x - p.x), sp = Math.hypot(s.vx, s.vz); s.vx = Math.cos(a) * sp; s.vz = Math.sin(a) * sp; s.life = Math.max(s.life, 0.8); break; }
        }
        if (s.pierce-- <= 0) { s.life = 0; break; }
      }
      if (s.life <= 0) { this.fx.release(s.m); this.pcfx?.stop(s.pcm); this.shots.splice(i, 1); }
    }
  }

  // ----- ORBIT_AURA：繞身旋轉 -----
  orbit(k, s, d, st, dt, canAttack) {
    const pp = this.player.position, n = st.count, R = st.radius, c = new THREE.Color(d.color).getHex();
    while (s.orbs.length < n) { const m = this.fx.get(false); m.material.map = this.fx.tex[d.fx]; m.material.color.set(c); m.material.opacity = 1; m.material.needsUpdate = true; m.scale.setScalar(1.5); s.orbs.push(m); }
    s.ang += dt * st.spin; s.tick -= dt; const doHit = canAttack && s.tick <= 0; if (doHit) s.tick = 0.3;
    s.orbs.forEach((m, i) => {
      m.visible = canAttack;
      const a = s.ang + i * 6.283 / n; m.position.set(pp.x + Math.cos(a) * R, 1, pp.z + Math.sin(a) * R); m.material.rotation += dt * 6;
      if (doHit) for (const e of this.enemies()) if (!e.dead && d2(e.mesh.position, m.position) < (0.95 + e.r) ** 2) this.hit(e, k, st.dmg, m.position);
    });
    if (canAttack && (s.cd -= dt) <= 0) { s.cd = 2.2; this.onCast?.(null, this.motion(k)); this.pcPlay(k, 'cast', pp, this.P.face, { fit: R + 1 }) || this.pcPlay(k, 'hit', pp, this.P.face, { fit: R + 1, follow: this.player }); } // 原版特效：每次繞身時在自己身上播一次
  }

  // ----- ZONE_AOE：目標點範圍傷害 -----
  ZONE_AOE(k, s, d, st, pp) {
    const pts = [];
    if (st.at === 'self') pts.push(pp.clone());
    else {
      const used = new Set();
      for (let i = 0; i < st.count; i++) {
        let e = null;
        if (st.at === 'nearest') e = this.nearest(pp, 13, used);
        else { const list = this.enemies().filter(x => !x.dead && !used.has(x) && x.mesh.position.distanceToSquared(pp) < 16 * 16); e = list[Math.random() * list.length | 0]; }
        if (!e) break; used.add(e); pts.push(e.mesh.position.clone());
      }
    }
    if (!pts.length) return false;
    this.onCast?.(st.at === 'self' ? null : Math.atan2(pts[0].z - pp.z, pts[0].x - pp.x), this.motion(k)); this.castSound(k, 'boom');
    const c = new THREE.Color(d.color).getHex(), R = st.radius, pc = this.pc(k, 'hit');
    this.pcPlay(k, 'cast', pp, Math.atan2(pts[0].z - pp.z, pts[0].x - pp.x), { fit: 2.5 });
    for (const p of pts) {
      if (pc) this.pcPlay(k, 'hit', p, Math.atan2(p.z - pp.z, p.x - pp.x), { fit: R });
      else this.fx.spawn(d.fx, p, { flat: true, scale: R * 2.3, life: 0.4, grow: 1.25, color: c, spin: 3 });
      if (!pc && st.at !== 'self') this.fx.spawn(d.fx === 'beam' ? 'beam' : d.fx, p, { scale: R * 1.1, scaleY: d.fx === 'beam' ? 7 : R * 1.6, y: d.fx === 'beam' ? 3.5 : 1, life: 0.35, grow: 1.2, color: c });
      for (const e of this.enemies()) if (!e.dead && d2(e.mesh.position, p) < (R + e.r) ** 2) this.hit(e, k, st.dmg, p);
    }
  }

  clear() { for (const k in this.skills) for (const o of this.skills[k].orbs) this.fx.release(o); for (const s of this.shots) { this.fx.release(s.m); this.pcfx?.stop(s.pcm); } this.shots.length = 0; }
}
