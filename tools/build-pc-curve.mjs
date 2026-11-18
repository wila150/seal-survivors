// 項目 41 v1.1：PC 怪物等級曲線（難度＝同一張地圖選「怪物等級」，強度照 PC 數值）
// 用法：node tools/build-pc-curve.mjs <服務端 Game/scripts/monster.scr（GBK）>  → src/1_data/pc-curve.js
// 只取「一般野外怪」：同名同等級有 ≥3 個血量相近的變體（PC 野外怪的固定格式）；首領、副本、召喚物、場景物件都排除
// 欄位（monster.scr）：0 名稱、1 等級、2 HP、7 攻擊、11 經驗
// 每級取中位數 → 前後 4 級滑動中位數剔除離群（>2 倍或 <0.5 倍，前 3 級不剔）→ 線性補洞 → 強制單調遞增 → Lv1～200
import fs from 'node:fs';
import { TextDecoder } from 'node:util';

const src = process.argv[2];
if (!src) { console.error('用法：node tools/build-pc-curve.mjs <monster.scr>'); process.exit(1); }
const text = new TextDecoder('gbk').decode(fs.readFileSync(src));
const rows = text.split('\n').slice(1).map(l => l.split('|')).filter(r => r.length > 12);
const groups = {};
for (const r of rows) (groups[r[0] + '|' + r[1]] ??= []).push(r);
const by = {};
for (const rs of Object.values(groups)) {
  if (rs.length < 3) continue;
  const r = rs.reduce((a, b) => +a[2] < +b[2] ? a : b), lv = +r[1], hp = +r[2], atk = +r[7], exp = +r[11];
  if (lv < 1 || lv > 200 || atk < 10 || exp < 3) continue;
  if (hp >= 100000 && hp % 10000 === 0) continue; // 10 萬以上的整萬數＝佔位假資料（例：一堆剛好 200000）
  if (Math.max(...rs.map(x => +x[2])) / hp > 1.2) continue;
  (by[lv] ??= []).push([hp, atk, exp]);
}
const med = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
const MAX = 200, raw = { hp: [], atk: [], exp: [] }; // 200 以上的資料混了特殊怪（Lv218→219 HP 跳 6 倍），不用
for (let l = 1; l <= MAX; l++) if (by[l]) { raw.hp[l] = med(by[l].map(x => x[0])); raw.atk[l] = med(by[l].map(x => x[1])); raw.exp[l] = med(by[l].map(x => x[2])); } // exp：項目 33 每隻怪給的經驗
function clean(arr) {
  const out = [];
  for (let l = 1; l <= MAX; l++) {
    if (arr[l] == null) continue;
    const win = []; for (let k = l - 4; k <= l + 4; k++) if (arr[k] != null) win.push(arr[k]);
    const m = med(win); if (l > 3 && (arr[l] > m * 2 || arr[l] < m * 0.5)) continue; out[l] = arr[l]; // 前 3 級成長很快，不剔除
  }
  // 線性補洞＋單調
  let last = null; const res = [];
  for (let l = 1; l <= MAX; l++) {
    if (out[l] != null) { if (last != null) for (let k = last + 1; k < l; k++) res[k] = Math.round(out[last] + (out[l] - out[last]) * (k - last) / (l - last)); res[l] = out[l]; last = l; }
  }
  for (let l = 1; l <= MAX; l++) { if (res[l] == null) res[l] = res[l - 1] ?? res.find(v => v != null); if (l > 1 && res[l] < res[l - 1]) res[l] = res[l - 1]; }
  return res.slice(1);
}
const curve = { _說明: 'PC 一般野外怪的等級曲線（tools/build-pc-curve.mjs 從服務端 monster.scr 產生）：hp[i]／atk[i]＝Lv(i+1) 的中位數，已剔除離群、補洞、單調化', max: MAX, hp: clean(raw.hp), atk: clean(raw.atk), exp: clean(raw.exp) };
fs.writeFileSync(new URL('../src/1_data/pc-curve.js', import.meta.url), `// 自動產生，不要手改（node tools/build-pc-curve.mjs <monster.scr>）\nexport default ${JSON.stringify(curve)};\n`); // JS 模組：瀏覽器不用支援 import JSON
console.log(`Lv1～${MAX}：` + [1, 10, 30, 50, 80, 100, 150, 200].map(l => `Lv${l} HP${curve.hp[l - 1]} ATK${curve.atk[l - 1]} EXP${curve.exp[l - 1]}`).join('｜'));
