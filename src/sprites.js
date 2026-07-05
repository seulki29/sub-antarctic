// procedural sprite baking — runs once at load
function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
function g2(c) { const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return g; }

export function bakePixelArt(rows, legend) {
  const c = mk(rows[0].length, rows.length), g = g2(c);
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.' || !legend[ch]) return;
    g.fillStyle = legend[ch];
    g.fillRect(x, y, 1, 1);
  }));
  return c;
}

export function outline(c, color = '#05040a') {
  const g = g2(c), { width: w, height: h } = c;
  const img = g.getImageData(0, 0, w, h), d = img.data;
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 40;
  const mark = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)))
      mark.push([x, y]);
  }
  g.fillStyle = color;
  for (const [x, y] of mark) g.fillRect(x, y, 1, 1);
  return c;
}

function poly(g, pts, fill) {
  g.fillStyle = fill;
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) g.lineTo(p[0], p[1]);
  g.closePath(); g.fill();
}
function ell(g, x, y, rx, ry, fill) {
  g.fillStyle = fill;
  g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
}

// diver (approved sample art, 28x12, facing right)
const DIVER_ROWS = [
  '..................KKKKK.....',
  '.......KKK.......KHHHHHK....',
  '......KTTtK.....KHHGGGGgK...',
  '......KTTtK....KHhGGggggK...',
  '...KK.KTTtKKKKKKoHGGggggKL..',
  '..KFFKohooooooooohKGGGGKKL..',
  '.KFFFKoodooodoooooKKKKKK....',
  '..KFFKoodooodooooooooK......',
  '...KKKohoooooooKoooooK......',
  '......KKoodooKKKKoodoK......',
  '........KKKKK...KooooK......',
  '.................KKKK.......',
];
const DIVER_LEGEND = {
  K: '#05040a', o: '#de7e30', d: '#9c4c22', h: '#fab264',
  H: '#a8b2be', G: '#78dceb', g: '#d7fafc',
  T: '#c4ae5a', t: '#827038', F: '#3c5a70', L: '#ffecaa',
};

function bakeDiver() {
  const r = bakePixelArt(DIVER_ROWS, DIVER_LEGEND);
  const l = mk(r.width, r.height), g = g2(l);
  g.scale(-1, 1); g.drawImage(r, -r.width, 0);
  return { diverR: r, diverL: l };
}

function bakeJelly() {
  const c = mk(14, 16), g = g2(c);
  ell(g, 7, 5, 6, 4, 'rgba(190,140,255,0.85)');
  ell(g, 7, 4, 4, 2, 'rgba(240,210,255,0.9)');
  g.strokeStyle = 'rgba(190,140,255,0.5)';
  for (let i = 0; i < 5; i++) {
    g.beginPath(); g.moveTo(2.5 + i * 2.2, 8);
    g.lineTo(2.5 + i * 2.2 + (i % 2), 14 + (i % 3)); g.stroke();
  }
  return outline(c, 'rgba(40,20,60,0.6)');
}

function bakeMoray() { // head + neck, facing right at rest
  const c = mk(26, 12), g = g2(c);
  poly(g, [[0, 4], [14, 2], [24, 5], [24, 9], [14, 10], [0, 8]], '#2e5040');
  poly(g, [[14, 3], [24, 5], [24, 9], [14, 9]], '#3e6852');
  ell(g, 19, 5, 1.5, 1.5, '#ffd050');
  g.fillStyle = '#101a14'; g.fillRect(19, 5, 1, 1);
  poly(g, [[24, 5], [26, 6], [24, 7]], '#e8f0ee'); // tooth tip
  return outline(c);
}

function bakeFish() {
  const c = mk(8, 5), g = g2(c);
  poly(g, [[0, 2], [2, 0], [6, 2], [2, 4]], '#4a6a94');
  poly(g, [[6, 2], [8, 0], [8, 4]], '#3a5478');
  g.fillStyle = '#c0e0f0'; g.fillRect(2, 1, 1, 1);
  return outline(c);
}

const GEM_TONES = {
  crystal: { dark: '#38b8c0', main: '#5ae0e6', hi: '#b8f8fa' },
  pearl:   { dark: '#c8a8b8', main: '#f0dce6', hi: '#ffffff' },
  abyss:   { dark: '#c04828', main: '#ff7a50', hi: '#ffd0a0' },
  magma:   { dark: '#b84a10', main: '#ff9a30', hi: '#ffe0a0' },
};

function bakeGem(t) {
  const c = mk(7, 9), g = g2(c);
  poly(g, [[3, 0], [6, 4], [3, 8], [0, 4]], t.main);
  poly(g, [[3, 0], [6, 4], [3, 4]], t.hi);
  return outline(c);
}

function bakeNodeKind(t) {
  const c = mk(16, 12), g = g2(c);
  poly(g, [[2, 11], [4, 4], [7, 11]], t.dark);
  poly(g, [[6, 11], [9, 1], [12, 11]], t.main);
  poly(g, [[10, 11], [13, 6], [15, 11]], t.dark);
  poly(g, [[8, 4], [9, 1], [10, 4]], t.hi);
  return outline(c);
}

function bakeRelic() {
  const c = mk(10, 12), g = g2(c);
  poly(g, [[2, 11], [8, 11], [7, 3], [3, 3]], '#c8a84a');
  g.fillStyle = '#ffe9a0'; g.fillRect(4, 5, 2, 2);
  ell(g, 5, 2, 2, 2, '#c8a84a');
  return outline(c);
}

function bakeRocks() {
  const out = [];
  for (let v = 0; v < 4; v++) {
    const c = mk(16, 16), g = g2(c);
    g.fillStyle = '#0a1226'; g.fillRect(0, 0, 16, 16);
    g.fillStyle = '#111c38';
    for (let i = 0; i < 6; i++) {
      const h = (v * 31 + i * 47) % 13;
      g.fillRect((i * 3 + v) % 14, h, 2 + (i % 2), 2);
    }
    g.fillStyle = '#060a18';
    for (let i = 0; i < 5; i++) {
      const h = (v * 17 + i * 71) % 13;
      g.fillRect((i * 5 + v * 2) % 14, h, 2, 1 + (i % 2));
    }
    out.push(c);
  }
  return out;
}

function bakeAngler() {
  const w = 130, h = 96, c = mk(w, h), g = g2(c);
  const cx = w * 0.56, cy = h * 0.52;
  const base = '#38223e', shade = '#26162c', hi = '#56385c',
        mouth = '#100510', teeth = '#e8f0ee';
  poly(g, [[w * 0.86, cy], [w - 2, cy - 26], [w * 0.93, cy], [w - 2, cy + 26]], shade);
  poly(g, [[cx - 6, cy - 34], [cx + 16, cy - 52], [cx + 30, cy - 30]], shade);
  poly(g, [[cx + 2, cy + 32], [cx + 20, cy + 48], [cx + 32, cy + 28]], shade);
  ell(g, cx, cy, 45, 36, base);
  poly(g, [[cx - 44, cy - 2], [cx - 4, cy - 10], [cx - 8, cy + 16], [cx - 46, cy + 22]], mouth);
  poly(g, [[cx - 46, cy + 22], [cx - 8, cy + 16], [cx - 2, cy + 30], [cx - 38, cy + 34]], shade);
  poly(g, [[cx - 48, cy - 4], [cx - 6, cy - 14], [cx + 2, cy - 30], [cx - 34, cy - 22]], base);
  for (let i = 0; i < 7; i++) {
    const tx = cx - 42 + i * 6;
    poly(g, [[tx, cy - 3], [tx + 3, cy - 3], [tx + 1, cy + 4]], teeth);
  }
  for (let i = 0; i < 6; i++) {
    const tx = cx - 40 + i * 6.4;
    poly(g, [[tx, cy + 20], [tx + 3, cy + 20], [tx + 1, cy + 14]], teeth);
  }
  ell(g, cx + 2, cy - 18, 4, 4, '#ffcc5a');
  ell(g, cx + 3, cy - 18, 1.5, 2, '#0a060a');
  poly(g, [[cx + 14, cy + 6], [cx + 34, cy + 20], [cx + 30, cy - 2]], hi);
  g.strokeStyle = shade; g.lineWidth = 2;
  g.beginPath(); g.moveTo(cx - 20, cy - 26);
  g.quadraticCurveTo(cx - 40, cy - 70, cx - 54, cy - 62); g.stroke();
  outline(c);
  return { canvas: c, lure: { x: cx - 54, y: cy - 64 } };
}

function bakeCrawler() {
  const c = mk(70, 40), g = g2(c);
  for (let i = 0; i < 4; i++)
    poly(g, [[8 + i * 15, 34], [12 + i * 15, 24], [16 + i * 15, 34], [14 + i * 15, 39], [10 + i * 15, 39]], '#7a2818');
  ell(g, 35, 22, 30, 14, '#a03820');
  ell(g, 35, 18, 26, 10, '#c05028');
  g.fillStyle = '#ffb040';
  for (const [vx, vy] of [[24, 13], [34, 10], [44, 13]]) g.fillRect(vx, vy, 3, 3);
  poly(g, [[2, 26], [11, 19], [11, 31]], '#a03820');
  poly(g, [[68, 26], [59, 19], [59, 31]], '#a03820');
  g.fillStyle = '#ffe0a0';
  g.fillRect(27, 21, 2, 2); g.fillRect(41, 21, 2, 2);
  return outline(c);
}

export function bakeSprites() {
  return {
    ...bakeDiver(),
    jelly: bakeJelly(), moray: bakeMoray(), fish: bakeFish(),
    gems: Object.fromEntries(Object.entries(GEM_TONES).map(([k, t]) => [k, bakeGem(t)])),
    nodes: Object.fromEntries(Object.entries(GEM_TONES).map(([k, t]) => [k, bakeNodeKind(t)])),
    relic: bakeRelic(),
    rock: bakeRocks(), angler: bakeAngler(), crawler: bakeCrawler(),
  };
}
