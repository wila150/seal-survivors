// 背景音樂音量（11/21 使用者：「手機設定把背景音樂拉到 0 還是有聲音」）
// iPhone／iPad 的 Safari 不准網頁改 <audio>.volume（永遠 100%）→ 改用 Web Audio 的 GainNode 控制音量；
// 拉到 0 時另外設 muted（iOS 有吃），連 Web Audio 還沒啟動前也不會出聲
const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const routed = new WeakMap();
export function setBgmVol(audio, v, ac) {
  v = Math.max(0, Math.min(1, v));
  audio.muted = v <= 0.001;
  if (!IOS) { audio.volume = v; return; }
  let g = routed.get(audio);
  if (!g) {
    try {
      ac = ac || (setBgmVol.ac ??= new (window.AudioContext || window.webkitAudioContext)());
      const src = ac.createMediaElementSource(audio); g = ac.createGain(); src.connect(g).connect(ac.destination); routed.set(audio, g);
      const wake = () => { if (ac.state !== 'running') ac.resume().catch(() => {}); };
      addEventListener('pointerdown', wake); addEventListener('touchend', wake); addEventListener('keydown', wake); wake();
    } catch (e) { audio.volume = v; return; }
  }
  g.gain.value = v;
}
