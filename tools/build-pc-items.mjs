// 道具數值照 PC（11/19 使用者：「道具數值也照 pc 去做」）
// 用法：node tools/build-pc-items.mjs <服務端 Game/scripts/item.scr（GBK）> → src/1_data/pc-items.js
// item.scr 欄位（0 起算）：0 編號、1 名稱、2 類別、3 需求等級、6 物理攻擊、12 魔法攻擊、17 防禦、73 圖示（= assets/items/<圖示>.png）
// 只取一般款：名稱沒有 ? [ ( 、不是 .G／.DG／.XG（G 化是我們自己的 gup）、不是 GM 用、同類別同名只留一個；依等級排序
import fs from 'node:fs';
import { S2T } from './s2t.mjs';
const src = process.argv[2];
if (!src) { console.error('用法：node tools/build-pc-items.mjs <item.scr>'); process.exit(1); }
// 我們的底材 → PC 道具類別（武器看物理攻擊、防具看防禦）
export const TYPES = { 4: '劍', 6: '大劍', 7: '匕首', 8: '榔頭', 9: '鎚', 11: '杖', 46: '彈弓', 14: '盾', 15: '盔甲', 16: '上衣',
  17: '頭盔', 18: '帽子', 25: '盔甲下', 26: '下褲', 19: '靴', 20: '鞋', // 項目 32：PC 部位 頭部 17／18、下衣 25／26、鞋子 19／20
  a0: '頭飾', a8: '耳環', a9: '項鍊', a10: '手鐲', a11: '戒指' }; // 飾品 21 依第 70 欄（裝備位置）再分：0 頭飾、8 耳環、9 項鍊、10 手鐲、11 戒指（6＝一般飾品，維持舊的飾品格）
const STAT_COL = t => [14, 15, 16, 17, 18, 19, 20, 25, 26].includes(t) || String(t)[0] === 'a' ? 17 : t === 11 ? 12 : 6; // 杖看魔法攻擊（第 12 欄）
const text = new TextDecoder('gbk').decode(fs.readFileSync(src));
const rows = text.split('\n').slice(1).map(l => l.split('|')).filter(r => r.length > 74);
const out = {}, chars = new Set(), miss = new Set();
const tw = s => [...s].map(c => { if (S2T[c]) return S2T[c]; chars.add(c); return c; }).join('');
for (const r of rows) {
  const t = +r[2] === 21 ? 'a' + r[70] : +r[2]; if (!TYPES[t]) continue;
  const name = r[1].trim().replace(/\(上(衣)?\)$/, '').replace(/\(下(裤|裙|衣)?\)$/, '（下）'), lv = +r[3], icon = +r[73]; let v = +r[STAT_COL(t)]; if (String(t)[0] === 'a' && v <= 0) v = Math.max(1, lv); // 戒指等防禦是 0 → 用需求等級當強度 // 盔甲(上)＝上半身那件
  // 排除：英文名、活動／搞笑道具（周年、紀念、服裝、套裝、禮服）、「20等級○○武器」這種泛用名、新手道具
  if (!name || /[?？\[\(（A-Za-z]|\.(G|DG|XG)$|测试|周年|纪念|服装|套装|礼服|等级.*(武器|上衣)|初级者|初心者|新手|未完成/.test(name.replace(/（下）$/, '')) || lv < 1 || lv > 200 || v <= 0 || !icon) continue;
  if (!fs.existsSync(new URL(`../assets/items/${icon}.png`, import.meta.url))) { miss.add(icon); continue; }
  const list = out[t] ??= [];
  if (list.some(x => x[1] === name)) continue;
  list.push([+r[0], name, lv, v, icon, +r[72] || 0]); // 第 6 欄＝外觀編號（wear/cha.dat 該部位清單的序號＋1，tools/build-wear.mjs 用）
}
// 離群值：跟前後 15 級同類道具的中位數比，超過 1.6 倍或不到 0.6 倍的不要（例：雷神之鎚 Lv50 攻 400、日輪刀、好巨好扇攻 53）
const med = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
for (const t in out) {
  out[t].sort((a, b) => a[2] - b[2] || a[3] - b[3]);
  const L = out[t]; out[t] = L.filter(x => { const m = med(L.filter(y => Math.abs(y[2] - x[2]) <= 15).map(y => y[3])); return x[3] <= m * 1.6 && x[3] >= m * 0.6; });
  for (const x of out[t]) x[1] = tw(x[1]);
}
if (process.argv.includes('--chars')) { console.log([...chars].join('')); process.exit(0); }
const body = `// 自動產生，不要手改（node tools/build-pc-items.mjs <item.scr>）\n// [PC 編號, 名稱, 需求等級, 攻擊或防禦, 圖示, 外觀編號]（依等級排序）\nexport const PC_TYPES = ${JSON.stringify(TYPES)};\nexport const PC_ITEMS = ${JSON.stringify(out)};\n`;
fs.writeFileSync(new URL('../src/1_data/pc-items.js', import.meta.url), body);
console.log(Object.entries(out).map(([t, l]) => `${TYPES[t]} ${l.length} 件（Lv${l[0][2]}～${l.at(-1)[2]}）`).join('、') + (miss.size ? `；缺圖示 ${miss.size}` : ''));
