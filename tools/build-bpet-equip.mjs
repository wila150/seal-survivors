// 戰寵裝備原版資料：服務端 Game/scripts/item.scr（GBK）類別 50 → src/1_data/pc-bpet-equip.js
// 用法：node tools/build-bpet-equip.mjs <item.scr>
// 欄位（0 起算）：0 編號、1 名稱、2 類別（50＝戰寵裝備）、3 需求戰寵等級、6 攻擊、17 防禦、35 售價、43 忠誠度需求、70 部位（0 武器／頭盔、1 上衣、2 下褲、3 精靈石Ⅰ、4 精靈石Ⅱ）、71 限定種類（0 共通、1 光、2 黑暗、3 火、4 水）、73 圖示
// 精煉版（.G／.DG／.XG）不收：割草版沒有戰寵裝備精煉
import fs from 'node:fs'; import { execSync } from 'node:child_process';
import { S2T } from './s2t.mjs';
const MORE = '宠寵灵靈闇闇龙龍头頭盔盔铁鐵圣聖级級独獨兽獸纳納勒勒卡卡蟾蟾蜍蜍玛瑪璐璐犬犬狼狼温溫蒂蒂妮妮德德雷雷克克尼尼特特拉拉斯斯伊伊弗弗利利裤褲衣衣钢鋼黄黃金金白白恶惡乱亂赖賴勇勇气氣绝絕琳琳妒妒忌忌怒怒伤傷渴渴';
for (let i = 0; i < MORE.length; i += 2) S2T[MORE[i]] ??= MORE[i + 1];
const t = s => [...s].map(c => S2T[c] || c).join('');
const f = process.argv[2]; if (!f) { console.error('用法：node tools/build-bpet-equip.mjs <item.scr>'); process.exit(1); }
const KIND = { 1: 'light', 2: 'dark', 3: 'fire', 4: 'water' };
const out = {};
for (const l of execSync(`iconv -f GBK -t UTF-8 -c "${f}"`, { maxBuffer: 1 << 28 }).toString().split('\n')) {
  const c = l.split('|'); if (c[2] !== '50' || /\.(G|DG|XG)$/.test(c[1])) continue;
  out[+c[0]] = { name: t(c[1]), slot: +c[70] || 0, kind: KIND[c[71]] || null, req: +c[3] || 0, atk: +c[6] || 0, def: +c[17] || 0, loyal: +c[43] || 0, price: +c[35] || 0, icon: +c[73] || 0 };
}
const body = `// 自動產生，不要手改（node tools/build-bpet-equip.mjs <item.scr>）\n// PC 原版戰寵裝備：編號 → { 名稱, 部位 0 武器／頭盔 1 上衣 2 下褲 3 精靈石Ⅰ 4 精靈石Ⅱ, 限定種類（null 共通）, 需求戰寵等級, 攻擊, 防禦, 忠誠度需求, 售價, 圖示 }\nexport const PC_BPET_EQUIP = ${JSON.stringify(out).replace(/\},"/g, '},\n"')};\n`;
fs.writeFileSync(new URL('../src/1_data/pc-bpet-equip.js', import.meta.url), body);
console.log(Object.keys(out).length, '件', (body.length / 1024).toFixed(0) + ' KB');
const cnt = {}; for (const e of Object.values(out)) { const k = `${e.kind || '共通'} 部位${e.slot}`; cnt[k] = (cnt[k] || 0) + 1; } console.log(cnt);
