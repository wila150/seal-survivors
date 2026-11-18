// 遠征地圖（前端、伺服器、遊戲共用）
// 地名取自客戶端 map/*.map 檔頭（韓文原名），中文是暫譯，待確認台版譯名
// banner：出征選單橫幅＝客戶端原版載入畫面（interface/*_load.tex 轉檔，暫時挑風格接近的）
// bosses：[秒數, 怪物, 'mini' | 'mvp']；打倒 mvp 就通關
// zones：4 區（站在哪一區就生那一區的怪）；mapId＝客戶端原版地圖編號，地形在 assets/maps/<mapId>/（tools/build-map.mjs 轉檔）
export const STAGE_TIME = 600;
export const STAGES = [
  { key: 'hill', bgm: '01', banner: 'assets/load/rookie_load.png', name: '格拉西斯平原', sub: '글라시스 평원・原版地圖 30', mapId: 30, lv: '1–8', ground: 0x3d6b3a, fog: 0x1a2a1f,
    monsters: ['咕咕', '小豌豆', '整人箱', '蘑菇弟弟'],
    bosses: [[120, '整人箱', 'mini'], [240, '蘑菇弟弟', 'mini'], [360, '小豌豆', 'mini'], [480, '咕咕', 'mini'], [600, '菜頭王', 'mvp']],
    // 區域（項目 10）：原版地圖以可走區重心分成中央一圈＋四個象限（西北、東北、東南、西南）；站在哪區就生哪區的怪
    zones: [{ name: '箱子丘陵', monsters: ['整人箱', '咕咕'] }, { name: '蘑菇田', monsters: ['蘑菇弟弟', '小豌豆'] },
            { name: '豌豆園', monsters: ['小豌豆', '咕咕'] }, { name: '咕咕草原', monsters: ['咕咕', '蘑菇弟弟'] }],
    hp: 1, dmg: 1, reward: 1 },
  { key: 'forest', bgm: '02', banner: 'assets/load/sevis_load.png', name: '席隆森林', sub: '실론 숲・原版地圖 10', mapId: 10, lv: '9–15', ground: 0x2f5a35, fog: 0x10241a,
    monsters: ['蘑菇弟弟', '蘑菇妹妹', '搖滾菜頭', '飛天豬', '法師咕咕'],
    bosses: [[120, '蘑菇妹妹', 'mini'], [240, '法師咕咕', 'mini'], [360, '飛天豬', 'mini'], [480, '熊寶寶', 'mini'], [600, '熊爸爸', 'mvp']],
    zones: [{ name: '蘑菇林', monsters: ['蘑菇弟弟', '蘑菇妹妹'] }, { name: '咕咕魔法林', monsters: ['法師咕咕', '搖滾菜頭'] },
            { name: '飛豬崖', monsters: ['飛天豬', '搖滾菜頭'] }, { name: '熊出沒深林', monsters: ['蘑菇妹妹', '法師咕咕', '飛天豬'] }],
    hp: 1.8, dmg: 1.4, reward: 1.6 },
  { key: 'grave', bgm: '03', banner: 'assets/load/elimdun_load.png', name: '地下墓地', sub: '지하묘지・原版地圖 57', mapId: 57, lv: '16–25', ground: 0x3a3550, fog: 0x15121f,
    monsters: ['南瓜舞者', '骷髏兵', '幽靈戰士', '護士咕咕', '戰士咕咕'],
    bosses: [[120, '護士咕咕', 'mini'], [240, '南瓜舞者', 'mini'], [360, '戰士咕咕', 'mini'], [480, '幽靈戰士', 'mini'], [600, '骷髏王', 'mvp']],
    zones: [{ name: '醫護廢墟', monsters: ['護士咕咕', '骷髏兵'] }, { name: '南瓜墳場', monsters: ['南瓜舞者', '骷髏兵'] },
            { name: '咕咕戰場', monsters: ['戰士咕咕', '護士咕咕'] }, { name: '幽魂迴廊', monsters: ['幽靈戰士', '骷髏兵'] }],
    hp: 3, dmg: 1.9, reward: 2.4 },
  { key: 'desert', bgm: '04', banner: 'assets/load/deathdun_load.png', name: '紅土地帶', sub: '레드소일・原版地圖 36', mapId: 36, lv: '26+', ground: 0x8a7444, fog: 0x2a2010,
    monsters: ['骷髏兵', '幽靈戰士', '熊寶寶', '熊媽媽', '蘑菇奶奶'],
    bosses: [[120, '熊媽媽', 'mini'], [240, '蘑菇奶奶', 'mini'], [360, '骷髏兵', 'mini'], [480, '熊寶寶', 'mini'], [600, '魔蠍大帝', 'mvp']],
    zones: [{ name: '熊窩紅岩', monsters: ['熊媽媽', '熊寶寶'] }, { name: '枯菇谷', monsters: ['蘑菇奶奶', '幽靈戰士'] },
            { name: '白骨沙丘', monsters: ['骷髏兵', '幽靈戰士'] }, { name: '赤土荒野', monsters: ['熊寶寶', '骷髏兵'] }],
    hp: 4.8, dmg: 2.6, reward: 3.5 },
];
// 解鎖：通關前一張才開；cleared = 已通關的 key 陣列
export const stageUnlocked = (i, cleared = []) => i === 0 || cleared.includes(STAGES[i - 1].key);
