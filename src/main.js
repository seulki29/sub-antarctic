import { VIEW_W, VIEW_H, DT } from './constants.js';
import { GameScene } from './game.js';
import { drawText, textWidth } from './hud.js';
import { initAudio } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

function resize() {
  const s = Math.max(1, Math.floor(Math.min(
    window.innerWidth / VIEW_W, window.innerHeight / VIEW_H)));
  canvas.style.width = VIEW_W * s + 'px';
  canvas.style.height = VIEW_H * s + 'px';
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

function makeTitle() {
  let pulse = 0;
  const start = () => {
    initAudio();
    const g = new GameScene(canvas);
    const t0 = performance.now();
    g.onClear = () => setScene(makeClear(g, (performance.now() - t0) / 1000));
    setScene(g);
  };
  const onTap = () => { canvas.removeEventListener('mousedown', onTap); canvas.removeEventListener('touchstart', onTap); start(); };
  canvas.addEventListener('mousedown', onTap);
  canvas.addEventListener('touchstart', onTap);
  return {
    update(dt) { pulse += dt; },
    draw(c) {
      const grad = c.createLinearGradient(0, 0, 0, VIEW_H);
      grad.addColorStop(0, '#12244c'); grad.addColorStop(1, '#04050e');
      c.fillStyle = grad; c.fillRect(0, 0, VIEW_W, VIEW_H);
      drawText(c, 'SUB-ANTARCTIC', (VIEW_W - textWidth('SUB-ANTARCTIC', 3)) / 2, 90, '#9fd0e0', 3);
      if (Math.floor(pulse * 2) % 2)
        drawText(c, 'CLICK OR TAP TO DIVE', (VIEW_W - textWidth('CLICK OR TAP TO DIVE')) / 2, 150, '#5a8ca0');
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
