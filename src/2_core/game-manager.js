// 遊戲流程：生怪波次、精英、首領（登場／招式／死亡）、結算送伺服器
// 數值照原本，之後改由後端調整（企劃_工程交付.md 第六章）
import * as THREE from 'three';

export const BOSS_TITLES = { 菜頭王: '菜園的暴君', 熊爸爸: '森林之怒', 骷髏王: '不死軍團之主', 魔蠍大帝: '沙漠的災厄' };

// ===== 生怪：出場順序跟首領都由遠征地圖決定（stages.js）=====
// listAt(t)：這一刻要生哪些怪（區域地圖＝玩家所在區域的怪；沒給就照時間解鎖）
export function createSpawner(STAGE, listAt) {
  const BOSSES = STAGE.bosses;
  const waveAt = listAt || (t => STAGE.monsters.slice(0, Math.min(STAGE.monsters.length, 2 + Math.floor(t / 100))));
  const sp = {
    BOSSES, waveAt, bossIdx: 0, spawnAcc: 0, eliteAcc: 0,
    reset() { sp.bossIdx = 0; sp.spawnAcc = 0; sp.eliteAcc = 0; },
    // count()：目前怪物數；spawn(type, elite)；boss(type, kind, 第幾隻)
    tick(dt, t, count, spawn, boss) {
      const rate = Math.min(11, 1.2 + t / 22); // 每秒生怪數，最多 11 隻
      sp.spawnAcc += dt * rate * (sp.countMul || 1); // countMul／eventMul：項目 41 難度滑桿（預設 1＝不變）
      while (sp.spawnAcc >= 1 && count() < 200) { sp.spawnAcc--; const list = waveAt(t); spawn(list[Math.random() * list.length | 0]); }
      if ((sp.eliteAcc += dt * (sp.eventMul || 1)) > 45) { sp.eliteAcc = 0; const list = waveAt(t); spawn(list[list.length - 1], true); }
      if (sp.bossIdx < BOSSES.length && t >= BOSSES[sp.bossIdx][0]) { boss(BOSSES[sp.bossIdx][1], BOSSES[sp.bossIdx][2], sp.bossIdx); sp.bossIdx++; }
    },
  };
  return sp;
}

// ===== 首領：登場演出、光環、招式、死亡 =====
// ctx：scene, tex, player, ENEMY_TYPES, spawnFx, play, showBanner, hitPlayer, addMat, spawnEnemy, setBoss, dropGem, gameOver, time(), state(), enemies()
const LEASH = 34; // 王追出家門的最遠距離（玩家離王的家超過就回去）
export function createBossSystem(ctx) {
  const { scene, tex, spawnFx, play, showBanner, hitPlayer, addMat } = ctx;
  const fx = { shake: 0, slow: 0 };
  const eShots = [], teles = [];
  const teleMat = () => new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  function addTele(geo, x, z, rotY = 0) {
    const m = new THREE.Mesh(geo, teleMat()); m.rotation.set(-Math.PI / 2, 0, rotY); m.position.set(x, 0.07, z); scene.add(m); teles.push(m); return m;
  }
  function dropTele(m) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); const i = teles.indexOf(m); if (i >= 0) teles.splice(i, 1); }
  function clear() {
    for (const m of [...teles]) dropTele(m);
    for (const s of eShots) scene.remove(s.mesh); eShots.length = 0;
    for (const e of ctx.enemies() || []) if (e.aura) scene.remove(e.aura);
    fx.shake = 0; fx.slow = 0;
  }

  // home＝區域地圖上王的家（區域中心）：玩家離家太遠王就回家守著，靠近才追；where＝橫幅上的地名
  function enter(type, kind = 'mvp', home = null, where = '') {
    const pp = ctx.player.position;
    showBanner(kind === 'mvp' ? `<small>⚠ WARNING ⚠</small><b>${type}</b><span>MVP・${BOSS_TITLES[type] || ''}${where ? '・出現在' + where : ''}</span>` : `<small>小王出現${where ? '・' + where : ''}</small><b>${type}</b><span>MINI BOSS</span>`, kind === 'mvp' ? 3200 : 2000, kind === 'mvp');
    play('boom', 0.8, 0); setTimeout(() => play('zap', 0.6, 0), 400);
    const e = ctx.spawnEnemy(type, false, kind === 'mini'); e.mvp = kind === 'mvp';
    const a = Math.random() * Math.PI * 2;
    e.hgt = (ctx.ENEMY_TYPES[type].h || 1.5) * e.s0;
    // 有家：在家出現（玩家剛好站在那就往旁邊 10 格）；沒家：玩家旁邊 10 格
    const near = !home || Math.hypot(pp.x - home.x, pp.z - home.z) < 8;
    e.mesh.position.set(near ? pp.x + Math.cos(a) * 10 : home.x, -e.hgt, near ? pp.z + Math.sin(a) * 10 : home.z);
    e.home = home; e.far = !near && Math.hypot(pp.x - home.x, pp.z - home.z) > 30; // 離很遠出現就不震畫面
    e.ai = { st: 'rise', tm: 1.8, cd: 2.2, next: 0, enraged: false };
    e.r = Math.max(e.r, e.hgt * 0.45);
    // 腳下的血色光環＋紅光（紅光掛在模型上，物件池重用時沿用）
    const aura = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex.shock, color: 0xff3b2f, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    aura.rotation.x = -Math.PI / 2; aura.scale.setScalar(e.hgt * 2.6); scene.add(aura); e.aura = aura;
    if (!e.mesh.userData.bossLight) { const light = new THREE.PointLight(0xff3020, 25, e.hgt * 6, 1.6); light.position.y = e.hgt * 0.8; e.mesh.add(light); e.mesh.userData.bossLight = light; }
    // 地面裂開
    spawnFx('shock', e.mesh.position, { flat: true, scale: e.hgt * 3, life: 1.8, grow: 1.6, color: 0xff5030 });
    // 原版怪物出現特效＋音效（腳本 MonReJen：SFX_MoR、ak10）
    if (ctx.pcfx?.play('monrejen', 'cast', { x: e.mesh.position.x, z: e.mesh.position.z }, 0, { y: 0.3, scale: 1.2 })) play(ctx.pcfx.index.monrejen?.sound?.cast || 'boom', 0.7, 0);
    if (!e.far) fx.shake = 0.8;
    ctx.setBoss(e);
    return e;
  }

  function think(e, dt, pp, d) {
    const t = ctx.time();
    const p = e.mesh.position, ai = e.ai, rage = ai.enraged ? 1.6 : 1;
    e.aura.position.set(p.x, 0.06, p.z); e.aura.rotation.z += dt * (ai.enraged ? 4 : 1.5);
    e.aura.material.opacity = 0.55 + Math.sin(t * 6) * 0.25;
    // 呼吸感＋受擊縮放
    e.flash -= dt; const br = 1 + Math.sin(t * 3) * 0.03, sq = e.flash > 0 ? 1.06 : 1;
    e.mesh.scale.set(e.s0 * sq, e.s0 * br * (e.flash > 0 ? 0.94 : 1), e.s0 * sq);
    if (ai.st === 'rise') {
      ai.tm -= dt; p.y = -e.hgt * Math.max(0, ai.tm / 1.8); if (!e.far) fx.shake = Math.max(fx.shake, 0.3);
      if (Math.random() < dt * 8) spawnFx('hit', { x: p.x + (Math.random() - 0.5) * e.hgt * 2, z: p.z + (Math.random() - 0.5) * e.hgt * 2 }, { scale: 1.5, life: 0.5, grow: 1.6, color: 0xc8a070, y: 0.3 });
      if (ai.tm <= 0) { ai.st = 'chase'; p.y = 0; spawnFx('shock', p, { flat: true, scale: e.hgt * 4, life: 0.6, grow: 1.5, color: 0xff7040 }); if (!e.far) { play('boom', 0.8, 0); fx.shake = 1; } }
      return;
    }
    if (!ai.enraged && e.hp < e.maxHp / 2) {
      ai.enraged = true; ai.cd = 0.6; showBanner(`<b>${e.type} 暴怒了！</b><span>攻擊速度提升</span>`, 1800, true);
      e.aura.material.color.setHex(0xff00aa); fx.shake = 0.7; play('boom', 0.7, 0);
    }
    // 慢慢轉向玩家
    const want = Math.atan2(pp.x - p.x, pp.z - p.z); let dy = want - e.mesh.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    if (ai.st !== 'charge') e.mesh.rotation.y += dy * Math.min(1, dt * 5);
    p.y = 0;
    // 守家：玩家離王的家超過 LEASH 就走回家、不出招（還沒被打到一半血以前；暴怒後會一直追）
    if (ai.st === 'chase' && e.home && !ai.enraged && Math.hypot(pp.x - e.home.x, pp.z - e.home.z) > LEASH) {
      const hx = e.home.x - p.x, hz = e.home.z - p.z, hd = Math.hypot(hx, hz);
      if (hd > 0.5) { p.x += hx / hd * e.speed * dt; p.z += hz / hd * e.speed * dt; e.mesh.rotation.y = Math.atan2(hx, hz); }
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.02 * dt); // 回家慢慢回血
      return;
    }
    const A = e.mesh.userData.actor; A?.move(ai.st === 'chase' || ai.st === 'charge'); // 原版走路／攻擊動作（項目 6）
    if (ai.st === 'chase') {
      if (d > 0.001) { p.x += (pp.x - p.x) / d * e.speed * rage * dt; p.z += (pp.z - p.z) / d * e.speed * rage * dt; }
      p.x += e.kb.x * dt; p.z += e.kb.z * dt; e.kb.multiplyScalar(Math.max(0, 1 - dt * 8));
      if ((ai.cd -= dt * rage) <= 0) {
        const moves = ['slam', 'charge', 'volley']; const mv = moves[ai.next++ % moves.length]; A?.act('f1');
        if (mv === 'slam') { // 地面紅圈：1.1 秒後爆炸
          const R = 3.2 + (ai.enraged ? 0.8 : 0);
          ai.st = 'slam'; ai.tm = 1.1; ai.tx = pp.x; ai.tz = pp.z; ai.R = R;
          ai.tA = addTele(new THREE.RingGeometry(R - 0.12, R, 48), pp.x, pp.z); ai.tB = addTele(new THREE.CircleGeometry(R, 48), pp.x, pp.z); ai.tB.scale.setScalar(0.01);
        } else if (mv === 'charge') { // 紅色直線預警後衝刺
          const ang = Math.atan2(pp.x - p.x, pp.z - p.z);
          ai.st = 'chargeTele'; ai.tm = 0.9; ai.dx = Math.sin(ang); ai.dz = Math.cos(ang);
          const L = 18, W = e.r * 2;
          ai.tA = addTele(new THREE.PlaneGeometry(W, L), p.x + ai.dx * L / 2, p.z + ai.dz * L / 2, ang);
          e.mesh.rotation.y = ang;
        } else { ai.st = 'volley'; ai.tm = 0.9; ai.waves = ai.enraged ? 3 : 2; ai.wt = 0; }
      }
    } else if (ai.st === 'slam') {
      ai.tm -= dt; ai.tB.scale.setScalar(Math.max(0.01, 1 - ai.tm / 1.1)); ai.tA.material.opacity = 0.4 + Math.sin(t * 30) * 0.2;
      if (ai.tm <= 0) {
        const c = { x: ai.tx, z: ai.tz };
        spawnFx('hammer', c, { scale: ai.R * 2.2, life: 0.5, grow: 1.5, color: 0xff8040, y: 1 });
        spawnFx('shock', c, { flat: true, scale: ai.R * 2.6, life: 0.5, grow: 1.3, color: 0xff4020 });
        play('boom', 0.9, 0); fx.shake = 0.9;
        if (Math.hypot(pp.x - c.x, pp.z - c.z) < ai.R) hitPlayer(e.dmg * 1.3);
        dropTele(ai.tA); dropTele(ai.tB); ai.st = 'chase'; ai.cd = 2.6;
      }
    } else if (ai.st === 'chargeTele') {
      ai.tm -= dt; ai.tA.material.opacity = 0.25 + Math.sin(t * 30) * 0.15;
      p.x -= ai.dx * dt * 0.8; p.z -= ai.dz * dt * 0.8; // 往後蓄力
      if (ai.tm <= 0) { dropTele(ai.tA); ai.st = 'charge'; ai.tm = 0.65; play('zap', 0.6, 0); }
    } else if (ai.st === 'charge') {
      ai.tm -= dt; p.x += ai.dx * 26 * dt; p.z += ai.dz * 26 * dt;
      if (Math.random() < dt * 30) spawnFx('hit', p, { scale: 1.4, life: 0.35, grow: 1.4, color: 0xffb070, y: 0.4 });
      if (ai.tm <= 0) { ai.st = 'chase'; ai.cd = 2.4; fx.shake = 0.4; }
    } else if (ai.st === 'volley') { // 毒液彈幕：一圈一圈往外射
      ai.tm -= dt; ai.wt -= dt;
      if (ai.wt <= 0 && ai.waves > 0) {
        ai.waves--; ai.wt = 0.35; const n = ai.enraged ? 18 : 14, off = Math.random() * Math.PI;
        for (let i = 0; i < n; i++) {
          const a = off + i * Math.PI * 2 / n, m = new THREE.Sprite(addMat(tex.fireball, 0xc040ff)); m.scale.setScalar(1.1);
          m.position.set(p.x, 1, p.z); scene.add(m); eShots.push({ mesh: m, vx: Math.cos(a) * 8, vz: Math.sin(a) * 8, life: 3.5, dmg: e.dmg * 0.6 });
        }
        play('zap', 0.4, 0);
      }
      if (ai.tm <= 0 && ai.waves <= 0) { ai.st = 'chase'; ai.cd = 2.2; }
    }
    if (d < e.r + 0.5) hitPlayer(e.dmg);
  }

  function updateShots(dt) {
    const pp = ctx.player.position;
    for (let i = eShots.length - 1; i >= 0; i--) {
      const s = eShots[i]; s.life -= dt; s.mesh.position.x += s.vx * dt; s.mesh.position.z += s.vz * dt; s.mesh.material.rotation += dt * 6;
      if (Math.hypot(s.mesh.position.x - pp.x, s.mesh.position.z - pp.z) < 0.7) { hitPlayer(s.dmg); s.life = 0; }
      if (s.life <= 0) { scene.remove(s.mesh); s.mesh.material.dispose(); eShots.splice(i, 1); }
    }
  }

  function death(e) {
    const p = e.mesh.position.clone();
    for (let i = 0; i < 6; i++) setTimeout(() => {
      const q = { x: p.x + (Math.random() - 0.5) * e.hgt * 2, z: p.z + (Math.random() - 0.5) * e.hgt * 2 };
      spawnFx('hammer', q, { scale: 3 + Math.random() * 2, life: 0.6, grow: 1.6, color: 0xffa050, y: 1 }); play('boom', 0.5, 0);
    }, i * 120);
    spawnFx('shock', p, { flat: true, scale: e.hgt * 6, life: 1.2, grow: 1.8, color: 0xffd36b });
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; ctx.dropGem({ x: p.x + Math.cos(a) * 2.5, z: p.z + Math.sin(a) * 2.5 }, 5); }
    fx.shake = 1.2; fx.slow = 0.9;
    showBanner(`<small>BOSS DEFEATED</small><b>擊敗 ${e.type}！</b>`, 2600);
    if (e.mvp) setTimeout(() => ctx.state() === 'play' && ctx.gameOver(true), 3000); // 打倒 MVP＝通關
    if (e.aura) scene.remove(e.aura);
    for (const m of [...teles]) dropTele(m);
  }

  return { fx, eShots, teles, enter, think, updateShots, death, clear };
}

// ===== 結算：只在局末送一次，伺服器自己擲裝備、算經驗與金幣（防作弊）=====
export async function submitRun(token, body) {
  const r = await fetch('/api/runs', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: JSON.stringify(body) });
  const j = await r.json(); if (!r.ok) throw new Error(j.error);
  return j;
}
