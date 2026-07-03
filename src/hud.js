import { VIEW_W, VIEW_H, UPGRADES, PLAYER as P } from './constants.js';

const F = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011',
  D: '110101101101110', E: '111100110100111', F: '111100110100100',
  G: '011100101101011', H: '101101111101101', I: '111010010010111',
  J: '001001001101010', K: '101110100110101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101011001', R: '110101110110101',
  S: '011100010001110', T: '111010010010010', U: '101101101101011',
  V: '101101101010010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111',
  0: '010101101101010', 1: '010110010010111', 2: '110001010100111',
  3: '110001010001110', 4: '101101111001001', 5: '111100110001110',
  6: '011100110101010', 7: '111001010010010', 8: '111101111101111',
  9: '010101011001110',
  ' ': '000000000000000', '-': '000000111000000', '+': '000010111010000',
  '!': '010010010000010', '.': '000000000000010',
};

export function drawText(ctx, s, x, y, color, scale = 1) {
  ctx.fillStyle = color;
  let cx = x;
  for (const ch of String(s).toUpperCase()) {
    const pat = F[ch];
    if (pat) for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++)
      if (pat[j * 3 + i] === '1') ctx.fillRect(cx + i * scale, y + j * scale, scale, scale);
    cx += 4 * scale;
  }
}
export function textWidth(s, scale = 1) { return String(s).length * 4 * scale; }

export function drawHud(ctx, player) {
  // O2 bar
  ctx.fillStyle = '#080a14'; ctx.fillRect(6, 6, 62, 7);
  ctx.strokeStyle = '#5a788c'; ctx.strokeRect(5.5, 5.5, 63, 8);
  const frac = player.o2 / player.o2Max();
  ctx.fillStyle = frac < 0.25 ? '#e05a5a' : '#5ac8e6';
  ctx.fillRect(7, 7, Math.round(60 * frac), 5);
  drawText(ctx, 'O2', 72, 7, '#8cc8dc');
  // hearts
  for (let i = 0; i < P.HP_MAX; i++) {
    ctx.fillStyle = i < player.hp ? '#e64656' : '#2a1e2c';
    const x = 6 + i * 9;
    ctx.fillRect(x, 17, 3, 3); ctx.fillRect(x + 4, 17, 3, 3);
    ctx.fillRect(x + 1, 20, 5, 2); ctx.fillRect(x + 2, 22, 3, 1);
  }
  // crystals
  ctx.fillStyle = '#5ae0e6';
  ctx.fillRect(6, 27, 3, 5); ctx.fillRect(7, 26, 1, 7);
  drawText(ctx, `${player.carried}+${player.banked}`, 13, 27, '#9ff0f4');
  // depth
  const depth = Math.max(0, Math.round(player.y / 4));
  const label = `DEPTH ${depth}M`;
  drawText(ctx, label, VIEW_W - textWidth(label) - 6, 7, '#78a0be');
  if (player.hasRelic) drawText(ctx, 'RELIC!', VIEW_W - 30, 17, '#ffd870');
}

export function drawBossBar(ctx, name, frac) {
  const bw = 180, x0 = (VIEW_W - bw) / 2, y0 = VIEW_H - 20;
  drawText(ctx, name, (VIEW_W - textWidth(name)) / 2, y0 - 8, '#dcbec8');
  ctx.fillStyle = '#0a060e'; ctx.fillRect(x0, y0, bw, 7);
  ctx.strokeStyle = '#78465a'; ctx.strokeRect(x0 - 0.5, y0 - 0.5, bw + 1, 8);
  ctx.fillStyle = '#be3246';
  ctx.fillRect(x0 + 1, y0 + 1, Math.round((bw - 2) * Math.max(0, frac)), 5);
}

export class UpgradeMenu {
  constructor() { this.open = false; }

  layout(player) {
    const keys = Object.keys(UPGRADES);
    const bw = 190, bh = 26, x = (VIEW_W - bw) / 2;
    const btns = keys.map((key, i) => {
      const u = UPGRADES[key];
      return {
        key, x, y: 70 + i * (bh + 8), w: bw, h: bh,
        label: u.label, cost: u.cost,
        owned: player.upgrades[key], affordable: player.banked >= u.cost,
      };
    });
    btns.push({ key: 'close', x, y: 70 + keys.length * (bh + 8), w: bw, h: 20, label: 'CLOSE' });
    return btns;
  }

  click(x, y, player) {
    if (!this.open) return null;
    for (const b of this.layout(player)) {
      if (x < b.x || x > b.x + b.w || y < b.y || y > b.y + b.h) continue;
      if (b.key === 'close') { this.open = false; return 'closed'; }
      if (player.buyUpgrade(b.key)) return 'bought';
      return null;
    }
    return null;
  }

  draw(ctx, player) {
    if (!this.open) return;
    ctx.fillStyle = 'rgba(4,6,14,0.85)';
    ctx.fillRect(100, 40, VIEW_W - 200, 190);
    ctx.strokeStyle = '#4a7890';
    ctx.strokeRect(100.5, 40.5, VIEW_W - 200, 190);
    drawText(ctx, 'SUBMARINE - UPGRADES', (VIEW_W - textWidth('SUBMARINE - UPGRADES', 2)) / 2, 48, '#9fd0e0', 2);
    for (const b of this.layout(player)) {
      const col = b.key === 'close' ? '#3a5468' : b.owned ? '#2a4a3a' : b.affordable ? '#2a5a78' : '#28303c';
      ctx.fillStyle = col;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      const txt = b.key === 'close' ? 'CLOSE'
        : b.owned ? `${b.label} - OK`
        : `${b.label} - ${b.cost} CRYSTAL`;
      drawText(ctx, txt, b.x + 8, b.y + (b.h - 5) / 2, b.owned ? '#8ce0a8' : '#d0e8f0');
    }
    drawText(ctx, `BANKED ${player.banked}`, 108, 214, '#9ff0f4');
  }
}
