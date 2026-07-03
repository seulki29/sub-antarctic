# -*- coding: utf-8 -*-
"""Deep-sea pixel-art sample scene renderer.

Renders two mood samples (exploration / combat) at 480x270 internal
resolution, then upscales 3x with nearest-neighbor for crisp pixels.
Pipeline: dithered background -> parallax silhouettes -> sprites ->
lightmap (ambient + headlamp cone + point lights) -> emissive + bloom
-> particles -> HUD -> upscale.
"""

import math
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H = 480, 270
SCALE = 3

# ---------------------------------------------------------------- palette
DEEP_RAMP = [
    (4, 5, 14), (6, 9, 24), (9, 15, 38), (13, 24, 56),
    (19, 36, 78), (28, 52, 100),
]
ROCK_FAR = (17, 27, 56)
ROCK_MID = (11, 18, 40)
ROCK_NEAR = (6, 10, 24)
OUTLINE = (5, 4, 10)

BAYER4 = np.array([
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
], dtype=np.float32) / 16.0


def bayer_tile():
    ty = (H + 3) // 4
    tx = (W + 3) // 4
    return np.tile(BAYER4, (ty, tx))[:H, :W]


def dithered_gradient(ramp, top=0.0, bottom=1.0):
    """Vertical gradient dithered through a color ramp (ordered dithering)."""
    ys = np.linspace(top, bottom, H, dtype=np.float32)[:, None]
    v = np.repeat(ys, W, axis=1) * (len(ramp) - 1)
    thr = bayer_tile()
    idx = np.floor(v).astype(int)
    frac = v - idx
    idx = np.clip(idx + (frac > thr).astype(int), 0, len(ramp) - 1)
    ramp_np = np.array(ramp, dtype=np.float32) / 255.0
    return ramp_np[idx]


# ---------------------------------------------------------------- terrain
def ridge_heights(seed, base_y, amp, rough):
    rng = random.Random(seed)
    phases = [rng.uniform(0, math.tau) for _ in range(4)]
    freqs = [rng.uniform(0.004, 0.012) * (i + 1) for i in range(4)]
    hs = []
    walk = 0.0
    for x in range(W):
        v = sum(math.sin(x * f + p) for f, p in zip(freqs, phases)) / 4
        walk += rng.uniform(-rough, rough)
        walk *= 0.98
        hs.append(int(base_y + v * amp + walk))
    return hs


def draw_terrain(draw, seed, base_y, amp, rough, color, spikes=0):
    hs = ridge_heights(seed, base_y, amp, rough)
    pts = [(0, H)] + [(x, hs[x]) for x in range(W)] + [(W, H)]
    draw.polygon(pts, fill=color + (255,))
    rng = random.Random(seed + 99)
    for _ in range(spikes):  # rocky spires
        x = rng.randrange(10, W - 10)
        top = hs[x] - rng.randrange(14, 40)
        w = rng.randrange(4, 12)
        draw.polygon([(x - w, hs[x] + 4), (x, top), (x + w, hs[x] + 4)],
                     fill=color + (255,))


def draw_stalactites(draw, seed, color, n=14):
    rng = random.Random(seed)
    draw.rectangle([0, 0, W, rng.randrange(4, 10)], fill=color + (255,))
    for _ in range(n):
        x = rng.randrange(0, W)
        length = rng.randrange(10, 46)
        w = rng.randrange(3, 10)
        draw.polygon([(x - w, 0), (x + w, 0), (x, length)], fill=color + (255,))


# ---------------------------------------------------------------- flora
def draw_kelp(albedo, emissive, seed, ground_y_fn, n=10):
    d = ImageDraw.Draw(albedo)
    e = ImageDraw.Draw(emissive)
    rng = random.Random(seed)
    for _ in range(n):
        x = rng.randrange(6, W - 6)
        gy = ground_y_fn(x)
        if gy > H - 4:
            continue
        length = rng.randrange(18, 44)
        sway = rng.uniform(1.5, 4.0)
        pts = []
        for t in range(length):
            px = x + math.sin(t * 0.18 + rng.random()) * sway * (t / length)
            pts.append((px, gy - t))
        col = (22, 58 + rng.randrange(26), 70)
        for i in range(len(pts) - 1):
            d.line([pts[i], pts[i + 1]], fill=col + (255,), width=1)
        # bioluminescent tip
        tx, ty = pts[-1]
        tip = rng.choice([(120, 240, 220), (150, 220, 255), (200, 160, 255)])
        e.point((tx, ty), fill=tip + (255,))
        e.point((tx, ty - 1), fill=tip + (180,))


def draw_jellyfish(emissive, x, y, size, col):
    e = ImageDraw.Draw(emissive)
    e.ellipse([x - size, y - size // 2, x + size, y + size // 2],
              fill=col + (150,))
    e.ellipse([x - size + 1, y - size // 2 + 1, x + size - 1, y],
              fill=col + (60,))
    for i in range(-size + 2, size - 1, 2):
        ln = size + (i % 3) * 2
        e.line([(x + i, y + size // 2 - 1), (x + i, y + size // 2 + ln)],
               fill=col + (70,), width=1)


def draw_coral(albedo, emissive, seed, ground_y_fn, n=7):
    """Warm bioluminescent coral / anemone clusters on the seafloor."""
    d = ImageDraw.Draw(albedo)
    e = ImageDraw.Draw(emissive)
    rng = random.Random(seed)
    warm = [(255, 140, 90), (255, 100, 130), (255, 190, 110),
            (170, 120, 255)]
    for _ in range(n):
        x = rng.randrange(8, W - 8)
        gy = ground_y_fn(x)
        if gy > H - 3:
            continue
        col = rng.choice(warm)
        branches = rng.randrange(3, 6)
        for b in range(branches):
            bx = x + b - branches // 2
            ln = rng.randrange(3, 7)
            d.line([(bx, gy), (bx, gy - ln)],
                   fill=(col[0] // 3, col[1] // 3, col[2] // 3, 255))
            e.point((bx, gy - ln), fill=col + (230,))
            if rng.random() < 0.5:
                e.point((bx, gy - ln - 1), fill=col + (120,))


def draw_fish_school(albedo, seed, cx, cy, n, col):
    d = ImageDraw.Draw(albedo)
    rng = random.Random(seed)
    for _ in range(n):
        x = cx + int(rng.gauss(0, 26))
        y = cy + int(rng.gauss(0, 12))
        d.line([(x, y), (x + 3, y)], fill=col + (255,), width=1)
        d.point((x - 1, y - 1), fill=col + (200,))
        d.point((x - 1, y + 1), fill=col + (200,))


def draw_wreck(albedo, x, y):
    """Sunken ship silhouette on the far layer."""
    d = ImageDraw.Draw(albedo)
    col = ROCK_FAR
    hull = [(x, y), (x + 78, y - 6), (x + 70, y + 12), (x + 8, y + 16)]
    d.polygon(hull, fill=col + (255,))
    d.line([(x + 30, y - 4), (x + 24, y - 42)], fill=col + (255,), width=2)
    d.line([(x + 24, y - 42), (x + 46, y - 30)], fill=col + (255,), width=1)
    d.line([(x + 24, y - 34), (x + 8, y - 24)], fill=col + (255,), width=1)
    d.polygon([(x + 52, y - 2), (x + 60, y - 22), (x + 62, y - 2)],
              fill=col + (255,))


# ---------------------------------------------------------------- diver
SUIT = (222, 126, 48)       # orange wetsuit pops against deep blue
SUIT_D = (156, 76, 34)
SUIT_H = (250, 178, 100)
HELM = (168, 178, 190)
HELM_D = (108, 118, 132)
VISOR = (120, 220, 235)
VISOR_HI = (215, 250, 252)
TANK = (196, 174, 90)
TANK_D = (130, 112, 56)
FIN = (60, 90, 112)
LAMP = (255, 236, 170)

DIVER_PX = [
    "..................KKKKK.....",
    ".......KKK.......KHHHHHK....",
    "......KTTtK.....KHHGGGGgK...",
    "......KTTtK....KHhGGggggK...",
    "...KK.KTTtKKKKKKoHGGggggKL..",
    "..KFFKohooooooooohKGGGGKKL..",
    ".KFFFKoodooodoooooKKKKKK....",
    "..KFFKoodooodooooooooK......",
    "...KKKohoooooooKoooooK......",
    "......KKoodooKKKKoodoK......",
    "........KKKKK...KooooK......",
    ".................KKKK.......",
]
DIVER_LEGEND = {
    "K": OUTLINE, "o": SUIT, "d": SUIT_D, "h": SUIT_H,
    "H": HELM, "G": VISOR, "g": VISOR_HI,
    "T": TANK, "t": TANK_D, "F": FIN, "L": LAMP,
}


def paste_pixels(img, rows, legend, ox, oy, flip=False):
    px = img.load()
    for j, row in enumerate(rows):
        it = reversed(row) if flip else row
        for i, ch in enumerate(it):
            if ch == ".":
                continue
            c = legend.get(ch)
            if c is None:
                continue
            x, y = ox + i, oy + j
            if 0 <= x < W and 0 <= y < H:
                px[x, y] = c + (255,)


def draw_diver(albedo, emissive, x, y):
    paste_pixels(albedo, DIVER_PX, DIVER_LEGEND, x, y)
    e = ImageDraw.Draw(emissive)
    # helmet lamp
    lx, ly = x + 25, y + 4
    e.point((lx, ly), fill=LAMP + (255,))
    e.point((lx, ly + 1), fill=LAMP + (255,))
    # visor inner glow
    e.point((x + 20, y + 3), fill=(180, 240, 245, 110))
    e.point((x + 21, y + 3), fill=(180, 240, 245, 80))
    return lx, ly + 1


def draw_harpoon_gun(albedo, x, y):
    d = ImageDraw.Draw(albedo)
    d.line([(x, y), (x + 7, y)], fill=(90, 100, 112, 255), width=2)
    d.line([(x + 1, y + 2), (x + 1, y + 3)], fill=SUIT_D + (255,))


# ---------------------------------------------------------------- monster
def dither_mask(w, h, level):
    thr = np.tile(BAYER4, ((h + 3) // 4, (w + 3) // 4))[:h, :w]
    return thr < level


def outline_sprite(spr, color=OUTLINE):
    """Add 1px outline around opaque pixels of an RGBA sprite."""
    a = np.array(spr)[:, :, 3] > 0
    grown = np.zeros_like(a)
    grown[1:, :] |= a[:-1, :]
    grown[:-1, :] |= a[1:, :]
    grown[:, 1:] |= a[:, :-1]
    grown[:, :-1] |= a[:, 1:]
    edge = grown & ~a
    arr = np.array(spr)
    arr[edge] = list(color) + [255]
    return Image.fromarray(arr)


def build_angler(w=130, h=96):
    """Big anglerfish boss sprite, facing left. Returns (sprite, lure_xy)."""
    spr = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(spr)
    base = (56, 34, 62)
    shade = (38, 22, 44)
    hi = (86, 56, 92)
    belly = (70, 46, 74)
    mouth = (16, 5, 12)
    teeth = (232, 240, 238)

    cx, cy = w * 0.56, h * 0.52
    # tail fin
    d.polygon([(w * 0.86, cy), (w - 2, cy - 26), (w * 0.93, cy),
               (w - 2, cy + 26)], fill=shade + (255,))
    # dorsal / ventral fins
    d.polygon([(cx - 6, cy - 34), (cx + 16, cy - 52), (cx + 30, cy - 30)],
              fill=shade + (255,))
    d.polygon([(cx + 2, cy + 32), (cx + 20, cy + 48), (cx + 32, cy + 28)],
              fill=shade + (255,))
    # body
    d.ellipse([cx - 44, cy - 36, cx + 46, cy + 36], fill=base + (255,))
    # open jaw: carve a wedge mouth on the left
    jaw = [(cx - 44, cy - 2), (cx - 4, cy - 10), (cx - 8, cy + 16),
           (cx - 46, cy + 22)]
    d.polygon(jaw, fill=mouth + (255,))
    # lower jaw plate
    d.polygon([(cx - 46, cy + 22), (cx - 8, cy + 16), (cx - 2, cy + 30),
               (cx - 38, cy + 34)], fill=shade + (255,))
    # upper snout
    d.polygon([(cx - 48, cy - 4), (cx - 6, cy - 14), (cx + 2, cy - 30),
               (cx - 34, cy - 22)], fill=base + (255,))
    # teeth (upper row hanging down, lower row pointing up)
    rng = random.Random(7)
    for i in range(7):
        tx = cx - 42 + i * 6
        ln = rng.randrange(5, 9)
        d.polygon([(tx, cy - 4 + i * 0.8), (tx + 3, cy - 4 + i * 0.8),
                   (tx + 1, cy - 4 + i * 0.8 + ln)], fill=teeth + (255,))
    for i in range(6):
        tx = cx - 40 + i * 6.4
        ln = rng.randrange(4, 7)
        d.polygon([(tx, cy + 20 + i * 0.4), (tx + 3, cy + 20 + i * 0.4),
                   (tx + 1, cy + 20 + i * 0.4 - ln)], fill=teeth + (255,))
    # eye
    ex, ey = cx + 2, cy - 18
    d.ellipse([ex - 4, ey - 4, ex + 4, ey + 4], fill=(255, 204, 90, 255))
    d.ellipse([ex - 1, ey - 2, ex + 2, ey + 2], fill=(10, 6, 10, 255))
    # pectoral fin
    d.polygon([(cx + 14, cy + 6), (cx + 34, cy + 20), (cx + 30, cy - 2)],
              fill=hi + (255,))
    # lure stalk
    stalk = [(cx - 20, cy - 26)]
    for t in range(1, 22):
        stalk.append((cx - 20 - t * 1.6, cy - 26 - t * 1.7 + (t * t) * 0.03))
    for i in range(len(stalk) - 1):
        d.line([stalk[i], stalk[i + 1]], fill=shade + (255,), width=2)
    lure = (int(stalk[-1][0]) - 2, int(stalk[-1][1]) - 2)

    # dithered shading: highlight upper-left (lit by lure), shade lower-right
    arr = np.array(spr)
    alpha = arr[:, :, 3] > 0
    body_mask = (np.abs(arr[:, :, :3].astype(int) -
                        np.array(base)).sum(2) < 30) & alpha
    yy, xx = np.mgrid[0:h, 0:w]
    lit = ((xx - lure[0]) ** 2 + (yy - lure[1]) ** 2) < 65 ** 2
    dm = dither_mask(w, h, 0.5)
    arr[body_mask & lit & dm] = list(hi) + [255]
    low = yy > cy + 8
    arr[body_mask & low & dither_mask(w, h, 0.4)] = list(belly) + [255]
    spr = Image.fromarray(arr)
    spr = outline_sprite(spr)
    return spr, lure


# ---------------------------------------------------------------- lighting
def light_cone(lx, ly, angle, spread, reach, strength):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    dx, dy = xx - lx, yy - ly
    dist = np.hypot(dx, dy) + 1e-4
    da = np.abs((np.arctan2(dy, dx) - angle + math.pi) %
                (2 * math.pi) - math.pi)
    ang_fall = np.clip(1 - da / spread, 0, 1) ** 1.6
    dist_fall = np.clip(1 - dist / reach, 0, 1) ** 1.4
    return (ang_fall * dist_fall * strength)[..., None]


def point_light(lx, ly, radius, strength, tint=(1.0, 1.0, 1.0)):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    dist = np.hypot(xx - lx, yy - ly)
    fall = np.clip(1 - dist / radius, 0, 1) ** 2 * strength
    return fall[..., None] * np.array(tint, dtype=np.float32)


def god_rays(seed, n=5, strength=0.10):
    img = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(img)
    rng = random.Random(seed)
    for _ in range(n):
        x0 = rng.randrange(-40, W)
        wd = rng.randrange(14, 42)
        slant = rng.randrange(30, 80)
        depth = rng.randrange(int(H * 0.45), int(H * 0.8))
        d.polygon([(x0, 0), (x0 + wd, 0),
                   (x0 + wd + slant, depth), (x0 + slant, depth)],
                  fill=rng.randrange(100, 255))
    img = img.filter(ImageFilter.GaussianBlur(6))
    ray = np.array(img, dtype=np.float32) / 255.0
    fade = np.clip(1 - np.linspace(0, 1.6, H), 0, 1)[:, None]
    return (ray * fade * strength)[..., None] * \
        np.array([0.75, 0.95, 1.0], dtype=np.float32)


# ---------------------------------------------------------------- HUD
FONT35 = {
    "A": "010101111101101", "B": "110101110101110", "C": "011100100100011",
    "D": "110101101101110", "E": "111100110100111", "G": "011100101101011",
    "H": "101101111101101", "L": "100100100100111", "M": "101111111101101",
    "N": "110101101101101", "P": "110101110100100", "R": "110101110110101",
    "S": "011100010001110", "T": "111010010010010", "Y": "101101010010010",
    "O": "010101101101010", "I": "111010010010111", "X": "101101010101101",
    "0": "010101101101010", "1": "010110010010111", "2": "110001010100111",
    "4": "101101111001001", "7": "111001010010010", " ": "000000000000000",
    "-": "000000111000000",
}


def draw_text(img, s, x, y, col):
    px = img.load()
    for ch in s:
        pat = FONT35.get(ch)
        if pat:
            for j in range(5):
                for i in range(3):
                    if pat[j * 3 + i] == "1":
                        if 0 <= x + i < W and 0 <= y + j < H:
                            px[x + i, y + j] = col
        x += 4


def draw_hud(img, o2=0.72, hp=3, depth="DEPTH 214M"):
    d = ImageDraw.Draw(img)
    # O2 bar
    d.rectangle([6, 6, 66, 12], fill=(8, 10, 20), outline=(90, 120, 140))
    fill_w = int(58 * o2)
    d.rectangle([7, 7, 7 + fill_w, 11], fill=(90, 200, 230))
    d.rectangle([7, 7, 7 + fill_w, 8], fill=(160, 240, 250))
    draw_text(img, "O2", 70, 7, (140, 200, 220))
    # hearts
    for i in range(3):
        x = 6 + i * 9
        col = (230, 70, 90) if i < hp else (40, 30, 44)
        d.polygon([(x, 17), (x + 2, 15), (x + 4, 17), (x + 6, 15),
                   (x + 8, 17), (x + 4, 22)], fill=col)
    draw_text(img, depth, W - 4 * len(depth) - 6, 7, (120, 160, 190))


def draw_boss_bar(img, name="ABYSSAL ANGLER", frac=0.83):
    d = ImageDraw.Draw(img)
    bw = 180
    x0 = (W - bw) // 2
    y0 = H - 22
    draw_text(img, name, (W - 4 * len(name)) // 2, y0 - 8, (220, 190, 200))
    d.rectangle([x0, y0, x0 + bw, y0 + 6], fill=(10, 6, 14),
                outline=(120, 70, 90))
    d.rectangle([x0 + 1, y0 + 1, x0 + 1 + int((bw - 2) * frac), y0 + 5],
                fill=(190, 50, 70))
    d.rectangle([x0 + 1, y0 + 1, x0 + 1 + int((bw - 2) * frac), y0 + 2],
                fill=(240, 110, 120))


# ---------------------------------------------------------------- compose
def compose(albedo_img, emissive_img, lightmap, extra_add=None,
            seed=1, mote_count=140):
    albedo = np.array(albedo_img.convert("RGB"), dtype=np.float32) / 255.0
    em_rgba = np.array(emissive_img, dtype=np.float32) / 255.0
    emissive = em_rgba[:, :, :3] * em_rgba[:, :, 3:4]

    lit = albedo * np.clip(lightmap, 0, 1.6)
    if extra_add is not None:
        lit += extra_add

    # bloom from emissive + hot spots
    hot = np.clip(lit - 0.75, 0, 1) + emissive
    hot_img = Image.fromarray((np.clip(hot, 0, 1) * 255).astype(np.uint8))
    bloom = np.array(hot_img.filter(ImageFilter.GaussianBlur(4)),
                     dtype=np.float32) / 255.0

    final = lit + emissive + bloom * 0.55

    # floating motes, brightness follows local light
    rng = random.Random(seed)
    lum = lightmap.mean(axis=2) if lightmap.ndim == 3 else lightmap
    for _ in range(mote_count):
        x, y = rng.randrange(W), rng.randrange(H)
        b = float(np.clip(lum[y, x], 0, 1)) * rng.uniform(0.3, 0.9)
        if b > 0.05:
            final[y, x] += np.array([b * 0.7, b * 0.85, b * 0.9])

    # vignette
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.hypot((xx - W / 2) / (W / 2), (yy - H / 2) / (H / 2))
    final *= (1 - np.clip(r - 0.55, 0, 1) * 0.45)[..., None]

    out = (np.clip(final, 0, 1) * 255).astype(np.uint8)
    return Image.fromarray(out)


def ambient(top, bottom):
    ys = np.linspace(top, bottom, H, dtype=np.float32)[:, None, None]
    amb = np.repeat(np.repeat(ys, W, axis=1), 3, axis=2)
    amb *= np.array([0.75, 0.9, 1.15], dtype=np.float32)  # blue-shift depth
    return amb


# ================================================================ scenes
def scene_exploration():
    bg = dithered_gradient(DEEP_RAMP[::-1])
    albedo = Image.fromarray((bg * 255).astype(np.uint8)).convert("RGBA")
    emissive = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(albedo)

    draw_wreck(albedo, 310, 158)
    draw_fish_school(albedo, 5, 130, 74, 14, (34, 52, 92))
    draw_fish_school(albedo, 8, 386, 104, 10, (28, 44, 80))
    draw_fish_school(albedo, 13, 250, 128, 8, (40, 60, 100))

    far_h = ridge_heights(11, 205, 16, 0.35)
    draw_terrain(d, 11, 205, 16, 0.35, ROCK_FAR, spikes=4)
    draw_terrain(d, 22, 235, 14, 0.45, ROCK_MID, spikes=5)
    mid_h = ridge_heights(22, 235, 14, 0.45)
    draw_kelp(albedo, emissive, 5, lambda x: far_h[x], n=9)
    draw_kelp(albedo, emissive, 6, lambda x: mid_h[x], n=12)
    draw_coral(albedo, emissive, 7, lambda x: far_h[x], n=6)
    draw_coral(albedo, emissive, 8, lambda x: mid_h[x], n=8)
    draw_terrain(d, 33, 262, 10, 0.5, ROCK_NEAR, spikes=3)

    draw_jellyfish(emissive, 402, 60, 7, (150, 200, 255))
    draw_jellyfish(emissive, 430, 84, 5, (230, 150, 255))
    draw_jellyfish(emissive, 66, 150, 6, (120, 240, 220))

    dx, dy = 168, 108
    lx, ly = draw_diver(albedo, emissive, dx, dy)
    # bubbles rising behind diver
    e = ImageDraw.Draw(emissive)
    rng = random.Random(3)
    for i in range(8):
        bx = dx + 4 - i * 2 + rng.randrange(-2, 3)
        by = dy - 4 - i * 7 + rng.randrange(-2, 3)
        r = 1 if i < 5 else 2
        e.ellipse([bx - r, by - r, bx + r, by + r],
                  fill=(170, 210, 230, 90))

    lm = ambient(0.62, 0.22)
    lm += god_rays(4, n=8, strength=0.4)
    lm += light_cone(lx, ly, angle=0.12, spread=0.5, reach=170,
                     strength=1.35) \
        * np.array([1.0, 0.95, 0.8], dtype=np.float32)
    lm += point_light(lx, ly, 34, 0.7, (1.0, 0.95, 0.85))
    lm += point_light(402, 60, 40, 0.35, (0.6, 0.8, 1.0))
    lm += point_light(66, 150, 36, 0.35, (0.5, 1.0, 0.9))
    lm += point_light(350, 165, 60, 0.22, (0.7, 0.85, 1.0))  # wreck accent

    img = compose(albedo, emissive, lm, seed=10)
    draw_hud(img, o2=0.72, hp=3, depth="DEPTH 214M")
    return img


def scene_combat():
    bg = dithered_gradient(DEEP_RAMP[::-1], top=0.15, bottom=1.0)
    albedo = Image.fromarray((bg * 255).astype(np.uint8)).convert("RGBA")
    emissive = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(albedo)

    draw_stalactites(d, 44, ROCK_MID, n=16)
    draw_terrain(d, 55, 240, 12, 0.4, ROCK_MID, spikes=4)
    mid_h = ridge_heights(55, 240, 12, 0.4)
    draw_kelp(albedo, emissive, 9, lambda x: mid_h[x], n=6)
    draw_coral(albedo, emissive, 10, lambda x: mid_h[x], n=6)
    draw_terrain(d, 66, 262, 8, 0.5, ROCK_NEAR, spikes=2)

    # boss
    angler, lure_local = build_angler()
    ax, ay = 268, 66
    albedo.alpha_composite(angler, (ax, ay))
    lure = (ax + lure_local[0], ay + lure_local[1])
    e = ImageDraw.Draw(emissive)
    e.ellipse([lure[0] - 3, lure[1] - 3, lure[0] + 3, lure[1] + 3],
              fill=(220, 255, 170, 255))
    e.ellipse([lure[0] - 1, lure[1] - 1, lure[0] + 1, lure[1] + 1],
              fill=(255, 255, 230, 255))
    # eye glint
    e.point((ax + 75, ay + 32), fill=(255, 220, 120, 200))

    # diver firing
    dx, dy = 96, 124
    lx, ly = draw_diver(albedo, emissive, dx, dy)
    draw_harpoon_gun(albedo, dx + 23, dy + 8)

    # harpoon in flight + trail
    hx, hy = 236, dy + 8
    d.line([(hx - 14, hy), (hx, hy)], fill=(170, 186, 200, 255), width=1)
    d.polygon([(hx, hy - 1), (hx + 4, hy), (hx, hy + 1)],
              fill=(220, 230, 240, 255))
    for i in range(10):
        tx = dx + 34 + i * 17
        if tx >= hx - 6:
            break
        e.point((tx, hy + (i % 2)), fill=(140, 220, 240, 110))
    # muzzle flash
    e.ellipse([dx + 29, dy + 6, dx + 35, dy + 11], fill=(200, 240, 255, 160))
    # previous harpoon impact on monster: spark burst
    ix, iy = ax + 26, ay + 52
    for ang in range(0, 360, 45):
        a = math.radians(ang)
        e.line([(ix, iy), (ix + math.cos(a) * 5, iy + math.sin(a) * 5)],
               fill=(255, 240, 200, 220), width=1)
    e.point((ix, iy), fill=(255, 255, 255, 255))

    # bubbles from monster jaw
    rng = random.Random(12)
    for i in range(6):
        bx = ax + 10 + rng.randrange(0, 30)
        by = ay + 30 - i * 6 + rng.randrange(-3, 4)
        e.ellipse([bx - 1, by - 1, bx + 1, by + 1], fill=(170, 210, 230, 80))

    lm = ambient(0.30, 0.13)
    lm += light_cone(lx, ly, angle=0.0, spread=0.42, reach=230,
                     strength=1.35) \
        * np.array([1.0, 0.95, 0.8], dtype=np.float32)
    lm += point_light(lx, ly, 32, 0.7, (1.0, 0.95, 0.85))
    lm += point_light(lure[0], lure[1], 110, 0.9, (0.85, 1.0, 0.6))
    lm += point_light(ix, iy, 44, 0.65, (1.0, 0.9, 0.7))
    lm += point_light(dx + 33, dy + 9, 32, 0.55, (0.8, 0.95, 1.0))

    img = compose(albedo, emissive, lm, seed=20, mote_count=170)
    draw_hud(img, o2=0.41, hp=2, depth="DEPTH 407M")
    draw_boss_bar(img, "ABYSSAL ANGLER", 0.83)
    return img


def save(img, name):
    big = img.resize((W * SCALE, H * SCALE), Image.NEAREST)
    big.save(name)
    print("saved", name)


if __name__ == "__main__":
    save(scene_exploration(), "sample_exploration.png")
    save(scene_combat(), "sample_combat.png")
