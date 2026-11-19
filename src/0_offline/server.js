// 自動產生，不要手改（node tools/build-offline.mjs）
import { http, fs, path, crypto, Buffer, DatabaseSync, fileURLToPath, handle } from './shims.js';
export { handle };
// 希望OL 倖存者 本機伺服器：靜態檔案＋帳號／角色 API
// 啟動：node server.mjs   → http://localhost:8765
import * as PS from '../1_data/persona.js';
import * as TW from '../1_data/tower.js';
import { JOBS, OUTFITS, validateStats, STATS, MOUNT, validLook, defaultStats, FREE_POINTS, NOVICE, JOB1_AT, FIRST_JOBS } from '../1_data/jobs.js';
import { PC_WEAR } from '../1_data/pc-wear.js';
import { STAGES, stageUnlocked, stageGate, gearScore, stageTime } from '../1_data/stages.js';
import { NEED as PC_NEED, BASE_MAX } from '../1_data/pc-level.js';
import PC_CURVE from '../1_data/pc-curve.js';
import { STONES, STONE_UP, STONE_MAX, STONE_CHANGE, CHANGE_MAX, CHANGE_CHARGE, STONE_ORDER, DECOMPOSE, DUST_PER_CRYSTAL, stoneOf, rollAttr } from '../1_data/stones.js';
import { towerFloor, towerSeg, towerScore, towerPoints, towerOpen, CURSES, TOWER_NAME } from '../1_data/tower.js';
import { parseGm } from '../1_data/gm.js';
import { fameLevel, runFame, earnedTitles, titleOf, FAME_GEAR } from '../1_data/fame.js';
import { cleanDiff, diffLoot, lootBonus, stageBaseLv } from '../1_data/difficulty.js';
import { PETS, PET_MAX, EGG_PRICE, MVP_EGG_RATE, FEED_EXP, addPetExp, petNeed, petStage9, HUNGER_PER_SEC, FEED_HUNGER, PLAY_HUNGER, EVOLVE_SECS, WANT_SLOTS, EVO_CAT, evolveResult, TRAITS } from '../1_data/pets.js';
import { GRADES, newGem, rollGem, enchant, checkGemSlots, PATTERNS, OPEN_TRIES, OPEN_COST, FUSE_COST, FUSE_NEED, FUSE_UP, SLOT_LV, SLOT_COST, GEM_MAX, gemName } from '../1_data/gems.js';
import { checkTalents, talentPoints, spentPoints, branchOf, JOB1_MAX, JOB2_MAX, JOB3_MAX, IDENT_SLOTS, IDENT_COST, IDENT_PICK_COST, rollIdent } from '../1_data/talents.js';
import { RODS, BAIT, CATCH, rollCatch } from '../1_data/fishing.js';
import { JOB_WEAPON, rollAffix, rollItem, totalBonus, sellPrice, dismantleYield, REFINE_RATE, REFINE_MAX, refineBreaks, SLOTS, BASES, ORES, oreFor, stockFor, STOCK_DAILY, GUP, GUP_MAX, gupRate } from '../1_data/items.js';

const PORT = +process.env.PORT || 8765;
let _skills = null; const SKILLS = () => (_skills ??= JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'data', 'skills.json'), 'utf8')));
let _talents = null; const TALENTS = () => (_talents ??= JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'data', 'talents.json'), 'utf8'))); // 項目 26
const ROOT = path.dirname(fileURLToPath(import.meta.url));
fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
const db = new DatabaseSync(path.join(ROOT, 'data', 'game.db'));
db.exec(`
CREATE TABLE IF NOT EXISTS accounts (id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, pass TEXT NOT NULL, created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, account_id INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS characters (id INTEGER PRIMARY KEY, account_id INTEGER NOT NULL, slot INTEGER NOT NULL, name TEXT UNIQUE NOT NULL,
  gender TEXT NOT NULL, job TEXT NOT NULL DEFAULT '初心者', base_lv INTEGER NOT NULL DEFAULT 1, job_lv INTEGER NOT NULL DEFAULT 1,
  exp INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL DEFAULT '{}', created INTEGER NOT NULL, UNIQUE(account_id, slot));
CREATE TABLE IF NOT EXISTS runs (id INTEGER PRIMARY KEY, char_id INTEGER NOT NULL, secs INTEGER NOT NULL, kills INTEGER NOT NULL, lv INTEGER NOT NULL, exp INTEGER NOT NULL, created INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS runs_secs ON runs(secs DESC);
CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, char_id INTEGER NOT NULL, slot TEXT NOT NULL, base TEXT NOT NULL, rarity INTEGER NOT NULL,
  roll REAL NOT NULL, refine INTEGER NOT NULL DEFAULT 0, equipped INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS items_char ON items(char_id);
`);
try { db.exec('ALTER TABLE characters ADD COLUMN gold INTEGER NOT NULL DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE items ADD COLUMN bound INTEGER NOT NULL DEFAULT 0'); } catch {} // 項目 29：商人限量裝備綁定帳號
try { db.exec('ALTER TABLE items ADD COLUMN ident TEXT'); } catch {}
try { db.exec('ALTER TABLE items ADD COLUMN gup INTEGER NOT NULL DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE items ADD COLUMN aff TEXT'); } catch {} try { db.exec('ALTER TABLE auctions ADD COLUMN aff TEXT'); } catch {} // 項目 32：★ 特性＋詞綴 JSON
// 項目 32：裝備部位照 PC（防具拆成盾牌／頭部／上衣／下衣／鞋子）→ 舊的 armor 搬家：盾 → shield、其他 → top；非騎士身上的盾卸下
for (const t of ['items', 'auctions']) { try { db.exec(`UPDATE ${t} SET slot='shield' WHERE slot='armor' AND base='shield'`); db.exec(`UPDATE ${t} SET slot='top' WHERE slot='armor'`); } catch {} }
try { db.exec("UPDATE items SET equipped=0 WHERE slot='shield' AND char_id IN (SELECT id FROM characters WHERE job!='騎士')"); } catch {}
// 11/19：已經穿著別職業武器的（例：騎士穿彈弓）卸下
try { for (const [job, base] of Object.entries(JOB_WEAPON)) db.prepare("UPDATE items SET equipped=0 WHERE slot='weapon' AND base!=? AND equipped=1 AND char_id IN (SELECT id FROM characters WHERE job=?)").run(base, job); } catch {}
try { db.exec('ALTER TABLE items ADD COLUMN pc INTEGER'); } catch {}
try { db.exec('ALTER TABLE items ADD COLUMN locked INTEGER NOT NULL DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE items ADD COLUMN elem INTEGER NOT NULL DEFAULT 0'); } catch {} // 指令 4-3 武器七大屬性合成（1 火…7 暗）
try { db.exec('ALTER TABLE items ADD COLUMN look INTEGER'); } catch {}
try { db.exec('ALTER TABLE items ADD COLUMN setk TEXT'); } catch {} // 賢者之塔艾希頓套裝 // 指令 4-3 衣櫥外觀複製（顯示成這個 PC 道具的外觀） // 項目 50：鎖定（不會被一鍵餵食／分解／賣掉） // 11/19 道具照 PC：PC 原版道具編號（名稱、圖示、數值倍率） // 項目 46：G 化階段 0 一般／1 G／2 DG／3 XG
// 項目 18：倉庫（整個帳號共用）。存進倉庫的裝備 char_id＝0、acct＝帳號、stash＝分頁 0～5
try { db.exec('ALTER TABLE items ADD COLUMN acct INTEGER'); } catch {}
try { db.exec('ALTER TABLE items ADD COLUMN stash INTEGER'); } catch {}
try { db.exec('ALTER TABLE accounts ADD COLUMN stash TEXT'); } catch {}
// 項目 20：信箱（每個角色一個）。附件：gold、items（裝備規格陣列）、mats（{ 道具: 數量 }）
db.exec(`CREATE TABLE IF NOT EXISTS mails (id INTEGER PRIMARY KEY, char_id INTEGER NOT NULL, sender TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL,
  gold INTEGER NOT NULL DEFAULT 0, items TEXT, mats TEXT, read INTEGER NOT NULL DEFAULT 0, claimed INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS mails_char ON mails(char_id);
CREATE TABLE IF NOT EXISTS towers (id INTEGER PRIMARY KEY, char_id INTEGER NOT NULL, month TEXT NOT NULL, floor INTEGER NOT NULL, score INTEGER NOT NULL, curse TEXT NOT NULL, kills INTEGER NOT NULL, created INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS towers_month ON towers(month, score);`); // 項目 22 賢者之塔
const monthKey = (ts = Date.now()) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const towerBest = cid => ({ floor: db.prepare('SELECT MAX(floor) f FROM towers WHERE char_id=?').get(cid).f || 0, score: db.prepare('SELECT MAX(score) s FROM towers WHERE char_id=?').get(cid).s || 0,
  month: db.prepare('SELECT MAX(score) s FROM towers WHERE char_id=? AND month=?').get(cid, monthKey()).s || 0 }); // 項目 28：技能屬性鑑定結果 JSON { job, tree, id, lv }
db.exec(`CREATE TABLE IF NOT EXISTS auctions (id INTEGER PRIMARY KEY, seller_char INTEGER NOT NULL, seller_name TEXT NOT NULL, slot TEXT NOT NULL, base TEXT NOT NULL,
  rarity INTEGER NOT NULL, roll REAL NOT NULL, refine INTEGER NOT NULL, price INTEGER NOT NULL, expires INTEGER NOT NULL, created INTEGER NOT NULL)`);
try { db.exec('ALTER TABLE auctions ADD COLUMN ident TEXT'); } catch {} // 項目 28
try { db.exec('ALTER TABLE auctions ADD COLUMN gup INTEGER NOT NULL DEFAULT 0'); } catch {} // 項目 46
try { db.exec('ALTER TABLE auctions ADD COLUMN pc INTEGER'); } catch {}
const AUC_MAX = 10, AUC_HOURS = 24, AUC_FEE = 0.05;
// 過期的拍賣退回賣家背包
function expireAuctions() {
  npcMarket(); // 項目 56
  for (const a of db.prepare('SELECT * FROM auctions WHERE expires<?').all(Date.now())) {
    if (a.seller_char) giveItem(a.seller_char, a); // NPC 上架的（seller_char 0）過期就直接收掉
    db.prepare('DELETE FROM auctions WHERE id=?').run(a.id);
  }
}
// ===== 項目 56：離線拍賣 NPC（第八批藍圖）=====
// ①自動上架：每 2 小時補 2 件，NPC 同時最多 6 件；帶技能屬性鑑定（武器、防具）或 G 化的 PC 道具，定價＝賣價 ×8（G 化、鑑定再加價）
// ②自動收購：玩家上架 10 分鐘以上，依「行情 ÷ 定價」每小時有機率被買走（便宜賣很快、亂開價幾乎不會成交）；金幣扣 5% 手續費後用信件寄給賣家
db.exec('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)');
const NPC_SELLERS = ['旅行商人 卡爾', '收藏家 莉莉', '老商人 巴頓'], NPC_MAX = 6, NPC_EVERY = 2 * 3600e3;
const metaGet = k => db.prepare('SELECT v FROM meta WHERE k=?').get(k)?.v, metaSet = (k, v) => db.prepare('INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v=excluded.v').run(k, String(v));
const marketValue = it => sellPrice(it) * 6 * (1 + 0.5 * (it.gup || 0)) * (it.ident ? 1.5 : 1);
function npcMarket() {
  const now = Date.now(), last = +(metaGet('npcTick') || 0); if (now - last < 60e3) return; metaSet('npcTick', now);
  // 上架
  const lastList = +(metaGet('npcList') || 0), have = db.prepare('SELECT COUNT(*) n FROM auctions WHERE seller_char=0').get().n;
  if (now - lastList >= NPC_EVERY && have < NPC_MAX) {
    metaSet('npcList', now); const T = TALENTS();
    for (let i = 0; i < Math.min(2, NPC_MAX - have); i++) {
      const it = rollItem(Math.random, 1.2, null, 10 + Math.floor(Math.random() * 90)); if (it.rarity < 1) it.rarity = 1;
      if (IDENT_SLOTS.includes(it.slot) && Math.random() < 0.7) { const jobs = Object.keys(T.jobs).filter(j => T.jobs[j].nodes?.length); it.ident = JSON.stringify(rollIdent(T, jobs[Math.floor(Math.random() * jobs.length)])); }
      if (Math.random() < 0.35) it.gup = 1 + (Math.random() < 0.25 ? 1 : 0);
      const price = Math.round(marketValue({ ...it, ident: it.ident ? 1 : null }) * (1.2 + Math.random() * 0.4) / 10) * 10;
      db.prepare('INSERT INTO auctions (seller_char, seller_name, slot, base, rarity, roll, refine, price, expires, created, ident, gup, pc) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(0, NPC_SELLERS[Math.floor(Math.random() * NPC_SELLERS.length)], it.slot, it.base, it.rarity, it.roll, 0, price, now + AUC_HOURS * 3600e3, now, it.ident || null, it.gup || 0, it.pc || null);
    }
  }
  // 收購
  const hrs = Math.min(24, (now - (last || now)) / 3600e3); if (hrs <= 0) return;
  for (const a of db.prepare('SELECT * FROM auctions WHERE seller_char>0 AND created<? AND expires>=?').all(now - 600e3, now)) {
    const ratio = marketValue(a) / Math.max(1, a.price), pH = Math.max(0, Math.min(0.8, 0.25 * ratio * ratio));
    if (Math.random() >= 1 - Math.pow(1 - pH, hrs)) continue;
    db.prepare('DELETE FROM auctions WHERE id=?').run(a.id);
    const got = Math.floor(a.price * (1 - AUC_FEE));
    sendMail(a.seller_char, { sender: '拍賣商人', title: '拍賣成交', body: `你上架的裝備被 ${NPC_SELLERS[Math.floor(Math.random() * NPC_SELLERS.length)]} 以 ${a.price} 金幣買走了（扣 5% 手續費）。`, gold: got });
  }
}
const aucView = a => ({ id: a.id, seller: a.seller_name, sellerChar: a.seller_char, slot: a.slot, base: a.base, rarity: a.rarity, roll: a.roll, refine: a.refine, gup: a.gup || 0, aff: a.aff ? JSON.parse(a.aff) : null, pc: a.pc || null, price: a.price, expires: a.expires, ident: a.ident ? JSON.parse(a.ident) : null });
const BAG_MAX = 40;
const STASH_PAGES = 6, STASH_SIZE = 40, STASH_FREE = 2, STASH_COST = [0, 0, 5000, 10000, 20000, 40000]; // 第 3 頁起花金幣解鎖（數值暫定）
const stashInfo = uid => { const a = db.prepare('SELECT stash FROM accounts WHERE id=?').get(uid); const s = a?.stash ? JSON.parse(a.stash) : {};
  return { unlocked: Math.max(STASH_FREE, s.unlocked || 0), names: Array.from({ length: STASH_PAGES }, (_, i) => s.names?.[i] || `倉庫 ${i + 1}`) }; };
// 項目 21：轉生師
const REBIRTH_LV = 70, REBIRTH_MAX = 10, REBIRTH_BONUS = 75;
const MAIL_MAX = 100;
const isTowerKey = k => k === 'tower';
const RARITY_N = ['普通', '精良', '稀有', '史詩', '傳說'];
// 項目 19：戰力＝穿著裝備的數值換算成分數（權重暫定）
const RANK_TABS = ['power', 'base', 'job', 'stage', 'kills', 'tower'];
const POWER_W = { atk: 1000, crit: 1000, haste: 800, speed: 500, magnet: 100, hp: 2, armor: 20 };
const powerOf = items => Math.round(Object.entries(totalBonus(items)).reduce((t, [k, v]) => t + v * (POWER_W[k] || 0), 0));
function sendMail(cid, { sender = '系統', title, body = '', gold = 0, items = [], mats = {} }) {
  db.prepare('INSERT INTO mails (char_id, sender, title, body, gold, items, mats, created) VALUES (?,?,?,?,?,?,?,?)')
    .run(cid, sender, title, body, gold | 0, items.length ? JSON.stringify(items) : null, Object.keys(mats).length ? JSON.stringify(mats) : null, Date.now());
}
const mailView = m => ({ id: m.id, sender: m.sender, title: m.title, body: m.body, gold: m.gold, items: m.items ? JSON.parse(m.items) : [], mats: m.mats ? JSON.parse(m.mats) : {}, read: !!m.read, claimed: !!m.claimed, created: m.created });
const hasAttach = m => m.gold > 0 || !!m.items || !!m.mats;
// 開服見面禮：每個角色第一次打開信箱時寄一封（舊角色也會收到）。內容暫定
function welcomeMail(c) {
  const d = JSON.parse(c.data || '{}'); if (d.welcomed) return;
  d.welcomed = true; db.prepare('UPDATE characters SET data=? WHERE id=?').run(JSON.stringify(d), c.id);
  let w; do { w = rollItem(Math.random, 2, 'weapon', Math.max(1, c.base_lv), c.job); } while (w.rarity < 2); // 見面禮：自己職業的武器、照角色等級挑 PC 原版
  sendMail(c.id, { sender: '希望倖存者營運團隊', title: '開服見面禮', body: `${c.name}，歡迎來到艾林！這是我們準備的見面禮，祝你出征順利。`, gold: 1000, items: [w], mats: { ore1: 10 } });
}
const stashSave = (uid, s) => db.prepare('UPDATE accounts SET stash=? WHERE id=?').run(JSON.stringify(s), uid);
const stashItems = uid => db.prepare('SELECT * FROM items WHERE acct=? AND stash IS NOT NULL ORDER BY rarity DESC, id DESC').all(uid).map(r => ({ ...itemView(r), page: r.stash }));
const stashView = uid => ({ ...stashInfo(uid), pages: STASH_PAGES, size: STASH_SIZE, cost: STASH_COST, items: stashItems(uid) });
const MAX_SLOTS = 15;
// 項目 33（11/19「照建議」＋最高原則照 PC）：Base 升級經驗＝服務端 level.scr 原版表，上限 Lv 99
const needExp = lv => PC_NEED[Math.min(lv, BASE_MAX) - 1] || PC_NEED.at(-1);
// 每隻怪的經驗＝PC 一般野外怪該等級的經驗 × EXP_SCALE（割草一局殺的怪比 PC 多很多，取 1/10）；怪物等級比你低，每差 1 級經驗減半
const EXP_SCALE = 0.1;
const runExp = (kills, monLv, baseLv) => Math.floor(kills * (PC_CURVE.exp[Math.max(1, Math.min(PC_CURVE.max, monLv)) - 1] || 1) * EXP_SCALE * Math.pow(0.5, Math.max(0, baseLv - monLv)));
// 項目 25／27：Job 經驗＝本局 Base 經驗；曲線平緩（使用者 11/18 選「Job 50＋平緩曲線」：約 100 局到 Job 50）
// 一轉上限 Job Lv 50（滿 50 才能二轉）；二轉後接著升到 100（51 以後的點數給二轉樹）。數值暫定，之後後端調
const jobNeed = lv => (400 + 80 * lv) * (lv >= JOB2_MAX ? 8 : 1); // 項目 40：三轉 Job 經驗 ×8（企劃「Job 經驗 ÷8」）
const jobMaxOf = d => d.novice ? 10 : d.job3 ? JOB3_MAX : d.job2 ? JOB2_MAX : JOB1_MAX; // 初心者 Job Lv 最高 10（PC）
const DAY = 86400000;

// 密碼雜湊（scrypt）
const hash = pw => { const salt = crypto.randomBytes(16).toString('hex'); return salt + ':' + crypto.scryptSync(pw, salt, 32).toString('hex'); };
const verify = (pw, stored) => { const [salt, h] = stored.split(':'); return crypto.timingSafeEqual(Buffer.from(h, 'hex'), crypto.scryptSync(pw, salt, 32)); };

const send = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };
const body = req => new Promise((ok, bad) => { let s = ''; req.on('data', c => { s += c; if (s.length > 1e5) req.destroy(); }); req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch { bad(new Error('bad json')); } }); });
function auth(req) {
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  const s = t && db.prepare('SELECT account_id, expires FROM sessions WHERE token=?').get(t);
  if (!s || s.expires < Date.now()) return null;
  return s.account_id;
}
const charView = c => { const d = JSON.parse(c.data || '{}'); return { id: c.id, slot: c.slot, name: c.name, gender: c.gender, job: c.job, baseLv: c.base_lv, jobLv: c.job_lv, exp: c.exp, jobExp: d.jobExp ?? 0, jobMax: jobMaxOf(d), job2: d.job2 ?? null, job3: !!d.job3, jobName: (d.job2 && (d.job3 ? branchOf(TALENTS(), c.job, d.job2)?.third : branchOf(TALENTS(), c.job, d.job2)?.name)) || c.job, talents2: d.talents2 ?? {}, talentPts2: d.job2 ? talentPoints(c.job_lv, d.job2) : 0, stats: (S0 => { for (const [k, v] of Object.entries({ ...(d.persona?.pts || {}), ...(d.persona?.sub || {}) })) S0[k] = (S0[k] || 0) + v * 3; return S0; })({ wis: 1, ...(d.stats || {}) }), persona: { lv: d.persona?.lv || 0, lines: d.persona?.lines || [], sub: { ...(d.persona?.pts || {}), ...(d.persona?.sub || {}) }, corr: d.persona?.corr || 0 }, fameCur: (d.fame || 0) - (d.fameUsed || 0), towerToday: d.towerDay?.day === TW.towerDay() ? d.towerDay : { n: 0, t: 0 }, outfit: d.outfit ?? 0, hair: d.hair ?? 0, hairColor: d.hairColor ?? 0, gold: c.gold ?? 0, points: d.points ?? 0, cleared: d.cleared ?? [], mats: d.mats ?? {}, mountUntil: d.mountUntil ?? 0, talents: d.talents ?? {}, talentPts: talentPoints(c.job_lv), rebirth: d.rebirth ?? 0, fame: d.fame ?? 0, ...(F => ({ fameLv: F.lv, fameNext: F.next }))(fameLevel(d.fame ?? 0)), bossKills: d.bossKills ?? {}, title: d.title ?? null, pets: d.pets ?? [], pet: d.pet ?? null, gems: d.gems ?? [], gemOpen: d.gemOpen ?? 0, gemSlots: d.gemSlots ?? [], stones: Object.fromEntries(STONE_ORDER.map(k => [k, stoneOf(d.stones, k)])) }; };
const jobNeedOf = c => { const d = JSON.parse(c.data || '{}'); return c.job_lv >= jobMaxOf(d) ? 0 : jobNeed(c.job_lv); };
const itemView = r => ({ id: r.id, slot: r.slot, base: r.base, rarity: r.rarity, roll: r.roll, refine: r.refine, gup: r.gup || 0, aff: r.aff ? JSON.parse(r.aff) : null, pc: r.pc || null, elem: r.elem || 0, look: r.look || null, setk: r.setk || null, locked: !!r.locked, equipped: !!r.equipped, bound: !!r.bound, ident: r.ident ? JSON.parse(r.ident) : null });
const itemsOf = cid => db.prepare('SELECT * FROM items WHERE char_id=? ORDER BY equipped DESC, rarity DESC, id DESC').all(cid).map(itemView);
const ownChar = (uid, cid) => db.prepare('SELECT * FROM characters WHERE id=? AND account_id=?').get(+cid, uid);
const ownItem = (uid, iid) => db.prepare('SELECT i.* FROM items i JOIN characters c ON c.id=i.char_id WHERE i.id=? AND c.account_id=?').get(+iid, uid);
// it.refine／it.ident 會保留（拍賣成交、取回、過期退回都走這裡；以前取回／成交會把精煉歸零，11/18 修正）
function giveItem(cid, it, bound = false) {
  if (it.slot === 'armor') it = { ...it, slot: it.base === 'shield' ? 'shield' : 'top' }; // 項目 32：信件／舊資料裡的 armor
  { const a = typeof it.aff === 'string' ? JSON.parse(it.aff) : it.aff; if (!a || (a.r != null && a.r !== it.rarity)) it = { ...it, aff: rollAffix(it.rarity) }; else it = { ...it, aff: a }; } // 品質被改過（保底）就重擲詞綴
  const ident = typeof it.ident === 'string' ? it.ident : it.ident ? JSON.stringify(it.ident) : null;
  const r = db.prepare('INSERT INTO items (char_id, slot, base, rarity, roll, refine, created, bound, ident, gup, pc, aff) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(cid, it.slot, it.base, it.rarity, it.roll, it.refine | 0, Date.now(), bound ? 1 : 0, ident, it.gup | 0, it.pc || null, it.aff ? JSON.stringify(it.aff) : null);
  return { ...it, refine: it.refine | 0, gup: it.gup | 0, aff: it.aff || null, ident: ident ? JSON.parse(ident) : null, id: Number(r.lastInsertRowid), equipped: false, bound };
}
const bagCount = cid => db.prepare('SELECT COUNT(*) n FROM items WHERE char_id=?').get(cid).n;
function shopState(d, hour) {
  const day = new Date(hour * 3600000 + 8 * 3600000).toISOString().slice(0, 10); // 台灣時間換日
  const sh = d.shop || {}; if (sh.day !== day) { sh.day = day; sh.bought = 0; } if (sh.hour !== hour) { sh.hour = hour; sh.taken = []; }
  sh.taken ??= []; sh.bought ??= 0; return sh;
}
// ===== 衣櫥（照 PC：造型師＝衣櫥，FAVORITE／4 PIECE／ALL IN ONE）=====
// 衣櫥收藏＝曾經擁有過、有原版外觀的頭部／上衣／下衣／鞋子（PC 編號）；拿到就自動收進衣櫥（賣掉也保留）
// 時裝（costume）＝只改外觀不改數值：{ head, top, bottom, shoes: PC 編號 }；最愛（favs）＝存 4 套分離式搭配
const WARD_SLOTS = ['head', 'top', 'bottom', 'shoes'];
function syncWardrobe(c, items) {
  const d = JSON.parse(c.data || '{}'), W = d.wardrobe ??= {}; let changed = false;
  const all = [...items, ...db.prepare('SELECT slot, pc FROM items WHERE acct=(SELECT account_id FROM characters WHERE id=?) AND char_id=0').all(c.id)];
  for (const it of all) if (WARD_SLOTS.includes(it.slot) && it.pc && PC_WEAR[it.pc]) { const L = W[it.slot] ??= []; if (!L.includes(it.pc)) { L.push(it.pc); changed = true; } }
  if (changed) { const fresh = JSON.parse(db.prepare('SELECT data FROM characters WHERE id=?').get(c.id).data || '{}'); fresh.wardrobe = W; db.prepare('UPDATE characters SET data=? WHERE id=?').run(JSON.stringify(fresh), c.id); }
  return { wardrobe: W, costume: d.costume || {}, favs: d.favs || [] };
}
function fullChar(c) { const items = itemsOf(c.id), tb = towerBest(c.id), cd = JSON.parse(c.data || '{}'); return { ...charView(c), ...syncWardrobe(c, items), titles: earnedTitles({ fameLv: fameLevel(cd.fame ?? 0).lv, bossKills: cd.bossKills, towerBest: tb.floor, rebirth: cd.rebirth, job3: cd.job3 }), tower: { ...tb, points: towerPoints(tb.floor), open: towerOpen(charView(c), STAGES) }, unreadMail: db.prepare('SELECT COUNT(*) n FROM mails WHERE char_id=? AND (read=0 OR (claimed=0 AND (gold>0 OR items IS NOT NULL OR mats IS NOT NULL)))').get(c.id).n + (JSON.parse(c.data || '{}').welcomed ? 0 : 1), need: needExp(c.base_lv), jobNeed: jobNeedOf(c), fishing: JSON.parse(c.data || '{}').fishing ?? { rod: 0, bait: 0, fish: {} }, items, bonus: totalBonus(items.filter(i => i.equipped)) }; }

const api = {
  'POST /api/register': async (req, res) => {
    const { username = '', password = '' } = await body(req);
    if (!/^[A-Za-z0-9_]{4,16}$/.test(username)) return send(res, 400, { error: '帳號要 4～16 個英文、數字或底線' });
    if (password.length < 6 || password.length > 64) return send(res, 400, { error: '密碼要 6～64 個字' });
    try { db.prepare('INSERT INTO accounts (username, pass, created) VALUES (?,?,?)').run(username, hash(password), Date.now()); }
    catch { return send(res, 409, { error: '這個帳號已經有人用了' }); }
    return api['POST /api/login'](req, res, { username, password });
  },
  'POST /api/login': async (req, res, pre) => {
    const { username = '', password = '' } = pre || await body(req);
    const a = db.prepare('SELECT id, pass FROM accounts WHERE username=?').get(username);
    if (!a || !verify(password, a.pass)) return send(res, 401, { error: '帳號或密碼錯誤' });
    const token = crypto.randomBytes(24).toString('hex');
    db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
    db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(token, a.id, Date.now() + 30 * DAY);
    send(res, 200, { token, username });
  },
  'POST /api/logout': async (req, res) => {
    db.prepare('DELETE FROM sessions WHERE token=?').run((req.headers.authorization || '').replace('Bearer ', ''));
    send(res, 200, { ok: true });
  },
  'GET /api/chars': async (req, res, _, uid) => {
    send(res, 200, { max: MAX_SLOTS, chars: db.prepare('SELECT * FROM characters WHERE account_id=? ORDER BY slot').all(uid).map(charView) });
  },
  // 11/19 一轉：初心者 Base Lv 10 以上找百業宗師選 7 職之一；Job Lv 從 1 開始、天賦清空
  'POST /api/job1': async (req, res, _, uid) => {
    const { charId, job } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    if (c.job !== NOVICE) return send(res, 400, { error: '已經一轉了' });
    if (c.base_lv < JOB1_AT || c.job_lv < 10) return send(res, 400, { error: `要 Base Lv ${JOB1_AT} 而且 Job Lv 10 才能一轉（目前 Base ${c.base_lv}／Job ${c.job_lv}）` }); // 11/19 使用者企劃：雙條件
    if (!FIRST_JOBS.includes(job)) return send(res, 400, { error: '沒有這個職業' });
    const d = JSON.parse(c.data || '{}'); delete d.novice; d.jobExp = 0; d.talents = {};
    db.prepare('UPDATE characters SET job=?, job_lv=1, data=? WHERE id=?').run(job, JSON.stringify(d), c.id);
    { const w = rollItem(Math.random, 0, 'weapon', Math.max(1, c.base_lv), job); w.rarity = 1; sendMail(c.id, { sender: '百業宗師', title: `轉職賀禮：${job}的新手武器`, body: `恭喜你成為${job}！這是給你的新手武器，記得裝上。`, items: [w] }); } // 一轉自動配發職業新手武器
    send(res, 200, fullChar(ownChar(uid, c.id)));
  },
  'POST /api/chars': async (req, res, _, uid) => {
    const { name = '', gender = '', slot, job, stats, outfit = 0, hair = 0, hairColor = 0 } = await body(req);
    const n = String(name).trim();
    if (!/^[\p{L}\p{N}_]{2,12}$/u.test(n)) return send(res, 400, { error: '角色名稱要 2～12 個字，不能有空白或符號' });
    if (!['男', '女'].includes(gender)) return send(res, 400, { error: '請選性別' });
    if (!Number.isInteger(slot) || slot < 0 || slot >= MAX_SLOTS) return send(res, 400, { error: '欄位不對' });
    // 11/19：照 PC 新角色一律先當初心者（舊版傳來的 job 不用）
    const job0 = NOVICE;
    if (!validateStats(stats)) return send(res, 400, { error: '素質點數不對' });
    if (!validLook(hair, hairColor, outfit)) return send(res, 400, { error: '髮型或顏色不對' });
    try { const r = db.prepare('INSERT INTO characters (account_id, slot, name, gender, job, data, created) VALUES (?,?,?,?,?,?,?)').run(uid, slot, n, gender, job0, JSON.stringify({ stats, outfit, hair, hairColor, novice: true }), Date.now());
      send(res, 200, charView(db.prepare('SELECT * FROM characters WHERE id=?').get(r.lastInsertRowid))); }
    catch (e) { send(res, 409, { error: String(e.message).includes('name') ? '這個角色名稱已經有人用了' : '這個欄位已經有角色了' }); }
  },
  'GET /api/char': async (req, res, _, uid, id) => {
    const c = db.prepare('SELECT * FROM characters WHERE id=? AND account_id=?').get(+id, uid);
    if (!c) return send(res, 404, { error: '找不到角色' });
    send(res, 200, fullChar(c));
  },
  // 出征結算：存紀錄、加經驗、升級
  'POST /api/runs': async (req, res, _, uid) => {
    const { charId, secs, kills, lv, cleared, chests = 0, bossChests = 0, stage = 'hill', curse = 'none', lootMin = 0, bosses = [], diff = null, spent = 0, events = 0, combos = 0 } = await body(req); req.__spent = spent; const evBonus = 0.15 * Math.max(0, Math.min(10, events | 0)); // 項目 53：完成地圖事件 → 寶箱品質提升
    const stB = stageBaseLv(STAGES.find(x => x.key === stage)), DL = isTowerKey(stage) ? diffLoot(null) : diffLoot(cleanDiff(diff, stB), stB); // 項目 41：難度只影響寶箱裝備品質，經驗金幣不變
    const isTower = stage === 'tower';
    const c = db.prepare('SELECT * FROM characters WHERE id=? AND account_id=?').get(+charId, uid);
    if (!c) return send(res, 404, { error: '找不到角色' });
    if (![secs, kills, lv].every(Number.isInteger) || secs < 0 || secs > (isTower ? 14400 : 3600) || kills < 0 || kills > 100000 || lv < 1 || lv > 500)
      return send(res, 400, { error: '紀錄不對' });
    const d0 = JSON.parse(c.data || '{}');
    // 賢者之塔：獎勵倍率＝目前樓層那一段遠征地圖 ×1.2；沒有通關獎勵
    if (isTower) { const dd = JSON.parse(c.data || '{}'); if (!(dd.towerPass > Date.now() - 6 * 3600e3)) return send(res, 400, { error: '要先找越過次元的修道士入場' }); }
    const floor = isTower ? towerFloor(secs) : 0, si = isTower ? towerSeg(floor) : STAGES.findIndex(x => x.key === stage);
    const S = isTower ? { ...STAGES[si], key: 'tower', reward: STAGES[si].reward * 1.2 } : STAGES[si];
    if (isTower) { if (!towerOpen(charView(c), STAGES)) return send(res, 400, { error: `${TOWER_NAME}要完成二轉並通關四張遠征地圖才開放` }); if (!CURSES[curse]) return send(res, 400, { error: '沒有這個詛咒' }); }
    else if (!S || !stageUnlocked(si, d0.cleared || [])) return send(res, 400, { error: '這張地圖還沒解鎖' });
    else { const g = stageGate(si, d0.cleared || [], gearScore(itemsOf(c.id))); if (!g.ok) return send(res, 400, { error: g.why }); } // 項目 31：裝備分數門檻
    const bonus = !isTower && cleared === true && secs >= stageTime(S) - 10; // MVP 在時長結束時才出場（T1 15 分、T2／T3 11 分），太快通關不算
    const mul = S.reward * (bonus ? 1.5 : 1);
    const monLvExp = isTower ? stageBaseLv(STAGES[si]) + towerFloor(secs) : cleanDiff(diff, stageBaseLv(S)).monLv; // 這局怪物等級（難度滑桿選的）
    // 項目 51：難度經驗加成（階梯式）：敵人數量、事件數量每多一階（×2、×3…）Base／Job 經驗 +12%；塔不套用
    const DX = isTower ? null : cleanDiff(diff, stB), expBonus = DX ? 1 + 0.12 * ((DX.count - 1) + (DX.event - 1)) : 1;
    const jobGain = Math.floor((secs / 3 + kills / 4 + lv * 5) * mul * expBonus); // Job 經驗維持原本算法（第 25／27 項的 Job 曲線是照這個調的）
    const gain = Math.floor((runExp(Math.max(0, +kills | 0), monLvExp, c.base_lv) * mul + lv * 5 * mul) * expBonus); // 項目 33：Base 經驗照怪物等級（PC）
    let base = c.base_lv, exp = c.exp + gain, ups = 0;
    while (exp >= needExp(base) && base < BASE_MAX) { exp -= needExp(base); base++; ups++; }
    if (base >= BASE_MAX) exp = 0;
    // 金幣與寶箱（伺服器自己擲裝備；數量依存活時間設上限）
    const gold = Math.floor((kills / 3 + secs / 2) * mul);
    const nChest = Math.max(0, Math.min(+chests | 0, Math.floor(secs / 40) + 1, 100)); // 項目 42：一般寶箱每局最多 100 個
    const minR = Math.max(0, Math.min(4, lootMin | 0)); let filtered = 0;
    const lukBonus = Math.min(0.6, ((d0.stats?.luk || 1) - 1) * 0.02); // 感覺每點 +0.02 品質加成（暫定） // 撿取篩選：低於門檻的直接不給、不佔背包
    const nBoss = Math.max(0, Math.min(+bossChests | 0, Math.floor(secs / 120), 5));
    const got = [], monLvRun = isTower ? stageBaseLv(STAGES[si]) + floor : cleanDiff(diff, stB).monLv; // 寶箱裝備照這局怪物等級挑 PC 原版道具
    for (let i = 0; i < nChest + nBoss; i++) {
      if (bagCount(c.id) >= BAG_MAX) break;
      const it = rollItem(Math.random, (i < nChest ? lootBonus(DL.gear, 0.3) : lootBonus(DL.boss, 2)) + si * 0.4 + lukBonus + evBonus, undefined, monLvRun, i >= nChest || Math.random() < 0.5 ? c.job : null); // 11/19 使用者企劃：一般寶箱 50% 本職業／50% 其他，首領寶箱一定本職業 // 項目 49：寶箱掉全職業（保留原味），非本職業的拿去一鍵餵寵／分解（項目 50） // 項目 35：感覺提升寶箱品質
      if (i >= nChest && it.rarity < 1) it.rarity = 1; // 首領寶箱至少精良
      if (it.rarity < minR) { filtered++; continue; }
      got.push(giveItem(c.id, it));
    }
    const d = d0; d.points = (d.points || 0) + ups * 3;
    // 項目 28：首領寶箱各掉 1 顆未開放的技能寶石（寶石袋滿了就不掉）
    const gemsGot = []; d.gems ??= [];
    for (let i = 0; i < nBoss && d.gems.length < GEM_MAX; i++) { const g = rollGem(); d.gems.push(g); gemsGot.push(g); }
    let job = c.job_lv, jexp = (d.jobExp || 0) + jobGain, jobUps = 0;
    const JM = jobMaxOf(d);
    while (job < JM && jexp >= jobNeed(job)) { jexp -= jobNeed(job); job++; jobUps++; }
    if (job >= JM) jexp = 0;
    d.jobExp = jexp;
    let newStage = null; d.cleared ??= [];
    const firstClear = bonus && !d.cleared.includes(S.key);
    if (bonus && !d.cleared.includes(S.key)) { d.cleared.push(S.key); newStage = STAGES[si + 1]?.name || null; }
    // 項目 47：名聲（首領、首次通關、塔樓層）＋首領擊殺次數＋稱號；首領名單只收這張地圖的首領、數量依時間夾上限
    const mvpNames = new Set(STAGES.map(x => x.bosses.at(-1)[1])), okBoss = new Set((isTower ? STAGES.flatMap(x => x.bosses) : S.bosses).map(b => b[1]));
    const bl = (Array.isArray(bosses) ? bosses : []).filter(n => typeof n === 'string' && okBoss.has(n)).slice(0, isTower ? Math.floor(floor / 5) + 1 : Math.min(5, Math.floor(secs / 120) + 1));
    const fameGain = runFame({ stageIdx: si, bosses: bl.filter(n => !mvpNames.has(n)), mvps: bl.filter(n => mvpNames.has(n)).length, firstClear, towerFloor: floor });
    const fameBefore = fameLevel(d.fame || 0).lv; d.fame = (d.fame || 0) + fameGain; const fameAfter = fameLevel(d.fame).lv;
    d.bossKills ??= {}; for (const n of bl) d.bossKills[n] = (d.bossKills[n] || 0) + 1;
    const earned = earnedTitles({ fameLv: fameAfter, bossKills: d.bossKills, towerBest: Math.max(towerBest(c.id).floor, floor), rebirth: d.rebirth, job3: d.job3 });
    const newTitles = earned.filter(t => !(d.titlesSeen || []).includes(t)); d.titlesSeen = [...new Set([...(d.titlesSeen || []), ...earned])];
    const fameGear = FAME_GEAR.filter(([l]) => fameBefore < l && fameAfter >= l);
    // 項目 30：出戰寵物拿經驗（＝本局經驗的 30%）；打倒 MVP 有機率掉寵物蛋
    let petUp = 0, petEgg = null; d.pets ??= [];
    const ap = d.pets.find(p => p.id === d.pet); let petStarve = false, petDied = null;
    if (ap) { // 寵物 v2（官方 wiki 49）：出征會餓；餓到 100 不長經驗還會掉經驗，第 1 階段掉到 0 會死
      ap.hunger = Math.min(100, (ap.hunger || 0) + secs * HUNGER_PER_SEC); ap.wants ??= WANT_SLOTS[Math.floor(Math.random() * WANT_SLOTS.length)];
      if (ap.hunger >= 100) { petStarve = true; ap.exp = (ap.exp || 0) - Math.round(petNeed(ap.lv) * 0.2);
        if (ap.exp < 0) { if (petStage9(ap.lv) === 1 && ap.lv === 1) { petDied = ap.name || PETS[ap.kind].name; d.pets = d.pets.filter(x => x !== ap); d.pet = null; } else if (ap.lv > 1) { ap.lv--; ap.exp = 0; } else ap.exp = 0; } }
      else { petUp = addPetExp(ap, Math.floor(gain * 0.3)); if (petStage9(ap.lv) === 9) ap.s9 = (ap.s9 || 0) + secs; } }
    if (bl.some(n => mvpNames.has(n)) && Math.random() < MVP_EGG_RATE && d.pets.length < PET_MAX) { const k = Object.keys(PETS)[Math.random() * 4 | 0]; petEgg = { id: Date.now(), kind: k, lv: 1, exp: 0 }; d.pets.push(petEgg); }
    // 11/19 使用者企劃 指令 3：每打完一套 A→S→D 連續技，身上鑲著的技能寶石各 +20 融合經驗，滿 100 升一級（N → G → DG → XG）
    const gemUps = []; { const n = Math.max(0, Math.min(30, combos | 0)); if (n) for (const sl of d.gemSlots || []) { const g = sl && (d.gems || []).find(x => x.id === sl.gem); if (!g) continue;
      g.fx = (g.fx || 0) + 20 * n; while (g.fx >= 100 && g.grade < 3) { g.fx -= 100; g.grade++; gemUps.push(g.grade); } if (g.grade >= 3) g.fx = Math.min(g.fx, 100); } }
    let souls = 0; if (isTower) { delete d.towerPass; souls = Math.floor(floor / 3); if (souls) { d.mats ??= {}; d.mats.ashton = (d.mats.ashton || 0) + souls; } } // 賢者之塔：入場證用掉、每 3 層 1 個艾希頓之魂
    const spentGold = Math.max(0, Math.min(Math.floor(+req.__spent || 0), (c.gold ?? 0) + gold)); // 項目 37：菁英寶箱花的金幣，結算時扣（不會扣到負的）
    db.prepare('UPDATE characters SET base_lv=?, job_lv=?, exp=?, gold=gold+?, data=? WHERE id=?').run(base, job, exp, gold - spentGold, JSON.stringify(d), c.id);
    db.prepare('INSERT INTO runs (char_id, secs, kills, lv, exp, created) VALUES (?,?,?,?,?,?)').run(c.id, secs, kills, lv, gain, Date.now());
    for (const [l, slot, rar, name] of fameGear) sendMail(c.id, { sender: '名聲', title: `名聲 Lv${l} 獎勵`, body: `你的名聲到了 Lv${l}，送你名聲專屬裝備「${name}」。`, items: [{ ...rollItem(Math.random, 0, slot, Math.max(1, c.base_lv), c.job), rarity: rar }] });
    let tower = null;
    if (isTower) { const before = towerBest(c.id), score = towerScore(floor, kills, curse);
      db.prepare('INSERT INTO towers (char_id, month, floor, score, curse, kills, created) VALUES (?,?,?,?,?,?,?)').run(c.id, monthKey(), floor, score, curse, kills, Date.now());
      tower = { floor, score, newBest: score > before.score, newFloor: floor > before.floor, points: towerPoints(Math.max(floor, before.floor)) }; }
    send(res, 200, { gain, bonus, baseLv: base, exp, need: needExp(base), levelUps: ups, jobLv: job, jobExp: jexp, jobNeed: job >= JM ? 0 : jobNeed(job), jobUps, gems: gemsGot, tower, filtered, petStarve, petDied, pet: ap && !petDied ? { name: ap.name || PETS[ap.kind].name, hunger: Math.round(ap.hunger), lv: ap.lv, up: petUp } : null, petEgg: petEgg && PETS[petEgg.kind].name, fame: { gain: fameGain, total: d.fame, lv: fameAfter, up: fameAfter > fameBefore, newTitles: newTitles.map(t => titleOf(t)?.name), gear: fameGear.map(g => g[3]) }, gold, spent: spentGold, souls, gemUps, items: got, newStage, bagFull: bagCount(c.id) >= BAG_MAX });
  },
  // ===== 背包、商店、強化、素質 =====
  'POST /api/equip': async (req, res, _, uid) => {
    const { itemId } = await body(req); const it = ownItem(uid, itemId); if (!it) return send(res, 404, { error: '找不到裝備' });
    if (it.slot === 'shield' && ownChar(uid, it.char_id)?.job !== '騎士') return send(res, 400, { error: '盾牌只有騎士能裝備' }); // 項目 32：PC 只有騎士拿盾
    { const job = ownChar(uid, it.char_id)?.job, want = JOB_WEAPON[job]; if (it.slot === 'weapon' && want && it.base !== want) return send(res, 400, { error: `${job}不能裝備這種武器（PC 每個職業只能用自己的武器）` }); }
    db.prepare('UPDATE items SET equipped=0 WHERE char_id=? AND slot=?').run(it.char_id, it.slot);
    db.prepare('UPDATE items SET equipped=1 WHERE id=?').run(it.id);
    send(res, 200, fullChar(ownChar(uid, it.char_id)));
  },
  'POST /api/unequip': async (req, res, _, uid) => {
    const { itemId } = await body(req); const it = ownItem(uid, itemId); if (!it) return send(res, 404, { error: '找不到裝備' });
    db.prepare('UPDATE items SET equipped=0 WHERE id=?').run(it.id);
    send(res, 200, fullChar(ownChar(uid, it.char_id)));
  },
  // 項目 50：鎖定／解鎖
  'POST /api/lock': async (req, res, _, uid) => {
    const { itemId } = await body(req); const it = ownItem(uid, itemId); if (!it) return send(res, 404, { error: '找不到裝備' });
    db.prepare('UPDATE items SET locked=? WHERE id=?').run(it.locked ? 0 : 1, it.id); send(res, 200, { locked: !it.locked, char: fullChar(ownChar(uid, it.char_id)) });
  },
  // 項目 50：一鍵分解 → 強化金屬＋希幣
  'POST /api/dismantle': async (req, res, _, uid) => {
    const { charId, itemIds } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    if (!Array.isArray(itemIds) || !itemIds.length || itemIds.length > BAG_MAX) return send(res, 400, { error: '清單不對' });
    const its = itemIds.map(id => db.prepare('SELECT * FROM items WHERE id=? AND char_id=?').get(+id, c.id));
    if (its.some(i => !i)) return send(res, 404, { error: '找不到裝備' }); if (its.some(i => i.equipped || i.locked)) return send(res, 400, { error: '穿著或鎖定的裝備不能分解' });
    const got = { ore1: 0, ore2: 0, gold: 0 }; for (const i of its) { const y = dismantleYield(i); for (const k in got) got[k] += y[k]; db.prepare('DELETE FROM items WHERE id=?').run(i.id); }
    const d = JSON.parse(c.data || '{}'); d.mats ??= {}; d.mats.ore1 = (d.mats.ore1 || 0) + got.ore1; if (got.ore2) d.mats.ore2 = (d.mats.ore2 || 0) + got.ore2;
    db.prepare('UPDATE characters SET gold=gold+?, data=? WHERE id=?').run(got.gold, JSON.stringify(d), c.id);
    send(res, 200, { n: its.length, ...got, char: fullChar(ownChar(uid, c.id)) });
  },
  'POST /api/sell': async (req, res, _, uid) => {
    const { itemId } = await body(req); const it = ownItem(uid, itemId); if (!it) return send(res, 404, { error: '找不到裝備' });
    if (it.equipped) return send(res, 400, { error: '先卸下才能賣' }); if (it.locked) return send(res, 400, { error: '鎖定中，先解鎖才能賣' });
    const price = sellPrice(it);
    db.prepare('DELETE FROM items WHERE id=?').run(it.id); db.prepare('UPDATE characters SET gold=gold+? WHERE id=?').run(price, it.char_id);
    send(res, 200, { price, char: fullChar(ownChar(uid, it.char_id)) });
  },
  'POST /api/buy': async (req, res, _, uid) => {
    const { charId, slot } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    if (!Object.hasOwn(SLOTS, slot)) return send(res, 400, { error: '沒有這種商品' });
    const PRICE = 150;
    if ((c.gold ?? 0) < PRICE) return send(res, 400, { error: `金幣不夠（要 ${PRICE}）` });
    if (bagCount(c.id) >= BAG_MAX) return send(res, 400, { error: '背包滿了' });
    const it = rollItem(Math.random, 0, slot, Math.max(1, c.base_lv), c.job); if (it.rarity > 1) it.rarity = 1; // 商店只賣普通～精良；照角色等級、職業
    db.prepare('UPDATE characters SET gold=gold-? WHERE id=?').run(PRICE, c.id);
    const got = giveItem(c.id, it);
    send(res, 200, { item: got, char: fullChar(ownChar(uid, c.id)) });
  },
  'POST /api/refine': async (req, res, _, uid) => {
    const { itemId, protect = false } = await body(req); const it = ownItem(uid, itemId); if (!it) return send(res, 404, { error: '找不到裝備' });
    if (it.refine >= REFINE_MAX) return send(res, 400, { error: '已經強化到最高了' });
    const c = ownChar(uid, it.char_id), ore = oreFor(it), d = JSON.parse(c.data || '{}'); d.mats ??= {};
    if (!(d.mats[ore] > 0)) return send(res, 400, { error: `需要 1 個「${ORES[ore].name}」，去裝備商人那裡買` });
    // 項目 55：艾彼斯的祝福（防爆）：有勾選而且這次會碎才用掉 1 個；失敗改成降 1 級
    const guard = !!protect && refineBreaks(it.refine) && d.mats.abis > 0; if (protect && refineBreaks(it.refine) && !guard) return send(res, 400, { error: '沒有艾彼斯的祝福' });
    d.mats[ore]--; if (guard) d.mats.abis--; db.prepare('UPDATE characters SET data=? WHERE id=?').run(JSON.stringify(d), c.id);
    let result;
    if (Math.random() < REFINE_RATE[it.refine]) { db.prepare('UPDATE items SET refine=refine+1 WHERE id=?').run(it.id); result = 'ok'; }
    else if (refineBreaks(it.refine) && !guard) { db.prepare('DELETE FROM items WHERE id=?').run(it.id); result = 'broken'; }
    else { db.prepare('UPDATE items SET refine=MAX(0, refine-1) WHERE id=?').run(it.id); result = 'down'; }
    send(res, 200, { result, char: fullChar(ownChar(uid, c.id)) });
  },
  // 項目 46：G 化（一般 → G → DG → XG）：用對應寶石（紅寶石／鑽石／粉紅鑽），可加 G 化工具箱（80%／100%）；失敗只消耗材料
  // 指令 4-2 裝備繼承：同部位、來源沒穿沒鎖；目標的精煉、G 化取兩件較高的；來源刪除；費用 300×精煉＋1000×G 化＋200
  // 個性化 v2（照官方 wiki id=110，src/1_data/persona.js）：名聲當貨幣；op＝roll 展現（locks＝要用固定券鎖的條目）／up 升級／sub 強化次要個性／init 初始化（stat、n）
  'POST /api/persona': async (req, res, _, uid) => {
    const { charId, op, stat, locks = [], n = 1 } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    const d = JSON.parse(c.data || '{}'), P = d.persona ??= { lv: 0, lines: [], sub: {}, corr: 0 }; P.lines ??= []; P.sub ??= {};
    if (P.pts) { for (const [k, v] of Object.entries(P.pts)) P.sub[k] = (P.sub[k] || 0) + v; delete P.pts; } // 舊版資料搬過來
    const fameCur = (d.fame || 0) - (d.fameUsed || 0), useFame = v => { if (fameCur < v) throw new Error(`名聲不夠（要 ${v}，目前 ${fameCur}）`); d.fameUsed = (d.fameUsed || 0) + v; };
    let gold = 0, result = null;
    try {
      if (op === 'roll') {
        const cnt = PS.lineCount(P.lv); if (!cnt) throw new Error('主要個性要先升到 1 階段'); const lk = [...new Set(locks.map(Number))].filter(i => i >= 0 && i < P.lines.length);
        d.mats ??= {}; if (lk.length > (d.mats.personaTicket || 0)) throw new Error(`個性化固定券不夠（要 ${lk.length}）`);
        useFame(PS.rollCost(P.lv)); d.mats.personaTicket = (d.mats.personaTicket || 0) - lk.length;
        const kinds = PS.kindsAt(P.lv).map(a => a.k), out = [], used = new Set(lk.map(i => P.lines[i].k));
        for (let i = 0; i < cnt; i++) { let k; if (lk.includes(i)) k = P.lines[i].k; else { const pool = kinds.filter(x => !used.has(x)); k = pool[Math.floor(Math.random() * pool.length)]; used.add(k); } out.push({ k, g: PS.rollGrade() }); }
        P.lines = out;
      } else if (op === 'up') {
        if (P.lv >= PS.PERSONA_MAX) throw new Error('主要個性已經是最高階段'); useFame(PS.upCost(P.lv));
        const rate = Math.min(1, PS.UP_RATE[P.lv] + (P.corr || 0)); if (Math.random() < rate) { P.lv++; P.corr = 0; result = 'ok'; } else { if (P.lv >= 5) P.corr = (P.corr || 0) + PS.CORR_STEP; result = 'fail'; }
      } else if (op === 'sub') {
        if (!Object.hasOwn(STATS, stat)) throw new Error('沒有這個素質'); const used = Object.values(P.sub).reduce((a, b) => a + b, 0);
        if (used >= PS.subMax(P.lv)) throw new Error('次要個性強化次數用完了（升主要個性階段可以增加）'); gold = PS.SUB_GOLD; if ((c.gold ?? 0) < gold) throw new Error(`希幣不夠（要 ${gold}）`); P.sub[stat] = (P.sub[stat] || 0) + 1;
      } else if (op === 'init') {
        const m = Math.max(1, Math.floor(+n || 1)); if (!(P.sub[stat] >= m)) throw new Error('返還次數比強化次數多'); const cst = PS.initCost(P.lv, m);
        gold = cst.gold; if ((c.gold ?? 0) < gold) throw new Error(`希幣不夠（要 ${gold}）`); useFame(cst.fame); P.sub[stat] -= m; if (!P.sub[stat]) delete P.sub[stat];
      } else throw new Error('沒有這個動作');
    } catch (e) { return send(res, 400, { error: e.message }); }
    db.prepare('UPDATE characters SET gold=gold-?, data=? WHERE id=?').run(gold, JSON.stringify(d), c.id);
    send(res, 200, { result, char: fullChar(ownChar(uid, c.id)) });
  },
  // 指令 4-3 七大屬性合成：武器 100% 成功變成指定屬性（火水木金土光暗），2000 希幣
  'POST /api/elemsynth': async (req, res, _, uid) => {
    const { itemId, elem } = await body(req); const it = ownItem(uid, itemId); if (!it) return send(res, 404, { error: '找不到裝備' });
    if (it.slot !== 'weapon') return send(res, 400, { error: '只有武器可以屬性合成' }); if (!Number.isInteger(elem) || elem < 1 || elem > 7) return send(res, 400, { error: '沒有這個屬性' });
    const c = ownChar(uid, it.char_id); if ((c.gold ?? 0) < 2000) return send(res, 400, { error: '希幣不夠（要 2000）' });
    db.prepare('UPDATE items SET elem=? WHERE id=?').run(elem, it.id); db.prepare('UPDATE characters SET gold=gold-2000 WHERE id=?').run(c.id);
    send(res, 200, { char: fullChar(ownChar(uid, c.id)) });
  },
  // 指令 4-3 衣櫥外觀複製：把同部位另一件裝備的外觀複製到這件（來源消失），1000 希幣
  // 衣櫥：穿／脫時裝。slot＝head/top/bottom/shoes，pc＝衣櫥裡有的 PC 編號（null＝脫掉）
  'POST /api/costume': async (req, res, _, uid) => {
    const { charId, slot, pc } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    if (!WARD_SLOTS.includes(slot)) return send(res, 400, { error: '沒有這個部位' });
    const d = JSON.parse(c.data || '{}'); d.costume ??= {};
    if (pc == null) delete d.costume[slot]; else { if (!(d.wardrobe?.[slot] || []).includes(+pc)) return send(res, 400, { error: '衣櫥裡沒有這件' }); d.costume[slot] = +pc; }
    db.prepare('UPDATE characters SET data=? WHERE id=?').run(JSON.stringify(d), c.id); send(res, 200, fullChar(ownChar(uid, c.id)));
  },
  // 衣櫥：我的最愛（4 套）。act＝save（存目前時裝到第 i 套）／use（套用第 i 套）／clear
  'POST /api/costumefav': async (req, res, _, uid) => {
    const { charId, i, act } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    if (!(i >= 0 && i < 4)) return send(res, 400, { error: '沒有這一套' }); const d = JSON.parse(c.data || '{}'); d.favs ??= [];
    if (act === 'save') d.favs[i] = { ...(d.costume || {}) }; else if (act === 'use') d.costume = { ...(d.favs[i] || {}) }; else if (act === 'clear') d.favs[i] = null; else return send(res, 400, { error: '不支援' });
    db.prepare('UPDATE characters SET data=? WHERE id=?').run(JSON.stringify(d), c.id); send(res, 200, fullChar(ownChar(uid, c.id)));
  },
  'POST /api/lookcopy': async (req, res, _, uid) => {
    const { fromId, toId } = await body(req); const a = ownItem(uid, fromId), b = ownItem(uid, toId);
    if (!a || !b || a.id === b.id) return send(res, 404, { error: '找不到裝備' }); if (a.char_id !== b.char_id || a.slot !== b.slot) return send(res, 400, { error: '只能複製同部位的外觀' });
    if (a.equipped || a.locked) return send(res, 400, { error: '來源裝備要先卸下、解鎖' }); if (!(a.look || a.pc)) return send(res, 400, { error: '這件沒有原版外觀' });
    const c = ownChar(uid, a.char_id); if ((c.gold ?? 0) < 1000) return send(res, 400, { error: '希幣不夠（要 1000）' });
    db.prepare('UPDATE items SET look=? WHERE id=?').run(a.look || a.pc, b.id); db.prepare('DELETE FROM items WHERE id=?').run(a.id); db.prepare('UPDATE characters SET gold=gold-1000 WHERE id=?').run(c.id);
    send(res, 200, { char: fullChar(ownChar(uid, c.id)) });
  },
  // ===== 賢者之塔 Another（官方 wiki 83；src/1_data/tower.js）=====
  'POST /api/towerenter': async (req, res, _, uid) => {
    const { charId, ticket = false } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    const d = JSON.parse(c.data || '{}'); if (!towerOpen(charView(c), STAGES)) return send(res, 400, { error: `${TOWER_NAME}要完成二轉並通關四張遠征地圖才開放` });
    const day = TW.towerDay(); if (d.towerDay?.day !== day) d.towerDay = { day, n: 0, t: 0 };
    if (d.towerDay.n >= TW.ENTRY_FREE) { if (!ticket) return send(res, 400, { error: '今天的免費入場次數用完了（可以用賢者之塔入場券）' }); if (d.towerDay.t >= TW.TICKET_MAX) return send(res, 400, { error: '今天入場券已經用了 2 張' });
      d.mats ??= {}; if (!(d.mats.towerTicket > 0)) return send(res, 400, { error: '沒有賢者之塔入場券（裝備商人「購買」）' }); d.mats.towerTicket--; d.towerDay.t++; }
    d.towerDay.n++; d.towerPass = Date.now(); const gs = gearScore(itemsOf(c.id));
    db.prepare('UPDATE characters SET data=? WHERE id=?').run(JSON.stringify(d), c.id);
    send(res, 200, { penalty: gs < TW.REC_GS[0], gs, rec: TW.REC_GS, char: fullChar(ownChar(uid, c.id)) });
  },
  'POST /api/ashcraft': async (req, res, _, uid) => {
    const { charId, set, slot } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    if (!TW.ASHTON_SETS[set] || !TW.ASHTON_SLOTS.includes(slot)) return send(res, 400, { error: '沒有這種艾希頓裝備' }); if (bagCount(c.id) >= BAG_MAX) return send(res, 400, { error: '背包滿了' });
    const d = JSON.parse(c.data || '{}'); d.mats ??= {}; if ((d.mats.ashton || 0) < TW.ASH_CRAFT.souls) return send(res, 400, { error: `艾希頓之魂不夠（要 ${TW.ASH_CRAFT.souls}）` }); if ((c.gold ?? 0) < TW.ASH_CRAFT.gold) return send(res, 400, { error: `希幣不夠（要 ${TW.ASH_CRAFT.gold}）` });
    d.mats.ashton -= TW.ASH_CRAFT.souls; const it = rollItem(Math.random, 0, slot, Math.max(60, c.base_lv), c.job); it.rarity = 3; it.setk = set;
    const got = giveItem(c.id, it); db.prepare('UPDATE items SET setk=? WHERE id=?').run(set, got.id);
    db.prepare('UPDATE characters SET gold=gold-?, data=? WHERE id=?').run(TW.ASH_CRAFT.gold, JSON.stringify(d), c.id);
    send(res, 200, { item: { ...got, setk: set }, char: fullChar(ownChar(uid, c.id)) });
  },
  'POST /api/ashbreak': async (req, res, _, uid) => {
    const { itemId } = await body(req); const it = ownItem(uid, itemId); if (!it) return send(res, 404, { error: '找不到裝備' });
    if (!it.setk) return send(res, 400, { error: '只能分解艾希頓裝備' }); if (it.equipped || it.locked) return send(res, 400, { error: '先卸下、解鎖' });
    const c = ownChar(uid, it.char_id), cost = TW.ashBreakCost(it); if ((c.gold ?? 0) < cost) return send(res, 400, { error: `希幣不夠（要 ${cost}）` });
    const n = TW.ashBreakSouls(it), d = JSON.parse(c.data || '{}'); d.mats ??= {}; d.mats.ashton = (d.mats.ashton || 0) + n;
    db.prepare('DELETE FROM items WHERE id=?').run(it.id); db.prepare('UPDATE characters SET gold=gold-?, data=? WHERE id=?').run(cost, JSON.stringify(d), c.id);
    send(res, 200, { souls: n, char: fullChar(ownChar(uid, c.id)) });
  },
  'POST /api/inherit': async (req, res, _, uid) => {
    const { fromId, toId } = await body(req); const a = ownItem(uid, fromId), b = ownItem(uid, toId);
    if (!a || !b || a.id === b.id) return send(res, 404, { error: '找不到裝備' }); if (a.char_id !== b.char_id) return send(res, 400, { error: '要同一個角色的裝備' });
    if (a.slot !== b.slot) return send(res, 400, { error: '只能繼承同部位的裝備' }); if (a.equipped || a.locked) return send(res, 400, { error: '來源裝備要先卸下、解鎖' });
    const cost = 300 * (a.refine || 0) + 1000 * (a.gup || 0) + 200, c = ownChar(uid, a.char_id);
    if ((c.gold ?? 0) < cost) return send(res, 400, { error: `希幣不夠（要 ${cost}）` });
    db.prepare('UPDATE items SET refine=?, gup=? WHERE id=?').run(Math.max(a.refine || 0, b.refine || 0), Math.max(a.gup || 0, b.gup || 0), b.id);
    db.prepare('DELETE FROM items WHERE id=?').run(a.id); db.prepare('UPDATE characters SET gold=gold-? WHERE id=?').run(cost, c.id);
    send(res, 200, { char: fullChar(ownChar(uid, c.id)) });
  },
  'POST /api/gup': async (req, res, _, uid) => {
    const { itemId, box } = await body(req); const it = ownItem(uid, itemId); if (!it) return send(res, 404, { error: '找不到裝備' });
    if ((it.gup || 0) >= GUP_MAX) return send(res, 400, { error: '已經是 XG 了' });
    const next = GUP[(it.gup || 0) + 1], c = ownChar(uid, it.char_id), d = JSON.parse(c.data || '{}'); d.mats ??= {};
    if (!(d.mats[next.gem] > 0)) return send(res, 400, { error: `需要 1 個「${ORES[next.gem].name}」，去裝備商人那裡買` });
    if (box && !['gbox80', 'gbox100'].includes(box)) return send(res, 400, { error: '沒有這種工具箱' });
    if (box && !(d.mats[box] > 0)) return send(res, 400, { error: `沒有「${ORES[box].name}」` });
    d.mats[next.gem]--; if (box) d.mats[box]--;
    db.prepare('UPDATE characters SET data=? WHERE id=?').run(JSON.stringify(d), c.id);
    const rate = Math.max(gupRate(it), box === 'gbox100' ? 1 : box === 'gbox80' ? 0.8 : 0);
    const ok = Math.random() < rate; if (ok) db.prepare('UPDATE items SET gup=gup+1 WHERE id=?').run(it.id);
    send(res, 200, { result: ok ? 'ok' : 'fail', tag: next.tag, char: fullChar(ownChar(uid, c.id)) });
  },
  // 項目 48：釣魚。what＝rod1～3（釣竿，買更好的會取代）／bait（魚餌 ×n）
  'POST /api/fishbuy': async (req, res, _, uid) => {
    const { charId, what, n = 1 } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    const d = JSON.parse(c.data || '{}'), F = d.fishing ??= { rod: 0, bait: 0, fish: {} }; let cost;
    if (what === 'bait') { if (![10, 50].includes(n)) return send(res, 400, { error: '數量不對' }); cost = BAIT.price * n; F.bait += n; }
    else { const r = +String(what).replace('rod', ''); if (!RODS[r]) return send(res, 400, { error: '沒有這種釣竿' }); if (F.rod >= r) return send(res, 400, { error: '已經有一樣好或更好的釣竿了' }); cost = RODS[r].price; F.rod = r; }
    if ((c.gold ?? 0) < cost) return send(res, 400, { error: `金幣不夠（要 ${cost}）` });
    db.prepare('UPDATE characters SET gold=gold-?, data=? WHERE id=?').run(cost, JSON.stringify(d), c.id);
    send(res, 200, fullChar(ownChar(uid, c.id)));
  },
  // 拋竿：用掉 1 個魚餌；hit＝浮標下沉時有沒有及時拉竿（沒拉到就只用掉魚餌）
  'POST /api/fish': async (req, res, _, uid) => {
    const { charId, hit } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    const d = JSON.parse(c.data || '{}'), F = d.fishing ??= { rod: 0, bait: 0, fish: {} };
    if (!F.rod) return send(res, 400, { error: '先跟釣魚老人買一支釣竿' });
    if (!(F.bait > 0)) return send(res, 400, { error: '沒有魚餌了' });
    F.bait--; let got = null;
    if (hit) { got = rollCatch(F.rod); if (got.mat) { d.mats ??= {}; d.mats[got.mat] = (d.mats[got.mat] || 0) + 1; } else F.fish[got.key] = (F.fish[got.key] || 0) + 1; }
    db.prepare('UPDATE characters SET data=? WHERE id=?').run(JSON.stringify(d), c.id);
    send(res, 200, { got: got && { key: got.key, name: got.name, icon: got.icon, rare: !!got.rare }, char: fullChar(ownChar(uid, c.id)) });
  },
  // 項目 55：稀有魚 2 條 → 艾彼斯的祝福 1 個（白金金魚、鯉魚、綢緞鯉魚任意組合）
  'POST /api/fishtrade': async (req, res, _, uid) => {
    const { charId } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    const d = JSON.parse(c.data || '{}'), F = d.fishing ??= { rod: 0, bait: 0, fish: {} }, rare = CATCH.filter(f => f.rare && !f.mat);
    if (rare.reduce((t, f) => t + (F.fish[f.key] || 0), 0) < 2) return send(res, 400, { error: '要 2 條稀有魚（白金金魚、鯉魚、綢緞鯉魚）' });
    let need = 2; for (const f of rare) while (need && F.fish[f.key] > 0) { F.fish[f.key]--; if (!F.fish[f.key]) delete F.fish[f.key]; need--; }
    d.mats ??= {}; d.mats.abis = (d.mats.abis || 0) + 1;
    db.prepare('UPDATE characters SET data=? WHERE id=?').run(JSON.stringify(d), c.id);
    send(res, 200, { abis: d.mats.abis, char: fullChar(ownChar(uid, c.id)) });
  },
  'POST /api/fishsell': async (req, res, _, uid) => {
    const { charId } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    const d = JSON.parse(c.data || '{}'), F = d.fishing ??= { rod: 0, bait: 0, fish: {} };
    let gold = 0; for (const f of CATCH) if (F.fish[f.key]) { gold += f.sell * F.fish[f.key]; delete F.fish[f.key]; }
    if (!gold) return send(res, 400, { error: '沒有魚可以賣' });
    db.prepare('UPDATE characters SET gold=gold+?, data=? WHERE id=?').run(gold, JSON.stringify(d), c.id);
    send(res, 200, { gold, char: fullChar(ownChar(uid, c.id)) });
  },
  'POST /api/buyore': async (req, res, _, uid) => {
    const { charId, ore, n } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    if (!Object.hasOwn(ORES, ore) || ORES[ore].noshop || ![1, 10].includes(n)) return send(res, 400, { error: '沒有這種商品' });
    const cost = ORES[ore].price * n;
    if ((c.gold ?? 0) < cost) return send(res, 400, { error: `金幣不夠（要 ${cost}）` });
    const d = JSON.parse(c.data || '{}'); d.mats ??= {}; d.mats[ore] = (d.mats[ore] || 0) + n;
    db.prepare('UPDATE characters SET gold=gold-?, data=? WHERE id=?').run(cost, JSON.stringify(d), c.id);
    send(res, 200, fullChar(ownChar(uid, c.id)));
  },
  'GET /api/stock': async (req, res, _, uid, id) => {
    const c = ownChar(uid, id); if (!c) return send(res, 404, { error: '找不到角色' });
    const hour = Math.floor(Date.now() / 3600000), d = JSON.parse(c.data || '{}'), sh = shopState(d, hour);
    send(res, 200, { items: stockFor(c.id, hour).map((it, i) => ({ ...it, sold: sh.taken.includes(i) })), left: STOCK_DAILY - sh.bought, nextIn: 3600000 - Date.now() % 3600000 });
  },
  'POST /api/buystock': async (req, res, _, uid) => {
    const { charId, idx } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    const hour = Math.floor(Date.now() / 3600000), d = JSON.parse(c.data || '{}'), sh = shopState(d, hour);
    const stock = stockFor(c.id, hour); const it = stock[idx];
    if (!Number.isInteger(idx) || !it) return send(res, 400, { error: '沒有這件商品' });
    if (sh.taken.includes(idx)) return send(res, 400, { error: '這件已經買走了' });
    if (sh.bought >= STOCK_DAILY) return send(res, 400, { error: `今天已經買 ${STOCK_DAILY} 件了，明天再來` });
    if ((c.gold ?? 0) < it.price) return send(res, 400, { error: `金幣不夠（要 ${it.price}）` });
    if (bagCount(c.id) >= BAG_MAX) return send(res, 400, { error: '背包滿了' });
    sh.bought++; sh.taken.push(idx); d.shop = sh;
    db.prepare('UPDATE characters SET gold=gold-?, data=? WHERE id=?').run(it.price, JSON.stringify(d), c.id);
    const { price, ...item } = it; const got = giveItem(c.id, item, true);
    send(res, 200, { item: got, char: fullChar(ownChar(uid, c.id)) });
  },
  'POST /api/sellmany': async (req, res, _, uid) => {
    const { charId, itemIds } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    if (!Array.isArray(itemIds) || itemIds.length > BAG_MAX) return send(res, 400, { error: '清單不對' });
    let total = 0, n = 0;
    for (const iid of itemIds) { const it = ownItem(uid, iid); if (!it || it.char_id !== c.id || it.equipped) continue;
      total += sellPrice(it); n++; db.prepare('DELETE FROM items WHERE id=?').run(it.id); }
    db.prepare('UPDATE characters SET gold=gold+? WHERE id=?').run(total, c.id);
    send(res, 200, { total, n, char: fullChar(ownChar(uid, c.id)) });
  },
  'POST /api/mount': async (req, res, _, uid) => {
    const { charId } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    const d = JSON.parse(c.data || '{}'), now = Date.now(), cap = now + MOUNT.maxDays * 86400000;
    if ((d.mountUntil || 0) + MOUNT.hours * 3600000 > cap) return send(res, 400, { error: `最多累積 ${MOUNT.maxDays} 天` });
    if ((c.gold ?? 0) < MOUNT.price) return send(res, 400, { error: `金幣不夠（要 ${MOUNT.price}）` });
    d.mountUntil = Math.max(now, d.mountUntil || 0) + MOUNT.hours * 3600000;
    db.prepare('UPDATE characters SET gold=gold-?, data=? WHERE id=?').run(MOUNT.price, JSON.stringify(d), c.id);
    send(res, 200, fullChar(ownChar(uid, c.id)));
  },
  // 造型師：髮型／髮色／服裝配色，免費隨時改
  // 項目 26：局外天賦樹（整份配點一次送；重置＝送 {}）
  'POST /api/talents': async (req, res, _, uid) => {
    const { charId, alloc, tree = 1 } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    const d = JSON.parse(c.data || '{}');
    if (tree === 2 && !d.job2) return send(res, 400, { error: '還沒有二轉' });
    const clean = Object.fromEntries(Object.entries(alloc || {}).filter(([, v]) => v));
    const err = checkTalents(TALENTS(), c.job, c.job_lv, clean, tree === 2 ? d.job2 : null); if (err) return send(res, 400, { error: err });
    if (tree === 2) d.talents2 = clean; else d.talents = clean;
    db.prepare('UPDATE characters SET data=? WHERE id=?').run(JSON.stringify(d), c.id);
    send(res, 200, { ...fullChar(ownChar(uid, c.id)), spent: spentPoints(clean) });
  },
  // 項目 27：百業宗師＝二轉（一轉 Job Lv 50 才能轉；之後可回來換分支，免費，二轉天賦會重置）
  'POST /api/job2': async (req, res, _, uid) => {
    const { charId, branch } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    const B = branchOf(TALENTS(), c.job, branch); if (!B) return send(res, 400, { error: '沒有這條二轉' });
    if (c.job_lv < JOB1_MAX) return send(res, 400, { error: `要一轉 Job Lv ${JOB1_MAX} 才能二轉` });
    const d = JSON.parse(c.data || '{}');
    if (d.job2 === branch) return send(res, 400, { error: `你已經是${B.name}了` });
    if (d.job3) return send(res, 400, { error: '已經三轉了，不能換二轉分支（三轉延續原本的分支）' });
    d.job2 = branch; d.talents2 = {};
    db.prepare('UPDATE characters SET data=? WHERE id=?').run(JSON.stringify(d), c.id);
    send(res, 200, fullChar(ownChar(uid, c.id)));
  },
  // 項目 28：技能鑑定師（照 PC：主武器／防具、尚未鑑定才能鑑定、必出 1 條技能 Lv+N；選擇職業要多花錢）
  'POST /api/identify': async (req, res, _, uid) => {
    const { itemId, job } = await body(req); const it = ownItem(uid, itemId); if (!it) return send(res, 404, { error: '找不到裝備' });
    if (!IDENT_SLOTS.includes(it.slot)) return send(res, 400, { error: '只有武器和防具可以鑑定' });
    if (it.ident) return send(res, 400, { error: '這件已經鑑定過了，要先用「技能屬性初始化卷軸」重置' });
    const c = ownChar(uid, it.char_id), T = TALENTS();
    const pick = job && job !== c.job; if (pick && !T.jobs[job]) return send(res, 400, { error: '沒有這個職業' });
    const cost = IDENT_COST[it.slot] + (pick ? IDENT_PICK_COST : 0);
    if ((c.gold ?? 0) < cost) return send(res, 400, { error: `金幣不夠（要 ${cost}）` });
    const ident = rollIdent(T, pick ? job : c.job);
    db.prepare('UPDATE characters SET gold=gold-? WHERE id=?').run(cost, c.id);
    db.prepare('UPDATE items SET ident=? WHERE id=?').run(JSON.stringify(ident), it.id);
    send(res, 200, { ident, cost, char: fullChar(ownChar(uid, c.id)) });
  },
  'POST /api/identreset': async (req, res, _, uid) => {
    const { itemId } = await body(req); const it = ownItem(uid, itemId); if (!it) return send(res, 404, { error: '找不到裝備' });
    if (!it.ident) return send(res, 400, { error: '這件還沒鑑定' });
    const c = ownChar(uid, it.char_id), d = JSON.parse(c.data || '{}'); d.mats ??= {};
    if (!(d.mats.reset > 0)) return send(res, 400, { error: '需要 1 張「技能屬性初始化卷軸」，去裝備商人那裡買' });
    d.mats.reset--;
    db.prepare('UPDATE characters SET data=? WHERE id=?').run(JSON.stringify(d), c.id);
    db.prepare('UPDATE items SET ident=NULL WHERE id=?').run(it.id);
    send(res, 200, fullChar(ownChar(uid, c.id)));
  },
  // ===== 項目 28：技能寶石（照 PC 技能寶石系統）=====
  'POST /api/gemslot': async (req, res, _, uid) => {
    const { charId } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    const d = JSON.parse(c.data || '{}'), n = d.gemOpen ?? 0;
    if (n >= 5) return send(res, 400, { error: '5 格都開了' });
    if (c.base_lv < SLOT_LV[n]) return send(res, 400, { error: `第 ${n + 1} 格要 Base Lv ${SLOT_LV[n]}` });
    if ((c.gold ?? 0) < SLOT_COST[n]) return send(res, 400, { error: `金幣不夠（要 ${SLOT_COST[n]}）` });
    d.gemOpen = n + 1;
    db.prepare('UPDATE characters SET gold=gold-?, data=? WHERE id=?').run(SLOT_COST[n], JSON.stringify(d), c.id);
    send(res, 200, fullChar(ownChar(uid, c.id)));
  },
  'POST /api/gemenchant': async (req, res, _, uid) => {
    const { charId, gemId, p } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    const d = JSON.parse(c.data || '{}'), g = (d.gems || []).find(x => x.id === gemId); if (!g) return send(res, 404, { error: '找不到寶石' });
    const cost = OPEN_COST[g.grade]; if ((c.gold ?? 0) < cost) return send(res, 400, { error: `金幣不夠（要 ${cost}）` });
    const err = enchant(g, p); if (err) return send(res, 400, { error: err });
    db.prepare('UPDATE characters SET gold=gold-?, data=? WHERE id=?').run(cost, JSON.stringify(d), c.id);
    send(res, 200, { ok: g.tries.at(-1).ok, gem: g, char: fullChar(ownChar(uid, c.id)) });
  },
  'POST /api/gemopen': async (req, res, _, uid) => {
    const { charId, gemId } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    const d = JSON.parse(c.data || '{}'), g = (d.gems || []).find(x => x.id === gemId); if (!g) return send(res, 404, { error: '找不到寶石' });
    if (g.opened) return send(res, 400, { error: '已經開放了' });
    if (g.tries.length < OPEN_TRIES) return send(res, 400, { error: `要附魔滿 ${OPEN_TRIES} 次才能開放（目前 ${g.tries.length}）` });
    g.opened = true; db.prepare('UPDATE characters SET data=? WHERE id=?').run(JSON.stringify(d), c.id);
    send(res, 200, fullChar(ownChar(uid, c.id)));
  },
  'POST /api/gemfuse': async (req, res, _, uid) => {
    const { charId, gemIds } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    const d = JSON.parse(c.data || '{}'); d.gems ??= [];
    if (!Array.isArray(gemIds) || new Set(gemIds).size !== FUSE_NEED) return send(res, 400, { error: `要選 ${FUSE_NEED} 顆寶石` });
    const gs = gemIds.map(id => d.gems.find(x => x.id === id)); if (gs.some(g => !g)) return send(res, 404, { error: '找不到寶石' });
    if (new Set(gs.map(g => g.grade)).size !== 1) return send(res, 400, { error: '只能合成相同級別的技能寶石' });
    const inUse = new Set((d.gemSlots || []).filter(Boolean).map(x => x.gem)); if (gs.some(g => inUse.has(g.id))) return send(res, 400, { error: '裝備中的寶石要先卸下' });
    const grade = gs[0].grade, cost = FUSE_COST[grade]; if ((c.gold ?? 0) < cost) return send(res, 400, { error: `金幣不夠（要 ${cost}）` });
    const up = grade < GRADES.length - 1 && Math.random() < FUSE_UP, g = newGem(up ? grade + 1 : grade);
    d.gems = d.gems.filter(x => !gemIds.includes(x.id)); d.gems.push(g);
    db.prepare('UPDATE characters SET gold=gold-?, data=? WHERE id=?').run(cost, JSON.stringify(d), c.id);
    send(res, 200, { gem: g, up, char: fullChar(ownChar(uid, c.id)) });
  },
  'POST /api/gemequip': async (req, res, _, uid) => {
    const { charId, slots } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    const d = JSON.parse(c.data || '{}'), S = SKILLS(), J = S.jobs[c.job], B = d.job2 && branchOf(TALENTS(), c.job, d.job2);
    const ok = new Set([J.basic, ...J.pool, ...(B?.skills || []), ...S.fusions.filter(f => J.pool.includes(f.a)).map(f => f.into)]);
    const err = checkGemSlots(slots, d.gemOpen ?? 0, d.gems || [], k => ok.has(k)); if (err) return send(res, 400, { error: err });
    d.gemSlots = slots.map(x => x ? { skill: x.skill, gem: x.gem } : null);
    db.prepare('UPDATE characters SET data=? WHERE id=?').run(JSON.stringify(d), c.id);
    send(res, 200, fullChar(ownChar(uid, c.id)));
  },
  // ===== 項目 28：鑲嵌石系統（照 PC）=====
  'POST /api/stoneup': async (req, res, _, uid) => {
    const { charId, stone } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    if (!STONES[stone]) return send(res, 400, { error: '沒有這顆石頭' });
    const d = JSON.parse(c.data || '{}'); d.mats ??= {}; d.stones ??= {}; const st = d.stones[stone] = stoneOf(d.stones, stone);
    if (st.lv >= STONE_MAX) return send(res, 400, { error: `已經 +${STONE_MAX} 了` });
    const [cry, rains, rate, gold] = STONE_UP[st.lv], rain = rains[STONE_ORDER.indexOf(stone)];
    if ((d.mats.crystal || 0) < cry || (d.mats.rainbow || 0) < rain) return send(res, 400, { error: `材料不夠：要閃亮結晶 ×${cry}、七彩粉末 ×${rain}` });
    if ((c.gold ?? 0) < gold) return send(res, 400, { error: `金幣不夠（要 ${gold}）` });
    d.mats.crystal -= cry; d.mats.rainbow -= rain; // 成功失敗都會消失
    const ok = Math.random() < rate; let attr = null;
    if (ok) { st.lv++; attr = rollAttr(stone, st.lv); st.attrs.push(attr); }
    db.prepare('UPDATE characters SET gold=gold-?, data=? WHERE id=?').run(gold, JSON.stringify(d), c.id);
    send(res, 200, { ok, attr, char: fullChar(ownChar(uid, c.id)) });
  },
  'POST /api/stonechange': async (req, res, _, uid) => {
    const { charId, stone, fix } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    if (!STONES[stone]) return send(res, 400, { error: '沒有這顆石頭' });
    const d = JSON.parse(c.data || '{}'); d.mats ??= {}; d.stones ??= {}; const st = d.stones[stone] = stoneOf(d.stones, stone);
    if (st.lv < 1) return send(res, 400, { error: '石頭要 +1 以上才能變更屬性' });
    if (st.changes < 1) return send(res, 400, { error: '變更次數用完了，要用「石頭屬性變更次數充值券」' });
    const [cry, gold] = STONE_CHANGE[st.lv - 1];
    if ((d.mats.crystal || 0) < cry) return send(res, 400, { error: `要閃亮結晶 ×${cry}` });
    if ((c.gold ?? 0) < gold) return send(res, 400, { error: `金幣不夠（要 ${gold}）` });
    if (fix && !(d.mats.fixTicket > 0)) return send(res, 400, { error: '沒有石頭屬性固定券' });
    d.mats.crystal -= cry; if (fix) d.mats.fixTicket--; st.changes--;
    const last = st.attrs.length - 1; st.attrs[last] = rollAttr(stone, st.lv, fix ? st.attrs[last].k : null);
    db.prepare('UPDATE characters SET gold=gold-?, data=? WHERE id=?').run(gold, JSON.stringify(d), c.id);
    send(res, 200, { attr: st.attrs[last], char: fullChar(ownChar(uid, c.id)) });
  },
  'POST /api/stonereset': async (req, res, _, uid) => {
    const { charId, stone } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    if (!STONES[stone]) return send(res, 400, { error: '沒有這顆石頭' });
    const d = JSON.parse(c.data || '{}'); d.stones ??= {}; const st = d.stones[stone] = stoneOf(d.stones, stone);
    st.lv = 0; st.attrs = [];
    db.prepare('UPDATE characters SET data=? WHERE id=?').run(JSON.stringify(d), c.id);
    send(res, 200, fullChar(ownChar(uid, c.id)));
  },
  'POST /api/stonecharge': async (req, res, _, uid) => {
    const { charId, stone } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    if (!STONES[stone]) return send(res, 400, { error: '沒有這顆石頭' });
    const d = JSON.parse(c.data || '{}'); d.mats ??= {}; d.stones ??= {}; const st = d.stones[stone] = stoneOf(d.stones, stone);
    if (!(d.mats.chargeTicket > 0)) return send(res, 400, { error: '沒有石頭屬性變更次數充值券' });
    if (st.changes >= CHANGE_MAX) return send(res, 400, { error: `變更次數已經是上限 ${CHANGE_MAX}` });
    d.mats.chargeTicket--; st.changes = Math.min(CHANGE_MAX, st.changes + CHANGE_CHARGE);
    db.prepare('UPDATE characters SET data=? WHERE id=?').run(JSON.stringify(d), c.id);
    send(res, 200, fullChar(ownChar(uid, c.id)));
  },
  // 寶石收藏家扎羅：分解裝備（原版分解合成寶石）＋閃亮粉末換閃亮結晶
  'POST /api/decompose': async (req, res, _, uid) => {
    const { charId, itemIds } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    if (!Array.isArray(itemIds) || !itemIds.length || itemIds.length > BAG_MAX) return send(res, 400, { error: '清單不對' });
    const d = JSON.parse(c.data || '{}'); d.mats ??= {}; const got = { dust: 0, crystal: 0, rainbow: 0 };
    for (const iid of itemIds) {
      const it = ownItem(uid, iid); if (!it || it.char_id !== c.id) return send(res, 404, { error: '找不到裝備' });
      if (it.equipped) return send(res, 400, { error: '穿著的裝備不能分解' });
    }
    for (const iid of itemIds) {
      const it = ownItem(uid, iid), T = DECOMPOSE[it.rarity];
      got.dust += T.dust[0] + Math.floor(Math.random() * (T.dust[1] - T.dust[0] + 1));
      if (Math.random() < T.crystal) got.crystal++; if (Math.random() < T.rainbow) got.rainbow++;
      db.prepare('DELETE FROM items WHERE id=?').run(it.id);
    }
    for (const k in got) d.mats[k] = (d.mats[k] || 0) + got[k];
    db.prepare('UPDATE characters SET data=? WHERE id=?').run(JSON.stringify(d), c.id);
    send(res, 200, { got, char: fullChar(ownChar(uid, c.id)) });
  },
  'POST /api/dustex': async (req, res, _, uid) => {
    const { charId, n } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    if (![1, 10].includes(n)) return send(res, 400, { error: '只能換 1 或 10 個' });
    const d = JSON.parse(c.data || '{}'); d.mats ??= {}; const need = n * DUST_PER_CRYSTAL;
    if ((d.mats.dust || 0) < need) return send(res, 400, { error: `閃亮粉末不夠（要 ${need}）` });
    d.mats.dust -= need; d.mats.crystal = (d.mats.crystal || 0) + n;
    db.prepare('UPDATE characters SET data=? WHERE id=?').run(JSON.stringify(d), c.id);
    send(res, 200, fullChar(ownChar(uid, c.id)));
  },
  // ===== 項目 18：倉庫 =====
  'GET /api/stash': async (req, res, _, uid) => send(res, 200, stashView(uid)),
  'POST /api/stashput': async (req, res, _, uid) => {
    const { charId, itemIds, page } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    const S = stashInfo(uid);
    if (!Number.isInteger(page) || page < 0 || page >= S.unlocked) return send(res, 400, { error: '這一頁還沒解鎖' });
    if (!Array.isArray(itemIds) || !itemIds.length || itemIds.length > BAG_MAX) return send(res, 400, { error: '清單不對' });
    const its = itemIds.map(id => db.prepare('SELECT * FROM items WHERE id=? AND char_id=?').get(+id, c.id));
    if (its.some(i => !i)) return send(res, 404, { error: '找不到裝備' });
    if (its.some(i => i.equipped)) return send(res, 400, { error: '穿著中的裝備不能存' });
    const used = db.prepare('SELECT COUNT(*) n FROM items WHERE acct=? AND stash=?').get(uid, page).n;
    if (used + its.length > STASH_SIZE) return send(res, 400, { error: `這一頁放不下（${used}/${STASH_SIZE}）` });
    for (const i of its) db.prepare('UPDATE items SET char_id=0, acct=?, stash=? WHERE id=?').run(uid, page, i.id);
    send(res, 200, { stash: stashView(uid), char: fullChar(ownChar(uid, c.id)) });
  },
  'POST /api/stashtake': async (req, res, _, uid) => {
    const { charId, itemIds } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    if (!Array.isArray(itemIds) || !itemIds.length) return send(res, 400, { error: '清單不對' });
    const its = itemIds.map(id => db.prepare('SELECT * FROM items WHERE id=? AND acct=? AND stash IS NOT NULL').get(+id, uid));
    if (its.some(i => !i)) return send(res, 404, { error: '找不到倉庫裡的裝備' });
    const room = BAG_MAX - bagCount(c.id); if (room <= 0) return send(res, 400, { error: '背包滿了' });
    const take = its.slice(0, room);
    for (const i of take) db.prepare('UPDATE items SET char_id=?, acct=NULL, stash=NULL, equipped=0 WHERE id=?').run(c.id, i.id);
    send(res, 200, { took: take.length, left: its.length - take.length, stash: stashView(uid), char: fullChar(ownChar(uid, c.id)) });
  },
  'POST /api/stashunlock': async (req, res, _, uid) => {
    const { charId } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    const S = stashInfo(uid); if (S.unlocked >= STASH_PAGES) return send(res, 400, { error: '全部解鎖了' });
    const cost = STASH_COST[S.unlocked]; if ((c.gold ?? 0) < cost) return send(res, 400, { error: `金幣不夠（要 ${cost}）` });
    db.prepare('UPDATE characters SET gold=gold-? WHERE id=?').run(cost, c.id); S.unlocked++; stashSave(uid, S);
    send(res, 200, { stash: stashView(uid), char: fullChar(ownChar(uid, c.id)) });
  },
  'POST /api/stashname': async (req, res, _, uid) => {
    const { page, name } = await body(req); const S = stashInfo(uid), n = String(name ?? '').trim();
    if (!Number.isInteger(page) || page < 0 || page >= S.unlocked) return send(res, 400, { error: '這一頁還沒解鎖' });
    if (!n || n.length > 10) return send(res, 400, { error: '名稱 1～10 個字' });
    S.names[page] = n; stashSave(uid, S); send(res, 200, stashView(uid));
  },
  // ===== 項目 20：郵差（信箱）=====
  'GET /api/mail': async (req, res, _, uid, id) => {
    const c = ownChar(uid, id); if (!c) return send(res, 404, { error: '找不到角色' });
    welcomeMail(c);
    send(res, 200, { mails: db.prepare('SELECT * FROM mails WHERE char_id=? ORDER BY id DESC LIMIT ?').all(c.id, MAIL_MAX).map(mailView) });
  },
  'POST /api/mailread': async (req, res, _, uid) => {
    const { charId, mailId } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    db.prepare('UPDATE mails SET read=1 WHERE id=? AND char_id=?').run(+mailId, c.id); send(res, 200, { ok: true });
  },
  'POST /api/mailclaim': async (req, res, _, uid) => {
    const { charId, mailId } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    const ids = mailId === 'all' ? db.prepare('SELECT id FROM mails WHERE char_id=? AND claimed=0').all(c.id).map(r => r.id) : [+mailId];
    let n = 0, full = false;
    for (const id of ids) {
      const m = db.prepare('SELECT * FROM mails WHERE id=? AND char_id=?').get(id, c.id); if (!m) return send(res, 404, { error: '找不到信件' });
      if (m.claimed || !hasAttach(m)) continue;
      const items = m.items ? JSON.parse(m.items) : [], mats = m.mats ? JSON.parse(m.mats) : {};
      if (bagCount(c.id) + items.length > BAG_MAX) { full = true; if (mailId !== 'all') return send(res, 400, { error: `背包放不下（要 ${items.length} 格）` }); continue; }
      for (const it of items) giveItem(c.id, it);
      const cur = ownChar(uid, c.id), d = JSON.parse(cur.data || '{}'); d.mats ??= {};
      for (const [k, v] of Object.entries(mats)) d.mats[k] = (d.mats[k] || 0) + v;
      db.prepare('UPDATE characters SET gold=gold+?, data=? WHERE id=?').run(m.gold, JSON.stringify(d), c.id);
      db.prepare('UPDATE mails SET claimed=1, read=1 WHERE id=?').run(m.id); n++;
    }
    send(res, 200, { claimed: n, full, mails: db.prepare('SELECT * FROM mails WHERE char_id=? ORDER BY id DESC LIMIT ?').all(c.id, MAIL_MAX).map(mailView), char: fullChar(ownChar(uid, c.id)) });
  },
  'POST /api/maildel': async (req, res, _, uid) => {
    const { charId, mailIds } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    if (!Array.isArray(mailIds) || !mailIds.length) return send(res, 400, { error: '清單不對' });
    for (const id of mailIds) db.prepare('DELETE FROM mails WHERE id=? AND char_id=?').run(+id, c.id);
    send(res, 200, { mails: db.prepare('SELECT * FROM mails WHERE char_id=? ORDER BY id DESC LIMIT ?').all(c.id, MAIL_MAX).map(mailView) });
  },
  // ===== 項目 21：轉生（Base Lv 70 以上；Base 回 1、素質全部回 1，可重配點數＝20＋75×轉生次數；職業、Job、天賦、裝備、背包保留；最多 10 次）=====
  'POST /api/rebirth': async (req, res, _, uid) => {
    const { charId } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    const d = JSON.parse(c.data || '{}'), n = (d.rebirth || 0) + 1;
    if (n > REBIRTH_MAX) return send(res, 400, { error: `最多轉生 ${REBIRTH_MAX} 次` });
    if (c.base_lv < REBIRTH_LV) return send(res, 400, { error: `要 Base Lv ${REBIRTH_LV} 才能轉生` });
    d.rebirth = n; d.stats = defaultStats(); d.points = FREE_POINTS + REBIRTH_BONUS * n;
    db.prepare('UPDATE characters SET base_lv=1, exp=0, data=? WHERE id=?').run(JSON.stringify(d), c.id);
    send(res, 200, fullChar(ownChar(uid, c.id)));
  },
  // ===== GM 指令（只限本機連線）=====
  'POST /api/gm': async (req, res, _, uid) => {
    const ip = req.socket.remoteAddress || '';
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip)) return send(res, 403, { error: 'GM 指令只限本機' });
    const { charId, line } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    const { cmd, args } = parseGm(line), d = JSON.parse(c.data || '{}'), n = i => Number(args[i]);
    const int = (i, lo, hi) => { const v = n(i); if (!Number.isInteger(v) || v < lo || v > hi) throw new Error(`第 ${i + 1} 個參數要 ${lo}～${hi} 的整數`); return v; };
    const saveD = () => db.prepare('UPDATE characters SET data=? WHERE id=?').run(JSON.stringify(d), c.id);
    let msg;
    try {
      switch (cmd) {
        case 'lv': { const v = int(0, 1, 99); db.prepare('UPDATE characters SET base_lv=?, exp=0 WHERE id=?').run(v, c.id); msg = `Base Lv → ${v}`; break; }
        case 'job': { const max = jobMaxOf(d), v = int(0, 1, max); d.jobExp = 0; saveD(); db.prepare('UPDATE characters SET job_lv=? WHERE id=?').run(v, c.id); msg = `Job Lv → ${v}`; break; }
        case 'gold': { const v = int(0, -1e9, 1e9); db.prepare('UPDATE characters SET gold=MAX(0, gold+?) WHERE id=?').run(v, c.id); msg = `金幣 ${v >= 0 ? '+' : ''}${v}`; break; }
        case 'points': { const v = int(0, -999, 999); d.points = Math.max(0, (d.points || 0) + v); saveD(); msg = `素質點 → ${d.points}`; break; }
        case 'job2': { const b = (args[0] || '').toUpperCase();
          if (b === 'NONE') { delete d.job2; delete d.job3; d.talents2 = {}; if (c.job_lv > JOB1_MAX) db.prepare('UPDATE characters SET job_lv=? WHERE id=?').run(JOB1_MAX, c.id); saveD(); msg = '取消二轉'; break; }
          const B = branchOf(TALENTS(), c.job, b); if (!B) throw new Error('分支要 A 或 B（或 none）');
          d.job2 = b; d.talents2 = {}; saveD(); if (c.job_lv < JOB1_MAX) db.prepare('UPDATE characters SET job_lv=? WHERE id=?').run(JOB1_MAX, c.id); msg = `二轉 → ${B.name}`; break; }
        case 'job3': { if (!d.job2) throw new Error('要先 /job2 A 或 B'); if (args[0] === 'none') { delete d.job3; if (c.job_lv > JOB2_MAX) db.prepare('UPDATE characters SET job_lv=? WHERE id=?').run(JOB2_MAX, c.id); saveD(); msg = '取消三轉'; break; }
          d.job3 = true; saveD(); if (c.job_lv < JOB2_MAX) db.prepare('UPDATE characters SET job_lv=? WHERE id=?').run(JOB2_MAX, c.id); msg = `三轉 → ${branchOf(TALENTS(), c.job, d.job2).third}`; break; }
        case 'fame': { const v = int(0, 0, 2e9); d.fame = (d.fame || 0) + v; saveD(); msg = `名聲 +${v}（共 ${d.fame}，Lv ${fameLevel(d.fame).lv}；名聲裝備只在結算時寄）`; break; }
        case 'bosskill': { const nm = args[0], v = int(1, 1, 999); d.bossKills ??= {}; d.bossKills[nm] = (d.bossKills[nm] || 0) + v; saveD(); msg = `${nm} 擊殺 → ${d.bossKills[nm]}`; break; }
        case 'rebirth': { d.rebirth = int(0, 0, 10); saveD(); msg = `轉生次數 → ${d.rebirth}`; break; }
        case 'clear': { d.cleared = STAGES.map(x => x.key); saveD(); msg = '四張遠征地圖都標成已通關'; break; }
        case 'talentreset': { d.talents = {}; d.talents2 = {}; saveD(); msg = '天賦全部重置'; break; }
        case 'item': { const slot = args[0] || 'weapon'; if (!SLOTS[slot]) throw new Error('部位：' + Object.keys(SLOTS).join('／'));
          const rar = int(1, 0, 4), ref = args[2] == null ? 0 : int(2, 0, REFINE_MAX); if (bagCount(c.id) >= BAG_MAX) throw new Error('背包滿了');
          const it = rollItem(Math.random, 0, slot, Math.max(1, c.base_lv), c.job); // 部位、底材、數值浮動照一般擲法，品質與精煉用指定的
          const got = giveItem(c.id, { ...it, rarity: rar, refine: ref }); msg = `給了 ${RARITY_N[rar]} ${slot} +${ref}（id ${got.id}）`; break; }
        case 'mat': { const k = args[0], v = int(1, 1, 99999), ok = [...Object.keys(ORES), 'dust', 'crystal', 'rainbow']; if (!ok.includes(k)) throw new Error('道具：' + ok.join('／'));
          d.mats ??= {}; d.mats[k] = (d.mats[k] || 0) + v; saveD(); msg = `${k} +${v}（持有 ${d.mats[k]}）`; break; }
        case 'gem': { const g = int(0, 0, 3), cnt = args[1] == null ? 1 : int(1, 1, 50); d.gems ??= []; for (let i = 0; i < cnt && d.gems.length < GEM_MAX; i++) d.gems.push(newGem(g)); saveD(); msg = `技能寶石 ${GRADES[g]}級 ×${cnt}`; break; }
        case 'stone': { const k = args[0]; if (!STONES[k]) throw new Error('石頭：red／orange／yellow'); const lv = int(1, 0, STONE_MAX);
          d.stones ??= {}; const st = d.stones[k] = stoneOf(d.stones, k); st.lv = lv; st.attrs = Array.from({ length: lv }, (_, i) => rollAttr(k, i + 1)); saveD(); msg = `${STONES[k].name} → +${lv}`; break; }
        case 'bagclear': { const r = db.prepare('DELETE FROM items WHERE char_id=? AND equipped=0').run(c.id); msg = `清掉 ${r.changes} 件沒穿的裝備`; break; }
        case 'mail': { sendMail(c.id, { sender: 'GM', title: args[0] || '測試信', body: 'GM 指令寄的測試信', gold: args[1] ? int(1, 0, 1e9) : 0 }); msg = '寄出一封信'; break; }
        case 'welcome': { delete d.welcomed; saveD(); welcomeMail(ownChar(uid, c.id)); msg = '重新寄開服見面禮'; break; }
        default: throw new Error(`沒有「${cmd}」這個指令（打 /help 看清單）`);
      }
    } catch (e) { return send(res, 400, { error: e.message }); }
    send(res, 200, { msg, char: fullChar(ownChar(uid, c.id)) });
  },
  // 項目 40：三轉（百業宗師）：Base Lv 70＋Job Lv 100（二轉滿）＋打倒紅土地帶 MVP（通關）；延續二轉分支，學到三轉技能
  'POST /api/job3': async (req, res, _, uid) => {
    const { charId } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    const d = JSON.parse(c.data || '{}'), B = d.job2 && branchOf(TALENTS(), c.job, d.job2);
    if (!B) return send(res, 400, { error: '要先二轉' });
    if (d.job3) return send(res, 400, { error: `你已經是${B.third}了` });
    if (c.base_lv < 70) return send(res, 400, { error: '要 Base Lv 70' });
    if (c.job_lv < JOB2_MAX) return send(res, 400, { error: `要二轉 Job Lv ${JOB2_MAX}` });
    if (!(d.cleared || []).includes(STAGES.at(-1).key)) return send(res, 400, { error: `要打倒 ${STAGES.at(-1).bosses.at(-1)[1]}（通關${STAGES.at(-1).name}）` });
    d.job3 = true; d.jobExp = 0;
    db.prepare('UPDATE characters SET data=? WHERE id=?').run(JSON.stringify(d), c.id);
    send(res, 200, fullChar(ownChar(uid, c.id)));
  },
  // 項目 47：裝上稱號（只能裝已經達成的；title＝null 卸下）
  'POST /api/title': async (req, res, _, uid) => {
    const { charId, title } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    const full = fullChar(c);
    if (title != null && !full.titles.includes(title)) return send(res, 400, { error: '還沒有這個稱號' });
    const d = JSON.parse(c.data || '{}'); d.title = title || null;
    db.prepare('UPDATE characters SET data=? WHERE id=?').run(JSON.stringify(d), c.id);
    send(res, 200, fullChar(ownChar(uid, c.id)));
  },
  // ===== 項目 30：寵物飼育員 =====
  'POST /api/petbuy': async (req, res, _, uid) => {
    const { charId, kind } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    if (!PETS[kind]) return send(res, 400, { error: '沒有這種寵物' });
    const d = JSON.parse(c.data || '{}'); d.pets ??= [];
    if (d.pets.length >= PET_MAX) return send(res, 400, { error: `寵物最多 ${PET_MAX} 隻` });
    if ((c.gold ?? 0) < EGG_PRICE) return send(res, 400, { error: `金幣不夠（要 ${EGG_PRICE}）` });
    const p = { id: Date.now(), kind, lv: 1, exp: 0 }; d.pets.push(p); d.pet ??= p.id;
    db.prepare('UPDATE characters SET gold=gold-?, data=? WHERE id=?').run(EGG_PRICE, JSON.stringify(d), c.id);
    send(res, 200, fullChar(ownChar(uid, c.id)));
  },
  'POST /api/petfeed': async (req, res, _, uid) => {
    const { charId, petId, itemIds } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    const d = JSON.parse(c.data || '{}'), p = (d.pets || []).find(x => x.id === petId); if (!p) return send(res, 404, { error: '找不到寵物' });
    if (!Array.isArray(itemIds) || !itemIds.length || itemIds.length > BAG_MAX) return send(res, 400, { error: '清單不對' });
    const its = itemIds.map(id => db.prepare('SELECT * FROM items WHERE id=? AND char_id=?').get(+id, c.id));
    if (its.some(i => !i)) return send(res, 404, { error: '找不到裝備' }); if (its.some(i => i.equipped)) return send(res, 400, { error: '穿著的裝備不能餵' }); if (its.some(i => i.locked)) return send(res, 400, { error: '有鎖定的裝備' });
    p.wants ??= WANT_SLOTS[Math.floor(Math.random() * WANT_SLOTS.length)]; const liked = its.some(i => i.slot === p.wants);
    const exp = its.reduce((t, i) => t + Math.round(FEED_EXP[i.rarity] * (1 + 0.1 * (i.refine || 0)) * (i.slot === p.wants ? 2 : 1)), 0); // 想吃的部位 ×2
    p.hunger = Math.max(0, (p.hunger || 0) - FEED_HUNGER * its.length); if (liked) p.wants = WANT_SLOTS[Math.floor(Math.random() * WANT_SLOTS.length)];
    for (const i of its) db.prepare('DELETE FROM items WHERE id=?').run(i.id);
    const ups = addPetExp(p, exp);
    db.prepare('UPDATE characters SET data=? WHERE id=?').run(JSON.stringify(d), c.id);
    send(res, 200, { exp, ups, pet: p, char: fullChar(ownChar(uid, c.id)) });
  },
  // 指令 4-2 寵物冶煉：把另一隻寵物冶煉進目標（被冶煉的消失），目標得到牠累積經驗的 60%；500 希幣
  'POST /api/petsmelt': async (req, res, _, uid) => {
    const { charId, petId, fromId } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    const d = JSON.parse(c.data || '{}'), p = (d.pets || []).find(x => x.id === petId), f = (d.pets || []).find(x => x.id === fromId);
    if (!p || !f || p === f) return send(res, 404, { error: '找不到寵物' }); if (d.pet === f.id || f.sit) return send(res, 400, { error: '出戰中或代養中的寵物不能拿去冶煉' });
    if ((c.gold ?? 0) < 500) return send(res, 400, { error: '希幣不夠（要 500）' });
    let total = f.exp || 0; for (let l = 1; l < f.lv; l++) total += petNeed(l); const exp = Math.round(total * 0.6) + 50;
    d.pets = d.pets.filter(x => x !== f); const ups = addPetExp(p, exp);
    db.prepare('UPDATE characters SET gold=gold-500, data=? WHERE id=?').run(JSON.stringify(d), c.id);
    send(res, 200, { exp, ups, char: fullChar(ownChar(uid, c.id)) });
  },
  // 指令 4-2 寵物代養：把沒出戰的寵物交給飼育員，每小時 +80 經驗（最多算 24 小時），領回時結算
  'POST /api/petsit': async (req, res, _, uid) => {
    const { charId, petId, op } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    const d = JSON.parse(c.data || '{}'), p = (d.pets || []).find(x => x.id === petId); if (!p) return send(res, 404, { error: '找不到寵物' });
    let exp = 0, ups = 0;
    if (op === 'start') { if (d.pet === p.id) return send(res, 400, { error: '出戰中的寵物要先收回' }); if (p.sit) return send(res, 400, { error: '已經在代養了' }); p.sit = Date.now(); }
    else if (op === 'claim') { if (!p.sit) return send(res, 400, { error: '沒有在代養' }); exp = Math.floor(Math.min(24, (Date.now() - p.sit) / 3600e3) * 80); delete p.sit; ups = addPetExp(p, exp); }
    else return send(res, 400, { error: '沒有這個動作' });
    db.prepare('UPDATE characters SET data=? WHERE id=?').run(JSON.stringify(d), c.id);
    send(res, 200, { exp, ups, char: fullChar(ownChar(uid, c.id)) });
  },
  // 寵物 v2：陪牠玩（飢餓 −30，不長經驗）
  'POST /api/petplay': async (req, res, _, uid) => {
    const { charId, petId } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    const d = JSON.parse(c.data || '{}'), p = (d.pets || []).find(x => x.id === petId); if (!p) return send(res, 404, { error: '找不到寵物' });
    p.hunger = Math.max(0, (p.hunger || 0) - PLAY_HUNGER); db.prepare('UPDATE characters SET data=? WHERE id=?').run(JSON.stringify(d), c.id);
    send(res, 200, fullChar(ownChar(uid, c.id)));
  },
  // 寵物 v2：進化（第 9 階段再出征 30 分鐘；最多 10 個材料，材料類別決定性格）
  'POST /api/petevolve': async (req, res, _, uid) => {
    const { charId, petId, mats = {} } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    const d = JSON.parse(c.data || '{}'), p = (d.pets || []).find(x => x.id === petId); if (!p) return send(res, 404, { error: '找不到寵物' });
    if (petStage9(p.lv) < 9) return send(res, 400, { error: '要長到第 9 階段才能進化' }); if ((p.s9 || 0) < EVOLVE_SECS) return send(res, 400, { error: `第 9 階段還要再出征 ${Math.ceil((EVOLVE_SECS - (p.s9 || 0)) / 60)} 分鐘` });
    d.mats ??= {}; let n = 0; for (const [k, v] of Object.entries(mats)) { if (!EVO_CAT[k] || !Number.isInteger(v) || v < 0) return send(res, 400, { error: '材料不對' }); if ((d.mats[k] || 0) < v) return send(res, 400, { error: '材料不夠' }); n += v; }
    if (n < 1 || n > 10) return send(res, 400, { error: '材料要 1～10 個' }); const r = evolveResult(mats);
    for (const [k, v] of Object.entries(mats)) d.mats[k] -= v;
    p.evo = (p.evo || 0) + 1; p.trait = r.trait; p.perfect = r.perfect; p.lv = 1; p.exp = 0; p.hunger = 0; p.s9 = 0;
    db.prepare('UPDATE characters SET data=? WHERE id=?').run(JSON.stringify(d), c.id);
    send(res, 200, { trait: TRAITS[r.trait].name, perfect: r.perfect, char: fullChar(ownChar(uid, c.id)) });
  },
  'POST /api/petactive': async (req, res, _, uid) => {
    const { charId, petId } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    const d = JSON.parse(c.data || '{}');
    if (petId != null && !(d.pets || []).some(x => x.id === petId)) return send(res, 404, { error: '找不到寵物' });
    if (petId != null && d.pets.find(x => x.id === petId)?.sit) return send(res, 400, { error: '代養中的寵物要先領回' });
    d.pet = petId ?? null; db.prepare('UPDATE characters SET data=? WHERE id=?').run(JSON.stringify(d), c.id);
    send(res, 200, fullChar(ownChar(uid, c.id)));
  },
  'POST /api/petname': async (req, res, _, uid) => {
    const { charId, petId, name } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    const d = JSON.parse(c.data || '{}'), p = (d.pets || []).find(x => x.id === petId); if (!p) return send(res, 404, { error: '找不到寵物' });
    const n = String(name ?? '').trim(); if (n.length > 8 || /[<>&"]/.test(n)) return send(res, 400, { error: '名字 1～8 個字、不能有符號' });
    p.name = n || undefined; db.prepare('UPDATE characters SET data=? WHERE id=?').run(JSON.stringify(d), c.id);
    send(res, 200, fullChar(ownChar(uid, c.id)));
  },
  'POST /api/look': async (req, res, _, uid) => {
    const { charId, hair, hairColor, outfit } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    if (!validLook(hair, hairColor, outfit)) return send(res, 400, { error: '髮型或顏色不對' });
    const d = JSON.parse(c.data || '{}'); Object.assign(d, { hair, hairColor, outfit });
    db.prepare('UPDATE characters SET data=? WHERE id=?').run(JSON.stringify(d), c.id);
    send(res, 200, fullChar(ownChar(uid, c.id)));
  },
  // ===== 拍賣所 =====
  'GET /api/auctions': async (req, res) => {
    expireAuctions();
    const rows = db.prepare('SELECT * FROM auctions WHERE expires>=? ORDER BY price ASC LIMIT 500').all(Date.now()).map(aucView);
    send(res, 200, { rows, total: db.prepare('SELECT COUNT(*) n FROM auctions').get().n });
  },
  'GET /api/myauctions': async (req, res, _, uid, id) => {
    const c = ownChar(uid, id); if (!c) return send(res, 404, { error: '找不到角色' });
    expireAuctions();
    send(res, 200, { rows: db.prepare('SELECT * FROM auctions WHERE seller_char=? ORDER BY id DESC').all(c.id).map(aucView), max: AUC_MAX });
  },
  'POST /api/auclist': async (req, res, _, uid) => {
    const { itemId, price } = await body(req); const it = ownItem(uid, itemId); if (!it) return send(res, 404, { error: '找不到裝備' });
    if (it.equipped) return send(res, 400, { error: '先卸下才能上架' });
    if (it.bound) return send(res, 400, { error: '綁定帳號的裝備不能交易' });
    if (!Number.isInteger(price) || price < 10 || price > 9999999) return send(res, 400, { error: '價格要 10～9,999,999' });
    const c = ownChar(uid, it.char_id);
    if (db.prepare('SELECT COUNT(*) n FROM auctions WHERE seller_char=?').get(c.id).n >= AUC_MAX) return send(res, 400, { error: `最多同時上架 ${AUC_MAX} 件` });
    db.prepare('DELETE FROM items WHERE id=?').run(it.id);
    db.prepare('INSERT INTO auctions (seller_char, seller_name, slot, base, rarity, roll, refine, price, expires, created, ident, gup, pc, aff) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(c.id, c.name, it.slot, it.base, it.rarity, it.roll, it.refine, price, Date.now() + AUC_HOURS * 3600000, Date.now(), it.ident, it.gup | 0, it.pc || null, it.aff || null); // aff：項目 32 詞綴（items 表是 JSON 字串）
    send(res, 200, fullChar(ownChar(uid, c.id)));
  },
  'POST /api/auccancel': async (req, res, _, uid) => {
    const { aucId } = await body(req);
    const a = db.prepare('SELECT a.* FROM auctions a JOIN characters c ON c.id=a.seller_char WHERE a.id=? AND c.account_id=?').get(+aucId, uid);
    if (!a) return send(res, 404, { error: '找不到這筆拍賣' });
    db.prepare('DELETE FROM auctions WHERE id=?').run(a.id);
    giveItem(a.seller_char, a);
    send(res, 200, fullChar(ownChar(uid, a.seller_char)));
  },
  'POST /api/aucbuy': async (req, res, _, uid) => {
    const { charId, aucId } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    expireAuctions();
    const a = db.prepare('SELECT * FROM auctions WHERE id=?').get(+aucId); if (!a) return send(res, 404, { error: '這件已經賣掉或下架了' });
    if (a.seller_char === c.id) return send(res, 400, { error: '不能買自己上架的' });
    if ((c.gold ?? 0) < a.price) return send(res, 400, { error: `金幣不夠（要 ${a.price}）` });
    if (bagCount(c.id) >= BAG_MAX) return send(res, 400, { error: '背包滿了' });
    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM auctions WHERE id=?').run(a.id);
      db.prepare('UPDATE characters SET gold=gold-? WHERE id=?').run(a.price, c.id);
      db.prepare('UPDATE characters SET gold=gold+? WHERE id=?').run(Math.floor(a.price * (1 - AUC_FEE)), a.seller_char);
      giveItem(c.id, a); db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    send(res, 200, fullChar(ownChar(uid, c.id)));
  },
  'POST /api/statup': async (req, res, _, uid) => {
    const { charId, stat } = await body(req); const c = ownChar(uid, charId); if (!c) return send(res, 404, { error: '找不到角色' });
    if (!Object.hasOwn(STATS, stat)) return send(res, 400, { error: '沒有這個素質' });
    const d = JSON.parse(c.data || '{}');
    if (!(d.points > 0)) return send(res, 400, { error: '沒有素質點了' });
    if ((d.stats[stat] || 1) >= 99) return send(res, 400, { error: '已經到上限了' });
    d.points--; d.stats[stat] = (d.stats[stat] || 1) + 1;
    db.prepare('UPDATE characters SET data=? WHERE id=?').run(JSON.stringify(d), c.id);
    send(res, 200, fullChar(ownChar(uid, c.id)));
  },
  // 項目 19：排行榜（戰力／Base／Job／關卡進度／擊殺數／無盡塔；可依職業篩選；回自己的角色好標藍框）
  'GET /api/rank': async (req, res, _, uid) => {
    const q = new URL(req.url, 'http://x').searchParams, tab = q.get('tab') || 'power', job = q.get('job') || '';
    if (!RANK_TABS.includes(tab)) return send(res, 400, { error: '沒有這個排行' });
    const kills = Object.fromEntries(db.prepare('SELECT char_id, SUM(kills) k, MAX(secs) s FROM runs GROUP BY char_id').all().map(r => [r.char_id, r]));
    const T = TALENTS();
    let rows = db.prepare('SELECT * FROM characters').all().filter(c => !job || c.job === job).map(c => {
      const d = JSON.parse(c.data || '{}'), eq = db.prepare('SELECT * FROM items WHERE char_id=? AND equipped=1').all(c.id).map(itemView);
      const tw = tab === 'tower' ? db.prepare('SELECT floor, score FROM towers WHERE char_id=? AND month=? ORDER BY score DESC LIMIT 1').get(c.id, monthKey()) : null;
      return { id: c.id, name: c.name, job: c.job, towerFloor: tw?.floor || 0, towerScore: tw?.score || 0, jobName: (d.job2 && branchOf(T, c.job, d.job2)?.name) || c.job, baseLv: c.base_lv, jobLv: c.job_lv, exp: c.exp,
        power: powerOf(eq), stages: (d.cleared || []).length, best: kills[c.id]?.s || 0, kills: kills[c.id]?.k || 0, mine: c.account_id === uid };
    });
    const key = { power: r => [r.power, r.baseLv], base: r => [r.baseLv, r.exp], job: r => [r.jobLv, r.baseLv], stage: r => [r.stages, r.best], kills: r => [r.kills, r.baseLv], tower: r => [r.towerScore, r.towerFloor] }[tab];
    if (tab === 'tower') rows = rows.filter(r => r.towerScore > 0);
    rows.sort((a, b) => { const x = key(a), y = key(b); return y[0] - x[0] || y[1] - x[1] || a.id - b.id; });
    rows.forEach((r, i) => r.rank = i + 1);
    send(res, 200, { tab, month: monthKey(), rows: rows.slice(0, 50), mine: rows.filter(r => r.mine && r.rank > 50), total: rows.length, at: Date.now() });
  },
  'DELETE /api/chars': async (req, res, _, uid, id) => {
    const r = db.prepare('DELETE FROM characters WHERE id=? AND account_id=?').run(+id, uid);
    if (r.changes) { db.prepare('DELETE FROM mails WHERE char_id=?').run(+id); db.prepare('DELETE FROM runs WHERE char_id=?').run(+id); db.prepare('DELETE FROM items WHERE char_id=?').run(+id); db.prepare('DELETE FROM auctions WHERE seller_char=?').run(+id); }
    send(res, r.changes ? 200 : 404, r.changes ? { ok: true } : { error: '找不到角色' });
  },
};
const PUBLIC = new Set(['POST /api/register', 'POST /api/login']);

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.json': 'application/json', '.glb': 'model/gltf-binary' };
const BLOCK = /^\/(data|docs|tools|server\.mjs)/; // 不對外提供的檔案

http.createServer(async (req, res) => {
  let url; try { url = new URL(req.url, 'http://x'); } catch { res.writeHead(400); return res.end(); }
  if (url.pathname.startsWith('/api/')) {
    const [, , name, id] = url.pathname.split('/');
    const key = `${req.method} /api/${name}`;
    const fn = api[key]; if (!fn) return send(res, 404, { error: 'not found' });
    let uid = null;
    if (!PUBLIC.has(key) && !(uid = auth(req))) return send(res, 401, { error: '請重新登入' });
    try { await fn(req, res, null, uid, id); } catch (e) { console.error(e); send(res, 500, { error: '伺服器錯誤' }); }
    return;
  }
  let p; try { p = decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end(); }
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  const rel = '/' + path.relative(ROOT, file).split(path.sep).join('/');
  if (rel.startsWith('/..') || BLOCK.test(rel)) { res.writeHead(404); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    // 程式、頁面、資料每次都跟伺服器確認（不然改完程式瀏覽器還在用舊的）；圖片、模型、音效可以快取
    const ext = path.extname(file).toLowerCase(), fresh = ['.html', '.js', '.mjs', '.css', '.json'].includes(ext) || /\/src\//.test(file);
    res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': fresh ? 'no-cache' : 'max-age=3600' }); res.end(data);
  });
}).listen(PORT, () => console.log(`希望OL 倖存者 伺服器：http://localhost:${PORT}`));
