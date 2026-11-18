// 原版主選單按鈕（台服 interface/mainbutton_all.tex）→ assets/ui/btn_<名稱>_<0一般|1滑過|2按下>.png
// 用法：node tools/build-ui.mjs <客戶端 interface 資料夾>
// 方框是用透明度連通區塊量出來的（11/18）：[x1, y1, x2, y2]，三列＝一般／滑過／按下
import fs from 'node:fs';
import path from 'node:path';
import { texToPng, png } from './seal-model.mjs';

const dir = process.argv[2];
if (!dir) { console.error('用法：node tools/build-ui.mjs <客戶端 interface 資料夾>'); process.exit(1); }
const BTN = {
  mall:   [[6, 9, 70, 73], [5, 89, 69, 153], [4, 163, 68, 227]],          // 商城
  status: [[87, 16, 129, 58], [90, 69, 132, 111], [86, 134, 128, 176]],   // 狀態
  bag:    [[147, 11, 190, 58], [153, 69, 195, 111], [141, 134, 183, 176]], // 背包
  bank:   [[206, 9, 252, 58], [211, 69, 264, 111], [200, 134, 245, 176]],  // 賭拼銀行（倉庫）
  skill:  [[267, 16, 309, 58], [282, 69, 324, 111], [261, 134, 303, 176]], // 技能
  quest:  [[325, 15, 372, 58], [341, 69, 394, 111], [320, 134, 365, 176]], // 任務歷程
  quick:  [[391, 14, 435, 57], [403, 69, 455, 111], [384, 134, 426, 176]], // 快捷鍵
  friend: [[447, 11, 501, 57], [313, 191, 367, 233], [443, 134, 488, 176]],// 好友名單
  map:    [[83, 190, 125, 232], [81, 239, 127, 281], [82, 290, 125, 332]], // 傳送（MAP）
  party:  [[141, 186, 187, 232], [141, 239, 187, 281], [142, 290, 187, 332]], // 快速組隊
  help:   [[203, 186, 245, 232], [202, 239, 245, 281], [202, 290, 244, 332]], // 說明
  power:  [[260, 202, 285, 227], [260, 252, 285, 277], [258, 299, 283, 324]], // 電源
};
const { w, rgba } = texToPng(fs.readFileSync(path.join(dir, 'mainbutton_all.tex')), true);
const out = new URL('../assets/ui/', import.meta.url); fs.mkdirSync(out, { recursive: true });
let n = 0;
for (const [name, states] of Object.entries(BTN)) states.forEach(([x1, y1, x2, y2], s) => {
  const cw = x2 - x1 + 1, ch = y2 - y1 + 1, px = Buffer.alloc(cw * ch * 4);
  for (let y = 0; y < ch; y++) rgba.copy(px, y * cw * 4, ((y1 + y) * w + x1) * 4, ((y1 + y) * w + x2 + 1) * 4);
  fs.writeFileSync(new URL(`btn_${name}_${s}.png`, out), png(cw, ch, px)); n++;
});
// 整張照用的原版介面圖：小地圖 NPC 圖示（32px 格子 8×4）、左上 HP／AP／EXP 框（GageBar）
for (const name of ['minimapicon', 'GageBar']) { fs.writeFileSync(new URL(`${name.toLowerCase()}.png`, out), texToPng(fs.readFileSync(path.join(dir, `${name}.tex`)), true).png); n++; }
console.log(`${n} 張 → assets/ui/`);
