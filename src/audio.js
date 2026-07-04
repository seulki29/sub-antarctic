let ac = null, master = null, sfxGain = null, bgm = null, mutedFlag = false;

export function initAudio() {
  if (!ac) {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain();
    master.connect(ac.destination);
    sfxGain = ac.createGain();
    sfxGain.connect(master);
    mutedFlag = typeof localStorage !== 'undefined' && localStorage.getItem('snd') === 'off';
    master.gain.value = mutedFlag ? 0 : 1;
  }
  if (ac.state === 'suspended') ac.resume();
}

export function isMuted() { return mutedFlag; }

export function setMuted(m) {
  mutedFlag = m;
  if (typeof localStorage !== 'undefined') localStorage.setItem('snd', m ? 'off' : 'on');
  if (master) master.gain.setTargetAtTime(m ? 0 : 1, ac.currentTime, 0.05);
}

function tone(freq, dur, type = 'square', vol = 0.12, slide = 0) {
  if (!ac) return;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = freq;
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), ac.currentTime + dur);
  g.gain.value = vol;
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
  o.connect(g).connect(sfxGain);
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

// ---- procedural deep-sea BGM -------------------------------------------
export function startBgm() {
  if (!ac || bgm) return;
  const out = ac.createGain(); out.gain.value = 0.9; out.connect(master);
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 240; lp.connect(out);
  const droneGain = ac.createGain(); droneGain.gain.value = 0.05; droneGain.connect(lp);
  const o1 = ac.createOscillator(); o1.type = 'sine'; o1.frequency.value = 55;
  const o2 = ac.createOscillator(); o2.type = 'sine'; o2.frequency.value = 55.7;
  o1.connect(droneGain); o2.connect(droneGain);
  o1.start(); o2.start();
  bgm = { out, lp, droneGain, o1, o2, mode: 'calm', timer: null };
  scheduleSwell();
}

function scheduleSwell() {
  if (!bgm) return;
  const wait = bgm.mode === 'calm' ? 7000 + Math.random() * 5000 : 3000 + Math.random() * 2000;
  bgm.timer = setTimeout(() => { swell(); scheduleSwell(); }, wait);
}

function swell() {
  if (!bgm) return;
  const scale = bgm.mode === 'calm'
    ? [110, 130.8, 146.8, 164.8, 196]      // A minor pentatonic-ish
    : [116.5, 138.6, 155.6, 185];          // tense, semitone-shifted
  const f = scale[Math.floor(Math.random() * scale.length)];
  const dur = bgm.mode === 'calm' ? 4 : 2;
  const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
  const g = ac.createGain(); g.gain.value = 0;
  const t = ac.currentTime;
  g.gain.linearRampToValueAtTime(0.035, t + dur / 2);
  g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(g); g.connect(bgm.lp);
  o.start(t); o.stop(t + dur);
}

export function setBgmMode(mode) {
  if (!bgm || bgm.mode === mode) return;
  bgm.mode = mode;
  const t = ac.currentTime;
  bgm.o1.frequency.setTargetAtTime(mode === 'boss' ? 58.3 : 55, t, 1);
  bgm.o2.frequency.setTargetAtTime(mode === 'boss' ? 59.1 : 55.7, t, 1);
  bgm.droneGain.gain.setTargetAtTime(mode === 'boss' ? 0.07 : 0.05, t, 1);
}

export function stopBgm() {
  if (!bgm) return;
  clearTimeout(bgm.timer);
  try { bgm.o1.stop(); bgm.o2.stop(); } catch { /* already stopped */ }
  bgm.out.disconnect();
  bgm = null;
}
