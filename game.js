// 希望倖存者 出征：只負責組裝（場景、介面、傷害、升級），各模組在 src/
//   玩家 src/2_core/player.js、攝影機 camera.js、流程／首領／結算 game-manager.js、物件池 pool.js、技能 src/3_skills/skills.js
import { pcLoading } from './src/2_core/pc-loading.js';
import { personaBonus } from './src/1_data/persona.js';
import { setBonus } from './src/1_data/tower.js';
import { askConfirm } from './src/2_core/ask.js';
import * as THREE from 'three';
import { JOBS, defaultStats, MOUNT } from './src/1_data/jobs.js';
import { sealModel, sealMob, sealModelData } from './src/2_core/seal-model.js';
import { RARITY, itemName, itemIcon } from './src/1_data/items.js';
import { STAGES, bossTimes, earlyMul } from './src/1_data/stages.js';
import { talentEffects, branchOf, boostedAlloc } from './src/1_data/talents.js';
import { gemEffects } from './src/1_data/gems.js';
import { stoneEffects } from './src/1_data/stones.js';
import { titleOf } from './src/1_data/fame.js';
import { PETS, petStage, petName, petAtk, petBonus } from './src/1_data/pets.js';
import { cleanDiff, diffMods, stageBaseLv } from './src/1_data/difficulty.js';
import { ELEMS, ELEM_COLOR, elemMult, MONSTER_ELEM, skillElem } from './src/1_data/element.js';
import { TOWER_NAME, towerFloor, towerSeg, towerHpMul, towerDmgMul, towerBossAt, CURSES } from './src/1_data/tower.js';
import { loadSkills, SkillManager, FxPool, iconHtml, TYPE_NAMES, TAG_NAMES, ENH, ENH_Q } from './src/3_skills/skills.js';
import { SealFx } from './src/3_skills/seal-fx.js';
import { MeshPool, DomPool } from './src/2_core/pool.js';
import { createCamera, fitCamera, followCamera, cycleView, enableOrbit } from './src/2_core/camera.js';
import { openSettings, onSettings, getSettings, applyHud, pixelRatio } from './src/2_core/settings.js';
import { createInput, createPlayer, magnetGems } from './src/2_core/player.js';
import { BOSS_TITLES, createSpawner, createBossSystem, submitRun } from './src/2_core/game-manager.js';
import { createWatchdog } from './src/4_diagnostics/watchdog.js';
import { loadSealMap, buildSealMap, liftScene, zoneAt, zoneName, walkMove, drawSealMinimap, addWalkSurfaces } from './src/2_core/seal-map.js';
const SKD = await loadSkills();
// 項目 26：局外天賦（主城天賦樹點的）→ 開局套到 P 與技能
const TAL = await fetch('assets/data/talents.json').then(r => r.json()).catch(() => null);

// ===== 素材設定（正式素材到了改這裡） =====
const FX = {
  lightning: 'assets/fx/SFX_ThuA3_Blue.png',
  fireball: 'assets/fx/eff_fireball_re_01.png',
  tornado: 'assets/fx/E_blue_tornado_Green.png',
  shock: 'assets/fx/vfx_shockwave_blue.png',
  gem: 'assets/fx/vfx_dot10_Blue.png',
  hit: 'assets/fx/e_trap_explosion_green.png',
  slash: 'assets/fx/vfx_shockwave_fireR.png',
  hammer: 'assets/fx/SFX_Meteo_Fire_Green.png',
  holy: 'assets/fx/sfx_magic_cycle_yellow01.png',
  // PC 原版普攻打中特效（客戶端 sfx/E_Hit_A01、E_Hit_A_K、E_Hit_B01、e_spark01.tex 轉檔）
  pchit_a: 'assets/fx/pc_hit_a.png', pchit_k: 'assets/fx/pc_hit_k.png', pchit_b: 'assets/fx/pc_hit_b.png', pcspark: 'assets/fx/pc_spark.png',
};
const SFX = { hit: 'sword5010', zap: 'SKIL6002', boom: 'SKIL6024', level: 'BUTTON3001', gem: 'ETC40280', hurt: 'ETC40290' };
const BGM_DEFAULT = 'assets/bgm/01.mp3'; // 每張地圖用 stages.js 的 bgm（客戶端 bgm/ 原版曲目）

// 目前角色（從角色選擇畫面帶過來）
let CHAR = null; try { CHAR = JSON.parse(sessionStorage.getItem('ss_char')); } catch {}
if (!CHAR && !location.search.includes('auto')) location.replace('./');
if (!CHAR) CHAR = { name: '測試', job: new URLSearchParams(location.search).get('job') || '劍士', baseLv: 1, stats: defaultStats(), outfit: 0 };
const JOB = JOBS[CHAR.job] || JOBS['劍士'];
// 目前的遠征地圖
let STAGE_IDX = 0; try { STAGE_IDX = +(new URLSearchParams(location.search).get('stage') ?? sessionStorage.getItem('ss_stage') ?? 0) || 0; } catch {}
// 項目 22：賢者之塔（?tower=1；開打設定在主城選好存 sessionStorage ss_tower：{ skills[4], boost{}, curse }）
const TOWER = new URLSearchParams(location.search).has('tower');
let TSET = null; if (TOWER) { try { TSET = JSON.parse(sessionStorage.getItem('ss_tower')); } catch {} }
const CURSE = CURSES[TSET?.curse || 'none'] || CURSES.none;
if (TOWER) STAGE_IDX = -1; // 塔不存「未完成的一局」
const STAGE = TOWER ? { ...STAGES[2], key: 'tower', name: TOWER_NAME, lv: '∞', bosses: [] } : (S0 => ({ ...S0, bosses: bossTimes(S0) }))(STAGES[STAGE_IDX] || STAGES[0]); // 項目 31：首領時間照 Tier 時長換算
let floor = 1; // 塔的目前樓層
// 項目 41：難度滑桿（遠征視窗設定，存 sessionStorage ss_diff；塔不套用）
const DIFF_BASE = stageBaseLv(STAGE); // 地圖本身的怪物等級（難度＝選更高的 PC 怪物等級）
let DIFF = cleanDiff(null, DIFF_BASE); if (!TOWER) { try { DIFF = cleanDiff(JSON.parse(sessionStorage.getItem('ss_diff')), DIFF_BASE); } catch {} }
const DM = diffMods(DIFF, DIFF_BASE);
const ST = { ...defaultStats(), ...(CHAR.stats || {}) };
for (const k of ['str', 'agi', 'int', 'vit', 'wis', 'luk']) ST[k] += Math.round(CHAR.bonus?.[k] || 0); // 項目 32：裝備詞綴的素質
// 坐騎租約期間五項素質 +5
const MOUNT_ON = (CHAR.mountUntil || 0) > Date.now();
if (MOUNT_ON) for (const k in ST) ST[k] += MOUNT.stat;
document.getElementById('stageName').textContent = `${STAGE.name}　Lv ${STAGE.lv}`;
document.getElementById('pname').textContent = CHAR.name; document.getElementById('pjob').textContent = CHAR.jobName || CHAR.job;
document.getElementById('faceImg').src = JOB.icon; document.getElementById('stagec').textContent = `${STAGE.name}・Lv ${STAGE.lv}`;
if (CHAR) document.getElementById('stageName').insertAdjacentHTML('afterend', `<div style="color:#ffe9a8;font-weight:700">${CHAR.name.replace(/[<>&"]/g, '')}　${CHAR.jobName || CHAR.job} Lv ${CHAR.baseLv}</div>`);

// ===== 基本場景 =====
const renderer = new THREE.WebGLRenderer({ antialias: !matchMedia('(pointer:coarse)').matches, powerPreference: 'high-performance' }); // 手機關反鋸齒（省很多 GPU）
renderer.setPixelRatio(pixelRatio());
const AQ = { lvl: 0, acc: 0, n: 0, low: 0, q: null }; // 項目 7 自動畫質（說明在 autoQuality）
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(STAGE.fog);
scene.fog = new THREE.Fog(STAGE.fog, 45, 110);
const camera = createCamera();
scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x3a4a2a, 1.1));
const sun = new THREE.DirectionalLight(0xfff1d6, 1.6); sun.position.set(8, 20, 6); scene.add(sun);

function resize() { renderer.setSize(innerWidth, innerHeight); fitCamera(camera, innerWidth, innerHeight); }
addEventListener('resize', resize); resize();

// 地圖：希望OL 原版地圖（src/2_core/seal-map.js，tools/build-map.mjs 轉檔）—— 地形起伏、原版地表、原版擺設、可走區
const MAP = await loadSealMap(STAGE.mapId);
const MAPVIEW = buildSealMap(scene, MAP, STAGE.fog);
MAPVIEW.propsReady.then(() => addWalkSurfaces(MAP, scene)); // 橋面高度（不再走在橋下）
const groundY = () => MAP.heightAt(player.position.x, player.position.z);

const loader = new THREE.TextureLoader();
const tex = {}; for (const [k, url] of Object.entries({ ...SKD.fx, ...FX })) { tex[k] = loader.load(url); tex[k].colorSpace = THREE.SRGBColorSpace; }
const fxPool = new FxPool(scene, tex); // 特效物件池
const PCFX = new SealFx(scene, camera); // 原版技能特效（項目 5，assets/skillfx）
const addMat = (t, color = 0xffffff) => new THREE.SpriteMaterial({ map: t, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });

// ===== 音效 =====
let muted = false; const audioLast = {};
// 11/19 手機超卡：以前每次播放都 new Audio／cloneNode（iPhone 每個都要重新解碼、開播放器，打怪時一秒幾十次）
// → 改 Web Audio：每個檔只下載解碼一次，之後從記憶體播；同時最多 24 個聲音
const AC = new (window.AudioContext || window.webkitAudioContext)();
const sfxGain = AC.createGain(); sfxGain.connect(AC.destination);
const sounds = {}; let voices = 0;
const sndUrl = k => SFX[k] ? `assets/sfx/${SFX[k]}.wav` : k.includes('/') ? `assets/sfx/${k}` : `assets/sfx/skill/${k}`; // 原版技能音效（build-skillfx.mjs 從腳本 SoundName 抄來）
function loadSnd(k) { return sounds[k] ??= fetch(sndUrl(k)).then(r => r.ok ? r.arrayBuffer() : null).then(b => b && new Promise((ok, bad) => AC.decodeAudioData(b, ok, bad))).catch(() => null); }
for (const k in SFX) loadSnd(k);
const unlockAudio = () => { if (AC.state === 'suspended') AC.resume().catch(() => {}); };
addEventListener('pointerdown', unlockAudio, { capture: true }); addEventListener('keydown', unlockAudio, { capture: true });
function play(k, vol = 0.5, gap = 70) {
  if (muted) return; const now = performance.now(); if (now - (audioLast[k] || 0) < gap) return; audioLast[k] = now;
  if (!SFX[k] && !/\.wav$/.test(k)) return;
  if (voices >= 24) return;
  loadSnd(k).then(buf => {
    if (!buf || AC.state !== 'running') return;
    const G = getSettings(), src = AC.createBufferSource(), g = AC.createGain();
    src.buffer = buf; g.gain.value = Math.min(1, vol * G.master * G.sfx); src.connect(g).connect(sfxGain);
    voices++; src.onended = () => { voices--; g.disconnect(); }; src.start();
  });
}
// 怪物原版音效（tools/build-mobs.mjs 從 .act 抄來）：攻擊 f1、倒下 dd、受擊 ms
let MOB_SND = {}; fetch('assets/sfx/mob/index.json').then(r => r.ok ? r.json() : {}).then(j => { MOB_SND = j; }).catch(() => {});
const mobSound = (e, k, vol = 0.22, gap = 90) => { const f = MOB_SND[ENEMY_TYPES[e.type]?.model]?.[k]; if (f) play('mob/' + f, vol, gap); };
const bgm = new Audio(STAGE?.bgm ? `assets/bgm/${STAGE.bgm}.mp3` : BGM_DEFAULT); bgm.loop = true; bgm.volume = 0.35;
document.getElementById('mute').onclick = e => { muted = !muted; e.target.textContent = muted ? '🔇' : '🔊'; muted ? bgm.pause() : state === 'play' && bgm.play().catch(() => {}); };

// ===== 玩家（src/2_core/player.js）=====
const rig = createPlayer(scene, { CHAR, JOB, MOUNT_ON, onPortrait: url => document.getElementById('faceImg').src = url });
const player = rig.group;
function setMounted(on) {
  if (state !== 'play' || !rig.setMounted(on)) return;
  const b = document.getElementById('mountBtn'); if (b) b.textContent = on ? '下坐騎 (R)' : '上坐騎 (R)';
  spawnFx('shock', player.position, { flat: true, scale: 3, life: 0.4, grow: 1.4, color: 0xffe9a8 }); play('gem', 0.5, 0);
}
// 項目 54：坐騎衝鋒 triggerMountDash()：切換上下坐騎；上坐騎那一下（冷卻 15 秒）撞飛身邊的怪＋傷害＋1.5 秒加速
// 綁定：R 鍵、戰場滑鼠右鍵「點一下」（右鍵拖曳照舊轉視角）、手機右側馬頭鈕
const DASH_CD = 15; let dashCd = 0;
// 初心者開局（docs/企劃_初心者開局.md 第 2、4 節）：Lv1～10 經驗表、開局 30 秒溫和第一波、拾取 3 公尺、受擊無敵 0.8 秒、前 20 秒受傷減半
const NOVICE_RUN = CHAR.job === '初心者', NOVICE_NEED = [6, 9, 13, 17, 22, 27, 33, 39, 46];
const needFor = lv => NOVICE_RUN && lv <= NOVICE_NEED.length ? NOVICE_NEED[lv - 1] : Math.floor(5 + lv * 3.5 + lv ** 1.5);
let novWave = 0;
function noviceWave(dt) {
  if (!NOVICE_RUN || TOWER || t > 30 || state !== 'play') return; if ((novWave -= dt) > 0) return; novWave = 0.8;
  if (enemies.filter(e => !e.dead).length >= 12) return;
  const types = STAGE.monsters || []; const e = spawnEnemy(types[Math.random() * types.length | 0] || Object.keys(ENEMY_TYPES)[0]);
  const a = Math.random() * 6.283, r = 12 + Math.random() * 4, x = player.position.x + Math.cos(a) * r, z = player.position.z + Math.sin(a) * r;
  if (MAP.reach(x, z, player.position.x, player.position.z)) e.mesh.position.set(x, 0, z); e.hp = e.maxHp = 6; e.speed = 2.2; e.dmg = Math.min(e.dmg, 3); e.xp = 1;
}
function triggerMountDash() {
  if (state !== 'play') return; const on = !rig.mounted; setMounted(on);
  if (!on || dashCd > 0 || !rig.mounted) return;
  dashCd = DASH_CD; P.tmp.dash = 1.5; const pp = player.position, R2 = 4.5 * 4.5;
  for (const e of enemies) { if (e.dead) continue; const dx = e.mesh.position.x - pp.x, dz = e.mesh.position.z - pp.z; if (dx * dx + dz * dz > R2) continue;
    hurt(e, 15 * (1 + P.lv * 0.15), pp, 'phys', 'mount', { tags: ['heavy'] }); if (!e.boss) e.kb.set(dx, 0, dz).normalize().multiplyScalar(14); }
  spawnFx('shock', pp, { flat: true, scale: 9, life: 0.5, grow: 1.6, color: 0xffd36b }); play('boom', 0.6, 0); bossFx.shake = Math.max(bossFx.shake, 0.3);
}
addEventListener('keydown', e => { if (e.code === 'KeyR') triggerMountDash(); });
document.getElementById('mountBtn').onclick = () => triggerMountDash();
{ let rd = null; renderer.domElement.addEventListener('pointerdown', e => { if (e.button === 2) rd = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  addEventListener('pointerup', e => { if (e.button !== 2 || !rd) return; const moved = Math.hypot(e.clientX - rd.x, e.clientY - rd.y), dt = performance.now() - rd.t; rd = null; if (moved < 6 && dt < 350) { if (CB.st === 'charge' && cbTier()) cbTrigger(); else if (MOUNT_ON) triggerMountDash(); } }); }
const input = createInput(renderer.domElement, document.getElementById('joy'), { camera, scene, target: () => player.position, groundY: () => groundY() });
enableOrbit(renderer.domElement); // 右鍵拖曳轉視角
rig.walk = (p, nx, nz) => walkMove(MAP, p, nx, nz); // 原版可走區（水、懸崖、建築擋路）
// ===== 項目 52 定案：A→S→D 連續技 × 機率掉落屬性能量球（使用者 11/19 asd_combo_design_v3 定案版；取代 osu! 節點版）=====
// 1 刷怪撿球：普通怪 20% 掉小型能量球（+1）、菁英 75% 掉中型結晶（+3～6）、首領噴一地小球＋1 顆中型（+5）；走位撿起來累積 0～100 點
//   能量球外觀＝屬性（局內最高屬性寶石；沒有＝武器屬性；都沒有＝經典 A／S／D 徽章白球）；80% 以上進入過載磁場（吸球更快、身上燃起氣場）
// 2 觸發：30 點亮 A（小爆發）、60 亮 S（中爆發）、100 亮 D（完全體）；點大招鈕／空白鍵／滑鼠右鍵點一下 → 用目前的階梯放招
// 3 演出（11/19 改 PC 式連段，見 cbUnleash 上方說明）：全程無敵、可以自由走位；跑馬燈依序點亮；每段一道巨型屬性劍氣橫越畫面，命中的怪 0.03 秒頓幀＋震動＋沿切線被噴飛（一刀兩斷）；
//   最後一擊跳職業台詞大字；1000 點的完全體加屬性追加效果；放完能量歸零
// 局內卡片：能量球掉落 +10%、能量球吸取 +30%、撿球回 1% HP；寵物進化過＝掉落 +10%、吸取 ×1.5
const CB = { g: 0, st: 'charge', done: 0 };
// 11/19 使用者：「連續技改一百，集滿一千太久了」；asd_combo_design_v3「可透過局外成長逐步縮減門檻至 800／600」→ 改 100 後＝80／60
// 局外成長＝連續技熟練度（累計放過的連續技次數）：50 次 → 滿格 80、200 次 → 60（三階一起照比例縮；PC 天賦樹沒有這種節點，不塞進天賦樹）
const CB_MAX = (CHAR.cbTotal || 0) >= 200 ? 60 : (CHAR.cbTotal || 0) >= 50 ? 80 : 100, CB_TIER = [0.3, 0.6, 1].map(k => Math.round(CB_MAX * k));
const W_ELEM = (CHAR.items || []).find(i => i.equipped && i.slot === 'weapon')?.elem || 0; // 指令 4-3 武器七大屬性合成
const JOB_LINE = { 劍士: '一刀兩斷！', 騎士: '以盾為誓，斬！', 法師: '元素聽我號令！', 祭司: '我要代替聖光懲罰你！', 小丑: '表演開始～', 鐵匠: '人蔘攻擊！', 獵人: '百步穿楊！', 初心者: '別小看初心者！' };
const cbStyle = document.createElement('style'); cbStyle.textContent = `#ultBtn{position:fixed;right:calc(50% - 215px);bottom:calc(max(10px,env(safe-area-inset-bottom)) + 18px);z-index:7;width:66px;height:66px;border-radius:50%;padding:0;border:0;pointer-events:auto;--p:0;--ec:#ffd36b;
  background:conic-gradient(var(--ec) 0 calc(var(--p)*1%),#0008 0);box-shadow:0 2px 8px #0008}
#ultBtn i{position:absolute;inset:5px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:900 15px sans-serif;font-style:normal;color:#9aa6c8;background:radial-gradient(#2b3550,#0b1430)}
#ultBtn .pips{position:absolute;left:50%;bottom:-11px;transform:translateX(-50%);display:flex;gap:2px}#ultBtn .pips b{padding:0 4px;border-radius:5px;font:900 10px sans-serif;background:#222c;color:#778;border:1px solid #fff4}#ultBtn .pips b.on{background:linear-gradient(#ffe28a,#ff9d3d);color:#3a1d00}
#ultBtn.t1 i,#ultBtn.t2 i,#ultBtn.t3 i{color:#fff;background:radial-gradient(#fff6,var(--ec) 55%,#0b1430)}#ultBtn.t3{animation:ultP .8s ease-in-out infinite alternate}
@keyframes ultP{from{box-shadow:0 0 8px var(--ec)}to{box-shadow:0 0 28px var(--ec),0 0 6px #fff}}
@media (max-width:600px){#ultBtn{right:12px;bottom:calc(max(10px,env(safe-area-inset-bottom)) + 108px);width:72px;height:72px}}
#cbMarq{position:fixed;left:50%;top:calc(env(safe-area-inset-top) + 64px);transform:translateX(-50%);z-index:8;display:none;gap:5px;pointer-events:none}
#cbMarq b{min-width:30px;padding:3px 7px;border-radius:8px;background:#0b1430cc;border:2px solid #fff4;color:#9aa6c8;font-size:15px;text-align:center}#cbMarq b.on{background:linear-gradient(#ffe28a,#ff9d3d);color:#3a1d00;border-color:#fff;transform:scale(1.15)}`;
document.head.appendChild(cbStyle);
const ultBtn = document.createElement('button'); ultBtn.id = 'ultBtn'; ultBtn.title = 'A→S→D 連續技（空白鍵／滑鼠右鍵）'; ultBtn.innerHTML = '<i>0</i><span class="pips"><b>A</b><b>S</b><b>D</b></span>'; document.body.appendChild(ultBtn);
const marq = document.createElement('div'); marq.id = 'cbMarq'; document.body.appendChild(marq);
const cbElem = () => { const top = Object.entries(P.egem || {}).filter(([k]) => k !== 'combo').map(([, g]) => g).sort((a, b) => b.lv - a.lv)[0]; return top ? top.e : W_ELEM; };
const cbTier = () => CB_TIER.filter(v => CB.g >= v).length;
// ---- 能量球 ----
const CBO = [], orbGeo = new THREE.SphereGeometry(0.22, 10, 8), orbMats = {};
const orbMat = e => orbMats[e] ??= new THREE.MeshBasicMaterial({ color: new THREE.Color(e ? ELEM_COLOR[e] : '#ffffff'), transparent: true, opacity: 0.95 });
// 無屬性＝經典 A／S／D 鍵盤徽章（asd_combo_design_v3 第 6 點）：畫在 canvas 上的鍵帽貼圖
const asdTex = 'ASD'.split('').map(ch => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#2b3550'; g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.roundRect(6, 6, 52, 52, 10); g.fill(); g.stroke();
  g.fillStyle = '#ffe28a'; g.font = '900 36px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 32, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return new THREE.SpriteMaterial({ map: t, depthWrite: false }); });
function cbDropOrb(pos, pts, scale = 1) {
  if (CBO.length > 160) return;
  if (!cbElem()) { const m = new THREE.Sprite(asdTex[Math.floor(Math.random() * 3)]); m.scale.setScalar(0.7 * scale); m.position.set(pos.x + (Math.random() - 0.5) * 1.2, 0.6, pos.z + (Math.random() - 0.5) * 1.2); scene.add(m); CBO.push({ m, pts, ph: Math.random() * 6 }); return; }
  const m = new THREE.Mesh(orbGeo, orbMat(cbElem())); m.scale.setScalar(scale);
  const halo = new THREE.Sprite(addMat(tex.gem, new THREE.Color(cbElem() ? ELEM_COLOR[cbElem()] : '#ffffff').getHex())); halo.scale.setScalar(1.1 * scale); m.add(halo);
  m.position.set(pos.x + (Math.random() - 0.5) * 1.2, 0.6, pos.z + (Math.random() - 0.5) * 1.2); scene.add(m); CBO.push({ m, pts, ph: Math.random() * 6 });
}
function cbOnKill(e) { // 怪物倒下：機率掉能量球
  const drop = (P.orbDrop || 0) + (PET?.evo ? 0.1 : 0);
  if (e.ai || e.boss) { for (let i = 0; i < 20; i++) cbDropOrb(e.mesh.position, 1); cbDropOrb(e.mesh.position, 5, 2); return; }
  if (e.elite) { if (Math.random() < 0.75 + drop) cbDropOrb(e.mesh.position, 3 + Math.floor(Math.random() * 4), 1.8); return; }
  if (Math.random() < 0.2 + drop) cbDropOrb(e.mesh.position, 1);
}
let auraRing = null;
function comboUpdate(dt = 0) {
  const pp = player.position, over = CB.g >= CB_MAX * 0.8, R = P.magnet * (1 + (P.orbMag || 0)) * (PET?.evo ? 1.5 : 1) * (over ? 2 : 1);
  for (let i = CBO.length - 1; i >= 0; i--) { const o = CBO[i], p = o.m.position; o.ph += dt * 4; p.y = 0.6 + Math.sin(o.ph) * 0.15;
    const dx = pp.x - p.x, dz = pp.z - p.z, d = Math.hypot(dx, dz);
    if (d < 0.8) { scene.remove(o.m); CBO.splice(i, 1); if (CB.st === 'charge') CB.g = Math.min(CB_MAX, CB.g + o.pts); if (P.orbHeal) P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.01 * P.orbHeal); play('gem', 0.25, 40); continue; }
    if (d < R) { const sp = (over ? 16 : 10) * dt / d; p.x += dx * Math.min(1, sp); p.z += dz * Math.min(1, sp); } }
  // 過載磁場：80% 以上身上燃起屬性氣場
  if (!auraRing) { auraRing = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.35, 40), new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })); auraRing.rotation.x = -Math.PI / 2; scene.add(auraRing); }
  auraRing.visible = over && CB.st === 'charge'; if (auraRing.visible) { auraRing.material.color.set(cbElem() ? ELEM_COLOR[cbElem()] : '#ffd36b'); auraRing.position.set(pp.x, 0.07, pp.z); auraRing.scale.setScalar(1 + Math.sin(t * 6) * 0.08); }
  const tier = CB.st === 'charge' ? cbTier() : 0;
  ultBtn.style.setProperty('--p', CB.g / CB_MAX * 100); ultBtn.style.setProperty('--ec', cbElem() ? ELEM_COLOR[cbElem()] : '#ffd36b');
  ultBtn.className = tier ? 't' + tier : ''; ultBtn.querySelector('i').textContent = CB.g >= CB_MAX ? 'MAX' : Math.floor(CB.g);
  ultBtn.querySelectorAll('.pips b').forEach((b, i) => b.classList.toggle('on', i < tier));
}
function cbClearOrbs() { for (const o of CBO) scene.remove(o.m); CBO.length = 0; }
// ---- 觸發與演出 ----
function cbTrigger() { if (state !== 'play' || CB.st !== 'charge') return; const tier = cbTier(); if (!tier) return; cbUnleash(tier, cbElem()); }
function slashFx(pp, ang, col) { // 一道巨型劍氣（地面上的細長發光面，0.35 秒淡出）
  const m = new THREE.Mesh(new THREE.PlaneGeometry(30, 1.6), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  m.rotation.set(-Math.PI / 2, 0, -ang); m.position.set(pp.x, 1.0, pp.z); m.userData.fixed = false; scene.add(m);
  const t0 = performance.now(); const fade = () => { const k = (performance.now() - t0) / 350; m.material.opacity = 0.95 * (1 - k); m.scale.y = 1 + k * 0.6; if (k < 1) requestAnimationFrame(fade); else { scene.remove(m); m.geometry.dispose(); } }; requestAnimationFrame(fade);
}
// 11/19 使用者：「連續技的持續時間太少了，沒有玩到的感覺」→ 照 PC 連續技：放招後進入連段時間，畫面依序跳出 A／S／D 提示，
//   外圈收縮到內圈時按對＝PERFECT（×1.3），太早＝GOOD；按錯或超時＝連段結束、放終結技。越接越多段、每段傷害越高。
//   段數上限 A 6／S 9／D 12（連段擴充卡再加）；每段時限 1.1 秒起、越後面越短（最短 0.6 秒）；全程無敵可走位
//   鍵盤 A／S／D（或 J／K／L）、手機下方三顆大按鈕
const CBQ = { on: false };
const cbPad = document.createElement('div'); cbPad.id = 'cbPad'; cbPad.innerHTML = '<div id="cbPrompt"><span class="ring"></span><b></b><em></em></div><div class="keys"><button data-k="A">A</button><button data-k="S">S</button><button data-k="D">D</button></div>'; document.body.appendChild(cbPad);
cbStyle.textContent += `#cbPad{position:fixed;inset:0;z-index:8;display:none;pointer-events:none}
#cbPrompt{position:absolute;left:50%;top:calc(env(safe-area-inset-top) + 15%);width:92px;height:92px;margin-left:-46px;display:flex;align-items:center;justify-content:center}
#cbPrompt b{width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:900 34px sans-serif;color:#3a1d00;background:radial-gradient(#fff,#ffe28a 45%,#ff9d3d);box-shadow:0 0 18px var(--ec,#ffd36b);border:3px solid #fff}
#cbPrompt .ring{position:absolute;inset:-40px;border-radius:50%;border:4px solid var(--ec,#ffd36b);box-shadow:0 0 10px var(--ec,#ffd36b);transform:scale(var(--r,1))}
#cbPrompt em{position:absolute;bottom:-72px;left:50%;transform:translateX(-50%);white-space:nowrap;font:900 20px sans-serif;font-style:normal;color:#fff;text-shadow:0 0 6px #000,0 0 12px var(--ec,#ffd36b)}
#cbPrompt.hit b{animation:cbHit .18s}@keyframes cbHit{50%{transform:scale(1.35)}}
#cbPad .keys{position:absolute;left:50%;bottom:calc(max(10px,env(safe-area-inset-bottom)) + 20px);transform:translateX(-50%);display:flex;gap:14px;pointer-events:auto}
#cbPad .keys button{width:64px;height:64px;border-radius:14px;border:2px solid #fff8;background:linear-gradient(#2b3550,#0b1430);color:#fff;font:900 26px sans-serif;box-shadow:0 3px 10px #000a;touch-action:manipulation}
#cbPad .keys button.want{border-color:#fff;background:linear-gradient(#ffe28a,#ff9d3d);color:#3a1d00}
@media (max-width:600px){#cbPad .keys{bottom:calc(max(10px,env(safe-area-inset-bottom)) + 96px);gap:18px}#cbPad .keys button{width:80px;height:80px;font-size:32px}}`;
const cbPromptEl = cbPad.querySelector('#cbPrompt');
cbPad.querySelectorAll('.keys button').forEach(b => b.addEventListener('pointerdown', ev => { ev.preventDefault(); ev.stopPropagation(); cbPress(b.dataset.k); }));
function cbUnleash(tier, e) {
  CB.st = 'unleash'; const full = tier === 3, extra = full ? Math.max(0, Math.min(9, (P.comboLen || 3) - 3)) : 0;
  const owned = Object.keys(SM.skills).filter(k => !SKD.skills[k]?.basic), col = new THREE.Color(e ? ELEM_COLOR[e] : '#fff6c0');
  Object.assign(CBQ, { on: true, tier, full, e, col: col.getHex(), owned, max: [0, 6, 9, 12][tier] + extra, i: 0, perfect: 0, key: null, prev: '', t: 0, dur: 1.1,
    mult: [0, 1.0, 1.6, 2.6][tier], base: 10 * (1 + 0.12 * P.lv) });
  cbPad.style.setProperty('--ec', '#' + col.getHexString()); cbPad.style.display = 'block'; ultBtn.style.visibility = 'hidden';
  marq.innerHTML = ''; marq.style.display = 'flex';
  showBanner(`<small>${['', 'A 小爆發', 'S 中爆發', 'D 完全體・千人斬'][tier]}</small><b>A→S→D 連續技</b><span>照提示按 A／S／D・最多 ${CBQ.max} 段</span>`, 1100);
  CBQ.t = -1.0; cbPromptEl.querySelector('em').textContent = 'READY'; cbNext(); // 第一段多給 1 秒反應（橫幅還在）
}
function cbNext() {
  let k; do k = 'ASD'[Math.floor(Math.random() * 3)]; while (k === CBQ.prev && Math.random() < 0.6);
  CBQ.prev = CBQ.key = k; if (CBQ.t >= 0) CBQ.t = 0; CBQ.dur = Math.max(0.6, 1.1 - CBQ.i * 0.05);
  cbPromptEl.querySelector('b').textContent = k; cbPad.querySelectorAll('.keys button').forEach(b => b.classList.toggle('want', b.dataset.k === k));
}
function cbPress(k) {
  if (!CBQ.on || state === 'over') return;
  if (k !== CBQ.key) return cbFinish(false, '按錯了');
  const perfect = CBQ.t / CBQ.dur >= 0.5; if (perfect) CBQ.perfect++;
  const em = cbPromptEl.querySelector('em'); em.textContent = (perfect ? 'PERFECT' : 'GOOD') + `  ${CBQ.i + 1} COMBO`;
  cbPromptEl.classList.remove('hit'); void cbPromptEl.offsetWidth; cbPromptEl.classList.add('hit');
  const chip = document.createElement('b'); chip.textContent = k; chip.className = 'on'; marq.appendChild(chip); while (marq.children.length > 12) marq.firstChild.remove();
  const ang = (P.face || 0) + [0, 1.05, -1.05, 0.5, -0.5, 1.57][CBQ.i % 6];
  cbSlash(ang, CBQ.base * 2 * CBQ.mult * (1 + 0.12 * CBQ.i) * (perfect ? 1.3 : 1), false, CBQ.i);
  play('hit', 0.7, 200 + CBQ.i * 60); CBQ.i++;
  if (CBQ.i >= CBQ.max) cbFinish(true); else cbNext();
}
function cbSlash(ang, dmg, last, idx) { // 一道劍氣：30 公尺帶狀範圍、命中頓幀＋震動＋沿切線兩邊噴飛
  const pp = player.position, ux = Math.cos(ang), uz = Math.sin(ang), O = CBQ.owned, k = O.length ? O[idx % O.length] : SKD.jobs[CHAR.job]?.basic, e = CBQ.e;
  slashFx(pp, ang, CBQ.col);
  if (k) PCFX.play(SKD.skills[k]?.pcfx || k, 'hit', pp, ang, { fit: 4 }) || PCFX.play(SKD.skills[k]?.pcfx || k, 'cast', pp, ang, { fit: 4, follow: player });
  rig.swing(ang, 'p' + (1 + idx % 4)); let hits = 0; const fx = last && CBQ.full && CBQ.i >= CBQ.max;
  if (fx && e) P.egem.combo = { e, lv: 5 };
  for (const en of enemies) { if (en.dead) continue; const dx = en.mesh.position.x - pp.x, dz = en.mesh.position.z - pp.z, along = dx * ux + dz * uz, side = -dx * uz + dz * ux;
    if (Math.abs(along) > 15 || Math.abs(side) > 1.6 + en.r) continue; hits++;
    hurt(en, dmg, null, 'phys', 'combo', { tags: ['heavy'] });
    if (!en.ai) en.kb.set(-uz * Math.sign(side || 1), 0, ux * Math.sign(side || 1)).multiplyScalar(18);
    if (fx) { if (e === 2) { en.slowK = 0.6; en.slowT = 4; } if ((e === 4 || e === 5) && !en.ai) en.stunT = 1.2; if (e === 7 && !en.boss && !en.dead && en.hp < en.maxHp * 0.25) hurt(en, en.hp + 1, null, 'phys', 'combo'); } }
  delete P.egem.combo;
  if (hits && state === 'play') { state = 'hitstop'; setTimeout(() => { if (state === 'hitstop') { state = 'play'; last0(); } }, last ? 60 : 30); }
  if (hits) bossFx.shake = Math.max(bossFx.shake, 0.25 + (last ? 0.4 : 0));
  return hits;
}
function cbFinish(complete, why = '') { // 終結技：三道劍氣（傷害照接到的段數）；D 階全部接完＝完全體屬性追加效果
  if (!CBQ.on) return; CBQ.on = false; cbPad.style.display = 'none'; ultBtn.style.visibility = '';
  const n = CBQ.i, full = CBQ.full && complete, e = CBQ.e, dmg = CBQ.base * 4 * CBQ.mult * (1 + 0.12 * n) * (full ? 1.6 : 1);
  if (state === 'over') return cbEnd();
  play('boom', 0.8, 0); let hits = 0;
  for (let j = 0; j < 3; j++) hits += cbSlash((P.face || 0) + j * Math.PI / 3, dmg, true, n + j);
  showBanner(`<small>${complete ? (full ? '完全體！' : '全段命中！') : why || '超時'}・${n} COMBO${CBQ.perfect ? `（PERFECT ${CBQ.perfect}）` : ''}</small><b>${JOB_LINE[CHAR.job] || '一刀兩斷！'}</b>`, 1200);
  if (full) { if (e === 1) P.tmp.dmg = Math.max(P.tmp.dmg, 8); if (e === 3) { P.tmp.speed = 6; P.tmp.haste = 6; } if (e === 4 || e === 5) P.shield = Math.round(P.maxHp * 0.3);
    if (e === 6) { P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.3); P.inv = Math.max(P.inv, 1.5); } if (e === 7) P.hp = Math.min(P.maxHp, P.hp + P.maxHp * Math.min(0.3, hits * 0.02)); maybeElemGem(false); }
  P.inv = Math.max(P.inv, 0.8); CB.done++; setTimeout(cbEnd, 400);
}
function cbQUpdate(dt) { // 每格：計時、外圈收縮、無敵
  if (!CBQ.on) return; P.inv = Math.max(P.inv, 0.3); CBQ.t += dt;
  cbPromptEl.style.setProperty('--r', Math.max(0.5, 1 - Math.max(0, CBQ.t) / CBQ.dur * 0.5).toFixed(3));
  if (CBQ.t > CBQ.dur) cbFinish(false, '超時');
}
addEventListener('keydown', ev => { if (!CBQ.on || ev.repeat) return; const k = { KeyA: 'A', KeyS: 'S', KeyD: 'D', KeyJ: 'A', KeyK: 'S', KeyL: 'D' }[ev.code]; if (k) { ev.preventDefault(); cbPress(k); } });
const last0 = () => { last = performance.now(); };
function cbEnd() { CB.st = 'charge'; CB.g = 0; marq.style.display = 'none'; if (CBQ.on) { CBQ.on = false; cbPad.style.display = 'none'; ultBtn.style.visibility = ''; } }
function cbReset() { cbEnd(); CB.done = 0; cbClearOrbs(); }
ultBtn.addEventListener('click', e => { e.stopPropagation(); cbTrigger(); });
addEventListener('keydown', e => { if (e.code === 'Space' && state === 'play' && cbTier()) { e.preventDefault(); cbTrigger(); } });
// ===== 項目 53：地圖動態事件 × MVP 護盾（第八批藍圖）=====
// 依「事件數量」出事件（同時只有 1 個）：淨化嚕啦族祭壇（光圈內累積站 5 秒）、追擊黃金大盜（限時打倒會逃跑的金色精英）、守護希爾特商隊（咕咕撐 30 秒不被打倒）
// 每完成 1 個：結算寶箱品質提升、MVP 減傷護盾少一層（3 層、每層 HP ＋10%）；一個都沒完成：MVP 狂暴（HP ×1.3、攻擊 ×1.3）
const EV = { list: [], cur: null, next: 50, done: 0, failed: 0, mvpDone: false };
const evHud = document.createElement('div'); evHud.id = 'evHud'; document.body.appendChild(evHud);
{ const st = document.createElement('style'); st.textContent = `#evHud{position:fixed;left:50%;top:calc(env(safe-area-inset-top) + 92px);transform:translateX(-50%);z-index:6;pointer-events:none;display:none;min-width:220px;max-width:92vw;text-align:center;padding:6px 14px;border-radius:12px;background:#1a2340cc;border:1px solid #ffd36b99;color:#fff;font-size:13px;font-weight:700;text-shadow:0 1px 2px #000}
#evHud b{color:#ffd36b}#evHud .bar{height:6px;border-radius:4px;background:#0006;margin-top:4px;overflow:hidden}#evHud .bar i{display:block;height:100%;background:linear-gradient(90deg,#7dff9a,#ffd36b)}`; document.head.appendChild(st); }
const EV_TYPES = ['altar', 'thief', 'escort'];
const evEvery = () => Math.max(35, 100 / (1 + 0.2 * (DIFF.event - 1))); // 事件數量越高越頻繁
function evPoint(min = 12, max = 20) { for (let k = 0; k < 30; k++) { const a = Math.random() * 6.283, r = min + Math.random() * (max - min), x = player.position.x + Math.cos(a) * r, z = player.position.z + Math.sin(a) * r; if (MAP.reach(x, z, player.position.x, player.position.z)) return { x, z }; } return { x: player.position.x, z: player.position.z }; }
function evMark(pos, color, r) { const g = new THREE.Group(); const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.18, r, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.07; g.add(ring);
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 14, 12, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })); pillar.position.y = 7; g.add(pillar);
  g.position.set(pos.x, 0, pos.z); scene.add(g); return g; }
function evStart() {
  const type = EV_TYPES[Math.random() * EV_TYPES.length | 0], E = { type, t: 0, ok: false };
  if (type === 'altar') { E.pos = evPoint(); E.r = 3; E.need = 5; E.prog = 0; E.limit = 40; E.mark = evMark(E.pos, 0x9fe0ff, E.r); E.name = '淨化嚕啦族祭壇'; E.tip = '站進藍色光圈裡 5 秒'; }
  if (type === 'thief') { const types = STAGE.monsters || []; const e = spawnEnemy(types[Math.random() * types.length | 0] || Object.keys(ENEMY_TYPES)[0], true); e.thief = true; e.speed = (P.speed || 6) * 0.95; e.hp = e.maxHp = e.maxHp * 0.5; E.e = e; E.limit = 30; E.mark = evMark(e.mesh.position, 0xffd36b, 1.2); E.name = '追擊黃金大盜'; E.tip = '打倒逃跑的金色大盜'; }
  if (type === 'escort') { E.pos = evPoint(8, 14); E.hp = E.maxHp = 100; E.limit = 30; E.mark = evMark(E.pos, 0x7dff9a, 1.4); E.name = '守護希爾特商隊'; E.tip = '保護咕咕撐過 30 秒';
    sealMob('T_by', 1.2).then(f => { if (EV.cur !== E) return; const m = f.create(); m.children[0].rotation.y = Math.PI; m.position.set(E.pos.x, 0, E.pos.z); scene.add(m); E.gugu = m; }).catch(() => {});
    for (let i = 0; i < 6 + DIFF.count; i++) { const types = STAGE.monsters || []; const e = spawnEnemy(types[i % types.length] || Object.keys(ENEMY_TYPES)[0]); const a = Math.random() * 6.283; e.mesh.position.set(E.pos.x + Math.cos(a) * 9, 0, E.pos.z + Math.sin(a) * 9); } }
  EV.cur = E; showBanner(`<small>地圖事件</small><b>${E.name}</b><span>${E.tip}（${E.limit} 秒）</span>`, 1800); play('gem', 0.6, 0);
}
function evEnd(ok) {
  const E = EV.cur; if (!E) return; EV.cur = null; if (E.mark) scene.remove(E.mark); if (E.gugu) scene.remove(E.gugu);
  for (const e of enemies) if (e.evT) e.evT = null; if (E.e && !E.e.dead) E.e.thief = false;
  if (ok) { EV.done++; showBanner(`<small>事件完成 ✔（${EV.done}）</small><b>${E.name}</b><span>寶箱品質提升・MVP 護盾 −1 層</span>`, 1800); play('level', 0.6, 0); dropChest(E.pos || E.e?.mesh.position || player.position, false); }
  else { EV.failed++; showBanner(`<small>事件失敗</small><b>${E.name}</b>`, 1200); }
  EV.next = t + evEvery(); evHud.style.display = 'none';
}
function eventsUpdate(dt) {
  if (TOWER) return; const mvpAt = STAGE.bosses.at(-1)?.[0] ?? 1e9;
  // MVP 護盾：出場時依完成事件數調整
  if (!EV.mvpDone) { const m = enemies.find(e => e.mvp && !e.dead); if (m) { EV.mvpDone = true; const layers = Math.max(0, 3 - EV.done);
    if (EV.done === 0) { m.hp = m.maxHp = m.maxHp * 1.3; m.dmg *= 1.3; showBanner('<small>一個事件都沒完成</small><b>MVP 狂暴！</b><span>HP、攻擊 ×1.3</span>', 1800); }
    else if (layers) { m.hp = m.maxHp = m.maxHp * (1 + 0.1 * layers); showBanner(`<small>MVP 減傷護盾</small><b>剩 ${layers} 層</b><span>完成了 ${EV.done} 個事件</span>`, 1500); }
    else showBanner('<small>完成 3 個以上事件</small><b>MVP 護盾全破！</b>', 1500); } }
  if (!EV.cur) { if (t >= EV.next && t < mvpAt - 20) evStart(); return; }
  const E = EV.cur, pp = player.position; E.t += dt; let prog = 0;
  if (E.type === 'altar') { if (Math.hypot(pp.x - E.pos.x, pp.z - E.pos.z) < E.r) E.prog += dt; prog = E.prog / E.need; if (E.prog >= E.need) return evEnd(true); }
  if (E.type === 'thief') { if (E.e.dead) return evEnd(true); E.mark.position.set(E.e.mesh.position.x, 0, E.e.mesh.position.z); prog = 1 - E.e.hp / E.e.maxHp; }
  if (E.type === 'escort') { prog = E.hp / E.maxHp; let n = 0;
    for (const e of enemies) { if (e.dead) continue; const d = Math.hypot(e.mesh.position.x - E.pos.x, e.mesh.position.z - E.pos.z); e.evT = d < 10 ? E.pos : null; if (d < 1.8) n++; }
    E.hp -= n * 6 * dt; if (E.hp <= 0) return evEnd(false); if (E.t >= E.limit) return evEnd(true); }
  if (E.t >= E.limit) return evEnd(false);
  evHud.style.display = 'block'; evHud.innerHTML = `<b>${E.name}</b>　${E.tip}　剩 ${Math.ceil(E.limit - E.t)} 秒<div class="bar"><i style="width:${Math.round(Math.max(0, Math.min(1, prog)) * 100)}%"></i></div>`;
}
// 第八批 54 選配：趕路自動上馬（設定「趕路自動上馬」打開才有）：同方向移動 2 秒上馬；停下來（連續技 A）自動下馬
const AM = { dir: null, t: 0 };
function autoMount(dt, mv) {
  if (!getSettings().autoMount || !MOUNT_ON || state !== 'play') return;
  if (mv.ml > 0.5) { const d = Math.atan2(mv.mz, mv.mx); if (AM.dir != null && Math.abs(Math.atan2(Math.sin(d - AM.dir), Math.cos(d - AM.dir))) < 0.5) AM.t += dt; else { AM.dir = d; AM.t = 0; }
    if (AM.t > 2 && !rig.mounted) setMounted(true); }
  else { AM.t = 0; AM.dir = null; if (rig.mounted && CB.g >= CB_MAX) setMounted(false); }
}
// 視角切換：V 鍵或右下按鈕
function switchView() { const n = cycleView(); showBanner(`<small>視角</small><b>${n}</b>`, 700); }
addEventListener('keydown', e => { if (e.code === 'KeyV') switchView(); });
document.getElementById('viewBtn')?.addEventListener('click', switchView);

// ===== 遊戲狀態 =====
let chestsArr = null, chests = 0, bossChests = 0, runBosses = []; // runBosses：這局打倒的首領名稱（項目 47 名聲）
let state = 'start', boss = null, P, enemies, gems, t, kills;
let SM = null; // 技能管理器
// 希望OL 怪物（名字照 monster.scr；模型載入失敗就用幾何形狀）
const G = { ball: new THREE.SphereGeometry(0.5, 14, 10), box: new THREE.BoxGeometry(0.9, 0.9, 0.9), cone: new THREE.ConeGeometry(0.55, 1.1, 10),
  oct: new THREE.OctahedronGeometry(0.5), cap: new THREE.CapsuleGeometry(0.35, 0.6, 4, 10), dode: new THREE.DodecahedronGeometry(0.6), ico: new THREE.IcosahedronGeometry(0.55) };
const ENEMY_TYPES = {
  咕咕:     { model: 'T_by', h: 1.0, geo: G.ball, color: 0xffe066, hp: 8,   speed: 2.3, dmg: 6,  xp: 1 },
  小豌豆:   { model: 'T_gr1', h: 0.9, geo: G.ball, color: 0x7ed957, hp: 6,   speed: 2.8, dmg: 5,  xp: 1, scale: 0.75 },
  整人箱:   { model: 'T_box', h: 1.0, geo: G.box,  color: 0xb5835a, hp: 22,  speed: 1.8, dmg: 9,  xp: 2 },
  蘑菇弟弟: { model: 'T_mu1', h: 1.1, geo: G.cone, color: 0xe5533d, hp: 16,  speed: 2.4, dmg: 8,  xp: 2 },
  搖滾菜頭: { model: 'T_gr2', h: 1.2, geo: G.cap,  color: 0x3fbf6f, hp: 30,  speed: 2.6, dmg: 10, xp: 3 },
  飛天豬:   { model: 'T_ba1', h: 1.1, geo: G.ball, color: 0xff9ec4, hp: 20,  speed: 3.6, dmg: 9,  xp: 3, fly: true },
  熊寶寶:   { model: 'T_Be1', h: 1.4, geo: G.dode, color: 0x9a6b44, hp: 60,  speed: 2.0, dmg: 14, xp: 4, scale: 1.2 },
  南瓜舞者: { model: 'T_dancepumpkin', h: 1.6, geo: G.ico,  color: 0xff8c1a, hp: 45,  speed: 3.0, dmg: 12, xp: 4 },
  骷髏兵:   { model: 'T_sk', h: 1.8, geo: G.cap,  color: 0xe8e8e0, hp: 80,  speed: 2.6, dmg: 16, xp: 5 },
  幽靈戰士: { model: 'T_ghostmnight', h: 1.7, geo: G.oct,  color: 0x9fb8ff, hp: 70,  speed: 3.2, dmg: 16, xp: 5, fly: true },
  蘑菇妹妹: { model: 'T_mu2', h: 1.1, geo: G.cone, color: 0x5cbf5c, hp: 26, speed: 2.5, dmg: 10, xp: 3 },
  法師咕咕: { model: 'T_Bbyb', h: 1.1, geo: G.ball, color: 0xffe066, hp: 22, speed: 2.6, dmg: 10, xp: 3 },
  護士咕咕: { model: 'T_Bbyc', h: 1.1, geo: G.ball, color: 0xffe066, hp: 40, speed: 2.7, dmg: 13, xp: 4 },
  戰士咕咕: { model: 'T_Bbyd', h: 1.2, geo: G.ball, color: 0xffe066, hp: 55, speed: 2.8, dmg: 15, xp: 5 },
  熊媽媽:   { model: 'T_Be2', h: 1.5, geo: G.dode, color: 0x8a5b34, hp: 90, speed: 2.1, dmg: 18, xp: 6, scale: 1.2 },
  蘑菇奶奶: { model: 'T_mu3', h: 1.2, geo: G.cone, color: 0xff8040, hp: 75, speed: 2.4, dmg: 17, xp: 6 },
  // 首領
  菜頭王:   { model: 'T_mumuver2', h: 1.3, geo: G.cap,  color: 0x2e9e55, hp: 900,  speed: 2.0, dmg: 25, xp: 40, scale: 3, boss: true },
  熊爸爸:   { model: 'T_bear_fighter_attack', h: 1.5, geo: G.dode, color: 0x6b4423, hp: 2200, speed: 2.1, dmg: 32, xp: 60, scale: 3, boss: true },
  骷髏王:   { model: 'T_skull_oldman_stand', h: 1.7, geo: G.cap,  color: 0xd8d0b8, hp: 4500, speed: 2.3, dmg: 40, xp: 80, scale: 3.2, boss: true },
  魔蠍大帝: { model: 'boss_scorpion', h: 2.0, yaw: 0, geo: G.oct,  color: 0x8b1a1a, hp: 9000, speed: 2.5, dmg: 50, xp: 120, scale: 3.4, boss: true },
};
// 載入希望OL 模型當樣板（載入失敗就用幾何形狀）
const TEMPLATES = {};
// 進戰場前的載入畫面：怪物樣板＋玩家模型＋坐騎，載完才能按開始
let loadDone = 0; const loadTotal = Object.keys(ENEMY_TYPES).length + 2;
const GLOAD = pcLoading({ img: STAGE.banner, title: STAGE.name }); // PC 原版載入畫面（地圖插畫＋TIP＋黃色進度條）
const loadTick = () => { loadDone++; const p = Math.round(loadDone / loadTotal * 100); document.getElementById('gloadBar').style.width = p + '%'; document.getElementById('gloadTxt').textContent = `正在進入 ${STAGE.name}… ${p}%`; GLOAD.set(p); };
// 這個職業（含二轉分支）會出現的技能 → 預先載入原版特效
const pcfxReady = PCFX.preload(['levelup', 'monrejen', 'bigkill', 'bigitem', ...(SKD.jobs[CHAR.job]?.pool || []).map(k => SKD.skills[k]?.pcfx || k), ...((TAL && CHAR.job2 && branchOf(TAL, CHAR.job, CHAR.job2)?.skills) || []), ...((TAL && CHAR.job3 && [branchOf(TAL, CHAR.job, CHAR.job2)?.skill3].filter(Boolean)) || [])]).catch(() => {});
const modelsReady = Promise.all(Object.entries(ENEMY_TYPES).map(async ([k, T]) => {
  // 有骨架＋動作的用會動的版本（項目 6：走、攻擊、受擊、倒下），沒有的用靜態模型
  try { const mob = await sealMob(T.model, T.h).catch(() => null);
    if (mob) TEMPLATES[k] = { mob, yaw: T.yaw ?? Math.PI };
    else { const g = await sealModel(T.model, T.h); g.children[0].rotation.y = T.yaw ?? Math.PI; TEMPLATES[k] = g; } } catch (e) { console.warn(k, e.message); }
  loadTick();
}));
// 生怪＋首領時間表（src/2_core/game-manager.js）
// 生怪清單：站在四區之一＝那一區的怪；中央＝照時間解鎖（跟以前一樣）
const spawner = createSpawner(STAGE, t => { if (TOWER) return STAGES[towerSeg(floor)].monsters; const z = zoneAt(MAP, player.position.x, player.position.z);
  return z < 4 && STAGE.zones ? STAGE.zones[z].monsters : STAGE.monsters.slice(0, Math.min(STAGE.monsters.length, 2 + Math.floor(t / 100))); });
// 每隻王的狀態（小地圖用）；王照原本時間出現在「玩家正在打的地方」（使用者 11/18：不要侷限在固定位置）
let bossSlots = [], curZone = 4;
const resetBossSlots = (doneBefore = 0) => { bossSlots = STAGE.bosses.map(([at, type, kind], i) => ({ at, type, kind, e: null, done: i < doneBefore })); };
function enterBoss(type, kind, i) {
  const e = BS.enter(type, kind, null, zoneName(STAGE, curZone));
  if (bossSlots[i]) bossSlots[i].e = e;
}
const BOSSES = spawner.BOSSES;
spawner.countMul = DM.spawn; spawner.eventMul = DM.event;
Promise.all([rig.actorReady.finally(loadTick), rig.mountReady.finally(loadTick), modelsReady, pcfxReady]).then(() => {
  GLOAD.done(); document.getElementById('gload').style.display = 'none'; const go = document.getElementById('go'); go.disabled = false; go.textContent = '開始';
  // 11/18 使用者：不用按開始 → 載完後標題（希望倖存者＋地圖名＋等級）顯示 1.8 秒就直接開打
  if (!/auto|resume/.test(location.search)) setTimeout(async () => { if (state !== 'start') return; if (!(await askResume())) start(); }, 1800);
});
// 11/19 使用者：「按到重整就要重新開始，沒有問我要不要回去上一局」→ 戰場頁重新整理／重開時也問（以前只有回主城才問）
async function askResume() {
  let snap = null; try { snap = JSON.parse(localStorage.getItem(RUN_KEY)); } catch {}
  if (!snap || TOWER || Date.now() - snap.saved > 24 * 3600e3) return false;
  const tm = `${snap.t / 60 | 0}:${String(snap.t % 60 | 0).padStart(2, '0')}`;
  const yes = await askConfirm(`上一局還沒打完：${snap.stageName} 第 ${tm} 分、Lv ${snap.lv}、擊殺 ${snap.kills}。\n要接著打嗎？（放棄的話先結算已拿到的經驗與金幣）`, { title: '未完成的一局', ok: '繼續', cancel: '放棄' });
  if (yes) {
    if (snap.stage !== STAGE_IDX) { location.href = `game.html?resume&stage=${snap.stage}`; return true; }
    await start(); resumeRun(snap); return true;
  }
  clearRun();
  let token = null; try { token = localStorage.getItem('ss_token'); } catch {}
  if (token && CHAR.id) submitRun(token, { charId: CHAR.id, secs: Math.floor(snap.t), kills: snap.kills | 0, lv: snap.lv | 0, cleared: false, chests: snap.chests | 0, bossChests: snap.bossChests | 0, stage: snap.stageKey, spent: snap.spent | 0 })
    .then(j => showBanner(`<small>上一局已結算</small><b>經驗 +${j.gain}　金幣 +${j.gold}</b>`, 2200)).catch(() => {});
  return false;
}
// 瀏覽器不讓沒點過的頁面自動放音樂 → 第一次按鍵／點畫面時補播
const kickBgm = () => { if (!muted && state !== 'start' && bgm.paused) bgm.play().catch(() => {}); };
addEventListener('pointerdown', kickBgm, { once: true }); addEventListener('keydown', kickBgm, { once: true });

// 職業技能：assets/data/skills.json＋skills.js（企劃_技能系統.md）
const PASSIVES = {
  might: { name: '攻擊強化', img: FX.hit, desc: () => '所有傷害 +15%', apply: () => P.might *= 1.15 },
  speed: { name: '疾行', img: FX.gem, desc: () => '移動速度 +12%', apply: () => P.speed *= 1.12 },
  vital: { name: '體魄', img: FX.hit, desc: () => '最大 HP +25，並回滿血', apply: () => { P.maxHp += 25; P.hp = P.maxHp; } },
  magnet: { name: '磁力', img: FX.gem, desc: () => '經驗吸取範圍 +40%', apply: () => P.magnet *= 1.4 },
  haste: { name: '急速', img: FX.lightning, desc: () => '急速 +12（冷卻約 -10%，越疊越少）', apply: () => { P.hasteV += 12; } }, // 項目 34 遞減收益
  // 11/19 使用者企劃「初心者共通技」（一轉後保留，所有職業都會出現）
  run: { name: '快跑', img: FX.gem, desc: () => '移動速度 +10%、經驗吸取範圍 +20%', apply: () => { P.speed *= 1.1; P.magnet *= 1.2; } },
  aid: { name: '緊急治療', img: FX.hit, desc: () => '每 10 秒自動回復 6% 最大 HP（可疊加）', apply: () => { P.aid = (P.aid || 0) + 1; } },
  feign: { name: '裝死', img: FX.hit, desc: () => 'HP 低於 25% 時倒地裝死：2 秒無敵（冷卻 60 秒，每多一級 −10 秒）', apply: () => { P.feign = (P.feign || 0) + 1; } },
  orbDrop: { name: '能量球掉落', img: FX.gem, desc: () => '屬性能量球掉落率 +10%', apply: () => { P.orbDrop = (P.orbDrop || 0) + 0.1; } },
  orbMag: { name: '能量吸取', img: FX.gem, desc: () => '能量球吸取範圍 +30%', apply: () => { P.orbMag = (P.orbMag || 0) + 0.3; } },
  orbHeal: { name: '聚氣回生', img: FX.hit, desc: () => '撿到能量球回復 1% 生命（可疊加）', apply: () => { P.orbHeal = (P.orbHeal || 0) + 1; } },
  comboExt: { name: '連段擴充', img: FX.lightning, desc: () => `完全體 A→S→D 連續技 +2 段（現在 ${Math.min(12, P.comboLen || 3)} 段，最多 12 段）`, apply: () => { P.comboLen = Math.min(12, (P.comboLen || 3) + 2); } },
  cheer: { name: '初心者鼓舞', img: FX.lightning, desc: () => '所有傷害 +10%、經驗 +10%', apply: () => { P.might *= 1.1; P.expMul = (P.expMul || 1) + 0.1; } },
};

// ===== 物件池（src/2_core/pool.js）=====
const enemyPool = new MeshPool(scene, '怪物'), gemPool = new MeshPool(scene, '經驗寶石'); const corpses = []; let animFrame = 0;
const numsEl = document.getElementById('dmgnums'), nums = [], numPool = new DomPool(numsEl, 40);

function reset() {
  try { pendLv = 0; pendShow(); } catch {} // 升級累積清空（宣告在後面，太早呼叫時略過）
  if (enemies) for (const e of enemies) enemyPool.release(e.mesh); for (const c of corpses) enemyPool.release(c.m); corpses.length = 0;
  if (gems) for (const g of gems) gemPool.release(g.mesh);
  for (const c of coins) scene.remove(c.mesh); coins = [];
  const B = CHAR.bonus || {};
  const hp = Math.round(JOB.hp + ST.vit * 6 + (B.hp || 0));
  // 項目 35：PC 6 項素質（敏捷＝爆擊＋迴避、精神＝冷卻、體力＝HP＋減傷、感覺＝爆擊微幅；移速不再吃素質）
  // 項目 34：威力 近戰＝力量 3%／點；遠程（獵人）＝力量 1%＋敏捷 3%（PC 沒有 DEX → 用敏捷）；魔法＝智力 3%
  P = { hp, maxHp: hp, speed: JOB.speed, might: 1, phys: 1 + (CHAR.job === '獵人' ? ST.str * 0.01 + ST.agi * 0.03 : ST.str * 0.03), magic: 1 + ST.int * 0.03, crit: ST.agi * 0.01 + ST.luk * 0.003,
        dodge: Math.min(0.4, ST.agi * 0.005), vitDr: Math.min(0.3, ST.vit * 0.003),
        armor: JOB.armor + (B.armor || 0), regen: JOB.regen || 0, magnet: (CHAR.job === '初心者' ? 3 : 2.5) * (1 + (B.magnet || 0)), hasteV: (ST.wis || 1) + (B.haste || 0) * 100, lv: 1, xp: 0, need: CHAR.job === '初心者' ? 6 : 5, inv: 0, face: 0 };
  // 項目 34 遞減收益：急速值 → 冷卻倍率＝1／(1＋急速／100)（急速 100＝冷卻剩 50%；精神 1 點＝急速 1、裝備／天賦／石頭／稱號的冷卻 % 換成急速值）
  Object.defineProperty(P, 'haste', { get() { return 1 / (1 + Math.max(0, this.hasteV + (this.tmp.haste > 0 ? 30 : 0)) / 100); } });
  P.tmp = { dmg: 0, haste: 0, speed: 0, dash: 0 }; // 項目 37：菁英寶箱的局內道具（剩餘秒數）
  P.might *= 1 + (B.atk || 0); P.crit += B.crit || 0; P.speed *= 1 + (B.speed || 0); P.skd = B.skd || 0; // skd：項目 32 傳說詞綴「技能傷害」（不含普攻）
  const TE = TAL ? talentEffects(TAL, CHAR.job, ...(([a1, a2]) => [a1, CHAR.job2, a2])(boostedAlloc(TAL, CHAR.job, CHAR.talents, CHAR.job2, CHAR.talents2, CHAR.items))) : { stat: {}, skill: {}, tag: {} }, ts = TE.stat;
  P.might *= 1 + (ts.atk || 0); P.phys += ts.phys || 0; P.magic += ts.magic || 0; P.crit += ts.crit || 0; P.speed *= 1 + (ts.speed || 0);
  P.hasteV += (ts.haste || 0) * 100; P.armor += ts.armor || 0; P.regen += ts.regen || 0; P.magnet *= 1 + (ts.magnet || 0);
  if (ts.hp) { P.maxHp = Math.round(P.maxHp * (1 + ts.hp)); P.hp = P.maxHp; }
  P.talent = TE;
  P.egem = {}; // 項目 23：局內屬性寶石 { 技能: { e 屬性, lv 1～5 } }
  // 項目 28：鑲嵌石（三顆石頭的屬性直接加到角色）
  { const S = stoneEffects(CHAR.stones);
    P.might *= (1 + (S.atk || 0)) * (1 + (S.dmgUp || 0)); P.magic += S.magic || 0; P.armor += S.armor || 0; P.hasteV += (S.haste || 0) * 100;
    P.speed *= 1 + (S.speed || 0); P.crit += S.crit || 0; P.dr = Math.min(0.5, S.dmgDown || 0);
    if (S.hp) { P.maxHp = Math.round(P.maxHp * (1 + S.hp)); P.hp = P.maxHp; } }
  // 項目 30：出戰寵物的被動加成
  if (PET) { const pb = petBonus(PET); P.might *= 1 + (pb.atk || 0); P.crit += pb.crit || 0; P.regen += pb.regen || 0; if (pb.hp) { P.maxHp = Math.round(P.maxHp * (1 + pb.hp)); P.hp = P.maxHp; } }
  // 項目 47：裝上的稱號加成
  { const tb = titleOf(CHAR.title)?.bonus || {}; P.might *= 1 + (tb.atk || 0); P.magic += tb.magic || 0; P.crit += tb.crit || 0; P.speed *= 1 + (tb.speed || 0);
    P.hasteV += (tb.haste || 0) * 100; P.armor += tb.armor || 0; if (tb.hp) { P.maxHp = Math.round(P.maxHp * (1 + tb.hp)); P.hp = P.maxHp; } }
  // 個性化 v2 主要個性能力值（src/1_data/persona.js；次要個性已經加在素質裡）
  { const pb = personaBonus(CHAR.persona); P.might *= 1 + (pb.atk || 0); P.crit += pb.crit || 0; P.armor += pb.armor || 0; P.hasteV += (pb.haste || 0) * 100; P.speed *= 1 + (pb.speed || 0);
    P.magnet *= 1 + (pb.magnet || 0); P.dr = Math.min(0.5, (P.dr || 0) + (pb.dmgDown || 0)); P.magic += pb.magic || 0; P.expMul = (P.expMul || 1) + (pb.exp || 0); if (pb.hp) { P.maxHp = Math.round(P.maxHp * (1 + pb.hp)); P.hp = P.maxHp; } }
  // 賢者之塔艾希頓套裝加成（2／4 件）
  { const sb = setBonus(CHAR.items); P.might *= 1 + (sb.atk || 0); P.crit += sb.crit || 0; P.dr = Math.min(0.5, (P.dr || 0) + (sb.dmgDown || 0)); if (sb.hp) { P.maxHp = Math.round(P.maxHp * (1 + sb.hp)); P.hp = P.maxHp; } }
  if (TOWER && TSET?.penalty) P.might *= 0.85; // 戰鬥力未達建議值：懲罰
  P.gem = gemEffects(CHAR.gemSlots, CHAR.gems); // 項目 28：技能寶石（每招 傷害／爆擊率／爆擊傷害／冷卻）
  if (chestsArr) for (const c of chestsArr) scene.remove(c.mesh);
  chestsArr = []; chests = 0; bossChests = 0; runBosses = []; finalDown = false; winAt = null; goldSpent = 0; dashCd = 0; if (typeof EV !== 'undefined') { if (EV.cur) evEnd(false); Object.assign(EV, { cur: null, next: 50, done: 0, failed: 0, mvpDone: false }); } cbReset();
  enemies = []; gems = []; t = 0; kills = 0; spawner.reset();
  SM?.clear(); fxPool.clear(); PCFX.clear();
  SM = new SkillManager({ pcfx: PCFX, data: SKD, job: CHAR.job, pool: TOWER ? TSET?.skills : null, extraPool: (TAL && CHAR.job2 && (B => [...(B?.skills || []), ...(CHAR.job3 && B?.skill3 ? [B.skill3] : [])])(branchOf(TAL, CHAR.job, CHAR.job2))) || [], maxCarry: CHAR.job3 ? 6 : CHAR.job2 ? 5 : 4, /* 技能欄 一轉 4／二轉 5／三轉 6（項目 37、40）*/ fx: fxPool, player, P, enemies: () => enemies, nearest, hurt, onCast: (f, motion) => rig.swing(f, motion), sound: k => play(k, 0.35, 120), onMusou: m => { showBanner(`<small>${SM.combo} 連擊！職業無雙</small><b>${m.name}</b>`, 1100); bossFx.shake = Math.max(bossFx.shake, 0.4); } });
  if (TOWER) { floor = 1; document.getElementById('stageName').textContent = `${TOWER_NAME}　第 1 層`; for (const [k, v] of Object.entries(TSET?.boost || {})) for (let i = 0; i <= v && v > 0; i++) SM.add(k); } // 塔點數：選好的技能起始等級＝1＋點數
  setBoss(null); BS.clear(); passives = {}; dmgStats = {}; for (const n of nums) numPool.release(n.el); nums.length = 0;
  rig.resetMount();
  { const b = document.getElementById('mountBtn'); if (b) { b.style.display = MOUNT_ON ? 'block' : 'none'; b.textContent = '上坐騎 (R)'; } }
  player.position.set(MAP.spawn.x, 0, MAP.spawn.z); resetBossSlots(); curZone = zoneAt(MAP, MAP.spawn.x, MAP.spawn.z);
}

// ===== 生成 =====
function spawnEnemy(type, elite = false, asBoss = false) {
  const T = ENEMY_TYPES[type], r = 22 + Math.random() * 6, isBoss = !!T.boss || asBoss;
  // 生在玩家周圍一圈，但要在地圖裡（靠邊時換個方向）
  let a = Math.random() * Math.PI * 2;
  // 11/20「地圖死角」：要生在跟玩家同一塊走得到的地方（隔著牆的區域不算）
  for (let k = 0; k < 24 && !MAP.reach(player.position.x + Math.cos(a) * r, player.position.z + Math.sin(a) * r, player.position.x, player.position.z); k++) a = Math.random() * Math.PI * 2;
  const sc = (T.scale || 1) * (elite ? 1.7 : 1);
  const s = TEMPLATES[type] ? sc / (T.scale || 1) * (isBoss ? (T.boss ? 2.3 : 2.6) : 1) : sc;
  // 同「種類＋精英＋首領」的模型共用一個池子
  const mesh = enemyPool.get(`${type}|${elite ? 1 : 0}|${asBoss ? 1 : 0}`, () => {
    const TT = TEMPLATES[type], m = TT?.mob ? TT.mob.create() : TT ? TT.clone() : new THREE.Mesh(T.geo, new THREE.MeshStandardMaterial({ color: T.color, roughness: 0.6 }));
    if (TT?.mob) m.children[0].rotation.y = TT.yaw;
    m.scale.setScalar(s);
    if (elite) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.06, 6, 24), new THREE.MeshBasicMaterial({ color: 0xffd36b })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.05; ring.scale.setScalar(1 / m.scale.x * sc * 0.8); m.add(ring); }
    return m;
  });
  mesh.scale.setScalar(s); mesh.rotation.set(0, 0, 0); mesh.userData.actor?.reset();
  mesh.position.set(player.position.x + Math.cos(a) * r, 0, player.position.z + Math.sin(a) * r);
  const early = TOWER ? 1 : earlyMul(STAGE, t, isBoss || asBoss); // 項目 31：T2／T3 開局 180 秒怪物先削弱，首領全力
  const hpMul = (TOWER ? towerHpMul(floor) * (CURSE.hp || 1) : (1 + t / 100) * DM.hp) * (elite ? 12 : 1) * (TOWER ? STAGES[towerSeg(floor)].hp : STAGE.hp) * (asBoss ? 45 : 1) * early;
  const e = { mesh, type, hp: T.hp * hpMul, maxHp: T.hp * hpMul, speed: T.speed * (0.9 + Math.random() * 0.2) * (CURSE.speed || 1) * DM.speed, dmg: T.dmg * (elite ? 1.5 : 1) * (TOWER ? (TSET?.penalty ? 1.3 : 1) * STAGES[towerSeg(floor)].dmg * towerDmgMul(floor) : STAGE.dmg * DM.dmg) * (asBoss ? 1.6 : 1) * early,
    xp: T.xp * (elite ? 10 : 1) * (asBoss ? 25 : 1) * (CURSE.xp || 1), flash: 0, r: 0.5 * sc, kb: new THREE.Vector3(), elite, boss: isBoss, fly: !!T.fly, baseY: 0, s0: mesh.scale.x, ph: Math.random() * 6 };
  enemies.push(e); return e;
}
const gemGeo = new THREE.OctahedronGeometry(0.22);
// ===== 局內金幣（11/19 使用者：「遊戲內不會掉金幣，新手沒辦法開寶箱」）=====
// 怪物倒下有機會掉金幣，走過去自動吸；本局賺的金幣（跟結算同一條公式：擊殺/3＋秒數/2 × 地圖倍率）當場就能拿來開菁英寶箱
const coinGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.05, 14).rotateX(Math.PI / 2), coinMat = new THREE.MeshBasicMaterial({ color: 0xffcf3a });
let coins = [];
const runGold = () => Math.floor(((kills || 0) / 3 + (t || 0) / 2) * (STAGE?.reward || 1));
const goldHave = () => (CHAR.gold || 0) + runGold() - goldSpent;
function dropCoin(pos) { if (Math.random() > 0.35) return; const mesh = new THREE.Mesh(coinGeo, coinMat); mesh.position.set(pos.x + (Math.random() - 0.5) * 0.6, 0.45, pos.z + (Math.random() - 0.5) * 0.6); scene.add(mesh); coins.push({ mesh, pull: false }); }
const gemMat = [new THREE.MeshBasicMaterial({ color: 0x4fc3ff }), new THREE.MeshBasicMaterial({ color: 0x7dff9a }), new THREE.MeshBasicMaterial({ color: 0xffd36b })];
const chestTex = loader.load('assets/items/351.png'); chestTex.colorSpace = THREE.SRGBColorSpace; chestTex.magFilter = THREE.NearestFilter;
// PC 原版掉落物模型（客戶端 item/item_xx.ms1）：寶箱＝禮物盒 item_07、經驗寶石＝淡藍水晶 item_10／粉紅寶石 item_16／紫寶石 item_23
// 模型還沒載好就先用舊的圖片／八面體
let chestModel = null; sealModel('item_07', 0.75).then(g => { chestModel = g; }).catch(() => {});
const GEM_MODELS = ['item_10', 'item_16', 'item_23'], gemGeos = [null, null, null], gemMats = [null, null, null];
GEM_MODELS.forEach((n, i) => sealModelData(n).then(d => { const g = d.geos[0].clone(); g.computeBoundingBox(); const b = g.boundingBox, c = b.getCenter(new THREE.Vector3()), h = (b.max.y - b.min.y) || 1;
  g.translate(-c.x, -c.y, -c.z); const k = 0.5 / h * (1 + i * 0.2); g.scale(k, k, k); gemGeos[i] = g; gemMats[i] = d.partMats[0]; }).catch(() => {}));
function dropChest(pos, isBoss, elite = false) {
  let m;
  if (chestModel) { m = chestModel.clone(); m.scale.setScalar(isBoss ? 1.5 : 1); if (isBoss) m.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.setHex(0xffe08a); } }); }
  else { m = new THREE.Sprite(new THREE.SpriteMaterial({ map: chestTex, color: isBoss ? 0xffd36b : 0xffffff })); m.scale.setScalar(isBoss ? 1.6 : 1.1); }
  m.userData.model = !!chestModel;
  m.position.set(pos.x, 0.8, pos.z); scene.add(m);
  const glow = new THREE.Sprite(addMat(tex.gem, isBoss ? 0xffc040 : 0x80c0ff)); glow.scale.setScalar(isBoss ? 3 : 2); m.add(glow); glow.position.z = -0.01;
  if (elite) m.traverse(o => { if (o.isMesh || o.isSprite) { o.material = o.material.clone(); o.material.color.setHex(0xc08cff); } });
  chestsArr.push({ mesh: m, isBoss, elite });
}
function dropGem(pos, xp) {
  const k = xp >= 20 ? 2 : xp >= 3 ? 1 : 0;
  const mesh = gemPool.get('gem' + k, () => new THREE.Mesh(gemGeo, gemMat[k]));
  if (gemGeos[k] && mesh.geometry !== gemGeos[k]) { mesh.geometry = gemGeos[k]; mesh.material = gemMats[k]; } // 原版水晶模型載好了就換上
  mesh.position.set(pos.x, 0.35, pos.z);
  gems.push({ mesh, xp, pull: false });
}
function spawnFx(texKey, pos, opts) { return fxPool.spawn(texKey, pos, opts); }

// ===== 傷害 =====
// opts：{ tags:[ice/fire/heavy], status:{ slow:[比例,秒], poison:[每秒,秒], stun:[機率,秒] }, noCombo }
// ===== 項目 23：局內屬性寶石（撿到首領寶箱必出、一般寶箱 30%；鑲到一招：改屬性＋每級傷害 +10%、爆擊 +3%；同屬性再出現＝升級，最高 5）=====
let elemCd = 0;
// ===== 項目 42：寶箱上限＋撿取篩選（一般寶箱每局最多 100 個、首領寶箱不算；篩選＝結算時低於門檻的裝備直接不要）=====
const LOOT_CAP = 100, LOOT_F = ['全部', '精良以上', '稀有以上', '史詩以上', '只要傳說'];
let lootMin = 0; try { lootMin = Math.max(0, Math.min(4, +localStorage.getItem('ss_lootf') || 0)); } catch {}
const lootBtn = document.getElementById('lootf');
const drawLootBtn = () => { if (lootBtn) { lootBtn.textContent = '🔍 ' + LOOT_F[lootMin]; lootBtn.style.color = lootMin ? RARITY[lootMin].color : ''; } };
lootBtn?.addEventListener('click', e => { e.stopPropagation(); lootMin = (lootMin + 1) % LOOT_F.length; try { localStorage.setItem('ss_lootf', String(lootMin)); } catch {} drawLootBtn(); });
drawLootBtn();
function maybeElemGem(boss, force = 0) { // force＝測試用：指定屬性
  if (!boss && Math.random() >= 0.3) return;
  const el = force || 1 + (Math.random() * 7 | 0), have = Object.entries(P.egem).find(([, g]) => g.e === el);
  if (have) { const g = have[1]; if (g.lv < 5) g.lv++; showBanner(`<small>屬性寶石</small><b style="color:${ELEM_COLOR[el]}">${ELEMS[el]}屬性 Lv${g.lv}</b><span>${skillName(have[0])} 強化了${g.lv >= 5 ? '（已滿級）' : ''}</span>`, 1600); drawSkillbar(); return; }
  const owned = Object.keys(SM.skills); if (!owned.length) return;
  state = 'gem';
  const box = document.createElement('div'); box.id = 'gemPick';
  box.style.cssText = 'position:fixed;inset:0;z-index:50;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:#0009;color:#fff;font-weight:700';
  box.innerHTML = `<div style="font-size:22px">💎 屬性寶石：<b style="color:${ELEM_COLOR[el]}">${ELEMS[el]}</b>（傳說）</div><div style="font-size:13px;opacity:.85">鑲到一招技能：改成${ELEMS[el]}屬性（照原版相剋），傷害 +10%、爆擊 +3%；之後再撿到${ELEMS[el]}寶石會升級</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">${owned.map(k => { const g = P.egem[k], ce = g ? g.e : skillElem(SKD.skills[k]);
      return `<button data-eg="${k}" style="width:150px;padding:10px;border-radius:12px;border:2px solid #fff;background:linear-gradient(#3a4a7a,#1d2748);color:#fff;cursor:pointer;font:inherit">${iconHtml(SKD.skills[k].icon, 40)}<div>${skillName(k)}</div><small style="color:${ELEM_COLOR[ce]}">目前：${ELEMS[ce]}${g ? ` Lv${g.lv}（會被換掉）` : ''}</small></button>`; }).join('')}</div>
    <button data-eg="" style="padding:6px 18px;border-radius:10px;border:1px solid #fff8;background:#0006;color:#fff;cursor:pointer;font:inherit">不要</button>`;
  document.body.appendChild(box);
  box.querySelectorAll('[data-eg]').forEach(b => b.onclick = () => { const k = b.dataset.eg; if (k) P.egem[k] = { e: el, lv: 1 }; box.remove(); state = 'play'; last = performance.now(); drawSkillbar(); });
}
function hurt(e, dmg, from, kind = 'phys', src = '', opts = {}) {
  if (e.ai?.st === 'rise') return;
  const tags = opts.tags || [], st = opts.status || {};
  // 屬性聯動：緩速／暈眩中的怪被火或重擊打到 → 必定爆擊 ×1.5（碎冰）
  const weak = (e.slowT > 0 || e.stunT > 0) && (tags.includes('fire') || tags.includes('heavy'));
  const gm = P.gem?.[src], eg = P.egem?.[src];
  // 項目 44：屬性相剋（element.scr）；項目 23：屬性寶石改招式屬性、每級爆擊 +3%
  const em0 = elemMult(eg ? eg.e : src === 'pet' && PET ? PETS[PET.kind].elem : (skillElem(SKD.skills[src]) || W_ELEM), MONSTER_ELEM[e.type] ?? 0); // 指令 4-3：招式本身沒屬性 → 用武器合成的屬性 // 寵物＝自己的屬性
  const em = em0 > 1 ? 1 + (em0 - 1) * 1.5 : em0; // 項目 57：提高相剋倍率（剋制的加成 ×1.5，例：1.2 → 1.3）
  const crit = weak || Math.random() < P.crit + (gm?.crit || 0) + (eg ? 0.03 * eg.lv : 0);
  // 項目 34：× 0.9～1.1 隨機；爆擊 ×1.6＋額外（技能寶石爆傷）
  const amt = dmg * P.might * (kind === 'magic' ? P.magic : P.phys) * (crit ? 1.6 + (gm?.critDmg || 0) : 1) * (weak ? SKD.status.shatterMult : 1) * em * (0.9 + Math.random() * 0.2) * (P.tmp.dmg > 0 ? 1.2 : 1);
  if (em >= 1.2 && elemCd < t) { elemCd = t + 0.5; dmgNum(e.mesh.position, 0, true, 2.4, false, '剋！'); } else if (em <= 0.5 && elemCd < t) { elemCd = t + 0.8; dmgNum(e.mesh.position, 0, false, 2.4, false, '抗'); }
  if (weak && Math.random() < 0.5) { spawnFx('ice', e.mesh.position, { scale: 1.8, life: 0.3, grow: 1.6, color: 0xbfe8ff }); shatterText(e.mesh.position); }
  // 上狀態（首領只吃一半）
  const bossK = e.boss || e.ai ? 0.5 : 1;
  const slow = st.slow || (tags.includes('ice') ? [0.4, 2] : null);
  if (slow) { e.slowK = Math.max(e.slowT > 0 ? e.slowK : 0, slow[0] * bossK); e.slowT = slow[1]; }
  if (st.poison) { e.poison = { dps: st.poison[0], t: st.poison[1], tick: 0.5 }; }
  if (st.stun && !e.ai && Math.random() < st.stun[0]) e.stunT = st.stun[1];
  // 連擊無雙已取消（使用者 11/18：怪一多隨便就能達成）
  e.hp -= amt; trackDmg(src, amt); dmgNum(e.mesh.position, amt, crit, e.hgt || 1.2); e.flash = crit ? 0.18 : 0.1; if (crit) { e.mesh.userData.actor?.act('ms'); mobSound(e, 'ms', 0.18, 150); }
  if (from) { e.kb.subVectors(e.mesh.position, from).setY(0).normalize().multiplyScalar(e.boss ? 0.3 : e.elite ? 2 : 6); }
  play('hit', 0.25, 60);
  if (e.hp <= 0 && !e.dead) {
    e.dead = true; kills++; dropGem(e.mesh.position, e.xp); dropCoin(e.mesh.position); cbOnKill(e); mobSound(e, 'dd'); if (e.ai) runBosses.push(e.type);
    if (e.mvp) finalDown = true;
    if (e.ai) { BS.death(e); dropChest(e.mesh.position, true); PCFX.play('bigkill', 'cast', e.mesh.position, 0, { y: 0.3, scale: 1.4 }); /* 原版 BigKill */ const sl = bossSlots.find(b => b.e === e); if (sl) sl.done = true; }
    else if (e.elite) { if (Math.random() < 0.4) dropChest(e.mesh.position, false); dropChest({ x: e.mesh.position.x + 1.2, z: e.mesh.position.z }, false, true); } // 項目 37：菁英另外一定掉菁英寶箱（花金幣開、開出局內道具）
    if (e === boss) setBoss(null);
    spawnFx('hit', e.mesh.position, { scale: 1.6, life: 0.25, grow: 1.5, color: 0xffffff });
  }
}
// 最近的敵人（XZ 距離，不算高度）
function nearest(pos, maxD = 1e9, skip) {
  let best = null, bd = maxD * maxD;
  for (const e of enemies) { if (e.dead || skip?.has(e)) continue; const dx = e.mesh.position.x - pos.x, dz = e.mesh.position.z - pos.z, d = dx * dx + dz * dz; if (d < bd) { bd = d; best = e; } }
  return best;
}

const bossEl = document.getElementById('boss');
function setBoss(e) { boss = e; bossEl.style.display = e ? 'block' : 'none'; if (e) { bossEl.querySelector('b').textContent = e.type; document.getElementById('bossTitle').textContent = '　' + (BOSS_TITLES[e.type] || ''); } }

const bannerEl = document.getElementById('banner');
let bannerTimer;
function showBanner(html, ms = 2600, warn = false) {
  bannerEl.innerHTML = html; bannerEl.className = 'on' + (warn ? ' warn' : '');
  clearTimeout(bannerTimer); bannerTimer = setTimeout(() => bannerEl.className = '', ms);
}
function hitPlayer(dmg) {
  if (P.inv > 0) return;
  if (Math.random() < (P.dodge || 0)) { P.inv = 0.25; dmgNum(player.position, 0, false, 2, true, 'MISS'); return; } // 項目 35：敏捷迴避
  // 項目 34：受傷＝max(1,(攻擊−護甲)×(1−減傷，所有減傷加總上限 60%))；迴避先判定（上面）。護甲維持 ×2（我們的護甲數字小）
  const taken = Math.max(1, Math.round((dmg - P.armor * 2) * (1 - Math.min(0.6, (P.dr || 0) + (P.vitDr || 0))) * (NOVICE_RUN && t < 20 ? 0.5 : 1))); // 初心者前 20 秒受傷減半 if (P.shield > 0) { const ab = Math.min(P.shield, taken); P.shield -= ab; P.hp += ab; } // 連續技金土 Excellent：臨時護盾先吃傷害
  P.hp -= taken; P.inv = NOVICE_RUN ? 0.8 : 0.5;
  if (P.feign && P.hp > 0 && P.hp < P.maxHp * 0.25 && !(P.feignCd > 0)) { P.inv = 2; P.feignCd = Math.max(20, 60 - 10 * (P.feign - 1)); showBanner('<small>裝死</small><b>…（不動）</b><span>2 秒無敵</span>', 900); } // 裝死 play('hurt', 0.5, 200); dmgNum(player.position, taken, false, 2, true);
  bossFx.shake = Math.max(bossFx.shake, 0.25);
}
// 首領（src/2_core/game-manager.js）
const BS = createBossSystem({ pcfx: PCFX, scene, tex, player, ENEMY_TYPES, spawnFx, play, showBanner, hitPlayer, addMat, spawnEnemy, setBoss, dropGem,
  gameOver: win => gameOver(win), time: () => t, state: () => state, enemies: () => enemies });
const bossFx = BS.fx;

// ===== 升級三選一（只出自己職業的技能＋被動＋超武融合）=====
function skillName(k) { return k === 'pet' ? (PET ? '🐾 ' + petName(PET) : '寵物') : SKD.skills[k]?.name || (k === 'musou' ? SKD.jobs[CHAR.job]?.musou.name : k === 'combo' ? '連續技 A→S→D' : k === 'mount' ? '坐騎衝鋒' : k); }
// 每級固定加成（項目 15；數值在 skills.json status.perLevel）
// ===== 項目 37：菁英寶箱（花金幣開，開出局內道具；圖示＝服務端 item.scr 原版道具圖示）=====
const RUN_ITEMS = [
  { name: '紅藥水（大）', kind: '藥水', icon: 99, desc: '回復 40% HP', use: () => { P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.4); } },
  { name: '力量藥劑', kind: '藥劑', icon: 1352, desc: '60 秒內傷害 +20%', use: () => { P.tmp.dmg = 60; } },
  { name: '希爾特的祝福', kind: '祝福', icon: 67, desc: '60 秒內移動速度 +20%、急速 +30', use: () => { P.tmp.speed = 60; P.tmp.haste = 60; } },
  { name: '料理・麵包', kind: '料理', icon: 83, desc: '這局最大 HP +10%，並回復同樣的量', use: () => { const a = Math.round(P.maxHp * 0.1); P.maxHp += a; P.hp += a; } },
];
let goldSpent = 0;
const eliteCost = () => 30 * ((TOWER ? 2 : STAGE_IDX) + 1); // 暫定：第 1 張圖 30 金幣、每張 +30
// 11/20 使用者：「RO 的寶箱可以選擇你要加的 buff，我們給隨機 buff，我希望可以選擇」→ 打開後三選一（升級畫面同一套卡片），不要＝不花錢
async function openEliteChest(c, i) {
  state = 'chest'; const cost = eliteCost(), have = goldHave();
  scene.remove(c.mesh); chestsArr.splice(i, 1);
  if (have < cost) { showBanner(`<small>菁英寶箱</small><b>金幣不夠</b><span>要 ${cost} 金幣（剩 ${have}）</span>`, 1400); state = 'play'; last = performance.now(); return; }
  play('chest', 0.5, 0);
  const pick = [...RUN_ITEMS].sort(() => Math.random() - 0.5).slice(0, 3), box = document.getElementById('cards'), ov = document.getElementById('levelup');
  ov.querySelector('h1').textContent = '菁英寶箱';
  document.getElementById('luInfo').innerHTML = `<span class="lv">選一個・−${cost} 金幣（目前可用 ${have}，含這局賺的）</span>`;
  box.innerHTML = '';
  const close = () => { ov.classList.remove('on'); ov.querySelector('h1').textContent = '升級！'; document.getElementById('chestSkip')?.remove(); if (state === 'chest') { state = 'play'; last = performance.now(); } };
  pick.forEach((it, n) => { const el = document.createElement('div'); el.className = 'card p';
    el.innerHTML = `<span class="num">${n + 1}</span><span class="rb">${it.kind}</span><img src="assets/items/${it.icon}.png" alt="" style="object-fit:contain;image-rendering:pixelated;padding:14px;box-sizing:border-box"><b>${it.name}</b><span class="kind">${it.kind}</span><hr><small>${it.desc}</small>`;
    el.onclick = () => { goldSpent += cost; it.use(); play('level', 0.5, 0); close(); showBanner(`<small>菁英寶箱（−${cost} 金幣）</small><b>${it.name}</b><span>${it.desc}</span>`, 1400); };
    box.appendChild(el); });
  const skip = document.createElement('button'); skip.id = 'chestSkip'; skip.className = 'btn'; skip.textContent = '不要（不花金幣）'; skip.style.cssText = 'pointer-events:auto;margin-top:10px'; skip.onclick = close; ov.appendChild(skip);
  ov.classList.add('on');
}
function levelBonus() {
  const L = SKD.status.perLevel || { dmg: 0, hp: 0 };
  P.might *= 1 + L.dmg; const add = P.maxHp * L.hp; P.maxHp += add; P.hp = Math.min(P.maxHp, P.hp + add);
}
// 11/20 照 RO「升級：累積」：升級先存起來，按「升級」鈕（或 U 鍵）再一次一次選，不會一直被打斷
let pendLv = 0; const pendBtn = document.createElement('button'); pendBtn.id = 'pendLv'; document.body.appendChild(pendBtn);
pendBtn.style.cssText = 'position:fixed;left:calc(50% - 215px);bottom:calc(max(10px,env(safe-area-inset-bottom)) + 18px);z-index:7;display:none;min-width:66px;height:66px;border-radius:50%;border:3px solid #fff;background:radial-gradient(#fff6,#4d9dff 60%,#1a3f8a);color:#fff;font:900 14px sans-serif;text-shadow:0 1px 3px #000;box-shadow:0 0 18px #4d9dff;pointer-events:auto;padding:0 6px';
if (innerWidth <= 600) Object.assign(pendBtn.style, { left: '12px', bottom: 'calc(max(10px,env(safe-area-inset-bottom)) + 108px)', minWidth: '72px', height: '72px' });
const pendShow = () => { pendBtn.style.display = pendLv > 0 ? 'block' : 'none'; pendBtn.innerHTML = `升級<br>×${pendLv}`; };
function pendLvAdd() { pendLv++; pendShow(); play('level', 0.4, 0); }
function pendOpen() { if (pendLv <= 0 || state !== 'play') return; pendLv--; pendShow(); levelUp(); }
pendBtn.addEventListener('click', e => { e.stopPropagation(); pendOpen(); });
addEventListener('keydown', e => { if (e.code === 'KeyU') pendOpen(); });
function levelUp() {
  document.getElementById('combo')?.classList.remove('on');
  state = 'level';
  // 原版升級特效＋音效（客戶端 sfx/levelUP、levelup.wav）；沒有就用舊音效
  if (PCFX.play('levelup', 'cast', player.position, 0, { y: 0.3 })) play(PCFX.index.levelup?.sound?.cast || 'level', 0.6, 0); else play('level', 0.6, 0);
  const box = document.getElementById('cards'); box.innerHTML = ''; document.querySelector('#levelup h1').textContent = '升級！'; document.getElementById('chestSkip')?.remove();
  // 上方：等級＋技能格（技能 n/4，普攻另外算）
  { const J = SKD.jobs[CHAR.job], others = Object.keys(SM.skills).filter(k => k !== J.basic);
    const cells = [J.basic, ...[0, 1, 2, 3].map(i => others[i])].map(k => k ? `<span class="c on">${iconHtml(SKD.skills[k].icon, 30)}</span>` : '<span class="c">＋</span>').join('');
    const L = SKD.status.perLevel || { dmg: 0, hp: 0 };
    document.getElementById('luInfo').innerHTML = `<span class="lv">▲ Lv ${P.lv}：傷害 +${+(L.dmg * 100).toFixed(1)}%・HP +${+(L.hp * 100).toFixed(1)}%</span><div class="strip">技能 ${others.length}/4 ${cells}</div>`; }
  const CH = SM.choices(PASSIVES);
  if (!CH.length) { document.getElementById('levelup').classList.remove('on'); state = 'play'; last = performance.now(); return; } // 防呆：沒有卡可以選就直接繼續（11/19 手機卡在升級畫面）
  CH.forEach((c, i) => {
    const el = document.createElement('div');
    let html;
    if (c.kind === 'f') { // 超武融合
      const d = SKD.skills[c.k], A = SKD.skills[c.f.a], B = SKD.skills[c.f.b];
      el.className = 'card fus';
      html = `<span class="rb">二轉超武融合</span><span class="new">超武！</span>${iconHtml(d.icon, 92, 'big')}<b>${d.name}</b><span class="kind">${TYPE_NAMES[d.type]}${d.tags.map(t => '・' + TAG_NAMES[t]).join('')}</span><hr>
        <small>${A.name} ＋ ${B.name} 融合<br>${SM.diffLines(c.k, 0).join('<br>')}</small>`;
    } else if (c.kind === 's') {
      const d = SKD.skills[c.k], isNew = !c.lv, fu = SM.fusionFor(c.k);
      el.className = 'card ' + (isNew ? 'w' : 'up');
      html = `<span class="rb">${isNew ? '新技能' : `Lv ${c.lv} → ${c.lv + 1}`}</span>${isNew ? '<span class="new">新！</span>' : ''}${iconHtml(d.icon, 92, 'big')}<b>${d.name}</b>
        <span class="kind">${TYPE_NAMES[d.type]}${d.tags.map(t => '・' + TAG_NAMES[t]).join('')}${d.status?.slow ? '・緩速' : ''}${d.status?.poison ? '・中毒' : ''}${d.status?.stun ? '・暈眩' : ''}</span><hr>
        <small>${SM.diffLines(c.k, c.lv).join('<br>')}</small>${fu ? `<div class="fhint">超武：${SKD.skills[fu.a].name} Lv5 ＋ ${SKD.skills[fu.b].name} Lv5 → <b>${SKD.skills[fu.into].name}</b></div>` : ''}`;
    } else if (c.kind === 'e') { // 項目 36：強化卡（依技能類型的項目＋品質）
      const d = SKD.skills[c.k], E = ENH[c.e], Q = ENH_Q[c.q], v = SM.enhValue(c), cur = SM.skills[c.k]?.mods?.[c.e] || 0;
      el.className = 'card up enh'; el.style.borderColor = Q.color;
      html = `<span class="rb" style="background:${Q.color}">強化・${Q.name}</span>${iconHtml(d.icon, 92, 'big')}<b>${d.name}</b><span class="kind">${E.name} ${E.fmt(v)}${Q.mult > 1 ? `（×${Q.mult}）` : ''}</span><hr>
        <small>${E.name}：${cur ? E.fmt(cur) : '＋0'} → <b>${E.fmt(Math.min(E.cap ?? Infinity, cur + v))}</b>${E.max ? `（最多 +${E.max}）` : E.cap ? `（上限 ${Math.round(E.cap * 100)}%）` : ''}</small>`;
    } else {
      const d = PASSIVES[c.k]; el.className = 'card p';
      html = `<span class="rb">能力</span><img src="${d.img}" alt=""><b>${d.name}</b><span class="kind">被動</span><hr><small>${d.desc(0)}</small>`;
    }
    el.innerHTML = `<span class="num">${i + 1}</span>` + html;
    el.onclick = () => {
      if (c.kind === 'f') { SM.fuse(c.f); showBanner(`<small>二轉超武</small><b>${SKD.skills[c.k].name}</b>`, 1400); }
      else if (c.kind === 's') SM.add(c.k);
      else if (c.kind === 'e') SM.enhance(c);
      else { PASSIVES[c.k].apply(); passives[c.k] = (passives[c.k] || 0) + 1; }
      document.getElementById('levelup').classList.remove('on'); state = 'play'; last = performance.now(); drawSkillbar();
    };
    box.appendChild(el);
  });
  document.getElementById('levelup').classList.add('on');
  // 升級自動選卡（設定 → 顯示）：超武 > 已有技能升級 > 新技能 > 被動
  if (opts.autoPick) {
    const cards = [...box.querySelectorAll('.card')], rank = c => c.classList.contains('fus') ? 0 : c.classList.contains('up') ? 1 : c.classList.contains('w') ? 2 : 3;
    const pick = cards.sort((a, b) => rank(a) - rank(b))[0];
    if (pick) { const name = pick.querySelector('b')?.textContent || ''; pick.click(); showBanner(`<small>自動選卡</small><b>${name}</b>`, 700); }
  }
}
// 11/20 鍵盤 1～3 直接選卡（升級、菁英寶箱）
addEventListener('keydown', e => { if (!document.getElementById('levelup').classList.contains('on')) return; const n = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[e.code]; if (n != null) document.querySelectorAll('#cards .card')[n]?.click(); });
// 狀態：緩速／暈眩倒數、中毒扣血
function statusTick(e, dt) {
  if (e.slowT > 0) e.slowT -= dt; if (e.stunT > 0) e.stunT -= dt;
  if (e.poison) { e.poison.t -= dt; if ((e.poison.tick -= dt) <= 0) { e.poison.tick = 0.5; hurt(e, e.poison.dps * 0.5, null, 'phys', 'duzhi', { noCombo: true }); spawnFx('poison', e.mesh.position, { scale: 1.2, life: 0.4, grow: 1.3, color: 0x90ff90 }); } if (e.poison.t <= 0) e.poison = null; }
}
let shatterCd = 0;
function shatterText(pos) { if (shatterCd > t) return; shatterCd = t + 0.4; dmgNum(pos, 0, true, 2.2, false, '碎冰！'); }
// Combo 連段條
function drawCombo() {
  const el = document.getElementById('combo'); if (!el) return;
  if (!SM.combo) { el.classList.remove('on'); return; }
  el.classList.add('on'); el.querySelector('b').textContent = SM.combo;
  el.querySelector('i').style.width = (SM.comboT / SKD.status.combo.breakSecs * 100) + '%';
  el.querySelector('small').textContent = SM.musouCd > 0 ? '無雙冷卻中' : `無雙還差 ${Math.max(0, SM.nextMusou - SM.combo)}`;
}
let passives = {}, dmgStats = {}, dmgTimer = 0;
// 設定（src/2_core/settings.js，項目 12）：傷害數字、統計、震動、介面大小、畫質、音量
const opts = { nums: true, meter: true, shake: true, autoPick: false };
onSettings(G => {
  opts.nums = G.nums; opts.meter = G.meter; opts.shake = G.shake; opts.autoPick = G.autoPick;
  bgm.volume = 0.5 * G.master * G.bgm; applyHud(['hud']);
  if (AQ.q !== G.quality) { AQ.q = G.quality; AQ.lvl = 0; AQ.low = 0; } // 自己改畫質 → 自動降級重設
  if (renderer.getPixelRatio() !== pixelRatio() && !AQ.lvl) { renderer.setPixelRatio(pixelRatio()); resize(); }
  if (typeof drawMeter === 'function' && P) drawMeter();
});
// 底部技能列：普攻大格＋4 格技能（空格顯示＋），上面一排 5 個小格是被動
function drawSkillbar() {
  const bar = document.getElementById('skillbar'), J = SKD.jobs[CHAR.job];
  const cell = (k, cls) => { const d = SKD.skills[k], w = SM.skills[k];
    const eg = P.egem?.[k]; // 項目 23：鑲了屬性寶石＝左上角屬性字
    return `<div class="sk ${cls}${d.super ? ' sup' : ''}" data-k="${k}" title="${d.name}${eg ? `・${ELEMS[eg.e]}屬性寶石 Lv${eg.lv}` : ''}">${iconHtml(d.icon, cls === 'basic' ? 40 : 32)}<b>${d.super ? '超' : w.lv}</b>${eg ? `<i style="position:absolute;left:50%;top:0;transform:translateX(-50%);font-style:normal;font-size:11px;font-weight:900;color:#fff;background:${ELEM_COLOR[eg.e]};border-radius:6px;padding:0 3px;text-shadow:0 1px 1px #000a">${ELEMS[eg.e]}${eg.lv}</i>` : ''}</div>`; };
  const others = Object.keys(SM.skills).filter(k => k !== J.basic);
  const slots = []; for (let i = 0; i < (SM.maxCarry || 4); i++) slots.push(others[i] ? cell(others[i], 'slot') : '<div class="sk slot empty">＋</div>');
  const pas = Object.keys(PASSIVES).map(k => passives[k] ? `<div class="pv" title="${PASSIVES[k].name}"><img src="${PASSIVES[k].img}" alt=""><b>${passives[k]}</b></div>` : '<div class="pv empty"></div>').join('');
  bar.innerHTML = `<div class="pvrow">${pas}</div><div class="skrow">${SM.skills[J.basic] ? cell(J.basic, 'basic') : ''}<i class="sep"></i>${slots.join('')}</div>`;
}
function trackDmg(src, amt) { if (!src) return; const d = dmgStats[src] ??= { dmg: 0, hits: 0 }; d.dmg += amt; d.hits++; }
const fmtK = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : Math.round(n) + '';
function drawMeter() {
  const el = document.getElementById('dmgPanel'); el.classList.toggle('off', !opts.meter); if (!opts.meter) return;
  const rows = Object.entries(dmgStats).sort((a, b) => b[1].dmg - a[1].dmg), tot = rows.reduce((a, [, d]) => a + d.dmg, 0) || 1;
  document.getElementById('dmgRows').innerHTML = rows.map(([k, d], i) => `<div class="dr"><i style="width:${d.dmg / tot * 100}%"></i><span>${i + 1}. ${skillName(k)}</span><span>${fmtK(d.dmg)} (${d.hits}, ${(d.dmg / tot * 100).toFixed(0)}%)</span></div>`).join('') || '<div class="dr"><span>還沒有傷害</span></div>';
  document.getElementById('dmgTot').innerHTML = `<span>總計</span><span>${fmtK(tot)}・${Math.round(tot / Math.max(1, t))} DPS</span>`;
}
// 傷害數字（DOM 物件池，最多同時 40 個）
function dmgNum(pos, amt, crit, h, hurtMe = false, text = null) {
  if (!opts.nums) return;
  const el = numPool.get(); if (!el) return;
  el.className = 'dn' + (crit ? ' crit' : '') + (hurtMe ? ' hurt' : ''); el.textContent = text ?? Math.max(1, Math.round(amt)); if (text) el.classList.add('txt');
  nums.push({ el, x: pos.x + (Math.random() - 0.5) * 0.6, y: h + 0.3, z: pos.z, life: 0.8 });
}
const nv = new THREE.Vector3();
function drawNums(dt) {
  for (let i = nums.length - 1; i >= 0; i--) {
    const n = nums[i]; n.life -= dt; n.y += dt * 2;
    nv.set(n.x, n.y + MAP.heightAt(n.x, n.z), n.z).project(camera);
    n.el.style.left = (nv.x * 0.5 + 0.5) * innerWidth + 'px'; n.el.style.top = (-nv.y * 0.5 + 0.5) * innerHeight + 'px'; n.el.style.opacity = Math.min(1, n.life * 3);
    if (n.life <= 0) { numPool.release(n.el); nums.splice(i, 1); }
  }
  // 腳下血條
  const ph = document.getElementById('php'); nv.set(player.position.x, groundY() - 0.2, player.position.z).project(camera);
  ph.style.left = (nv.x * 0.5 + 0.5) * innerWidth + 'px'; ph.style.top = (-nv.y * 0.5 + 0.5) * innerHeight + 'px';
  ph.firstChild.style.width = Math.max(0, P.hp / P.maxHp * 100) + '%';
}
// 小地圖：原版地圖（像 RO），以玩家為中心，標區域分界與王
const mm = document.getElementById('mm'), mmx = mm.getContext('2d');
function drawMinimap() {
  const pp = player.position;
  drawSealMinimap(mmx, mm.width, MAP, STAGE, { pp, yaw: player.rotation.y, enemies, chests: chestsArr, bossSlots, t, zone: curZone });
  document.getElementById('mmTitle').textContent = `${zoneName(STAGE, curZone)} (${Math.round(pp.x)}, ${Math.round(pp.z)})`;
}
// 暫停
function setPause(on) {
  if (on && state !== 'play') return;
  if (!on && state !== 'pause') return;
  state = on ? 'pause' : 'play'; last = performance.now();
  document.getElementById('pause').classList.toggle('on', on); pAsk(false);
  if (on) bgm.pause(); else if (!muted) bgm.play().catch(() => {});
}
document.getElementById('pauseBtn').onclick = () => setPause(true);
document.getElementById('pResume').onclick = () => setPause(false);
// 放棄並結算：確認框做在遊戲的暫停面板裡（11/18 使用者：不要跳瀏覽器的視窗）
const pAsk = on => { document.getElementById('pQuitAsk').style.display = on ? 'flex' : 'none'; for (const id of ['pResume', 'pSettings', 'pTown', 'pQuit']) document.getElementById(id).style.display = on ? 'none' : ''; };
document.getElementById('pQuit').onclick = () => pAsk(true);
document.getElementById('pQuitNo').onclick = () => pAsk(false);
document.getElementById('pQuitYes').onclick = () => { pAsk(false); document.getElementById('pause').classList.remove('on'); state = 'play'; gameOver(false); };
addEventListener('keydown', e => { if (state === 'hitstop') return; if (e.code === 'Escape' || e.code === 'KeyP') setPause(state === 'play'); });
document.getElementById('pSettings').onclick = () => openSettings();

// ===== 主迴圈 =====
const hud = { xp: document.querySelector('#xp>i'), hp: document.querySelector('#hp>i'), lv: document.getElementById('lv'), time: document.getElementById('time'), kills: document.getElementById('kills'), hpTxt: document.getElementById('hpTxt'), xpPct: document.getElementById('xpPct'), gold: document.getElementById('goldc') };
const tmp = new THREE.Vector3(); let last = performance.now();
// 看門狗（?debug=1 顯示面板）
const wd = createWatchdog({ page: '出征', renderer, scene, active: () => state === 'play',
  counts: () => ({ 怪物: enemies?.length || 0, 特效: fxPool.live.length }),
  pools: () => ({ 怪物池: enemyPool.active, 經驗寶石池: gemPool.active, 傷害數字池: numPool.active, 特效池: fxPool.live.length }),
  player, enemies: () => enemies || [], actor: () => rig.actor, moving: () => input.read().ml > 0.05 });
const grid = new Map();

// 賢者之塔：上一層＝橫幅；每 5 層小王、每 10 層該段地圖的 MVP（塔裡打倒 MVP 不會結束）
function towerFloorUp() {
  const seg = STAGES[towerSeg(floor)], kind = towerBossAt(floor);
  document.getElementById('stageName').textContent = `${TOWER_NAME}　第 ${floor} 層`;
  showBanner(`<small>${TOWER_NAME}</small><b>第 ${floor} 層</b><span>${seg.name}的怪物・HP ×${towerHpMul(floor).toFixed(2)}</span>`, 1600);
  if (kind) { const minis = seg.bosses.filter(b => b[2] === 'mini'), b = kind === 'mvp' ? seg.bosses.at(-1) : minis[Math.random() * minis.length | 0]; enterBoss(b[1], 'mini', -1); }
}
function update(dt) {
  t += dt;
  // 移動（player.js）
  rig.move(dt, input.read(), P); comboUpdate(dt); cbQUpdate(dt); eventsUpdate(dt);
  autoMount(dt, input.read()); // 第八批 54 選配：趕路自動上馬 // 項目 52 連續技、53 地圖事件
  const pp = player.position;
  // 換區域：跳區域名
  if (TOWER) { const f = towerFloor(t); if (f !== floor) { floor = f; towerFloorUp(); } }
  else { const z = zoneAt(MAP, pp.x, pp.z); if (z !== curZone) { curZone = z; const mon = z < 4 ? STAGE.zones[z].monsters.join('・') : 'MVP 領地';
    showBanner(`<small>進入區域</small><b>${zoneName(STAGE, z)}</b><span>${mon}</span>`, 1300); drawMinimap(); } }

  // 生怪＋精英＋首領（game-manager.js）
  spawner.tick(dt * (CURSE.spawn || 1), t, () => enemies.length, spawnEnemy, enterBoss);
  if (!CURSE.noRegen) P.hp = Math.min(P.maxHp, P.hp + P.regen * dt);
  for (const k in P.tmp) if (P.tmp[k] > 0) P.tmp[k] -= dt; // 局內道具倒數
  if (P.aid && (P.aidT = (P.aidT ?? 10) - dt) <= 0) { P.aidT = 10; const h = P.maxHp * 0.06 * P.aid; P.hp = Math.min(P.maxHp, P.hp + h); dmgNum(player.position, Math.round(h), false, 2, true, '+' + Math.round(h)); } // 緊急治療
  if (P.feignCd > 0) P.feignCd -= dt;
  if (dashCd > 0) { dashCd -= dt; const mb = document.getElementById('mountBtn'); if (mb) { mb.style.setProperty('--cd', Math.max(0, dashCd / DASH_CD)); mb.classList.toggle('ready', dashCd <= 0); } }

  SM.update(dt, !rig.mounted); // 騎乘時不能攻擊
  petTick(dt); // 項目 30 寵物
  fxPool.update(dt); PCFX.update(dt);

  // 敵人移動＋簡單分離
  grid.clear();
  for (const e of enemies) { const k = `${Math.floor(e.mesh.position.x / 1.2)},${Math.floor(e.mesh.position.z / 1.2)}`; (grid.get(k) || grid.set(k, []).get(k)).push(e); }
  // 怪物動作：畫面外（離玩家 40 公尺以上）不更新，省效能
  // 怪很多（> 120）時每隻隔一幀更新一次（時間加倍），動作看起來一樣、骨架計算少一半（項目 7 效能）
  // 怪很多時隔幀更新（時間補回）；自動畫質降到最低檔時再隔更多（項目 7）
  animFrame++; const skip = (enemies.length > 120 ? 2 : 1) * (AQ.lvl >= 2 ? 2 : 1);
  for (let i = 0; i < enemies.length; i++) { const e = enemies[i], A = e.mesh.userData.actor; if (!A || e.dead) continue; if (skip > 1 && (i + animFrame) % skip) continue;
    const dx = e.mesh.position.x - pp.x, dz = e.mesh.position.z - pp.z; if (dx * dx + dz * dz < 1600) A.update(dt * skip); }
  for (const e of enemies) {
    if (e.dead) continue; const p = e.mesh.position;
    tmp.subVectors(e.evT || pp, p).setY(0); const d = tmp.length(); // 項目 53：商隊附近的怪改追咕咕
    statusTick(e, dt);
    if (e.ai) { BS.think(e, dt, pp, d); continue; }
    const spd = e.stunT > 0 ? 0 : e.speed * (e.slowT > 0 ? 1 - e.slowK : 1);
    if (d > 0.001) tmp.multiplyScalar((e.thief ? -1 : 1) * spd / d); // 黃金大盜：往反方向逃
    const cx = Math.floor(p.x / 1.2), cz = Math.floor(p.z / 1.2);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const cell = grid.get(`${cx + i},${cz + j}`); if (!cell) continue;
      for (const o of cell) { if (o === e) continue; const ox = p.x - o.mesh.position.x, oz = p.z - o.mesh.position.z, od = ox * ox + oz * oz, rr = (e.r + o.r) ** 2; if (od < rr && od > 1e-4) { const f = (1 - od / rr) * 4 / Math.sqrt(od); tmp.x += ox * f; tmp.z += oz * f; } }
    }
    { const nx = p.x + (tmp.x + e.kb.x) * dt, nz = p.z + (tmp.z + e.kb.z) * dt; if (e.fly) { p.x = nx; p.z = nz; } else walkMove(MAP, p, nx, nz); } // 飛的怪不管地形
    e.kb.multiplyScalar(Math.max(0, 1 - dt * 8));
    e.mesh.rotation.y = Math.atan2(pp.x - p.x, pp.z - p.z);
    const A = e.mesh.userData.actor;
    if (A) { A.move(spd > 0.1); p.y = e.fly ? 0.8 + Math.sin(t * 6 + e.ph) * 0.2 : 0; } // 有原版走路動作就不用假跳
    else p.y = e.fly ? 0.8 + Math.sin(t * 6 + e.ph) * 0.2 : Math.abs(Math.sin(t * 7 + e.ph)) * 0.18; // 走路時一跳一跳
    e.flash -= dt; const sq = e.flash > 0 ? 1.18 : 1; e.mesh.scale.set(e.s0 * sq, e.s0 * (e.flash > 0 ? 0.85 : 1), e.s0 * sq);
    if (d < e.r + 0.5) { hitPlayer(e.dmg); if (A && A.current !== 'f1') mobSound(e, 'f1', 0.2, 400); A?.act('f1'); }
    if (d > 45 && !e.boss) { p.x = pp.x - (p.x - pp.x) * 0.5; p.z = pp.z - (p.z - pp.z) * 0.5; } // 跑太遠拉回來
  }
  P.inv -= dt;
  BS.updateShots(dt);
  rig.blink(P); // 受傷閃爍
  // 死掉的怪：有倒下動作就留著播完（最多 1.2 秒、慢慢沉下去）再回收
  for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].dead) { const m = enemies[i].mesh, A = m.userData.actor;
    const dur = A && corpses.length < 40 ? A.die() : 0; if (dur > 0) corpses.push({ m, t: Math.min(1.2, dur + 0.3) }); else enemyPool.release(m); enemies.splice(i, 1); }
  for (let i = corpses.length - 1; i >= 0; i--) { const c = corpses[i]; c.t -= dt; c.m.userData.actor.update(dt); if (c.t < 0.3) c.m.position.y -= dt * 2; if (c.t <= 0) { enemyPool.release(c.m); corpses.splice(i, 1); } }

  // 經驗寶石：磁吸（player.js），撿到回收進池子
  noviceWave(dt);
  const mg0 = P.magnet; if (rig.moving) P.magnet *= 1.3; // 移動中拾取範圍 ×1.3（鼓勵走位）
  magnetGems(gems, pp, P, dt, g => {
    gemPool.release(g.mesh); P.xp += g.xp * (P.expMul || 1); play('gem', 0.2, 50); // 初心者鼓舞：經驗 +10%
    if (P.xp >= P.need) { P.xp -= P.need; P.lv++; P.need = needFor(P.lv); levelBonus(); if (!finalDown) { if (DIFF.stack && !TOWER) pendLvAdd(); else levelUp(); } } // 項目 37：打倒最後的首領後不再跳升級卡（以前 MVP 倒下後 3 秒內升級會卡在選卡、通關不觸發）
  });
  magnetGems(coins, pp, P, dt, c => { scene.remove(c.mesh); play('gem', 0.25, 400); });
  P.magnet = mg0;

  // 寶箱：走過去撿
  for (let i = chestsArr.length - 1; i >= 0; i--) {
    const c = chestsArr[i], p = c.mesh.position; p.y = (c.mesh.userData.model ? 0.25 : 0.8) + Math.sin(t * 4 + i) * 0.15; if (c.mesh.userData.model) c.mesh.rotation.y += 0.02;
    if (Math.hypot(pp.x - p.x, pp.z - p.z) < 1.3) {
      if (c.elite) { if (state === 'play') openEliteChest(c, i); continue; }
      scene.remove(c.mesh); chestsArr.splice(i, 1); if (c.isBoss) { bossChests++; PCFX.play('bigitem', 'cast', player.position, 0, { y: 0.3, follow: player }); } else if (chests < LOOT_CAP) chests++; else showBanner('<small>寶箱</small><b>已達上限</b><span>一般寶箱每局最多 ' + LOOT_CAP + ' 個（首領寶箱不算）</span>', 1000); /* 原版 BigItem */ maybeElemGem(c.isBoss);
      play('level', 0.5, 0); showBanner(`<small>${c.isBoss ? '首領寶箱' : '寶箱'}</small><b>📦 ×${chests + bossChests}</b><span>結算時打開</span>`, 1200);
    }
  }

  if (P.hp <= 0) gameOver();
  // 打倒 MVP 後 3 秒通關：以前只靠 setTimeout，剛好在升級卡／寶箱確認／連續技頓幀時就不會通關 → 每格都檢查，回到 play 就結算
  if (finalDown && !TOWER && state === 'play') { winAt ??= t + 3; if (t >= winAt) gameOver(true); }
}

// ===== PC 原版左上 HUD（GageBar）：EXP＝局內經驗、HP、AP 槽＝到下一隻首領（塔＝下一層）的時間、XP 槽＝寶箱上限進度 =====
const GAGE = { img: new Image(), face: document.getElementById('faceImg'), cv: document.getElementById('gageCv') }; // face＝原本 HUD 的頭像（會換成角色大頭照）
GAGE.img.src = 'assets/ui/gagebar.png';
document.getElementById('gageName') && (document.getElementById('gageName').textContent = `${CHAR.name}　${CHAR.jobName || CHAR.job}`);
function drawGage() {
  const g = GAGE.cv?.getContext('2d'); if (!g || !GAGE.img.complete || !GAGE.img.naturalWidth) return;
  const I = GAGE.img, clamp = v => Math.max(0, Math.min(1, v || 0));
  g.clearRect(0, 0, 485, 58); g.drawImage(I, 6, 1, 485, 58, 0, 0, 485, 58); // 外框（原圖 6,1 起）
  const fill = (sx, sy, sw, dx, dy, k) => { const w = Math.round(sw * clamp(k)); if (w > 0) g.drawImage(I, sx, sy, w, 12, dx, dy, w, 12); };
  const nb = TOWER ? 60 - (t % 60) : (BOSSES[spawner.bossIdx] ? BOSSES[spawner.bossIdx][0] - t : 0), nbMax = TOWER ? 60 : (BOSSES[spawner.bossIdx] ? BOSSES[spawner.bossIdx][0] - (BOSSES[spawner.bossIdx - 1]?.[0] || 0) : 1);
  fill(106, 72, 377, 100, 11, P.xp / P.need); fill(97, 85, 179, 91, 23, P.hp / P.maxHp); fill(304, 85, 179, 298, 23, nb > 0 ? 1 - nb / nbMax : 1); fill(97, 98, 62, 91, 37, chests / LOOT_CAP);
  // 頭像（圓框中心 39,29）
  if (GAGE.face.complete && GAGE.face.naturalWidth) { g.save(); g.beginPath(); g.arc(39, 29, 19, 0, 7); g.clip(); g.drawImage(GAGE.face, 20, 10, 38, 38); g.restore(); }
  g.font = 'bold 11px sans-serif'; g.textBaseline = 'middle'; g.lineWidth = 3; g.strokeStyle = '#000a'; g.fillStyle = '#fff';
  const txt = (s, x, y, a = 'center') => { g.textAlign = a; g.strokeText(s, x, y); g.fillText(s, x, y); };
  txt(String(P.lv), 39, 51); txt(`${(P.xp / P.need * 100).toFixed(1)}%`, 290, 17); txt(`${Math.max(0, Math.ceil(P.hp))} / ${Math.round(P.maxHp)}`, 181, 29);
  txt(nb > 0 ? `${TOWER ? '下一層' : '下一王'} ${String(nb / 60 | 0).padStart(2, '0')}:${String(nb % 60 | 0).padStart(2, '0')}` : (TOWER ? '' : '首領都出現了'), 388, 29); txt(`📦${chests}`, 122, 43);
}
// ===== 項目 30：出戰寵物（客戶端戰鬥寵物模型，跟在主角斜後方，自動打最近的怪；屬性照原版相剋）=====
const PET = (CHAR.pets || []).find(p => p.id === CHAR.pet) || null;
const pet = { g: null, actor: null, cd: 1 };
if (PET && PETS[PET.kind]) {
  const D = PETS[PET.kind], st = petStage(PET.lv), h = 1.0 + st * 0.35;
  // 原版戰寵模型（E_Bpet_*）只有幾片卡片，外觀靠原版特效系統畫，直接畫會變灰色三角形 → 改用屬性特效貼圖做浮動發光的精靈球（11/18）
  const g = new THREE.Group(), core = new THREE.Sprite(addMat(tex[D.fx] || tex.hit, D.color)), glow = new THREE.Sprite(addMat(tex.circle || tex[D.fx], D.color));
  core.scale.setScalar(0.9 + st * 0.35); glow.scale.setScalar(1.6 + st * 0.6); glow.material.opacity = 0.55; g.add(glow, core);
  const L = new THREE.PointLight(D.color, 4 + st * 6, 4 + st * 2, 1.6); g.add(L); // 進化越多越亮
  g.position.set(player.position.x - 1.5, 0, player.position.z - 1.5); scene.add(g); pet.g = g; pet.core = core; pet.glow = glow; pet.h = h;
}
function petTick(dt) {
  if (!pet.g) return;
  const pp = player.position, p = pet.g.position, a = player.rotation.y + Math.PI * 0.75, tx = pp.x + Math.sin(a) * 1.8, tz = pp.z + Math.cos(a) * 1.8;
  const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
  if (d > 12) p.set(tx, 0, tz); else if (d > 0.2) { const k = Math.min(1, dt * 4); p.x += dx * k; p.z += dz * k; }
  pet.t = (pet.t || 0) + dt; const bob = 1.1 + pet.h * 0.3 + Math.sin(pet.t * 3) * 0.15; pet.core.position.y = pet.glow.position.y = bob; pet.core.material.rotation += dt * 2; // 浮動＋旋轉
  const A = petAtk(PET); pet.cd -= dt;
  const e = pet.cd <= 0 ? nearest(p, A.range) : null;
  if (e) {
    pet.cd = A.cd; pet.glow.scale.setScalar(pet.glow.scale.x * 1.25); setTimeout(() => pet.glow && pet.glow.scale.setScalar(1.6 + petStage(PET.lv) * 0.6), 150); // 攻擊時閃一下
    spawnFx(PETS[PET.kind].fx, e.mesh.position, { scale: 1.8, life: 0.35, grow: 1.4, color: PETS[PET.kind].color, y: 1 });
    hurt(e, A.dmg, p, 'magic', 'pet', {});
  }
}
// ===== 技能列冷卻遮罩（像 PC 快捷列：圖示上順時針掃過的暗色＋剩餘秒數；環繞型技能沒有冷卻）=====
function drawSkillCd() {
  if (!SM) return;
  for (const el of document.querySelectorAll('#skillbar .sk[data-k]')) {
    const s = SM.skills[el.dataset.k], d = SKD.skills[el.dataset.k]; if (!s || !d || d.type === 'ORBIT_AURA') continue;
    let m = el.querySelector('.cdm'); if (!m) { m = document.createElement('i'); m.className = 'cdm'; el.appendChild(m); }
    const left = Math.max(0, s.cd || 0), k = s.cdMax ? Math.min(1, left / s.cdMax) : 0;
    m.style.setProperty('--p', (k * 360).toFixed(1) + 'deg'); m.textContent = left >= 1 ? Math.ceil(left) : '';
  }
}
let hudLast = 0;
function render() {
  const pp = player.position;
  if (!opts.shake) bossFx.shake = 0;
  const gy = groundY();
  followCamera(camera, pp, bossFx, gy);
  sun.position.set(pp.x + 8, gy + 20, pp.z + 6); sun.target.position.set(pp.x, gy, pp.z); sun.target.updateMatrixWorld();
  const restore = liftScene(scene, MAP.heightAt); renderer.render(scene, camera); restore(); // 畫面上抬到地面高度，邏輯維持平面
  if (!P) return;
  // 介面文字／條每秒更新 12 次就夠（以前每幀改 DOM，手機很吃效能）
  const nowH = performance.now(); if (nowH - hudLast < 83) return; hudLast = nowH;
  if (GAGE.cv?.offsetParent) drawGage(); // PC 原版左上 HUD（手機版藏起來就不畫）
  drawSkillCd(); // 技能冷卻遮罩
  hud.xp.style.width = (P.xp / P.need * 100) + '%';
  hud.hp.style.width = Math.max(0, P.hp / P.maxHp * 100) + '%';
  hud.lv.textContent = 'Lv ' + P.lv; hud.kills.textContent = '💀 ' + kills; hud.gold.textContent = `💰 ${goldHave()}　📦 ${chests}/${LOOT_CAP}${bossChests ? `　👑${bossChests}` : ''}`; hud.gold.classList.toggle('full', chests >= LOOT_CAP);
  hud.hpTxt.textContent = `${Math.max(0, Math.ceil(P.hp))} / ${Math.round(P.maxHp)}`; hud.xpPct.textContent = (P.xp / P.need * 100).toFixed(1) + '%';
  hud.time.textContent = `${String(t / 60 | 0).padStart(2, '0')}:${String(t % 60 | 0).padStart(2, '0')}`;
  if (boss) bossEl.querySelector('i').style.width = Math.max(0, boss.hp / boss.maxHp * 100) + '%';
}

// ===== 項目 7：自動畫質（中低階手機不用自己調）：出征中連續 4 秒平均低於 40 fps → 解析度降一檔（最多 2 檔：×0.8、×0.6）並減少怪物動作更新；
// 只往下調、不會自己調回來（避免一直跳）；設定裡改畫質會重設
function autoQuality(dt) {
  if (state !== 'play' || AQ.lvl >= 2) return;
  AQ.acc += dt; AQ.n++; if (AQ.acc < 1) return;
  const fps = AQ.n / AQ.acc; AQ.acc = 0; AQ.n = 0;
  AQ.low = fps < 40 ? AQ.low + 1 : 0;
  if (AQ.low >= 4) { AQ.low = 0; AQ.lvl++; renderer.setPixelRatio(pixelRatio() * (AQ.lvl === 1 ? 0.8 : 0.6)); resize();
    showBanner(`<small>畫面不夠順</small><b>自動降低畫質</b><span>可以在設定 → 畫質調整</span>`, 1600); }
}
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; autoQuality(dt);
  const t0 = performance.now();
  if (state === 'play') { if (bossFx.slow > 0) bossFx.slow -= dt; update(bossFx.slow > 0 ? dt * 0.3 : dt); }
  else if (state === 'over') rig.actor?.mixer.update(dt); // 倒下動作
  else if (state === 'level') PCFX.update(dt); // 選卡片時升級特效繼續播
  const t1 = performance.now(); render(); wd.tick(dt);
  // 效能量測（項目 7）：遊戲邏輯／繪圖送出的 CPU 毫秒（平滑），__ss.perf() 讀
  perf.upd += (t1 - t0 - perf.upd) * 0.05; perf.ren += (performance.now() - t1 - perf.ren) * 0.05;
  if (P) { drawNums(state === 'play' ? dt : 0); if ((dmgTimer -= dt) <= 0) { dmgTimer = 0.4; drawMeter(); drawMinimap(); } }
  raf = requestAnimationFrame(loop);
}
let raf = requestAnimationFrame(loop);
const perf = { upd: 0, ren: 0 };

async function start() {
  document.getElementById('go').textContent = '載入中…'; await modelsReady; await rig.actorReady; await rig.mountReady; document.getElementById('go').textContent = '開始';
  reset(); state = 'play'; last = performance.now(); drawSkillbar();
  for (const id of ['start', 'over']) document.getElementById(id).classList.remove('on');
  if (!muted) { bgm.currentTime = 0; bgm.play().catch(() => {}); }
}
function gameOver(win = false) {
  clearRun();
  if (!win) rig.actor?.play('dd');
  state = 'over'; bgm.pause(); cleared = win;
  document.querySelector('#over h1').textContent = win ? '通關！' : '倒下了';
  document.getElementById('result').innerHTML = TOWER ? `${TOWER_NAME}<br>到達第 <b>${floor}</b> 層（${CURSE.name}）<br>撐了 ${hud.time.textContent}　Lv ${P.lv}　擊殺 ${kills}`
    : `${STAGE.name}<br>${win ? `打倒了 ${BOSSES[BOSSES.length - 1][1]}！<br>` : ''}撐了 ${hud.time.textContent}　Lv ${P.lv}　擊殺 ${kills}`;
  document.getElementById('over').classList.add('on');
  if (win) play('level', 0.7, 0);
  saveRun();
}
let winAt = null; let cleared = false, finalDown = false; // finalDown：最後的首領（MVP）已倒
// 結算：把這局的紀錄送回伺服器換經驗（game-manager.js submitRun）
async function saveRun() {
  const out = document.getElementById('reward'); out.textContent = '';
  let token = null; try { token = localStorage.getItem('ss_token'); } catch {}
  if (!token || !CHAR.id) return;
  out.textContent = '結算中…';
  try {
    const j = await submitRun(token, { charId: CHAR.id, secs: Math.floor(t), kills, lv: P.lv, cleared, chests, bossChests, stage: STAGE.key, curse: TSET?.curse || 'none', lootMin, bosses: runBosses, diff: TOWER ? null : DIFF, spent: goldSpent, events: EV.done, combos: CB.done || 0 });
    const F = j.fame; // 項目 47
    out.innerHTML = (F?.gain ? `🏅 名聲 +${F.gain}${F.up ? `　<b>名聲 Lv${F.lv}！</b>` : ''}${F.newTitles?.length ? `　新稱號：${F.newTitles.map(t => `【${t}】`).join('')}` : ''}${F.gear?.length ? `　名聲裝備已寄到信箱` : ''}<br>` : '') + (j.tower ? `<b>分數 ${j.tower.score.toLocaleString()}</b>${j.tower.newBest ? '　🏆 新紀錄！' : ''}${j.tower.newFloor ? `　最高樓層更新（塔點數 ${j.tower.points}）` : ''}<br>` : '') + (j.bonus ? `通關獎勵 ×1.5！　` : '') + `經驗 +${j.gain}　金幣 +${j.gold}${j.spent ? `（菁英寶箱 −${j.spent}）` : ''}${j.gemUps?.length ? `<br>💎 連續技融合：技能寶石升級 ${j.gemUps.map(g => ['N', 'G', 'DG', 'XG'][g]).join('、')}！` : ''}` + (j.levelUps ? `<br>角色升級！Lv ${j.baseLv}（素質點 +${j.levelUps * 3}）` : `　（${j.exp} / ${j.need}）`) + (j.jobUps ? `<br>Job 升級！Job Lv ${j.jobLv}` : '') + (j.gems?.length ? `<br>拿到技能寶石 ${j.gems.length} 顆（主城「寶石」開放後裝備）` : '')
      + (j.newStage ? `<br>🔓 解鎖新地圖：${j.newStage}` : '') + (j.items.length ? `<div class="loot">${j.items.map(it => `<span class="${it.rarity >= 3 ? 'glow' : ''}" style="border-color:${RARITY[it.rarity].color};${it.rarity >= 3 ? `color:${RARITY[it.rarity].color}` : ''}"><img src="${itemIcon(it)}" alt=""><em style="color:${RARITY[it.rarity].color}">${RARITY[it.rarity].name} ${itemName(it)}</em></span>`).join('')}</div>` : '')
      + (j.filtered ? `<br><small>🔍 撿取篩選（${LOOT_F[lootMin]}）：${j.filtered} 件不要，沒進背包</small>` : '')
      + (j.bagFull ? '<br><small>背包滿了，有些寶箱沒打開</small>' : '');
    if (j.items.some(it => it.rarity >= 3)) play('level', 0.8, 0); // 精簡掉落顯示：史詩／傳說發光＋響一聲（項目 42）
    CHAR.baseLv = j.baseLv; CHAR.jobLv = j.jobLv; try { sessionStorage.setItem('ss_char', JSON.stringify(CHAR)); } catch {}
  } catch (e) { out.textContent = '結算失敗：' + e.message; }
}
document.getElementById('go').onclick = start;
document.getElementById('again').onclick = start;

// 切到背景就暫停、停止繪圖（不常駐）
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { cancelAnimationFrame(raf); bgm.pause(); }
  else { last = performance.now(); raf = requestAnimationFrame(loop); if (state === 'play' && !muted) bgm.play().catch(() => {}); }
});
reset();
// ===== 未完成的一局（企劃_工程交付 項目 13）=====
// 出征中每 5 秒、切走或關頁時把進度存到瀏覽器；回主城時問要不要繼續，放棄就先結算已拿到的部分
const RUN_KEY = 'ss_run_' + (CHAR.id || 'guest');
function snapshotRun() {
  if (TOWER || !P || !CHAR.id || !['play', 'level', 'pause'].includes(state) || t < 5) return;
  const snap = { stage: STAGE_IDX, stageKey: STAGE.key, stageName: STAGE.name, t, kills, lv: P.lv, xp: P.xp, need: P.need, hp: P.hp / P.maxHp, chests, bossChests, bossIdx: spawner.bossIdx, px: player.position.x, pz: player.position.z,
    skills: Object.fromEntries(Object.entries(SM.skills).map(([k, w]) => [k, w.lv])), skmods: Object.fromEntries(Object.entries(SM.skills).filter(([, w]) => w.mods).map(([k, w]) => [k, w.mods])), passives: { ...passives }, egem: { ...P.egem }, bosses: [...runBosses], spent: goldSpent, events: EV.done, combos: CB.done || 0, saved: Date.now() };
  try { localStorage.setItem(RUN_KEY, JSON.stringify(snap)); } catch {}
}
function clearRun() { try { localStorage.removeItem(RUN_KEY); } catch {} }
setInterval(snapshotRun, 5000);
addEventListener('pagehide', snapshotRun);
document.addEventListener('visibilitychange', () => { if (document.hidden) snapshotRun(); });
// 繼續：怪物重新生，但時間、等級、技能、被動、擊殺、寶箱、首領進度都接回去
function resumeRun(snap) {
  t = snap.t; kills = snap.kills; chests = snap.chests || 0; bossChests = snap.bossChests || 0; spawner.bossIdx = snap.bossIdx || 0;
  resetBossSlots(spawner.bossIdx); if (snap.px != null && MAP.canWalk(snap.px, snap.pz)) player.position.set(snap.px, 0, snap.pz); // 已經出現過的王重新進來不會再生（跟以前一樣）
  P.lv = snap.lv; P.xp = snap.xp; P.need = snap.need; for (let i = 1; i < P.lv; i++) levelBonus();
  SM.clear(); SM.skills = {};
  for (const [k, lv] of Object.entries(snap.skills || {})) for (let i = 0; i < lv; i++) SM.add(k);
  for (const [k, m] of Object.entries(snap.skmods || {})) if (SM.skills[k]) SM.skills[k].mods = { ...m }; // 項目 36：強化卡
  for (const [k, n] of Object.entries(snap.passives || {})) for (let i = 0; i < n; i++) { PASSIVES[k]?.apply(); passives[k] = (passives[k] || 0) + 1; }
  P.hp = Math.max(1, Math.round(P.maxHp * (snap.hp ?? 1)));
  P.egem = snap.egem || {}; runBosses = snap.bosses || []; goldSpent = snap.spent || 0; EV.done = snap.events || 0; EV.next = t + 20; CB.done = snap.combos || 0;
  drawSkillbar(); showBanner(`<small>繼續上一局</small><b>${STAGE.name}</b><span>${String(t / 60 | 0).padStart(2, '0')}:${String(t % 60 | 0).padStart(2, '0')}・Lv ${P.lv}</span>`, 1600);
}
// 暫停選單：回主城但保留這一局
document.getElementById('pTown')?.addEventListener('click', () => { snapshotRun(); location.href = 'town.html'; });
if (location.search.includes('resume')) {
  let snap = null; try { snap = JSON.parse(localStorage.getItem(RUN_KEY)); } catch {}
  if (snap && snap.stage === STAGE_IDX) start().then(() => resumeRun(snap));
}

// 測試用：?auto 直接開始；?sim=秒數 先快轉模擬；?boss=N 跳到第 N 隻首領
if (location.search.includes('auto')) start().then(() => {
  if (location.search.includes('ride')) setMounted(true);
  const bq = location.search.match(/boss=(\d)/); if (bq) { spawner.bossIdx = +bq[1]; t = BOSSES[spawner.bossIdx][0] - 0.1; }
  const m = location.search.match(/sim=([\d.]+)/); if (m) { for (let i = 0; i < +m[1] * 30 && state !== 'over'; i++) { if (state === 'level') document.querySelector('.card')?.click(); P.hp = P.maxHp; update(1 / 30); } }
  window.__ss = { pet: () => pet.g ? { x: +pet.g.position.x.toFixed(1), z: +pet.g.position.z.toFixed(1), cd: +pet.cd.toFixed(2), kind: PET?.kind, lv: PET?.lv } : null, dmg: () => dmgStats, pool: () => SM.J.pool, carry: () => SM.maxCarry, elemGem: (b, e) => maybeElemGem(b, e), egem: () => P.egem, elemOf: (src, type) => elemMult(P.egem?.[src]?.e ?? skillElem(SKD.skills[src]), MONSTER_ELEM[type] ?? 0), player, spawn: n => { for (let i = 0; i < n; i++) spawnEnemy(STAGE.monsters[i % STAGE.monsters.length]); }, enemies: () => enemies, gems: () => gems, pools: { enemyPool, gemPool, numPool }, state: () => state, t: () => t, kills: () => kills, zone: () => curZone, bossSlots: () => bossSlots, map: MAP, scene, sm: () => SM, pcfx: PCFX, drop: (x, z, xp, chest) => chest ? dropChest({ x, z }, chest === 2, chest === 3) : dropGem({ x, z }, xp), gold: () => goldSpent, setT: v => { t = v; }, coins: () => coins.length, goldHave: () => goldHave(), tmp: () => P.tmp, cb: () => CB, ev: () => EV, evStart: k => { EV_TYPES.length; evStart(); }, perf: () => ({ upd: +perf.upd.toFixed(2), ren: +perf.ren.toFixed(2), calls: renderer.info.render.calls, tris: renderer.info.render.triangles }) };
});
