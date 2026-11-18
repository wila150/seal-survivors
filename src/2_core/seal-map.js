// 希望OL 原版地圖（企劃_工程交付 項目 10 v1.1：使用者 11/18「要像 RO 那樣用 PC 的地圖來改，不要只用素材」）
// 資料由 tools/build-map.mjs 從客戶端 map/<編號>.map／.mdt 轉出，放在 assets/maps/<編號>/
//   地形：512×512 高度圖（1 格＝1 公尺）、地表磚依色調圖的 alpha 混合、再乘上原版烘好的光影
//   物件：原版擺放的樹、草、建築（位置／轉向／縮放照地圖檔），InstancedMesh
//   可走區：原版的可走遮罩（水、懸崖、建築都擋）
// 座標：遊戲世界 = 地圖座標 − 256（地圖中心在原點）
// 遊戲邏輯維持平面（y＝0）；畫面上的高度在 render 前統一加上去（liftScene），畫完再還原
import * as THREE from 'three';
import { sealModelData } from './seal-model.js';

const OFF = 256;

export async function loadSealMap(id) {
  const base = `assets/maps/${id}/`;
  const [meta, hb, wb] = await Promise.all([
    fetch(base + 'map.json').then(r => r.json()),
    fetch(base + 'height.bin').then(r => r.arrayBuffer()),
    fetch(base + 'walk.bin').then(r => r.arrayBuffer()),
  ]);
  const W = meta.w, H = meta.h, hgt = new Int16Array(hb), walk = new Uint8Array(wb);
  const hAt = (i, j) => hgt[Math.max(0, Math.min(H - 1, j)) * W + Math.max(0, Math.min(W - 1, i))] / 100;
  // 世界座標的地面高度（雙線性）
  const heightAt = (x, z) => {
    const gx = x + OFF, gz = z + OFF, i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j;
    return (hAt(i, j) * (1 - fx) + hAt(i + 1, j) * fx) * (1 - fz) + (hAt(i, j + 1) * (1 - fx) + hAt(i + 1, j + 1) * fx) * fz;
  };
  const canWalk = (x, z) => { const i = Math.floor(x + OFF), j = Math.floor(z + OFF); return i >= 1 && j >= 1 && i < W - 1 && j < H - 1 && walk[j * W + i] === 1; };
  // 出生點：可走區的重心附近最近的可走格（找周圍也都能走的位置）
  let sx = 0, sz = 0, n = 0;
  for (let j = 0; j < H; j += 2) for (let i = 0; i < W; i += 2) if (walk[j * W + i]) { sx += i; sz += j; n++; }
  const cx = sx / n - OFF, cz = sz / n - OFF;
  // 出生點附近不要有大型物件（草、花以外的東西，例：紅土地帶的巨大骨頭會擋住畫面）
  const big = meta.objects.filter(o => !/grass|flower|llip|weed/i.test(meta.models[o[0]] || '')).map(o => [o[1] - OFF, o[3] - OFF]);
  const open = (x, z, r) => { for (let a = 0; a < 8; a++) if (!canWalk(x + Math.cos(a * 0.785) * r, z + Math.sin(a * 0.785) * r)) return false;
    return canWalk(x, z) && big.every(([bx, bz]) => Math.hypot(bx - x, bz - z) > 14); };
  let spawn = { x: cx, z: cz };
  search: for (let r = 0; r < 200; r += 2) for (let a = 0; a < 24; a++) { const x = cx + Math.cos(a / 24 * 6.283) * r, z = cz + Math.sin(a / 24 * 6.283) * r; if (open(x, z, 6)) { spawn = { x, z }; break search; } }
  return { id, meta, W, H, heightAt, canWalk, spawn, center: { x: cx, z: cz }, base };
}

// 地形 mesh＋物件；回傳 propsReady
// opts.blend：指定地表磚（檔名關鍵字）{ a0: alpha 黑的地方, a1: alpha 白的地方, hi: alpha 白而且色調圖藍色亮的地方（艾林城內）}
// 原版地表磚怎麼分配還沒完全解出來（.map 檔頭有一段 128 個小整數，待查）；沒給就用 tile0／tile1
export function buildSealMap(scene, M, fogColor, opts = {}) {
  const L = new THREE.TextureLoader(), load = (f, rep) => { const t = L.load(M.base + f); t.colorSpace = THREE.SRGBColorSpace; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; } return t; };
  const tiles = M.meta.tiles.map(f => load(f, true));
  const color = load('color.png'); color.flipY = false;
  // 地形：每 2 格一個頂點；切成 CH×CH 公尺一塊（項目 7 效能：鏡頭外的塊不畫，整張 13 萬個三角形 → 畫面上只剩幾塊）
  // 法線用高度差直接算（各塊自己 computeVertexNormals 接縫會有明暗線）
  const CH = 64, step = 2, geos = [];
  const nrm = (x, z) => { const hx = M.heightAt(x + 1, z) - M.heightAt(x - 1, z), hz = M.heightAt(x, z + 1) - M.heightAt(x, z - 1); const l = Math.hypot(hx, 2, hz); return [-hx / l, 2 / l, -hz / l]; };
  for (let z0 = -OFF; z0 < M.H - OFF - 1; z0 += CH) for (let x0 = -OFF; x0 < M.W - OFF - 1; x0 += CH) {
    const w = Math.min(CH, M.W - OFF - 1 - x0), h = Math.min(CH, M.H - OFF - 1 - z0), g = new THREE.PlaneGeometry(w, h, Math.ceil(w / step), Math.ceil(h / step)); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, n = g.attributes.normal;
    for (let k = 0; k < p.count; k++) { const x = p.getX(k) + x0 + w / 2, z = p.getZ(k) + z0 + h / 2; p.setXYZ(k, x, M.heightAt(x, z), z); n.setXYZ(k, ...nrm(x, z)); }
    g.computeBoundingSphere(); geos.push(g);
  }
  // 地表：tile0（泥土路，alpha 黑）↔ tile1（主地面，alpha 白），tile2 依低頻雜訊混進來做變化；乘上原版光影（RGB）
  const mat = new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { t0: { value: null }, t1: { value: null }, t2: { value: null }, cmap: { value: null }, nt: { value: 1 }, size: { value: new THREE.Vector2(M.W, M.H) } }]),
    vertexShader: `varying vec2 vUv; varying vec2 vW; varying float vN;
      #include <fog_pars_vertex>
      void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vW = wp.xz; vUv = (wp.xz + ${OFF}.0) / vec2(${M.W}.0, ${M.H}.0); vN = normal.y;
        vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform sampler2D t0; uniform sampler2D t1; uniform sampler2D t2; uniform sampler2D cmap; uniform float nt; varying vec2 vUv; varying vec2 vW; varying float vN;
      #include <fog_pars_fragment>
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      void main(){
        vec4 c = texture2D(cmap, vUv); vec2 tu = vW / 2.6; // 地表磚每 2.6 公尺重複一次（原本 6 公尺 → 石板比人還大）
        vec3 a = texture2D(t0, tu).rgb, b = texture2D(t1, tu).rgb;
        if (nt > 2.5) b = mix(b, texture2D(t2, tu * 0.9).rgb, smoothstep(0.45, 0.75, noise(vW / 18.0)) * 0.7);
        if (nt < 0.0) b = mix(b, texture2D(t2, tu * 0.8).rgb, smoothstep(0.42, 0.55, c.b)); // 主城：城內（色調圖藍色亮）的廣場／空地＝圓形石板，城外＝草地
        vec3 g = mix(a, b, c.a);
        gl_FragColor = vec4(g * c.rgb * 1.55 * (0.75 + 0.25 * vN), 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const pick = (kw, def) => { const i = kw ? M.meta.tiles.findIndex(f => f.includes(kw)) : -1; return tiles[i >= 0 ? i : def] || tiles[0]; };
  const B = opts.blend;
  mat.uniforms.t0.value = pick(B?.a0, 0); mat.uniforms.t1.value = pick(B?.a1, 1); mat.uniforms.t2.value = B?.hi ? pick(B.hi, 2) : (tiles[2] || tiles[1] || tiles[0]);
  mat.uniforms.cmap.value = color; mat.uniforms.nt.value = B?.hi ? -1 : tiles.length;
  // 原版地圖的地板物件（廣場地磚、橋面、地下城地板）跟地形同高 → 會互相閃爍（破圖）；地形往後推一點，物件永遠畫在上面
  mat.polygonOffset = true; mat.polygonOffsetFactor = 2; mat.polygonOffsetUnits = 2;
  const ground = new THREE.Group(); ground.userData.fixed = true;
  for (const g of geos) { const m = new THREE.Mesh(g, mat); m.userData.fixed = true; ground.add(m); }
  scene.add(ground);
  // 水面：原版的海、河、池子是地形挖低（約 −14）再疊一層水；地面大多在 −7 → 水面放 −8.6
  let low = 0; for (let z = -OFF; z < M.H - OFF; z += 6) for (let x = -OFF; x < M.W - OFF; x += 6) if (M.heightAt(x, z) < -10) low++;
  if (low > 20) {
    const water = new THREE.Mesh(new THREE.PlaneGeometry(M.W * 3, M.H * 3), new THREE.MeshLambertMaterial({ color: 0x3f86b8, transparent: true, opacity: 0.78, depthWrite: false }));
    water.rotation.x = -Math.PI / 2; water.position.y = -8.6; water.renderOrder = 1; water.userData.fixed = true; scene.add(water);
  }
  // 地圖外：一圈暗色地面（避免看到天空）
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(M.W * 3, M.H * 3), new THREE.MeshBasicMaterial({ color: fogColor }));
  outer.rotation.x = -Math.PI / 2; outer.position.y = -30; outer.userData.fixed = true; scene.add(outer);

  // 物件：每種模型一組 InstancedMesh（原始座標、不置中）
  // 依「模型＋所在 48 公尺格子」分組（項目 7 效能：整張地圖的樹共用一個 InstancedMesh 時永遠全部畫；分格後鏡頭外的格子不畫）
  const byModel = new Map(), CELL = 48;
  for (const o of M.meta.objects) { const k = o[0] + '|' + Math.floor(o[1] / CELL) + '|' + Math.floor(o[3] / CELL); (byModel.get(k) || byModel.set(k, []).get(k)).push(o); }
  const place = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), s = new THREE.Vector3();
  const propsReady = Promise.all([...byModel].map(async ([key, list]) => {
    const name = M.meta.models[list[0][0]];
    try {
      const d = await sealModelData(name);
      d.geos.forEach((g, gi) => {
        const im = new THREE.InstancedMesh(g, d.partMats[gi], list.length);
        list.forEach(([, x, y, z, rot, sc], k) => { place.compose(v.set(x - OFF, y, z - OFF), q.setFromAxisAngle(up, rot * Math.PI), s.setScalar(sc || 1)); im.setMatrixAt(k, place); });
        im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.userData.fixed = true; scene.add(im);
      });
    } catch (e) { console.warn('地圖物件', name, e.message); }
  }));
  return { ground, propsReady };
}

// 畫面上的高度：render 前把會動的東西（scene 的直接子物件、沒標 fixed、不是燈光）抬到地面高度，畫完還原
export function liftScene(scene, heightAt) {
  const saved = [];
  for (const o of scene.children) { if (o.userData.fixed || o.isLight) continue; saved.push(o, o.position.y); o.position.y += heightAt(o.position.x, o.position.z); }
  return () => { for (let i = 0; i < saved.length; i += 2) saved[i].position.y = saved[i + 1]; };
}

// 區域：以可走區重心為中心，中央一圈＋四個象限
export const CENTER_R = 45;
export const zoneAt = (M, x, z) => { const dx = x - M.center.x, dz = z - M.center.z; if (Math.hypot(dx, dz) < CENTER_R) return 4; return dz < 0 ? (dx < 0 ? 0 : 1) : (dx < 0 ? 3 : 2); };
export const zoneName = (STAGE, z) => z === 4 ? `${STAGE.bosses[STAGE.bosses.length - 1][1]}的領地` : STAGE.zones?.[z]?.name || '';

// 移動：目標格不能走就沿著單一軸滑（貼牆走）
export function walkMove(M, p, nx, nz) {
  if (M.canWalk(nx, nz)) { p.x = nx; p.z = nz; return true; }
  if (M.canWalk(nx, p.z)) { p.x = nx; return true; }
  if (M.canWalk(p.x, nz)) { p.z = nz; return true; }
  return false;
}

// 小地圖：原版地圖色調圖（像 RO 的小地圖），以玩家為中心顯示 VIEW 公尺；區域分界淡線；王即時位置
const mmImg = new Map();
export function drawSealMinimap(mmx, Wpx, M, STAGE, { pp, yaw, enemies, chests, bossSlots, t, zone, view = 160 }) {
  let img = mmImg.get(M.id); if (!img) { img = new Image(); img.src = M.base + 'color.png'; mmImg.set(M.id, img); }
  const k = Wpx / view, P = (x, z) => [Wpx / 2 + (x - pp.x) * k, Wpx / 2 + (z - pp.z) * k];
  mmx.fillStyle = '#123'; mmx.fillRect(0, 0, Wpx, Wpx);
  if (img.complete && img.naturalWidth) { const [x0, y0] = P(-OFF, -OFF); const sc = img.naturalWidth / M.W; mmx.globalAlpha = 1; mmx.drawImage(img, x0, y0, M.W * k, M.H * k); }
  // 區域分界
  const [cx, cy] = P(M.center.x, M.center.z);
  mmx.strokeStyle = '#ffffff55'; mmx.lineWidth = 1; mmx.setLineDash([3, 3]);
  mmx.beginPath(); mmx.arc(cx, cy, CENTER_R * k, 0, 7); mmx.moveTo(cx, cy - CENTER_R * k); mmx.lineTo(cx, -999); mmx.moveTo(cx, cy + CENTER_R * k); mmx.lineTo(cx, 999);
  mmx.moveTo(cx - CENTER_R * k, cy); mmx.lineTo(-999, cy); mmx.moveTo(cx + CENTER_R * k, cy); mmx.lineTo(999, cy); mmx.stroke(); mmx.setLineDash([]);
  for (const e of enemies) { if (e.boss) continue; const [x, y] = P(e.mesh.position.x, e.mesh.position.z); if (x < 0 || y < 0 || x > Wpx || y > Wpx) continue; mmx.fillStyle = e.elite ? '#ffb000' : '#ff5050'; mmx.fillRect(x - 1, y - 1, e.elite ? 3 : 2, e.elite ? 3 : 2); }
  for (const c of chests) { const [x, y] = P(c.mesh.position.x, c.mesh.position.z); mmx.fillStyle = '#ffd36b'; mmx.fillRect(x - 2, y - 2, 4, 4); }
  mmx.textAlign = 'center'; mmx.textBaseline = 'middle'; mmx.font = 'bold 9px sans-serif';
  for (const b of bossSlots) {
    if (!b.e || b.done || b.e.dead) continue;
    let [x, y] = P(b.e.mesh.position.x, b.e.mesh.position.z); const R = b.kind === 'mvp' ? 6 : 5;
    x = Math.max(R, Math.min(Wpx - R, x)); y = Math.max(R, Math.min(Wpx - R, y)); // 在畫面外就貼邊顯示方向
    mmx.beginPath(); mmx.arc(x, y, R + Math.sin(t * 8), 0, 7); mmx.fillStyle = b.kind === 'mvp' ? '#ff2a6a' : '#ff3030'; mmx.fill(); mmx.strokeStyle = '#fff'; mmx.lineWidth = 1.5; mmx.stroke();
    mmx.fillStyle = '#fff'; mmx.fillText(b.kind === 'mvp' ? '★' : '☠', x, y + 0.5);
  }
  mmx.save(); mmx.translate(Wpx / 2, Wpx / 2); mmx.rotate(-yaw + Math.PI); mmx.fillStyle = '#fff'; mmx.strokeStyle = '#c00'; mmx.lineWidth = 2;
  mmx.beginPath(); mmx.moveTo(0, -7); mmx.lineTo(5, 5); mmx.lineTo(0, 2); mmx.lineTo(-5, 5); mmx.closePath(); mmx.fill(); mmx.stroke(); mmx.restore();
}
