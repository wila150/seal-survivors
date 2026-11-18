// 希望OL 骨架（.bn1）與動作（.an1）解析
//
// .bn1：i32 0, i32 0, i32 骨頭數；每根 765 bytes：
//   name[256] | u8 有父骨 | parent[256] | 252 bytes：
//   f[0..3] 不明（f[3] 根骨 = 0xffffffff）、f[5..20] 世界矩陣 4×4（列優先，平移在 f[17..19]，Y 朝上）、
//   f[21..36] 反矩陣、f[49..51] 原始位置（Z 朝上）、f[52..54] 縮放、f[55..58]／f[59..62] 四元數
// .an1：i32 0, i32 16, f32 結束影格, f32 每影格 tick（160）, name[256]；
//   0x110：i32 節點數, i32 ?, i32 ?, i32 ?, i32 ?；之後每個節點：
//   name[256] | 位置鍵 n + n×(i32 tick, 3f, 2×i32 樹連結) (+ i32 樹根 if n) |
//   旋轉鍵 n + n×(i32 tick, 4f 四元數, 4f 不明, 2×i32) (+ i32 if n) | 縮放鍵 n + n×(i32 tick, 3f, 4f, 2×i32) (+ i32 if n)
// .ms1 蒙皮：faces 之後…，檔尾是 i32 骨頭數 B，再 B 組 (n, n×f32 權重, n×u32 頂點)；骨頭編號 = .bn1 的順序
import fs from 'node:fs';

const cstr = (b, o) => { const e = b.indexOf(0, o); return b.toString('latin1', o, e < 0 || e > o + 256 ? o + 256 : e); };

export function parseBn1(b) {
  const n = b.readInt32LE(8), bones = [];
  for (let i = 0; i < n; i++) {
    const o = 12 + 765 * i, f = k => b.readFloatLE(o + 513 + k * 4);
    const world = []; for (let k = 5; k <= 20; k++) world.push(f(k));
    bones.push({ name: cstr(b, o), parent: b[o + 256] ? cstr(b, o + 257) : null, world });
  }
  return bones;
}

export function parseAn1(b) {
  const endFrame = b.readFloatLE(8), tpf = b.readFloatLE(12), name = cstr(b, 16);
  const count = b.readInt32LE(0x110); let o = 0x124; const nodes = {};
  for (let k = 0; k < count && o < b.length - 260; k++) {
    const nm = cstr(b, o); o += 256;
    const pos = [], rot = [], scl = [];
    let n = b.readInt32LE(o); o += 4;
    for (let i = 0; i < n; i++, o += 24) pos.push([b.readInt32LE(o), b.readFloatLE(o + 4), b.readFloatLE(o + 8), b.readFloatLE(o + 12)]);
    if (n) o += 4;
    n = b.readInt32LE(o); o += 4;
    for (let i = 0; i < n; i++, o += 44) rot.push([b.readInt32LE(o), b.readFloatLE(o + 4), b.readFloatLE(o + 8), b.readFloatLE(o + 12), b.readFloatLE(o + 16)]);
    if (n) o += 4;
    n = b.readInt32LE(o); o += 4;
    for (let i = 0; i < n; i++, o += 40) scl.push([b.readInt32LE(o), b.readFloatLE(o + 4), b.readFloatLE(o + 8), b.readFloatLE(o + 12)]);
    if (n) o += 4;
    nodes[nm] = { pos, rot, scl };
  }
  return { name, endFrame, tpf, secs: endFrame / 30, nodes };
}

// 蒙皮權重（檔尾那段）：回傳每個頂點 [[骨頭, 權重], ...]，失敗回傳 null
export function parseSkin(b, nverts) {
  // 從檔尾往前試：找一個起點，讓 B 組資料剛好讀到檔尾
  for (let s = b.length - 8; s > b.length - 200000 && s > 0; s -= 4) {
    const B = b.readUInt32LE(s); if (B < 10 || B > 80) continue;
    let o = s + 4, ok = true; const w = Array.from({ length: nverts }, () => []);
    for (let k = 0; k < B; k++) {
      if (o + 4 > b.length) { ok = false; break; }
      const n = b.readUInt32LE(o); o += 4; if (n > nverts * 2 || o + n * 8 > b.length) { ok = false; break; }
      for (let i = 0; i < n; i++) { const v = b.readUInt32LE(o + (n + i) * 4); if (v >= nverts) { ok = false; break; } w[v].push([k, b.readFloatLE(o + i * 4)]); }
      if (!ok) break; o += n * 8;
    }
    if (ok && o === b.length && w.every(x => x.length)) return w;
  }
  return null;
}
