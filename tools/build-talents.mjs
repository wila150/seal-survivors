// 項目 26：局外天賦樹資料產生器
// 用法：node tools/build-talents.mjs <2u 快取資料夾>
//   快取資料夾放 base_1.json～base_6.json（POST https://www.2usealol.com/mod/skill-v6/base.php，body jobid=1..6）
// 輸出：assets/data/talents.json
// 規則（企劃_工程交付.md 第 26 項）：內容＝PC 版一轉技能樹 tree_1，依 PC 前置關係排；
//   每欄有 Job Lv 門檻（0／5／10／15／20／25／30），節點上限 1～5，金框＝最終天賦，⚔＝限定武器。
//   天賦只給被動數值或改造局內技能，不會變成局內主動技。
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
if (!dir) { console.error('用法：node tools/build-talents.mjs <2u 快取資料夾>'); process.exit(1); }

const JOBS = { 1: '劍士', 2: '騎士', 3: '小丑', 4: '法師', 5: '祭司', 6: '鐵匠', 9: '獵人', 31: '饕客' }; // 9＝獵人（項目 45；2u 沒有 7、8）、31＝饕客（11/21）
const COLS = {
  劍士: ['劍技', '攻擊', '輔助'], 騎士: ['劍術', '攻擊', '盾牌'], 小丑: ['投擲', '戲法', '輔助'],
  法師: ['火', '冰', '奧術'], 祭司: ['神聖', '治癒', '祝福'], 鐵匠: ['粉碎', '炸彈', '工匠'], 獵人: ['射擊', '爆破', '求生'], 饕客: ['食具', '料理', '美食'],
};
const BASIC = { 劍士: 'b_musa', 騎士: 'b_knight', 小丑: 'b_clown', 法師: 'b_magic', 祭司: 'b_cleric', 鐵匠: 'b_smith', 獵人: 'b_hunter', 饕客: 'b_cook' };

// 效果簡寫：每 1 級的數值
//   atk 所有傷害％、phys 物理％、magic 魔法％、hp 最大 HP％、speed 移速％、haste 冷卻縮短％、crit 爆擊率、
//   armor 護甲、regen 每秒回血、magnet 吸取範圍％、tag:<fire|ice|heavy> 該屬性技能傷害％、skill:<key> 該招 傷害％／冷卻
const SK = k => ({ [`skill:${k}`]: 1 }); // 改造局內技能（傷害 +8%、冷卻 -3% 每級）
const W = (job, extra = {}) => ({ [`skill:${BASIC[job]}`]: 1, atk: 0.02, ...extra }); // 武器熟練：普攻＋全傷害

// [PC 技能 id, 繁體名, 欄, 效果, 旗標] 旗標：F＝最終天賦（金框）、W＝限定武器（⚔）
const MAP = {
  // 11/21 饕客（2u jobid 31 一轉 18 招）：照 PC 說明換成割草版效果
  饕客: [
    [277, '叉子連擊', 0, W('饕客'), 'W'], [278, '餐桌禮儀', 0, { magnet: 0.08 }], [284, '幸運餅乾', 0, SK('xingyun')], [286, '爆漿奶油派', 0, SK('naiyou')],
    [279, '山珍海味', 0, { 'tag:heavy': 0.08 }, 'F'],
    [285, '餐前湯', 1, SK('canqian')], [281, '特殊佐料', 1, { 'skill:canqian': 0.5 }], [288, '韓食-重辣', 1, { phys: 0.03 }], [290, '日式-芥末', 1, SK('jiemo')],
    [289, '中式-火候', 1, { atk: 0.03 }], [287, '西餐-奶油', 1, { magnet: 0.08 }], [291, '三大美食-松露', 1, { crit: 0.02 }], [293, '三大美食-魚子醬', 1, { 'skill:canqian': 0.5, 'skill:jiemo': 0.5 }],
    [292, '三大美食-鵝肝醬', 1, { atk: 0.04 }, 'F'],
    [280, '絕對味覺', 2, { regen: 0.15 }], [282, '美食獵人', 2, { atk: 0.02, hp: 0.03 }], [283, '美食會', 2, { hp: 0.05 }], [315, '饕客的應援', 2, { haste: 0.03 }, 'F'],
  ],
  獵人: [
    [231, '彈弓精通', 0, W('獵人'), 'W'], [234, '亂擊', 0, { phys: 0.03 }], [235, '弱點攻擊', 0, { crit: 0.02 }], [237, '亂射', 0, SK('luanshe')],
    [241, '雙子爆發', 0, SK('shuangzi')], [236, '全力一擊', 0, { 'tag:heavy': 0.08 }, 'F'],
    [232, '殺氣', 1, { atk: 0.03 }], [233, '霸氣', 1, { crit: 0.02 }], [242, '爆彈分裂', 1, SK('baodan')], [244, '紅心連擊', 1, { 'skill:luanshe': 0.5, 'skill:shuangzi': 0.5 }],
    [243, '魔力之雨', 1, { atk: 0.04 }, 'F'],
    [238, '纏繞樹根', 2, SK('chanrao')], [239, '鴿眼', 2, { magnet: 0.08 }], [240, '鷹眼', 2, { crit: 0.02 }], [245, '閃擊之舞', 2, { haste: 0.03 }],
    [246, '誘騙之餌', 2, { armor: 1 }], [247, '瞬息閃身', 2, { speed: 0.05 }], [314, '獵人的知識', 2, { hp: 0.05 }, 'F'],
  ],
  劍士: [
    [6, '雙手劍技', 0, W('劍士'), 'W'], [68, '雙手劍技2', 0, { atk: 0.03 }, 'W'], [115, '熟練劍技', 0, { crit: 0.02 }, 'W'], [266, '劍影', 0, { 'skill:b_musa': 1, crit: 0.03 }, 'FW'],
    [28, '聚氣', 1, { haste: 0.03 }], [29, '流雲斬', 1, SK('liuyun')], [30, '旋風斬', 1, SK('xuanfeng')], [31, '疾風斬', 1, SK('jifeng')],
    [113, '光速斬', 1, SK('guangsu')], [32, '颶風斬', 1, { 'tag:heavy': 0.08 }, 'F'], [270, '異界斬', 1, { atk: 0.1 }, 'F'],
    [308, '劍士的鼓舞', 2, { hp: 0.05 }], [48, '恐嚇', 2, { armor: 1 }], [49, '熱血', 2, { atk: 0.03 }], [103, '乘風破浪', 2, { speed: 0.03 }],
    [69, '團體熱血', 2, { hp: 0.04 }], [114, '範圍恐嚇', 2, { armor: 3 }], [264, '鐵血', 2, { hp: 0.05, regen: 0.3 }, 'F'],
  ],
  騎士: [
    [7, '單手劍技', 0, W('騎士'), 'W'], [309, '騎士的智慧', 0, { magnet: 0.1 }], [35, '砍擊', 0, { atk: 0.03 }], [37, '爆擊', 0, { crit: 0.02 }],
    [110, '點擊', 0, { phys: 0.03 }], [111, '大霹靂', 0, { 'tag:heavy': 0.08 }, 'F'],
    [34, '十字攻擊', 1, SK('shizi')], [36, '八方攻擊', 1, SK('bafang')], [106, '十字神劍', 1, SK('shenjian')], [112, '石破天驚', 1, { atk: 0.04 }, 'F'],
    [33, '淨化', 2, { regen: 0.2 }], [50, '挑釁', 2, { armor: 1 }], [51, '盾擋', 2, { armor: 1 }], [52, '盾擊', 2, { phys: 0.03 }],
    [65, '範圍挑釁', 2, { hp: 0.03 }], [144, '飛毛腿', 2, { speed: 0.03 }], [271, '盾牌投擲', 2, SK('dunpai')], [272, '盾牌術大師', 2, { armor: 2, hp: 0.04 }, 'F'],
  ],
  小丑: [
    [8, '匕首技', 0, W('小丑'), 'W'], [59, '熱情', 0, { haste: 0.03 }], [61, '任意投擲', 0, SK('renyi')], [117, '隨意投擲', 0, SK('suiyi')],
    [143, '毒匕首', 0, SK('duzhi')], [118, '俄羅斯輪盤', 0, { crit: 0.03 }, 'F'],
    [312, '小丑的催促', 1, { speed: 0.05 }], [58, '滑稽', 1, { magnet: 0.08 }], [60, '跳躍', 1, { speed: 0.03 }], [62, '裝死', 1, { hp: 0.05 }],
    [116, '大跳躍', 1, { speed: 0.03, armor: 1 }], [119, '爬行', 1, { regen: 1 }, 'F'],
    [63, '啦啦隊', 2, { atk: 0.03 }], [64, '催眠曲', 2, SK('cuimian')], [79, '加速', 2, { haste: 0.05 }], [80, '團體加速', 2, { speed: 0.06 }],
    [100, '假面遊戲', 2, { crit: 0.02, atk: 0.03 }, 'F'],
  ],
  法師: [
    [18, '火柴棒', 0, { 'tag:fire': 0.05 }], [19, '火風暴', 0, SK('huofeng')], [44, '火柴棒連擊', 0, { 'tag:fire': 0.05 }], [20, '火精靈', 0, SK('huojing')],
    [45, '狂暴火精靈', 0, SK('huojing')], [128, '狂暴烈焰', 0, { 'tag:fire': 0.06 }], [22, '隕石召喚', 0, { 'tag:fire': 0.08 }, 'F'], [129, '烈火鳳凰', 0, { 'tag:fire': 0.08 }, 'F'],
    [23, '冰劍術', 1, SK('bingjian')], [24, '冰柱術', 1, SK('bingzhu')], [46, '冰瀑術', 1, { 'tag:ice': 0.05 }], [25, '冰凍術', 1, { 'tag:ice': 0.05 }],
    [47, '凍結術', 1, { 'tag:ice': 0.05 }], [130, '狂暴寒冰', 1, { 'tag:ice': 0.06 }], [27, '暴風雪', 1, { 'tag:ice': 0.08 }, 'F'], [131, '冰雪瀑布', 1, { 'tag:ice': 0.08 }, 'F'],
    [9, '持杖技', 2, { 'skill:b_magic': 1, magic: 0.02 }, 'W'], [310, '法師的策略', 2, { haste: 0.05 }], [17, '熟讀咒語', 2, { magic: 0.03 }], [105, '魔人附體', 2, { magic: 0.03 }],
    [127, '瞬間移動', 2, { speed: 0.03 }], [123, '馭冰術', 2, { 'tag:ice': 0.04 }], [124, '馭火術', 2, { 'tag:fire': 0.04 }], [125, '馭冰潔心', 2, { hp: 0.03 }], [126, '馭火焚身', 2, { atk: 0.03 }],
  ],
  祭司: [
    [10, '鎚技', 0, W('祭司'), 'W'], [41, '勇敢', 0, { atk: 0.03 }], [43, '譴責', 0, SK('qianze')], [326, '審判之力', 0, SK('shenpan')],
    [133, '天譴', 0, SK('tianqian')], [132, '聖光', 0, SK('shengguang')], [327, '堅定信念', 0, { atk: 0.04 }, 'F'],
    [311, '祭司的激勵', 1, { hp: 0.05 }], [39, '祈禱', 1, { regen: 0.2 }], [40, '治癒', 1, { regen: 0.2 }], [42, '治療', 1, { hp: 0.03 }],
    [55, '隊伍治癒術', 1, { regen: 0.3 }], [56, '馬斯治癒術', 1, { hp: 0.03 }], [77, '狀態消除', 1, { armor: 1 }], [78, '復活', 1, { hp: 0.1 }, 'F'],
    [53, '鼓勵', 2, { magnet: 0.08 }], [137, '隊伍祝福', 2, { haste: 0.02 }], [54, '保護術', 2, { armor: 1 }], [102, '聖靈之力', 2, { atk: 0.03 }],
    [104, '瞬間加速', 2, { speed: 0.03 }], [134, '神聖祝福術', 2, { crit: 0.02 }], [135, 'HP祝福術', 2, { hp: 0.04 }], [136, 'AP祝福術', 2, { atk: 0.03 }],
    [138, '隊伍保護術', 2, { armor: 1 }], [139, '隊伍聖靈之力', 2, { atk: 0.04 }, 'F'], [140, '隊伍瞬間加速', 2, { speed: 0.03 }, 'F'],
  ],
  // 鐵匠的製作／合成類（制作武器、合成武器、制作防具、合成防具、制作配件、合成配件）跟割草無關，不收
  鐵匠: [
    [11, '鐵槌技', 0, W('鐵匠'), 'W'], [82, '致命一擊', 0, SK('zhiming')], [120, '一擊粉碎', 0, { crit: 0.02 }], [141, '多重粉碎', 0, SK('duozhong')],
    [142, '一擊毀滅', 0, SK('huimie')], [122, '毀滅術', 0, { 'tag:heavy': 0.08 }, 'F'],
    [83, '投擲炸彈', 1, SK('zhadan')], [121, '狂暴衝擊', 1, { atk: 0.03 }], [94, '鍊金術', 1, { 'tag:fire': 0.05 }], [96, '熔解', 1, { 'tag:fire': 0.04 }],
    [313, '鐵匠的眼光', 2, { atk: 0.03 }], [81, '鐵匠精神', 2, { hp: 0.05 }], [84, '料理', 2, { regen: 0.2 }], [85, '高級料理', 2, { regen: 0.4 }, 'F'],
    [86, '收集', 2, { magnet: 0.15 }], [101, '鑑定道具', 2, { crit: 0.02 }],
  ],
};

// PC 需求等級 → Job Lv 門檻列
const GATES = [0, 5, 10, 15, 20, 25, 30];
const gateOf = req => req <= 10 ? 0 : req <= 20 ? 1 : req <= 35 ? 2 : req <= 55 ? 3 : req <= 80 ? 4 : req <= 110 ? 5 : 6;
// PC 技能最高等級 → 天賦上限 1～5
const capOf = m => m <= 1 ? 1 : m <= 5 ? 3 : m <= 11 ? 3 : m <= 15 ? 4 : 5;

// ===== 二轉（項目 27）：tree_2＝A 分支、tree_3＝B 分支（2u 資料站；PC Lv 251 那批是三轉技能，留給第 40 項）=====
// skills＝轉職後加進局內技能池的 2 招（skills.json 的 k2_*）；表內 [PC id, 繁體名, 效果, 旗標]
const SKB = k => ({ [`skill:${k}`]: 0.5 }); // 二轉節點上限較高，每級效果減半
const BR = {
  獵人: [
    { key: 'A', name: '弓箭手', thirdName: '風暴獵手', skills: ['k2_guanchuan', 'k2_baoyu'], skill3: 'k3_jianshi', third: [[355, '箭矢雨', SKB('k3_jianshi'), 'F'], [356, '一箭三雕', { crit: 0.01 }]], nodes: [
      [256, '貫穿攻擊', SKB('k2_guanchuan')], [257, '爆雨梨花', SKB('k2_baoyu')], [258, '穿甲之箭', { phys: 0.015 }], [259, '魔性殺器', { atk: 0.015 }],
      [260, '毒氣環繞', { regen: 0.15 }], [261, '迷幻空間', { armor: 0.5 }], [262, '強襲之弓', { 'skill:b_hunter': 0.5, atk: 0.01 }, 'W'], [318, '魔法之箭', { crit: 0.01 }], [319, '弓箭改造', { haste: 0.03, atk: 0.01 }, 'F']] },
    { key: 'B', name: '槍手', thirdName: '魔彈射手', skills: ['k2_zhimiao', 'k2_hunxuan'], skill3: 'k3_huoli', third: [[357, '火力集中', SKB('k3_huoli'), 'F'], [358, '第二次機會', { hp: 0.015 }]], nodes: [
      [248, '弱點精準', { crit: 0.01 }], [249, '會心一擊', { atk: 0.015 }], [250, '致命瞄準', SKB('k2_zhimiao')], [251, '狂暴亂舞', { haste: 0.015 }],
      [252, '奪目炫光', { armor: 0.5 }], [253, '昏眩射擊', SKB('k2_hunxuan')], [255, '遠程火力', { phys: 0.015 }], [320, '狙擊模式', { 'tag:heavy': 0.03 }], [321, '瞬間爆發', { speed: 0.015 }], [322, '速戰之力', { haste: 0.02, crit: 0.01 }, 'F']] },
  ],
  // 11/21 饕客：2u tree_2＝食神（→ 廚神）、tree_3＝美食家（→ 美食獵人）（2u 職業頁寫的順序相反，以技能說明為準）
  饕客: [
    { key: 'A', name: '食神', thirdName: '廚神', skills: ['k2_shipo', 'k2_yangcong'], skill3: 'k3_huoji', third: [[359, '火雞伺候', SKB('k3_huoji'), 'F'], [360, '重口味料理', { atk: 0.01 }]], nodes: [
      [301, '最後的晚餐', { hp: 0.015, armor: 0.5 }], [302, '食破天驚', SKB('k2_shipo')], [303, '洋蔥剁剁剁', SKB('k2_yangcong')], [304, '黑暗料理界', { atk: 0.015 }],
      [305, '義大利麵', { 'tag:heavy': 0.03 }], [306, '特級廚師', { regen: 0.15, hp: 0.01 }, 'F']] },
    { key: 'B', name: '美食家', thirdName: '美食獵人', skills: ['k2_faguo', 'k2_xiangqi'], skill3: 'k3_duxiang', third: [[361, '獨享美味', SKB('k3_duxiang'), 'F'], [362, '特殊料理食材', { hp: 0.015 }]], nodes: [
      [294, '暴食', { atk: 0.015, hp: 0.015 }], [295, '減肥', { haste: 0.015, speed: 0.015 }], [296, '胃口大開', { regen: 0.15 }], [297, '法國麵包', SKB('k2_faguo')],
      [298, '輕如鴻毛', { speed: 0.015 }], [300, '香氣四溢', SKB('k2_xiangqi')], [299, '重於泰山', { armor: 0.5, hp: 0.01 }, 'F']] },
  ],
  劍士: [
    { key: 'A', name: '狂劍士', thirdName: '劍聖', skills: ['k2_yiwang', 'k2_fennu'], skill3: 'k3_renjian', third: [[331, '人劍合一', SKB('k3_renjian'), 'F'], [332, '精神集中', { crit: 0.01 }]], nodes: [
      [158, '威嚇', { armor: 0.5 }], [159, '覺醒', { atk: 0.015 }], [160, '本能', { crit: 0.01 }], [161, '反擊', { hp: 0.015 }],
      [163, '雙手劍大師', { 'skill:b_musa': 0.5, atk: 0.01 }, 'W'], [162, '憤怒之力', SKB('k2_fennu')], [265, '連續的奧義', { haste: 0.015 }], [267, '一網打盡', SKB('k2_yiwang'), 'F']] },
    { key: 'B', name: '魔劍士', thirdName: '修羅', skills: ['k2_tuji', 'k2_xixue'], skill3: 'k3_yuanhua', third: [[333, '圓滑刀刃', SKB('k3_yuanhua'), 'F'], [334, '狂怒', { haste: 0.01, 'skill:xuanfeng': 0.5 }]], nodes: [
      [164, '劍舞', { 'tag:heavy': 0.03 }], [165, '突擊', SKB('k2_tuji')], [166, '秋風掃落葉', { atk: 0.015 }], [169, '疾風斬之光', { 'skill:jifeng': 2 }],
      [167, '風之神速', { speed: 0.015 }], [268, '堅忍', { hp: 0.015, armor: 0.3 }], [168, '興奮', { haste: 0.05 }], [269, '吸血斬', { ...SKB('k2_xixue'), regen: 0.1 }, 'F']] },
  ],
  騎士: [
    { key: 'A', name: '闇騎士', thirdName: '督軍', skills: ['k2_chongji', 'k2_quanli'], skill3: 'k3_heizhou', third: [[336, '黑色詛咒', SKB('k3_heizhou'), 'F'], [335, '黑色狂潮', { atk: 0.015 }]], nodes: [
      [150, '復仇之心', { atk: 0.015 }], [145, '武器破壞', { phys: 0.015 }], [273, '潛力', { hp: 0.06 }], [146, '防具破壞', { crit: 0.01 }],
      [147, '衝擊波', SKB('k2_chongji')], [148, '全力一擊', SKB('k2_quanli')], [149, '勃然大怒', { atk: 0.06 }], [151, '割傷', { 'tag:heavy': 0.06 }, 'F']] },
    { key: 'B', name: '聖騎士', thirdName: '聖殿騎士', skills: ['k2_baofeng', 'k2_tianbeng'], skill3: 'k3_tianfa', third: [[338, '天罰', SKB('k3_tianfa'), 'F'], [337, '神之體魄', { atk: 0.01, armor: 0.3, hp: 0.01 }]], nodes: [
      [152, '暴風神劍', SKB('k2_baofeng')], [157, '神聖防護', { armor: 0.5 }], [156, '反射之盾', { hp: 0.015 }], [155, '神癒', { regen: 0.15 }],
      [153, '天崩地裂', SKB('k2_tianbeng')], [154, '神撼大地', { 'tag:heavy': 0.03 }], [274, '防護罩', { armor: 1, hp: 0.02 }, 'F']] },
  ],
  小丑: [
    { key: 'A', name: '刺客', thirdName: '暗夜行者', skills: ['k2_anying', 'k2_judu'], skill3: 'k3_duanjue', third: [[340, '斷絕', SKB('k3_duanjue'), 'F'], [339, '速戰速決', { haste: 0.015 }]], nodes: [
      [182, '突襲', { atk: 0.015 }], [185, '暗殺術', { crit: 0.01 }], [316, '死亡劇毒', SKB('k2_judu')], [183, '闇影之牙', SKB('k2_anying')],
      [188, '草上飛', { speed: 0.015 }], [186, '混亂', { haste: 0.015 }], [189, '刺刀大師', { 'skill:b_clown': 0.5, atk: 0.01 }, 'W'], [184, '強襲', { phys: 0.015 }], [187, '分身術', { atk: 0.02, crit: 0.01 }, 'F']] },
    { key: 'B', name: '藝者', thirdName: '命運牌手', skills: ['k2_fenli', 'k2_heijieke'], skill3: 'k3_weixie', third: [[342, '威脅之卡', SKB('k3_weixie'), 'F'], [341, '停止動作', { atk: 0.015 }]], nodes: [
      [192, '虛張聲勢', { armor: 0.5 }], [194, '奮力投擲', SKB('k2_fenli')], [317, '亞洲第一快手', { haste: 0.015 }], [193, '雙重攻擊', { atk: 0.015 }],
      [190, '天女散花', { 'skill:renyi': 0.5, 'skill:suiyi': 0.5 }], [196, '一石二鳥', { crit: 0.01 }], [191, '黑傑克', SKB('k2_heijieke')], [195, '吃角子老虎', { magnet: 0.04 }], [197, '投擲訓練', { phys: 0.03 }, 'F']] },
  ],
  法師: [
    { key: 'A', name: '冰魔導', thirdName: '冰霜領主', skills: ['k2_bingfeng', 'k2_qixuan'], skill3: 'k3_bingleng', third: [[343, '冰冷疾風', SKB('k3_bingleng'), 'F'], [344, '冷風強化', { magic: 0.012, 'tag:ice': 0.01 }]], nodes: [
      [170, '寒冰炮彈術', { 'tag:ice': 0.02 }], [171, '完美冰封術', SKB('k2_bingfeng')], [175, '寒冰之盾', { armor: 0.5, hp: 0.01 }], [172, '永凍術', { 'tag:ice': 0.02 }],
      [173, '寒冰氣旋', SKB('k2_qixuan')], [174, '時間扭轉術', { haste: 0.015 }], [275, '正義風暴', { 'tag:ice': 0.03, magic: 0.01 }, 'F']] },
    { key: 'B', name: '炎魔導', thirdName: '烈焰領主', skills: ['k2_huochong', 'k2_dihuo'], skill3: 'k3_huoyan', third: [[345, '火焰疾風', SKB('k3_huoyan'), 'F'], [346, '火焰強化', { magic: 0.012, 'tag:fire': 0.01 }]], nodes: [
      [176, '火焰衝擊', SKB('k2_huochong')], [177, '地獄烈火', { 'tag:fire': 0.02 }], [180, '火焰之盾', { armor: 0.5, hp: 0.01 }], [178, '地火震天', SKB('k2_dihuo')],
      [181, '烈炎反擊', { hp: 0.015 }], [179, '火焰之心', { magic: 0.015 }], [276, '火焰亂舞', { 'tag:fire': 0.03, magic: 0.01 }, 'F']] },
  ],
  祭司: [
    { key: 'A', name: '審判者', thirdName: '裁決者', skills: ['k2_chanhui', 'k2_shangdi'], skill3: 'k3_shengyu', third: [[348, '聖域', SKB('k3_shengyu'), 'F'], [347, '福音', { regen: 0.1, atk: 0.01 }]], nodes: [
      [198, '懺悔', SKB('k2_chanhui')], [202, '狂熱', { atk: 0.015 }], [328, '上帝之手', SKB('k2_shangdi')], [204, '贖罪', { hp: 0.02 }],
      [200, '預知', { crit: 0.01 }], [203, '聖鎚大師', { 'skill:b_cleric': 0.5, atk: 0.01 }, 'W'], [199, '審判', { 'skill:qianze': 0.5, 'skill:shenpan': 0.5 }], [201, '鞭策', { atk: 0.02, haste: 0.01 }, 'F']] },
    { key: 'B', name: '聖賢者', thirdName: '大主教', skills: ['k2_qumo', 'k2_tianshi'], skill3: 'k3_jiahu', third: [[350, '神的加護', SKB('k3_jiahu'), 'F'], [349, '恩寵', { hp: 0.02, regen: 0.1 }]], nodes: [
      [205, '終極治療術', { regen: 0.15 }], [212, '聖靈治癒', { hp: 0.03 }], [330, '驅魔術', SKB('k2_qumo')], [206, '聖靈護盾', { armor: 0.5 }],
      [209, '聖靈魔力', { magic: 0.015 }], [329, '天使的呢喃', SKB('k2_tianshi')], [208, '聖靈力量', { atk: 0.015 }], [210, '聖靈疾速', { speed: 0.015 }],
      [207, '聖靈祝福', { hp: 0.015 }], [211, '聖靈加速', { haste: 0.015 }], [213, '祈願', { regen: 0.2, hp: 0.01 }, 'F']] },
  ],
  鐵匠: [
    { key: 'A', name: '爆破士', thirdName: '毀滅者', skills: ['k2_dingshi', 'k2_zhiming2'], skill3: 'k3_feitian', third: [[351, '飛天槌擊', SKB('k3_feitian'), 'F'], [352, '縝密監定', { crit: 0.03 }]], nodes: [
      [217, '爆破傷害', { 'tag:fire': 0.08 }], [218, '餘波盪漾', { atk: 0.06 }], [215, '全面毀滅', { 'tag:heavy': 0.02 }], [325, '炸彈製作專家', { 'skill:zhadan': 3 }],
      [216, '定時炸彈', SKB('k2_dingshi')], [214, '致命毀滅', SKB('k2_zhiming2')], [220, '炸彈強化', { 'tag:fire': 0.03 }, 'F']] },
    // 匠師的 PC 技能幾乎都是製作／鑑定，割草版改成被動數值
    { key: 'B', name: '匠師', thirdName: '神匠', skills: ['k2_jiangchui', 'k2_zhilian'], skill3: 'k3_quanlei', third: [[353, '全壘打擊', SKB('k3_quanlei'), 'F'], [354, '超縝密監定', { crit: 0.03, magnet: 0.05 }]], nodes: [
      [221, '匠槌訓練', SKB('k2_jiangchui')], [224, '制鏈專家', SKB('k2_zhilian')], [222, '盔甲強化術', { armor: 0.5, hp: 0.015 }], [223, '武器強化術', { atk: 0.02 }],
      [227, '制鏈秘笈', { 'skill:k2_zhilian': 1 }], [324, '高級道具監定', { crit: 0.05, magnet: 0.1 }, 'F']] },
  ],
};
const gate2 = req => req <= 150 ? 50 : req <= 160 ? 55 : req <= 170 ? 60 : req <= 180 ? 65 : 70; // 二轉 Job Lv 51～100
const cap2 = m => m <= 1 ? 1 : m <= 5 ? 5 : m <= 8 ? 6 : m <= 15 ? 7 : 10;

function branchTree(raw, list) {
  const byId = Object.fromEntries(raw.map(s => [+s.skillid, s]));
  const nodes = list.map(([id, name, eff, flags = '']) => {
    const third = flags.includes('T');
    const s = byId[id]; if (!s) throw new Error(`找不到 PC 技能 ${id} ${name}`);
    const [px, py] = s.zuobiao.split(' ').map(v => -parseInt(v));
    return { id, name, gate: gate2(+s.req_lv), max: cap2(+s.maxlv), pcMax: +s.maxlv, preId: +s.qianzhi_datas[1] || 0, preLv: +s.qianzhilv_datas[1] || 0, icon: [s.icon_bg, px, py], eff, final: flags.includes('F'), weapon: flags.includes('W'), ...(third ? { third: true } : {}) };
  });
  const map = Object.fromEntries(nodes.map(n => [n.id, n]));
  for (const n of [...nodes].sort((a, b) => a.gate - b.gate)) { const p = map[n.preId]; if (p) { n.pre = [p.id, Math.max(1, Math.min(p.max, Math.round(n.preLv / p.pcMax * p.max)))]; n.gate = Math.max(n.gate, p.gate); } }
  for (const n of nodes) { if (n.final) n.gate = Math.max(n.gate, 65); if (n.third) { n.gate = n.final ? 110 : 101; } delete n.preId; delete n.preLv; delete n.pcMax; }
  // 樹太小（< 55 點）就把上限 ≥5 的節點輪流 +1，讓 50 點不會用不完
  const big = nodes.filter(n => n.max >= 5 && !n.final), sum = () => nodes.reduce((t, n) => t + n.max, 0);
  for (let i = 0; big.length && sum() < 55; i++) big[i % big.length].max++;
  return nodes;
}

const out = { _說明: '項目 26／27 局外天賦樹。內容＝2u 資料站 PC 版技能樹：一轉 tree_1、二轉 tree_2（A）／tree_3（B），前置＝PC 前置，由 tools/build-talents.mjs 產生。一轉點數＝min(Job Lv, 50)、二轉點數＝Job Lv − 50。gate＝要求 Job Lv。eff＝每 1 級的效果。', gates: GATES, skillMod: { dmg: 0.08, cd: -0.03 }, jobs: {} };
for (const [jid, job] of Object.entries(JOBS)) {
  const raw = JSON.parse(fs.readFileSync(path.join(dir, `base_${jid}.json`), 'utf8')).infos.tree_1_data;
  const byId = Object.fromEntries(raw.map(s => [+s.skillid, s]));
  const nodes = [];
  for (const [id, name, col, eff, flags = ''] of MAP[job]) {
    const s = byId[id]; if (!s) throw new Error(`${job} 找不到 PC 技能 ${id} ${name}`);
    const [px, py] = s.zuobiao.split(' ').map(v => -parseInt(v));
    nodes.push({ id, name, col, row: gateOf(+s.req_lv), max: capOf(+s.maxlv), pcMax: +s.maxlv, pcReq: +s.req_lv,
      preId: +s.qianzhi_datas[1] || 0, preLv: +s.qianzhilv_datas[1] || 0, icon: [s.icon_bg, px, py], eff, final: flags.includes('F'), weapon: flags.includes('W') });
  }
  // 前置：只保留樹裡有的；要求等級照 PC 比例換算；子節點至少在父節點下一列
  const map = Object.fromEntries(nodes.map(n => [n.id, n]));
  const order = [...nodes].sort((a, b) => a.pcReq - b.pcReq);
  for (const n of order) {
    const p = map[n.preId];
    if (p) { n.pre = [p.id, Math.max(1, Math.min(p.max, Math.round(n.preLv / p.pcMax * p.max)))]; if (n.row <= p.row) n.row = Math.min(6, p.row + 1); }
  }
  for (const n of nodes) { delete n.preId; delete n.preLv; delete n.pcMax; delete n.pcReq; }
  // 樹太小（全點滿 < 65 點）就把上限 3 的節點升到 4，讓 50 點有取捨
  if (nodes.reduce((t, n) => t + n.max, 0) < 65) for (const n of nodes) if (n.max === 3 && !n.final) n.max = 4;
  // 最終天賦一律放在最後一列
  for (const n of nodes) if (n.final) n.row = 6;
  // 同一格（欄＋列）多個節點時依序排開
  for (const n of nodes) { n.gate = GATES[n.row]; delete n.row; }
  const total = nodes.reduce((t, n) => t + n.max, 0);
  const I = JSON.parse(fs.readFileSync(path.join(dir, `base_${jid}.json`), 'utf8')).infos;
  const branches = BR[job].map((b, i) => { const raw = I[i ? 'tree_3_data' : 'tree_2_data'];
    // 項目 40：三轉節點（2u Lv251 技能）接在同一棵樹，門檻 Job Lv 101（三轉後 Job 才會超過 100）
    const nodes = branchTree(raw, [...b.nodes, ...b.third.map(([id, name, eff, fl = '']) => [id, name, eff, fl + 'T'])]);
    return { key: b.key, name: b.name, third: b.thirdName, skills: b.skills, skill3: b.skill3, nodes }; });
  out.jobs[job] = { cols: COLS[job], nodes, branches };
  console.log(`${job}：一轉 ${nodes.length} 個天賦、全點滿 ${total} 點；` + branches.map(b => `${b.name} ${b.nodes.length} 個／${b.nodes.reduce((t, n) => t + n.max, 0)} 點`).join('、'));
}
// 11/20 使用者：「初心者的天賦應該要可以點，因為升級到 10 等才能轉職，所以他可以升級空手，也就是說連續技」
// → 初心者樹＝PC 初心者 tree_1 的「空手技」（base_0.json id 5，上限 5 級；其他是睡覺、交易、釣魚等生活技，割草版不收）；空手技等級決定連續技（照 PC 連續技表）
{ const s = JSON.parse(fs.readFileSync(path.join(dir, 'base_0.json'), 'utf8')).infos.tree_1_data.find(x => +x.skillid === 5);
  const [px, py] = s.zuobiao.split(' ').map(v => -parseInt(v));
  out.jobs['初心者'] = { cols: ['空手'], nodes: [{ id: 5, name: '空手技', col: 0, max: +s.maxlv, icon: [s.icon_bg, px, py], eff: { 'skill:b_novice': 1, atk: 0.02 }, final: false, weapon: true, gate: 0 }], branches: [] }; }
fs.writeFileSync(new URL('../assets/data/talents.json', import.meta.url), JSON.stringify(out, null, 1));
console.log('→ assets/data/talents.json');
