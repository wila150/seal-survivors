// PC 等差掉寶率（2u news id=9，台服表）：角色等級和怪物等級差太多（高於或低於），經驗與道具掉落率打折
// 鐵匠不受「道具掉落率」影響（經驗照樣受影響）；PC 爆破士例外，割草版鐵匠二轉沒有爆破士 → 鐵匠一律不受影響
// 割草版：差距＝|Base Lv − 這局怪物等級（難度滑桿選的）|（本作怪物等級和 Base Lv 同一套數字）
const EXP = [[29, 1], [34, 0.95], [39, 0.85], [44, 0.75], [54, 0.65], [59, 0.35], [Infinity, 0.05]];
const DROP = [[29, 1], [34, 0.95], [39, 0.85], [44, 0.75], [49, 0.65], [54, 0.35], [Infinity, 0.05]];
const pick = (T, gap) => T.find(([max]) => Math.abs(gap) <= max)[1];
export const gapExp = gap => pick(EXP, gap);
export const gapDrop = (gap, job) => job === '鐵匠' ? 1 : pick(DROP, gap);
