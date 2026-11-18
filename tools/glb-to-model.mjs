// GLB（例如 Tripo 產生的）→ 減面 → 遊戲用的 JSON 模型＋貼圖
// 用法：node tools/glb-to-model.mjs <輸入.glb> <輸出名稱> [目標三角面數=30000]
// 減面方法：頂點分群（把位置＋貼圖座標相近的頂點合併），簡單、快、不需要裝套件
import fs from 'node:fs';
import path from 'node:path';

const [src, outName, targetArg] = process.argv.slice(2);
const TARGET = +targetArg || 30000;
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..', 'assets', 'models');
const outDir = decodeURIComponent(OUT);

const b = fs.readFileSync(src);
const jsonLen = b.readUInt32LE(12);
const gltf = JSON.parse(b.toString('utf8', 20, 20 + jsonLen));
const binStart = 20 + jsonLen + 8;
const bin = b.subarray(binStart, binStart + b.readUInt32LE(20 + jsonLen));

function read(accIdx) {
  const a = gltf.accessors[accIdx], v = gltf.bufferViews[a.bufferView];
  const n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
  const off = (v.byteOffset || 0) + (a.byteOffset || 0);
  const C = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array }[a.componentType];
  const stride = v.byteStride || n * C.BYTES_PER_ELEMENT;
  const out = new (C === Float32Array ? Float32Array : Uint32Array)(a.count * n);
  for (let i = 0; i < a.count; i++) for (let k = 0; k < n; k++) {
    const p = off + i * stride + k * C.BYTES_PER_ELEMENT;
    out[i * n + k] = C === Float32Array ? bin.readFloatLE(p) : C === Uint32Array ? bin.readUInt32LE(p) : C === Uint16Array ? bin.readUInt16LE(p) : bin[p];
  }
  return out;
}

const prim = gltf.meshes[0].primitives[0];
const P = read(prim.attributes.POSITION), N = read(prim.attributes.NORMAL), U = read(prim.attributes.TEXCOORD_0), I = read(prim.indices);
const nv = P.length / 3;
let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
for (let i = 0; i < nv; i++) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], P[i * 3 + k]); mx[k] = Math.max(mx[k], P[i * 3 + k]); }
const ext = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]);

function decimate(cells) {
  const cs = ext / cells, uvCells = Math.max(8, cells / 2);
  // 位置：同一格的點用同一個平均位置（不會有裂縫）；貼圖座標：同一格裡再依 UV 分開
  const pmap = new Map(), psum = [], map = new Map(), sum = [], remap = new Int32Array(nv);
  for (let i = 0; i < nv; i++) {
    const pk = `${Math.floor((P[i * 3] - mn[0]) / cs)},${Math.floor((P[i * 3 + 1] - mn[1]) / cs)},${Math.floor((P[i * 3 + 2] - mn[2]) / cs)}`;
    let pid = pmap.get(pk); if (pid === undefined) { pid = psum.length; pmap.set(pk, pid); psum.push([0, 0, 0, 0, 0, 0, 0]); }
    const q = psum[pid]; q[0] += P[i * 3]; q[1] += P[i * 3 + 1]; q[2] += P[i * 3 + 2]; q[3] += N[i * 3]; q[4] += N[i * 3 + 1]; q[5] += N[i * 3 + 2]; q[6]++;
    const key = pid + ',' + Math.floor(U[i * 2] * uvCells) + ',' + Math.floor(U[i * 2 + 1] * uvCells);
    let id = map.get(key);
    if (id === undefined) { id = sum.length; map.set(key, id); sum.push([pid, 0, 0, 0]); }
    const s = sum[id]; s[1] += U[i * 2]; s[2] += U[i * 2 + 1]; s[3]++;
    remap[i] = id;
  }
  const idx = [], seen = new Set();
  for (let t = 0; t < I.length; t += 3) {
    const a = remap[I[t]], c = remap[I[t + 1]], d = remap[I[t + 2]];
    const pa = sum[a][0], pc = sum[c][0], pd = sum[d][0];
    if (pa === pc || pc === pd || pa === pd) continue;
    const k = [a, c, d].sort((x, y) => x - y).join(','); if (seen.has(k)) continue; seen.add(k);
    idx.push(a, c, d);
  }
  return { sum, psum, idx };
}

// 二分找格子數，讓三角面數接近目標
let lo = 10, hi = 600, best = null;
for (let it = 0; it < 14; it++) {
  const mid = (lo + hi) / 2, r = decimate(mid);
  if (r.idx.length / 3 > TARGET) hi = mid; else { lo = mid; best = r; }
}
best ??= decimate(lo);
const pos = [], nor = [], uv = [];
for (const s of best.sum) {
  const q = best.psum[s[0]], c = q[6];
  pos.push(+(q[0] / c).toFixed(4), +(q[1] / c).toFixed(4), +(q[2] / c).toFixed(4));
  const l = Math.hypot(q[3], q[4], q[5]) || 1; nor.push(+(q[3] / l).toFixed(3), +(q[4] / l).toFixed(3), +(q[5] / l).toFixed(3));
  uv.push(+(s[1] / s[3]).toFixed(4), +(s[2] / s[3]).toFixed(4));
}

// 主貼圖（baseColor）
const mat = gltf.materials?.[prim.material] || {};
const texIdx = mat.pbrMetallicRoughness?.baseColorTexture?.index ?? 0;
const img = gltf.images[gltf.textures[texIdx].source];
const iv = gltf.bufferViews[img.bufferView];
const ext2 = img.mimeType === 'image/png' ? 'png' : 'jpg';
const texFile = `${outName}.${ext2}`;
fs.writeFileSync(path.join(outDir, texFile), bin.subarray(iv.byteOffset || 0, (iv.byteOffset || 0) + iv.byteLength));
fs.writeFileSync(path.join(outDir, outName + '.json'), JSON.stringify({ name: outName, tex: texFile, flipY: true, parts: [{ name: outName, pos, nor, uv, idx: best.idx }] }));
console.log(`${outName}: ${nv} 頂點 / ${I.length / 3} 面 → ${pos.length / 3} 頂點 / ${best.idx.length / 3} 面；貼圖 ${texFile} ${(iv.byteLength / 1e6).toFixed(1)}MB`);
