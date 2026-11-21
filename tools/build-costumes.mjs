// PC 時裝（企劃_PC系統補齊 #15）：服務端 item.scr 類別 12（分件時裝）／13（單件整套）→ src/1_data/costumes.js
// 用法：node tools/build-costumes.mjs <item.scr（GBK）> <客戶端 wear 資料夾>
// 欄位（0 起算）：1 名稱、2 類別、17 防禦、23 攻擊速度、25 命中率、27 必殺技、29 回避率、31 移動速度、33 套裝編號、37 HP、39 AP、72 外觀編號、73 圖示
//   對照 2u item_info：可愛的粉紅乳牛裝 17063（攻速 10、必殺 10、命中 10、回避 5、移速 10、HP 1000、AP 500）、長今戲服 8109（回避 15、移速 13）、白衣天使套裝 10801（攻速 10、命中 5、移速 13）
// 部位：類別 13＝上衣欄整套；類別 12 看名字（帽／頭飾…＝頭、上衣＝上衣、褲／下衣＝下衣、靴／鞋＝鞋），再用客戶端 cha.dat 該部位清單第 N 筆的模型名確認（M_cowboy_head／_body／_leg／_foot）
// 名字有亂碼（??）的、該部位找不到模型的不收
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { S2T } from './s2t.mjs';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const [src, wear] = process.argv.slice(2); if (!src || !wear) { console.error('用法：node tools/build-costumes.mjs <item.scr> <wear 資料夾>'); process.exit(1); }
const files = new Set(fs.readdirSync(wear).map(f => f.toLowerCase()));
const cb = fs.readFileSync(path.join(wear, [...fs.readdirSync(wear)].find(f => f.toLowerCase() === 'cha.dat'))); let o = 0x40; const CHA = {};
while (o + 4 <= cb.length) { const n = cb.readUInt32LE(o); if (n <= 0 || n > 5000) break; o += 4; const l = []; for (let i = 0; i < n; i++) { l.push(cb.toString('latin1', o, o + 32).split('\0')[0]); o += 32; } CHA[l[0]] = l; }
const tw = s => [...s].map(c => S2T[c] || c).join('');
const SEC = { head: 'M_head', top: 'M_body', bottom: 'M_Leg', shoes: 'M_Foot' };
const byName = n => /上衣|外衣|背心|夹克/.test(n) ? 'top' : /裤|下衣|裙/.test(n) ? 'bottom' : /靴|鞋/.test(n) ? 'shoes' : /帽|头|盔|冠|面具|发|耳|眼镜|角/.test(n) ? 'head' : null;
const text = new TextDecoder('gbk').decode(fs.readFileSync(src));
const out = {}; let skip = 0;
for (const line of text.split(/\r?\n/)) {
  const r = line.split('|'); if (r.length < 75) continue; const cat = +r[2]; if (cat !== 12 && cat !== 13) continue;
  const name = r[1]; if (!name || name.includes('?')) { skip++; continue; }
  const look = +r[72]; if (!look) { skip++; continue; }
  let slot = cat === 13 ? 'top' : byName(name);
  if (!slot || !CHA[SEC[slot]]?.[look] || !files.has(CHA[SEC[slot]][look].toLowerCase() + '.ms1')) { skip++; continue; }
  const st = {}; for (const [k, c] of [['def', 17], ['aspd', 23], ['hit', 25], ['crit', 27], ['dodge', 29], ['move', 31], ['hp', 37], ['ap', 39]]) if (+r[c]) st[k] = +r[c];
  out[r[0]] = [tw(name), slot, look, +r[73] || 0, st, +r[33] || 0, cat];
}
fs.writeFileSync(path.join(ROOT, 'src/1_data/costumes.js'), `// 自動產生，不要手改（node tools/build-costumes.mjs <item.scr> <wear 資料夾>）
// PC 時裝：編號 → [名稱, 部位, 外觀編號（cha.dat）, 圖示, 能力 { def 防禦, aspd 攻速, hit 命中, crit 必殺, dodge 回避, move 移速, hp, ap }, 套裝編號, 類別（12 分件／13 整套）]
export const COSTUMES = ${JSON.stringify(out)};
`);
console.log(`時裝 ${Object.keys(out).length} 件（跳過 ${skip}）`);
