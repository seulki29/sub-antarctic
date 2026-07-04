import { VIEW_W, VIEW_H, DT, fitViewWidth, DIFFICULTY } from './constants.js';
import { GameScene } from './game.js';
import { drawText, textWidth } from './hud.js';
import { initAudio, setMuted, isMuted, startBgm } from './audio.js';
import { loadSave, clearSave } from './save.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

function resize() {
  fitViewWidth(window.innerWidth / window.innerHeight);
  if (canvas.width !== VIEW_W) canvas.width = VIEW_W;
  // fractional "contain" scaling — fills the screen; pixelated CSS keeps it crisp
  const s = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  canvas.style.width = VIEW_W * s + 'px';
  canvas.style.height = VIEW_H * s + 'px';
  ctx.imageSmoothingEnabled = false; // canvas resize resets context state
}
window.addEventListener('resize', resize);
resize();

let scene = {
  update(dt) {},
  draw(c) { c.fillStyle = '#04050e'; c.fillRect(0, 0, VIEW_W, VIEW_H); },
};
export function setScene(s) { scene = s; }
export function getCanvas() { return canvas; }

let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min((now - last) / 1000, 0.1);
  last = now;
  while (acc >= DT) { scene.update(DT); acc -= DT; }
  scene.draw(ctx);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function viewPos(e) {
  const r = canvas.getBoundingClientRect();
  const p = e.touches ? e.touches[0] : e;
  return { x: (p.clientX - r.left) / r.width * VIEW_W, y: (p.clientY - r.top) / r.height * VIEW_H };
}

function startGame(key, save = null) {
  initAudio();
  startBgm();
  const g = new GameScene(canvas, key, save);
  const t0 = performance.now();
  g.onClear = () => setScene(makeClear(g, (performance.now() - t0) / 1000));
  setScene(g);
}

function makeTitle() {
  let pulse = 0;
  let confirm = false;
  const save = loadSave();
  const snd = () => ({ x: 8, y: VIEW_H - 20, w: textWidth('SOUND OFF') + 8, h: 14 });
  const btn = i => ({ x: (VIEW_W - 200) / 2, y: 140 + i * 36, w: 200, h: 26 });
  const inBtn = (p, i) => {
    const b = btn(i);
    return p.x > b.x && p.x < b.x + b.w && p.y > b.y && p.y < b.y + b.h;
  };
  const detach = () => {
    canvas.removeEventListener('mousedown', onTap);
    canvas.removeEventListener('touchstart', onTap);
  };
  const onTap = e => {
    if (e.touches) e.preventDefault();
    initAudio();
    const p = viewPos(e), r = snd();
    if (p.x < r.x + r.w && p.y > r.y - 4) { setMuted(!isMuted()); return; }
    if (!save) { detach(); setScene(makeDifficulty()); return; }
    if (!confirm) {
      if (inBtn(p, 0)) { detach(); startGame(save.difficulty, save); }
      else if (inBtn(p, 1)) confirm = true;
    } else {
      if (inBtn(p, 0)) { clearSave(); detach(); setScene(makeDifficulty()); }
      else if (inBtn(p, 1)) confirm = false;
    }
  };
  canvas.addEventListener('mousedown', onTap);
  canvas.addEventListener('touchstart', onTap, { passive: false });
  return {
    update(dt) { pulse += dt; },
    draw(c) {
      const grad = c.createLinearGradient(0, 0, 0, VIEW_H);
      grad.addColorStop(0, '#12244c'); grad.addColorStop(1, '#04050e');
      c.fillStyle = grad; c.fillRect(0, 0, VIEW_W, VIEW_H);
      drawText(c, 'SUB-ANTARCTIC', (VIEW_W - textWidth('SUB-ANTARCTIC', 3)) / 2, 80, '#9fd0e0', 3);
      if (!save) {
        if (Math.floor(pulse * 2) % 2)
          drawText(c, 'CLICK OR TAP TO DIVE', (VIEW_W - textWidth('CLICK OR TAP TO DIVE')) / 2, 150, '#5a8ca0');
      } else if (!confirm) {
        const labels = [`CONTINUE - ${save.difficulty.toUpperCase()}`, 'NEW GAME'];
        labels.forEach((t, i) => {
          const b = btn(i);
          c.fillStyle = i === 0 ? '#2a5a78' : '#3a5468';
          c.fillRect(b.x, b.y, b.w, b.h);
          drawText(c, t, b.x + (b.w - textWidth(t)) / 2, b.y + 10, '#e0f0f4');
        });
        drawText(c, `BANKED ${save.banked}`, (VIEW_W - textWidth(`BANKED ${save.banked}`)) / 2, 218, '#9ff0f4');
      } else {
        drawText(c, 'OVERWRITE SAVE?', (VIEW_W - textWidth('OVERWRITE SAVE?', 2)) / 2, 118, '#e0b0b8', 2);
        const labels = ['YES - DELETE SAVE', 'NO - KEEP'];
        labels.forEach((t, i) => {
          const b = btn(i);
          c.fillStyle = i === 0 ? '#5a2a34' : '#3a5468';
          c.fillRect(b.x, b.y, b.w, b.h);
          drawText(c, t, b.x + (b.w - textWidth(t)) / 2, b.y + 10, '#e0f0f4');
        });
      }
      drawText(c, `SOUND ${isMuted() ? 'OFF' : 'ON'}`, 8, VIEW_H - 18, '#5a8ca0');
    },
  };
}

function makeDifficulty() {
  const rows = [
    { key: 'easy',   label: 'EASY' },
    { key: 'normal', label: 'NORMAL' },
    { key: 'hard',   label: 'HARD' },
  ];
  const btn = i => ({ x: (VIEW_W - 220) / 2, y: 92 + i * 40, w: 220, h: 30 });
  const onTap = e => {
    if (e.touches) e.preventDefault();
    const p = viewPos(e);
    for (let i = 0; i < rows.length; i++) {
      const b = btn(i);
      if (p.x > b.x && p.x < b.x + b.w && p.y > b.y && p.y < b.y + b.h) {
        canvas.removeEventListener('mousedown', onTap);
        canvas.removeEventListener('touchstart', onTap);
        startGame(rows[i].key);
        return;
      }
    }
  };
  canvas.addEventListener('mousedown', onTap);
  canvas.addEventListener('touchstart', onTap, { passive: false });
  return {
    update(dt) {},
    draw(c) {
      c.fillStyle = '#04050e'; c.fillRect(0, 0, VIEW_W, VIEW_H);
      drawText(c, 'SELECT DEPTH RATING', (VIEW_W - textWidth('SELECT DEPTH RATING', 2)) / 2, 52, '#9fd0e0', 2);
      rows.forEach((r, i) => {
        const b = btn(i), d = DIFFICULTY[r.key];
        c.fillStyle = ['#2a5a3a', '#2a5a78', '#5a2a34'][i];
        c.fillRect(b.x, b.y, b.w, b.h);
        drawText(c, r.label, b.x + 10, b.y + 6, '#e0f0f4', 2);
        drawText(c, `${d.hp} HEARTS ${d.nodes} ORE ${d.vents} AIR`, b.x + 10, b.y + 20, '#a0c8d8');
      });
    },
  };
}

function makeClear(game, seconds) {
  const onTap = () => {
    canvas.removeEventListener('mousedown', onTap);
    canvas.removeEventListener('touchstart', onTap);
    setScene(makeTitle());
  };
  setTimeout(() => {
    canvas.addEventListener('mousedown', onTap);
    canvas.addEventListener('touchstart', onTap);
  }, 800);
  return {
    update() {},
    draw(c) {
      c.fillStyle = '#04050e'; c.fillRect(0, 0, VIEW_W, VIEW_H);
      drawText(c, 'DIVE COMPLETE!', (VIEW_W - textWidth('DIVE COMPLETE!', 2)) / 2, 90, '#ffd870', 2);
      drawText(c, `CRYSTALS BANKED ${game.player.banked}`, (VIEW_W - textWidth(`CRYSTALS BANKED ${game.player.banked}`)) / 2, 130, '#9ff0f4');
      drawText(c, `TIME ${Math.round(seconds)}S`, (VIEW_W - textWidth(`TIME ${Math.round(seconds)}S`)) / 2, 145, '#9ff0f4');
      drawText(c, 'TAP TO TITLE', (VIEW_W - textWidth('TAP TO TITLE')) / 2, 190, '#5a8ca0');
    },
  };
}

setScene(makeTitle());
