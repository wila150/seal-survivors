// 物件池：怪物、經驗寶石、傷害數字回收重用（戰鬥中不一直 new／dispose）
// 介面照 FxPool：get()／release()／update(dt)／clear()

// 3D 物件池：依 key 分開放（例如怪物「種類|精英|首領」），用完從場景拿掉、放回池子
export class MeshPool {
  constructor(scene, name = '') { this.scene = scene; this.name = name; this.free = new Map(); this.active = 0; }
  get(key, create) {
    const m = this.free.get(key)?.pop() ?? create();
    m.userData.poolKey = key; m.visible = true; this.scene.add(m); this.active++;
    return m;
  }
  release(m) {
    this.scene.remove(m); this.active--;
    const k = m.userData.poolKey; (this.free.get(k) || this.free.set(k, []).get(k)).push(m);
  }
  update() {}
  // 清空：池子裡閒置的物件丟掉（場景上的要先 release）
  clear() { this.free.clear(); }
  get idle() { let n = 0; for (const l of this.free.values()) n += l.length; return n; }
}

// DOM 物件池（傷害數字）：最多 max 個，用完藏起來下次再用
export class DomPool {
  constructor(parent, max = 40) { this.parent = parent; this.max = max; this.free = []; this.active = 0; }
  get() {
    if (this.active >= this.max) return null;
    let el = this.free.pop();
    if (!el) { el = document.createElement('div'); this.parent.appendChild(el); }
    el.style.display = ''; this.active++;
    return el;
  }
  release(el) { el.style.display = 'none'; this.free.push(el); this.active--; }
  update() {}
  clear() { for (const el of this.free) el.remove(); this.free.length = 0; }
}
