// 11/20 寵物照 PC：從服務端 item.txt（GBK）＋ Game/scripts/Pet_Ingest_Condition.scr 產生 src/1_data/pc-pets.js
// 用法：node tools/build-pc-pets.mjs <item.txt> <Pet_Ingest_Condition.scr>
// item.txt 欄位（0 起算）：0 編號、1 名稱、2 類別（22＝寵物）、3 需求等級、6 物理攻擊、12 魔法攻擊、17 防禦、35 售價、73 圖示
// Pet_Ingest_Condition.scr：序號|寵物編號|階級 1～5|?
import fs from 'node:fs'; import { execSync } from 'node:child_process';
import { S2T } from './s2t.mjs';
const [itemTxt, condScr] = process.argv.slice(2);
if (!itemTxt || !condScr) { console.error('用法：node tools/build-pc-pets.mjs <item.txt> <Pet_Ingest_Condition.scr>'); process.exit(1); }
const gbk = f => execSync(`iconv -f GBK -t UTF-8 "${f}"`, { maxBuffer: 1 << 28 }).toString();
const extra = { 鸡: '雞', 宝: '寶', 傻: '傻', 瓜: '瓜', 博: '博', 康: '康', 凡: '凡', 丑: '丑', 尼: '尼', 欧: '歐', 婴: '嬰', 儿: '兒', 淑: '淑', 种: '種', 发: '發', 芽: '芽', 头: '頭', 弟: '弟', 南: '南', 荚: '莢', 皮: '皮', 苞: '苞', 辣: '辣', 妹: '妹', 豌: '豌', 豆: '豆', 葵: '葵', 瑰: '瑰', 蔬: '蔬', 果: '果', 妖: '妖', 精: '精', 鸟: '鳥', 蛋: '蛋', 伸: '伸', 爪: '爪', 蝙: '蝙', 蝠: '蝠', 翅: '翅', 膀: '膀', 羽: '羽', 毛: '毛', 吸: '吸', 血: '血', 猪: '豬', 龙: '龍', 兽: '獸', 乌: '烏', 鸦: '鴉', 鸳: '鴛', 鸯: '鴦', 猫: '貓', 鹰: '鷹', 巴: '巴', 哈: '哈', 姆: '姆', 特: '特', 菲: '菲', 斯: '斯', 克: '克', 武: '武', 神: '神', 战: '戰', 士: '士', 师: '師', 祭: '祭', 司: '司', 勇: '勇', 者: '者', 王: '王', 后: '后', 火: '火', 女: '女', 天: '天', 上: '上', 之: '之', 少: '少', 小: '小', 明: '明', 星: '星', 菜: '菜' };
const t = s => [...s].map(c => S2T[c] || extra[c] || c).join('');
const tierOf = {}; for (const l of gbk(condScr).split('\n')) { const c = l.split('|'); if (c.length >= 4 && +c[1]) tierOf[+c[1]] = +c[2]; }
// 系列：照官方 wiki（植物系、咕咕系、猛禽系、少女系）＋ item.txt 編號區段
const FAM = id => (id >= 99 && id <= 120) ? 'gugu' : (id >= 121 && id <= 127) ? 'girl' : ((id >= 128 && id <= 141) || (id >= 549 && id <= 555)) ? 'plant' : ((id >= 556 && id <= 565) || (id >= 582 && id <= 585)) ? 'bird' : null;
const out = {};
for (const l of gbk(itemTxt).split('\n')) { const c = l.split('|'); const id = +c[0]; if (c[2] !== '22' || !tierOf[id] || !FAM(id)) continue;
  out[id] = { name: t(c[1]), fam: FAM(id), tier: tierOf[id], req: +c[3] || 0, atk: +c[6] || 0, matk: +c[12] || 0, def: +c[17] || 0, price: +c[35] || 0, icon: +c[73] || 0, desc: t(c[c.length - 2] || '') }; }
const body = `// 自動產生，不要手改（node tools/build-pc-pets.mjs <item.txt> <Pet_Ingest_Condition.scr>）\n// PC 原版寵物：編號 → { 名稱, 系列, 階級 1～5（1＝蛋）, 需求等級, 攻擊, 魔攻, 防禦, 售價, 圖示, 說明 }\nexport const PC_PETS = ${JSON.stringify(out, null, 0).replace(/\},"/g, '},\n"')};\n`;
fs.writeFileSync('src/1_data/pc-pets.js', body); console.log(Object.keys(out).length, '隻');
for (const [id, p] of Object.entries(out)) console.log(id, p.name, p.fam, p.tier, 'req', p.req, p.atk, p.matk, p.def, '$' + p.price, p.icon);
