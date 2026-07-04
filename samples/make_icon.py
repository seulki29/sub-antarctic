# -*- coding: utf-8 -*-
"""App icon candidates for Sub-Antarctic — 3 pixel-art variants.

Each drawn on a 32x32 grid, upscaled nearest to 512x512.
Run: python make_icon.py [1|2|3]  (no arg = render comparison sheet)
"""

import sys

from PIL import Image, ImageDraw

G = 32          # pixel grid
S = 512 // G    # upscale factor


def base(colors=((16, 34, 74), (5, 7, 18))):
    """Deep-sea vertical gradient with subtle rounded corners."""
    img = Image.new("RGBA", (G, G), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    top, bot = colors
    for y in range(G):
        t = y / (G - 1)
        c = tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3))
        d.line([(0, y), (G, y)], fill=c + (255,))
    # knock out 2px corners (pixel-art rounding)
    for cx, cy in [(0, 0), (G - 1, 0), (0, G - 1), (G - 1, G - 1)]:
        img.putpixel((cx, cy), (0, 0, 0, 0))
    for cx, cy in [(1, 0), (0, 1), (G - 2, 0), (G - 1, 1),
                   (1, G - 1), (0, G - 2), (G - 2, G - 1), (G - 1, G - 2)]:
        img.putpixel((cx, cy), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def glow(d, x, y, r, color, alpha=90):
    for rr in range(r, 0, -1):
        a = int(alpha * (1 - rr / (r + 1)))
        d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=color + (a,))


def motes(d, seed=7, n=14):
    rng = __import__("random").Random(seed)
    for _ in range(n):
        x, y = rng.randrange(2, G - 2), rng.randrange(2, G - 2)
        d.point((x, y), fill=(140, 180, 210, rng.randrange(40, 110)))


# ---------------------------------------------------------------- variant 1
def icon_helmet():
    """Diver helmet close-up: orange suit, big cyan visor, lamp."""
    img, d = base()
    motes(d)
    K = (5, 4, 10)
    # shoulders
    d.rectangle([6, 24, 25, 31], fill=(222, 126, 48, 255))
    d.rectangle([6, 24, 25, 25], fill=(250, 178, 100, 255))
    d.rectangle([5, 24, 6, 31], fill=K + (255,))
    d.rectangle([25, 24, 26, 31], fill=K + (255,))
    d.line([(6, 23), (25, 23)], fill=K + (255,))
    # helmet dome
    d.ellipse([7, 5, 24, 24], fill=(168, 178, 190, 255), outline=K + (255,), width=1)
    d.ellipse([9, 6, 22, 12], fill=(198, 208, 218, 255))
    # visor
    d.ellipse([10, 9, 21, 21], fill=(20, 40, 56, 255), outline=K + (255,), width=1)
    d.ellipse([11, 10, 20, 20], fill=(120, 220, 235, 255))
    d.ellipse([12, 11, 17, 15], fill=(215, 250, 252, 255))
    d.point((18, 17), fill=(215, 250, 252, 255))
    # lamp on top
    glow(d, 16, 4, 5, (255, 236, 170), 120)
    d.rectangle([14, 2, 17, 4], fill=(255, 236, 170, 255))
    d.rectangle([13, 4, 18, 5], fill=(120, 128, 140, 255))
    return img


# ---------------------------------------------------------------- variant 2
def icon_lure():
    """Anglerfish lure glowing in the abyss, teeth below."""
    img, d = base(((10, 18, 44), (3, 4, 12)))
    motes(d, seed=3)
    K = (5, 4, 10)
    # lure glow + orb
    glow(d, 16, 10, 9, (216, 255, 160), 130)
    d.ellipse([13, 7, 19, 13], fill=(232, 255, 190, 255), outline=K + (255,))
    d.ellipse([14, 8, 17, 11], fill=(255, 255, 235, 255))
    # stalk curving away
    d.line([(19, 12), (23, 16)], fill=(38, 22, 44, 255), width=2)
    d.line([(23, 16), (25, 21)], fill=(38, 22, 44, 255), width=2)
    # jaw silhouette rising from bottom: upper teeth of a huge mouth
    d.polygon([(2, 32), (2, 24), (30, 24), (30, 32)], fill=(20, 12, 24, 255))
    for i, (tx, ln) in enumerate([(4, 4), (8, 6), (12, 4), (16, 7), (20, 4), (24, 6), (28, 3)]):
        d.polygon([(tx - 2, 24), (tx + 1, 24), (tx - 1, 24 - ln)],
                  fill=(226, 234, 232, 255))
    d.line([(2, 23), (30, 23)], fill=K + (200,))
    # tiny eye
    d.ellipse([25, 26, 28, 29], fill=(255, 204, 90, 255))
    d.point((27, 27), fill=(10, 6, 10, 255))
    return img


# ---------------------------------------------------------------- variant 3
def icon_diver_cone():
    """Tiny diver with headlamp cone cutting the dark."""
    img, d = base(((12, 24, 56), (3, 4, 12)))
    motes(d, seed=11)
    # light cone from diver toward lower-right
    cone = Image.new("RGBA", (G, G), (0, 0, 0, 0))
    cd = ImageDraw.Draw(cone)
    cd.polygon([(11, 11), (30, 18), (24, 30)], fill=(255, 240, 190, 70))
    cd.polygon([(11, 11), (28, 16), (24, 26)], fill=(255, 240, 190, 60))
    img.alpha_composite(cone)
    d = ImageDraw.Draw(img)
    # fish caught in the beam
    for fx, fy in [(21, 19), (25, 23), (19, 24)]:
        d.line([(fx, fy), (fx + 2, fy)], fill=(90, 130, 170, 255))
        d.point((fx - 1, fy), fill=(60, 90, 130, 255))
    # diver (orange), compact 10x6, facing lower-right
    K = (5, 4, 10)
    d.rectangle([4, 8, 11, 12], fill=(222, 126, 48, 255), outline=K + (255,))
    d.rectangle([4, 8, 11, 9], fill=(250, 178, 100, 255))
    d.polygon([(2, 7), (4, 9), (2, 12)], fill=(60, 90, 112, 255))  # fin
    d.ellipse([8, 6, 13, 11], fill=(168, 178, 190, 255), outline=K + (255,))
    d.rectangle([10, 8, 12, 10], fill=(120, 220, 235, 255))
    d.point((10, 8), fill=(215, 250, 252, 255))
    glow(d, 12, 10, 3, (255, 236, 170), 140)
    # bubbles
    for bx, by in [(6, 5), (8, 3), (5, 2)]:
        d.point((bx, by), fill=(180, 220, 240, 160))
    return img


def up(img, size=512):
    return img.resize((size, size), Image.NEAREST)


VARIANTS = {1: icon_helmet, 2: icon_lure, 3: icon_diver_cone}

if __name__ == "__main__":
    if len(sys.argv) > 1:
        n = int(sys.argv[1])
        up(VARIANTS[n]()).save(f"icon-{n}-512.png")
        print(f"saved icon-{n}-512.png")
    else:
        sheet = Image.new("RGBA", (512 * 3 + 64, 560), (24, 26, 34, 255))
        for i, fn in VARIANTS.items():
            sheet.alpha_composite(up(fn()), ((i - 1) * (512 + 32), 24))
        sheet.save("icon-candidates.png")
        print("saved icon-candidates.png")
