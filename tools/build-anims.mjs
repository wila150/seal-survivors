// 轉出玩家動作：assets/anims/<檔名>.json
// 每職業一組武器動作（Ma/Wa + 武器代碼 + 動作）：pi 站立、rn 跑、f1~f3 攻擊、dd 倒下
import fs from 'node:fs'; import path from 'node:path';
import { parseAn1 } from './seal-anim.mjs';
const [actor, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const files = fs.readdirSync(actor); const lower = new Map(files.map(f => [f.toLowerCase(), f]));
// 武器代碼照客戶端 actor/man*.act：gd 匕首（小丑，man04.act 音效 Clown_01；11/20 原本誤用 hd 空手）、hd 空手、bgs 大劍、ssh 劍盾、stm 杖、mcc 鎚（祭司）、smith 榔頭
export const WEAPON = { novice: 'hd', musa: 'bgs', knight: 'ssh', magic: 'stm', cleric: 'mcc', clown: 'gd', smith: 'smith', gunner: 'gunner', cook: 'chef' }; // chef＝饕客（actor/man24.act、woman24.act：chef_m_／chef_w_ + 動作；f1～f3 普攻、f4～f7 技能 → p1～p4）
// 獵人（gunner，項目 45）的動作檔命名不同：hm_／hw_ + 動作（hm_w1、hm_rn、hm_f1、hm_p1…，見 actor/man20.act）
// 動作組的鍵：pi＝平常站著（用原版 w1 安靜站姿；原版 pi 是戰鬥備戰、一直彈跳，使用者 11/18：不要一直動來動去）
//            fid＝站久了偶爾播一次的等待動作（原版 w2：伸懶腰、東張西望，2～5 秒）
const ACTS = ['pi', 'rn', 'f1', 'f2', 'f3', 'dd', 'fid', 'p1', 'p2', 'p3', 'p4', 'rpi', 'rrn', 'fw', 'ff', 'fg', 'fx']; // rpi／rrn＝騎坐騎（11/20 使用者：上坐騎會穿模 → 照 PC 騎馬坐姿 GRHMpi／GRHMrn，每職業共用） // p1～p4＝原版技能動作（11/18 使用者：技能動畫要照 PC）
const SRC = { pi: ['w1', 'pi'], fid: ['w2'] };
// 獵人另外有每招專屬動作（skills.json 技能的 motion 欄指定）
const GUNNER_EXTRA = ['multishot', 'doubleshot', 'powershot', 'pointshot', 'rapid', 'simpleshot', 'overdriveshot', 'shotshot'];
const made = {};
for (const g of ['Ma', 'Wa']) for (const [job, w] of Object.entries(WEAPON)) for (const a of (w === 'gunner' ? [...ACTS, ...GUNNER_EXTRA] : ACTS)) {
  // 女角少數動作沒有 → 用男角同一個，再沒有就用空手
  const FISH = { fw: 'fishtd_wait', ff: 'fishtd_fight', fg: 'fishtd_get', fx: 'fishtd_fail' }; // 11/20 釣魚動作（actor/m_／w_fishtd_*，man_skill.act）：等魚上鉤、拉魚、釣到、失敗，每職業共用
  const RIDE = { rpi: 'GRHMpi', rrn: 'GRHMpi' }; // 移動也用坐姿：GRHMrn 兩腿往下擺、穿過坐騎肚子踩到地（11/20 使用者：人物移動還是怪）→ 改成坐穩不動、跟著坐騎步伐起伏（sealMount 的 bob） // 原版騎馬坐姿（跨坐、手拉韁繩；G2_ 開頭的是機車／轎車的後仰坐姿，騎動物像在大笑，11/20 使用者截圖）；只有男版 → 女角共用
  const cands = FISH[a] ? [(g === 'Ma' ? 'm_' : 'w_') + FISH[a], 'm_' + FISH[a]] : RIDE[a] ? [RIDE[a]] : w === 'chef' ? (SRC[a] || [({ p1: 'f4', p2: 'f5', p3: 'f6', p4: 'f7' })[a] || a]).flatMap(x => [(g === 'Ma' ? 'chef_m_' : 'chef_w_') + x, 'chef_m_' + x]): w === 'gunner' ? (SRC[a] || [a]).flatMap(x => [(g === 'Ma' ? 'hm_' : 'hw_') + x, 'hm_' + x]) : (SRC[a] || [a]).flatMap(x => [g + w + x, 'Ma' + w + x, g + 'hd' + x, 'Mahd' + x]);
  const f = cands.map(c => lower.get(c.toLowerCase() + '.an1')).find(Boolean); if (!f) { console.log('缺', g + w + a); continue; }
  const id = f.slice(0, -4);
  (made[`${g[0].toLowerCase()}_${job}`] ||= {})[a] = id;
  if (fs.existsSync(path.join(out, id + '.json'))) continue;
  const an = parseAn1(fs.readFileSync(path.join(actor, f)));
  const T = 160 * 30; // tick → 秒
  const tracks = Object.entries(an.nodes).map(([bone, n]) => ({ bone,
    pt: n.pos.map(k => +(k[0] / T).toFixed(4)), p: n.pos.flatMap(k => k.slice(1).map(v => +v.toFixed(4))),
    qt: n.rot.map(k => +(k[0] / T).toFixed(4)), q: n.rot.flatMap(k => k.slice(1).map(v => +v.toFixed(5))) })).filter(t => t.pt.length || t.qt.length);
  fs.writeFileSync(path.join(out, id + '.json'), JSON.stringify({ name: id, dur: an.endFrame / 30, tracks }));
}
// 怪物／NPC 的動作組（mob_ 開頭，tools/build-mobs.mjs 寫的）保留
try { for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(path.join(out, 'sets.json'), 'utf8')))) if (k.startsWith('mob_')) made[k] = v; } catch {}
fs.writeFileSync(path.join(out, 'sets.json'), JSON.stringify(made));
console.log(JSON.stringify(made));
