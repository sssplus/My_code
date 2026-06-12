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
    ground = solid_noise((30, 95, 55), (42, 120, 70), (22, 75, 45), 303, 0.1, 0.1)
    # two round tree canopies
    trees = [(4, 5, 3), (11, 9, 3)]
    trunk = {(4, 9), (4, 10), (11, 13), (11, 14)}
    def p(x, y):
        for (cx, cy, rad) in trees:
            d2 = (x - cx) ** 2 + (y - cy) ** 2
            if d2 <= rad * rad:
                edge = d2 >= (rad - 1) * (rad - 1)
                return (20, 70, 40) if edge else (34, 110, 58)
            if d2 <= (rad + 1) * (rad + 1):
                pass
        if (x, y) in trunk:
            return (70, 45, 25)
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

def main():
    here = os.path.dirname(os.path.abspath(__file__))
    out = os.path.normpath(os.path.join(here, "..", "assets", "tileset.png"))
    img = Image.new("RGBA", (N_TILES * TILE, TILE), (0, 0, 0, 0))
    px = img.load()
    for tid, painter in enumerate(PAINTERS):
        ox = tid * TILE
        for ly in range(LOGICAL):
            for lx in range(LOGICAL):
                col = painter(lx, ly)
                if len(col) == 3:
                    col = col + (255,)
                # scale 2x
                for dy in range(PX):
                    for dx in range(PX):
                        px[ox + lx * PX + dx, ly * PX + dy] = col
    img.save(out)
    print("wrote", out, img.size)

if __name__ == "__main__":
    main()
