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

def painter_market():
    # Warm sandstone cobblestone: 8×8 block grid with bevelled edges
    base = (198, 165, 118)
    light = (218, 188, 144)
    dark  = (158, 128, 86)
    fn = solid_noise(base, light, dark, 909, 0.10, 0.12)
    def p(x, y):
        # Mortar lines every 8 pixels
        if x % 8 == 0 or y % 8 == 0:
            return dark
        if x % 8 == 1 or y % 8 == 1:
            return light
        # Checkerboard tint within each block for variety
        bx, by = x // 8, y // 8
        if (bx + by) % 2 == 0:
            r, g, b = fn(x, y)
            return (min(255, r+8), min(255, g+6), min(255, b+4))
        return fn(x, y)
    return p

def painter_crop():
    # Tilled earth with alternating crop rows (dark furrows / green shoots)
    soil_dark  = (88,  60, 28)
    soil_mid   = (108, 76, 36)
    soil_light = (124, 88, 44)
    shoot      = (72, 140, 48)
    shoot_hi   = (96, 170, 60)
    def p(x, y):
        row = y // 5
        within = y % 5
        if within == 0:
            return soil_dark           # furrow
        if within == 1:
            return soil_mid
        if within == 4:
            return soil_dark           # next furrow approach
        # Shoot columns at x=2,9 (staggered odd/even rows)
        sx = 2 if row % 2 == 0 else 6
        if x % 8 == sx % 8 and within in (2, 3):
            return shoot_hi if within == 2 else shoot
        return soil_mid if within == 2 else soil_light
    return p

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
    painter_market(),    # 14
    painter_crop(),      # 15
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
    # trunk with side shading and root flare
    if 16 <= y <= 23:
        if 7 <= x <= 8:
            return (104, 68, 36) if x == 7 else (72, 44, 22)
        if y >= 22 and 6 <= x <= 9:
            return (88, 56, 28) if x <= 7 else (64, 40, 20)
    # canopy: big blob, four shade levels lit from the upper-left
    cx, cy = 7.5, 9
    d2 = (x - cx) ** 2 + ((y - cy) * 1.12) ** 2
    if d2 <= 55:
        l2 = (x - 5.0) ** 2 + ((y - 6.0) * 1.1) ** 2
        if d2 >= 44:
            # dark rim, but a lit rim on the sun side
            return (88, 176, 96) if (x < 6 and y < 9) else (18, 72, 38)
        if l2 <= 6:
            return (110, 196, 110)
        if l2 <= 20 and (x + y) % 3 != 0:
            return (72, 160, 86)
        if y > 11 or l2 > 38:
            return (30, 96, 50)
        return (46, 130, 64)
    return None

def dd_pine(x, y):
    if 7 <= x <= 8 and 19 <= y <= 23:
        return (94, 60, 32) if x == 7 else (68, 42, 22)
    # three triangle layers, lit from the left
    for (ty, h, hw) in ((2, 7, 4), (7, 7, 5), (12, 8, 6)):
        if ty <= y < ty + h:
            w = hw * (y - ty + 1) / h
            dx = x - 7.5
            if abs(dx) <= w:
                if abs(dx) >= w - 0.9:
                    return (14, 66, 40)
                if dx < -w * 0.25:
                    return (52, 134, 76)
                if dx > w * 0.35:
                    return (22, 86, 50)
                if y == ty + h - 1:
                    return (18, 76, 44)
                return (32, 108, 62)
    return None

def dd_bush(x, y):
    cx, cy = 7.5, 19
    d2 = (x - cx) ** 2 + ((y - cy) * 1.6) ** 2
    if d2 <= 30:
        if d2 >= 22:
            return (60, 150, 80) if (x < 6 and y < 19) else (24, 86, 44)
        l2 = (x - 5.5) ** 2 + ((y - 17.5) * 1.6) ** 2
        if l2 <= 4:
            return (96, 184, 102)
        if (x * 3 + y * 5) % 7 == 0:
            return (80, 164, 90)
        if y >= 20:
            return (34, 104, 54)
        return (48, 134, 68)
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

def dd_market_stall(x, y):
    # Wooden stall frame with striped canopy (red/white) and counter
    # Canopy: y 0-6, full width
    if y <= 6:
        if y == 0:                          # canopy top edge / ridge
            return (140, 30, 20)
        stripe = (x // 3) % 2
        if y <= 5:
            return (210, 48, 36) if stripe == 0 else (240, 230, 220)
        return (170, 36, 26)                # canopy lower border
    # Wooden posts at x=1 and x=14
    if x in (1, 14) and 0 <= y <= 21:
        return (130, 88, 42) if y % 4 != 3 else (100, 64, 28)
    # Counter top: y=14-15
    if 14 <= y <= 15 and 2 <= x <= 13:
        return (170, 116, 52) if y == 14 else (140, 94, 38)
    # Counter front face: y=16-17
    if 16 <= y <= 17 and 2 <= x <= 13:
        return (110, 72, 30)
    # Goods on counter (little coloured squares)
    goods = {(4,13):(220,60,50),(5,13):(220,60,50),
             (7,13):(80,180,80),(8,13):(80,180,80),
             (10,13):(220,200,60),(11,13):(220,200,60)}
    if (x, y) in goods:
        return goods[(x,y)]
    # Back wall of stall y=7-13, x=2-13
    if 7 <= y <= 13 and 2 <= x <= 13:
        bx = (x + y) % 6
        return (160, 108, 48) if bx < 2 else (140, 92, 38)
    return None

def dd_well(x, y):
    # Stone well: circular base, wooden crossbeam, rope and bucket
    # Base ring y=16-23
    cx = 7.5
    if 15 <= y <= 23:
        r = 6.5 - (y - 15) * 0.15
        if abs(x - cx) <= r:
            if abs(x - cx) >= r - 1.2:
                return (128, 128, 138) if y < 20 else (100, 100, 110)
            return (105, 105, 115)
    # Wooden posts at x=3 and x=12, y=6-15
    if x in (3, 12) and 6 <= y <= 15:
        return (130, 88, 42)
    # Crossbeam y=5-7, x=3-12
    if 5 <= y <= 7 and 3 <= x <= 12:
        if y == 6:
            return (150, 104, 52)
        return (120, 80, 36)
    # Rope x=7-8, y=8-15
    if x in (7, 8) and 8 <= y <= 14:
        return (190, 160, 100) if y % 2 == 0 else (160, 130, 78)
    # Bucket y=15-18, x=5-10
    if 15 <= y <= 18 and 5 <= x <= 10:
        if x in (5, 10) or y in (15, 18):
            return (100, 72, 36)
        return (120, 88, 44)
    return None

def dd_barrel(x, y):
    # Wooden barrel with iron bands
    cx = 7.5
    if 10 <= y <= 23:
        # Barrel profile widens toward middle (y=17), narrows at top/bottom
        mid = 17.0
        dist = abs(y - mid) / 7.0
        hw = 5.5 - dist * 2.5
        if abs(x - cx) <= hw:
            edge = abs(x - cx) >= hw - 1.0
            # Iron bands at y=12,17,22
            band = y in (12, 13, 17, 18, 22, 23)
            if band:
                return (60, 60, 68)
            if edge:
                return (100, 66, 30)
            lside = x < cx
            return (150, 100, 48) if lside else (120, 78, 34)
    # Lid top y=9-10
    cx2, cy2 = 7.5, 9.5
    d2 = (x - cx2)**2 + ((y - cy2)*2.2)**2
    if d2 <= 28:
        return (140, 94, 42) if d2 >= 20 else (160, 110, 52)
    return None

def dd_hay_bale(x, y):
    # Round hay bale (cylinder viewed from side)
    cx, cy = 7.5, 18.0
    d2 = (x - cx)**2 + ((y - cy)*1.1)**2
    if d2 <= 44:
        edge = d2 >= 36
        # Straw texture — diagonal hatch lines
        straw = (x * 2 + y) % 5
        if edge:
            return (180, 130, 40)
        if straw == 0:
            return (220, 175, 65)
        if straw == 2:
            return (190, 148, 52)
        return (205, 160, 56)
    # Straw wisps above bale
    wisp = {(5,8),(6,7),(8,7),(9,8),(7,6),(10,9),(4,9)}
    if (x,y) in wisp:
        return (220, 185, 70)
    return None

DOODADS = [dd_oak, dd_pine, dd_bush, dd_flowers, dd_rock, dd_dead_tree, dd_snow_pine,
           dd_market_stall, dd_well, dd_barrel, dd_hay_bale]

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
