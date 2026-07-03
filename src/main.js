import { VIEW_W, VIEW_H, DT } from './constants.js';

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
  update() {},
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
