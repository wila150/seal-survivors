// 用法：node tools/check-html.mjs town.html game.html index.html（提交前跑）
// 把 html 裡的 <script type="module"> 抽出來 node --check
import fs from "node:fs"; import os from "node:os"; import { execSync } from 'node:child_process';
let bad = 0;
for (const f of process.argv.slice(2)) {
  const s = fs.readFileSync(f, 'utf8'); let i = 0;
  for (const m of s.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/src=|importmap|application\/json/.test(m[1]) || !m[2].trim()) continue; i++;
    const tmp = `${os.tmpdir()}/sschk_${i}.mjs`; fs.writeFileSync(tmp, m[2]);
    try { execSync(`node --check ${tmp}`, { stdio: 'pipe' }); } catch (e) { bad++; console.log('BAD', f, '#' + i, String(e.stderr).split('\n').slice(0, 5).join('\n')); }
  }
  console.log(f, i, 'scripts checked');
}
process.exit(bad ? 1 : 0);
