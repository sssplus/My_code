#!/usr/bin/env python3
"""
Generate the retro pixel-art tileset for Chronicles of the Shattered Realm.

Output: retro-rpg/assets/tileset.png — a horizontal strip of 32x32 tiles,
one per tile id (0..13), drawn at a logical 16x16 resolution scaled 2x so
the result reads as chunky SNES/GBA-era pixel art.

Tile ids match DATA.TILE in js/data.js:
  0 void  1 grass  2 path  3 forest  4 mountain  5 desert  6 water
  7 wall  8 floor  9 door  10 dungeon_floor  11 dungeon_wall  12 swamp  13 snow

This script is a build-time asset generator. The committed PNG is the real
asset the game loads; re-run this only to regenerate it (needs Pillow).
"""
import os
from PIL import Image

TILE = 32          # output tile size in px
LOGICAL = 16       # logical pixels per tile edge
PX = TILE // LOGICAL  # 2x scale
N_TILES = 14

# ---- deterministic per-tile noise -------------------------------------------
def rng(seed):
    s = seed & 0xffffffff
    def nxt():
        nonlocal s
        s = (s * 1664525 + 1013904223) & 0xffffffff
        return s / 0xffffffff
    return nxt

def mix(c1, c2, t):
    return tuple(round(a + (b - a) * t) for a, b in zip(c1, c2))

# ---- per-tile painters: each fills a 16x16 logical grid ----------------------
# Painter returns a function(x,y)->(r,g,b[,a]) for logical pixel coords.

def solid_noise(base, light, dark, seed, light_p=0.18, dark_p=0.18):
    r = rng(seed)
    grid = {}
    for y in range(LOGICAL):
        for x in range(LOGICAL):
            v = r()
            if v < dark_p:
                grid[(x, y)] = dark
            elif v > 1 - light_p:
                grid[(x, y)] = light
            else:
                grid[(x, y)] = base
    return lambda x, y: grid[(x, y)]

def painter_void(x, y):
    return (10, 10, 20)

def painter_grass():
    base, light, dark = (35, 120, 65), (60, 160, 85), (26, 92, 50)
    fn = solid_noise(base, light, dark, 101, 0.14, 0.12)
    blades = {(3, 5), (3, 4), (8, 9), (8, 8), (12, 6), (12, 5), (5, 11), (5, 10)}
    def p(x, y):
        if (x, y) in blades:
            return (75, 180, 100)
        return fn(x, y)
    return p

def painter_path():
    base, light, dark = (150, 135, 105), (180, 165, 135), (120, 105, 80)
    return solid_noise(base, light, dark, 202, 0.22, 0.2)

def painter_forest():
    # Forest floor only — darker, mossier grass. The actual trees are
    # tall doodad sprites drawn (y-sorted) on top, JRPG-style.
    ground = solid_noise((28, 88, 50), (38, 108, 62), (20, 70, 40), 303, 0.12, 0.14)
    tufts = {(3, 4), (3, 3), (9, 11), (9, 10), (13, 6), (6, 13), (6, 12)}
    def p(x, y):
        if (x, y) in tufts:
            return (52, 128, 70)
        return ground(x, y)
    return p

def painter_mountain():
    base, light, dark = (95, 70, 50), (130, 100, 72), (66, 48, 34)
    fn = solid_noise(base, light, dark, 404, 0.2, 0.2)
    def p(x, y):
        # peak ridge highlight
        if y < 6 and abs(x - 8) <= (6 - y):
            return (165, 135, 100) if (x + y) % 2 == 0 else (140, 110, 80)
        if y > 12:
            return dark
        return fn(x, y)
    return p

def painter_desert():
    base, light, dark = (224, 200, 150), (240, 220, 175), (200, 175, 125)
    fn = solid_noise(base, light, dark, 505, 0.16, 0.14)
    ripple = {(2, 6), (3, 6), (4, 6), (9, 11), (10, 11), (11, 11), (6, 3), (7, 3)}
    def p(x, y):
        if (x, y) in ripple:
            return dark
        return fn(x, y)
    return p

def painter_water():
    base, light, dark = (40, 95, 190), (70, 130, 220), (28, 70, 150)
    def p(x, y):
        band = (y + (x // 3)) % 4
        if band == 0:
            return light
        if band == 2:
            return dark
        # sparkle
        if (x * 7 + y * 13) % 23 == 0:
            return (150, 200, 250)
        return base
    return p

def painter_wall():
    # red Lego-ish brick wall, pixel-art mortar lines
    brick, mortar, hi = (190, 40, 30), (120, 24, 18), (220, 80, 65)
    def p(x, y):
        if y % 5 == 0:
            return mortar
        # offset vertical mortar every other row band
        row = y // 5
        off = 0 if row % 2 == 0 else 4
        if (x + off) % 8 == 0:
            return mortar
        if y % 5 == 1:
            return hi
        return brick
    return p

def painter_floor():
    base, light, dark = (220, 190, 70), (240, 215, 100), (190, 160, 55)
    def p(x, y):
        # tiled floor with grout
        if x % 8 == 0 or y % 8 == 0:
            return dark
        if (x % 8 == 1) or (y % 8 == 1):
            return light
        return base
    return p

def painter_door():
    wood, dark, frame = (110, 70, 35), (80, 48, 22), (60, 36, 16)
    def p(x, y):
        if x < 2 or x > 13 or y < 1:
            return frame
        if x == 11 and 7 <= y <= 8:
            return (235, 200, 90)   # handle
        if (x) % 4 == 0:
            return dark
        return wood
    return p

def painter_dg_floor():
    base, light, dark = (62, 62, 62), (80, 80, 80), (46, 46, 46)
    fn = solid_noise(base, light, dark, 606, 0.14, 0.16)
    def p(x, y):
        if x % 8 == 0 or y % 8 == 0:
            return dark
        return fn(x, y)
    return p

def painter_dg_wall():
    base, light, dark = (32, 44, 56), (48, 62, 76), (20, 30, 40)
    def p(x, y):
        if y % 4 == 0:
            return dark
        row = y // 4
        off = 0 if row % 2 == 0 else 4
        if (x + off) % 8 == 0:
            return dark
        if y % 4 == 1:
            return light
        return base
    return p

def painter_swamp():
    base, light, dark = (60, 90, 35), (78, 112, 48), (44, 68, 26)
    fn = solid_noise(base, light, dark, 707, 0.12, 0.16)
    pools = {(5, 8), (6, 8), (5, 9), (6, 9), (11, 4), (12, 4), (11, 5)}
    def p(x, y):
        if (x, y) in pools:
            return (40, 70, 60)
        return fn(x, y)
    return p

def painter_snow():
    base, light, dark = (224, 235, 250), (245, 250, 255), (198, 212, 232)
    return solid_noise(base, light, dark, 808, 0.2, 0.12)

PAINTERS = [
    painter_void,        # 0
    painter_grass(),     # 1
    painter_path(),      # 2
    painter_forest(),    # 3
    painter_mountain(),  # 4
    painter_desert(),    # 5
    painter_water(),     # 6
    painter_wall(),      # 7
    painter_floor(),     # 8
    painter_door(),      # 9
    painter_dg_floor(),  # 10
    painter_dg_wall(),   # 11
    painter_swamp(),     # 12
    painter_snow(),      # 13
]

# ============================================================================
# Doodad sprites — tall environment objects (trees, bushes, rocks...)
# drawn over the tilemap and y-sorted with the player for 2.5D depth.
# Sheet: doodads.png, cells 32px wide x 48px tall, anchored at the bottom.
# Logical resolution 16x24, scaled 2x. Index order must match
# ENGINE/TERRAIN DOODAD ids in the JS.
# ============================================================================
D_W, D_H = 16, 24  # logical doodad size

def dd_oak(x, y):
    # trunk
    if 7 <= x <= 8 and 16 <= y <= 23:
        return (96, 62, 32) if x == 7 else (74, 46, 22)
    # canopy: big blob
    cx, cy = 7.5, 9
    d2 = (x - cx) ** 2 + ((y - cy) * 1.15) ** 2
    if d2 <= 52:
        if d2 >= 40:
            return (24, 86, 44)
        # dappled light upper-left
        if (x + y) % 4 == 0 and x < 9 and y < 10:
            return (74, 168, 92)
        return (44, 128, 64)
    return None

def dd_pine(x, y):
    if 7 <= x <= 8 and 19 <= y <= 23:
        return (90, 58, 30)
    # three triangle layers
    for (ty, h, hw) in ((2, 7, 4), (7, 7, 5), (12, 8, 6)):
        if ty <= y < ty + h:
            w = hw * (y - ty + 1) / h
            if abs(x - 7.5) <= w:
                edge = abs(x - 7.5) >= w - 0.9
                return (16, 74, 46) if edge else (30, 104, 60)
    return None

def dd_bush(x, y):
    cx, cy = 7.5, 19
    d2 = (x - cx) ** 2 + ((y - cy) * 1.6) ** 2
    if d2 <= 30:
        if d2 >= 22:
            return (26, 92, 48)
        if (x * 3 + y * 5) % 7 == 0:
            return (88, 172, 96)
        return (46, 132, 66)
    return None

def dd_flowers(x, y):
    if y < 17:
        return None
    pts = {(3, 19): (235, 90, 110), (6, 21): (240, 210, 80),
           (9, 18): (235, 90, 110), (12, 20): (160, 120, 230),
           (5, 18): (240, 210, 80), (11, 22): (235, 90, 110)}
    for (fx, fy), c in pts.items():
        if abs(x - fx) <= 1 and abs(y - fy) <= 1 and (abs(x - fx) + abs(y - fy)) < 2:
            return c
        if x == fx and y == fy + 1:
            return (40, 110, 50)
    return None

def dd_rock(x, y):
    cx, cy = 7.5, 20
    d2 = (x - cx) ** 2 + ((y - cy) * 2.0) ** 2
    if d2 <= 26:
        if y <= 18 and d2 < 16:
            return (150, 150, 158)
        if d2 >= 20:
            return (84, 84, 92)
        return (116, 116, 124)
    return None

def dd_dead_tree(x, y):
    if 7 <= x <= 8 and 8 <= y <= 23:
        return (70, 56, 44) if x == 7 else (52, 40, 30)
    # bare branches
    branches = {(5, 9), (6, 9), (4, 8), (9, 10), (10, 10), (11, 9), (6, 6), (7, 6), (9, 7)}
    if (x, y) in branches:
        return (64, 50, 38)
    return None

def dd_snow_pine(x, y):
    c = dd_pine(x, y)
    if c is None:
        return None
    # snow caps on layer tops
    for ty in (2, 7, 12):
        if y in (ty, ty + 1):
            return (236, 244, 252)
    return c

DOODADS = [dd_oak, dd_pine, dd_bush, dd_flowers, dd_rock, dd_dead_tree, dd_snow_pine]

def write_sheet(path, painters, lw, lh):
    img = Image.new("RGBA", (len(painters) * lw * PX, lh * PX), (0, 0, 0, 0))
    px = img.load()
    for idx, painter in enumerate(painters):
        ox = idx * lw * PX
        for ly in range(lh):
            for lx in range(lw):
                col = painter(lx, ly)
                if col is None:
                    continue
                if len(col) == 3:
                    col = col + (255,)
                for dy in range(PX):
                    for dx in range(PX):
                        px[ox + lx * PX + dx, ly * PX + dy] = col
    img.save(path)
    print("wrote", path, img.size)

def main():
    here = os.path.dirname(os.path.abspath(__file__))
    assets = os.path.normpath(os.path.join(here, "..", "assets"))
    write_sheet(os.path.join(assets, "tileset.png"),
                [lambda x, y, p=p: p(x, y) for p in PAINTERS], LOGICAL, LOGICAL)
    write_sheet(os.path.join(assets, "doodads.png"), DOODADS, D_W, D_H)

if __name__ == "__main__":
    main()
