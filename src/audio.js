let ac = null;
export function initAudio() {
  if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
  if (ac.state === 'suspended') ac.resume();
}

function tone(freq, dur, type = 'square', vol = 0.12, slide = 0) {
  if (!ac) return;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = freq;
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), ac.currentTime + dur);
  g.gain.value = vol;
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
  o.connect(g).connect(ac.destination);
  o.start(); o.stop(ac.currentTime + dur);
}

export const sfx = {
  shoot: () => tone(880, 0.07, 'square', 0.08, -500),
  hit: () => tone(220, 0.09, 'sawtooth', 0.1),
  hurt: () => tone(110, 0.25, 'sawtooth', 0.14, -60),
  pickup: () => tone(1320, 0.06, 'sine', 0.1, 300),
  bank: () => { tone(660, 0.08, 'sine', 0.1); setTimeout(() => tone(990, 0.1, 'sine', 0.1), 90); },
  buy: () => { tone(520, 0.08, 'square', 0.08); setTimeout(() => tone(1040, 0.12, 'square', 0.08), 100); },
  boom: () => tone(70, 0.5, 'sawtooth', 0.18, -30),
  denied: () => tone(140, 0.12, 'square', 0.08),
};
