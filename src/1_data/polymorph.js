// PC 變身系統（2u news id=67）。資料照服務端：
//   藥水＝item.scr（類別 3：第 5 欄名聲限制、第 82 欄變身編號、第 76 欄持續 30 分、第 35 欄售價）
//   能力＝Game/scripts/polymorph.scr（編號|怪物外觀|HP|AP|攻擊力|魔法力|防禦力|?|命中率|必殺技|回避率|移動速度）
//   外觀＝怪物外觀編號 → monster.scr 第 17 欄 → modelinfo.scr 模型（客戶端 monster/，tools/build-mobs.mjs 轉成會動的模型）
// PC 規則：喝了變身＋屬性增加、HP 回滿；可以放技能、連續技；登出或過傳點結束；恢復原狀變身藥水解除
// 割草版：在主城喝 → 下一次出征整局變身（PC 30 分鐘 ≥ 一局），出征結束就恢復；只收道具店（獅子城 拿坡里）有賣的 6 種
export const POLY = {
  poly1: { pc: 11677, id: 1, name: '小碗豆變身藥水', mob: '小豌豆', model: 'T_gr1', fame: 370, price: 1000, st: [100, 50, 5, 5, 5, 5, 5, 5, 3] },
  poly2: { pc: 11678, id: 2, name: '蘑菇妹妹變身藥水', mob: '蘑菇妹妹', model: 'T_mu2', fame: 5007, price: 1600, st: [150, 100, 8, 5, 5, 5, 7, 6, 4] },
  poly3: { pc: 11679, id: 3, name: '菜頭王變身藥水', mob: '菜頭王', model: 'T_gr3', fame: 8441, price: 2400, st: [200, 150, 11, 5, 5, 5, 9, 7, 5] },
  poly4: { pc: 11680, id: 4, name: '拳擊毛毛蟲變身藥水', mob: '拳擊毛毛蟲', model: 'T_sw1', fame: 14280, price: 3400, st: [250, 200, 14, 5, 5, 5, 11, 8, 6] },
  poly5: { pc: 11681, id: 5, name: '熊寶寶變身藥水', mob: '熊寶寶', model: 'T_Be3', fame: 24207, price: 4600, st: [300, 250, 17, 5, 5, 5, 13, 9, 7] },
  poly6: { pc: 11682, id: 6, name: '小妖姬變身藥水', mob: '小妖姬', model: 'T_wd', fame: 41082, price: 6000, st: [350, 300, 20, 5, 5, 5, 15, 10, 8] },
}; // st＝[HP, AP, 攻擊力, 魔法力, 防禦力, 命中率, 必殺技, 回避率, 移動速度]
export const POLY_ICON = 2574, UNPOLY_ICON = 2575; // item.scr 圖示：變身藥水／恢復原狀變身藥水
export const polyText = k => { const s = POLY[k]?.st; return s ? `攻擊力 +${s[2]}、魔法力 +${s[3]}、防禦力 +${s[4]}、命中率 +${s[5]}、必殺技 +${s[6]}、回避率 +${s[7]}、移動速度 +${s[8]}、HP +${s[0]}、AP +${s[1]}` : ''; };
// 換算成割草版（🔢 跟戰鬥力排名 BUFF 同一套：PC 固定值 N → +N/10 %）：攻擊力→傷害、魔法力→技能傷害、必殺技→爆擊率、回避率→迴避、移動速度→移速、HP→最大 HP；
// 防禦力 N → 護甲 +N/5；命中率（割草版不會打不中）、AP（沒有 AP）不生效
export function applyPoly(P, k) {
  const s = POLY[k]?.st; if (!s) return null;
  P.maxHp = Math.round(P.maxHp * (1 + s[0] / 1000)); P.hp = P.maxHp; P.might *= 1 + s[2] / 1000; P.skd = (P.skd || 0) + s[3] / 1000; P.armor += s[4] / 5;
  P.crit += s[6] / 1000; P.dodge = Math.min(0.4, (P.dodge || 0) + s[7] / 1000); P.speed *= 1 + s[8] / 1000; return POLY[k];
}
