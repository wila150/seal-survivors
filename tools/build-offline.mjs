// 產生離線版伺服器：server.mjs → src/0_offline/server.js（GitHub Pages／手機用，資料存在瀏覽器）
// 只換掉 node: 匯入和 ./src/ 路徑，其餘程式完全一樣 → 改了 server.mjs 之後重跑：node tools/build-offline.mjs
import fs from 'node:fs';
const root = new URL('../', import.meta.url);
let s = fs.readFileSync(new URL('server.mjs', root), 'utf8');
const nodeImports = /^import .* from 'node:[a-z]+';\n/gm;
const n = (s.match(nodeImports) || []).length;
if (n !== 6) throw new Error(`server.mjs 的 node: 匯入有 ${n} 行（預期 6），要更新 build-offline.mjs`);
s = s.replace(nodeImports, '');
s = s.replace(/from '\.\/src\//g, "from '../");
s = `// 自動產生，不要手改（node tools/build-offline.mjs）\nimport { http, fs, path, crypto, Buffer, DatabaseSync, fileURLToPath, handle } from './shims.js';\nexport { handle };\n` + s;
fs.writeFileSync(new URL('src/0_offline/server.js', root), s);
console.log('src/0_offline/server.js 已產生');
