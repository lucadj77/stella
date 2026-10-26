# Disegna la mappa di un'isola per il video 16 (Dividi immagine): 1890 × 1760 px, cioè 3 × 2 carte
# da 63 × 88 mm a 10 px/mm, senza abbondanza esterna. Colori piatti, nessuna sfumatura.
# Uso: python3 mappa.py <uscita.png>
import math
import random
import sys

from PIL import Image, ImageDraw

W, H = 1890, 1760
SEA = (46, 94, 134)
SHALLOW = (78, 132, 168)
SAND = (232, 214, 168)
GRASS = (122, 156, 84)
FOREST = (62, 104, 58)
ROCK = (138, 128, 116)
SNOW = (240, 236, 228)
WATER = (92, 150, 190)
PATH = (110, 76, 46)
ROOF = (168, 50, 47)
WALL = (244, 239, 228)

random.seed(7)
img = Image.new('RGB', (W, H), SEA)
d = ImageDraw.Draw(img)

# onde
for _ in range(140):
    x, y = random.randrange(W), random.randrange(H)
    d.arc([x, y, x + 40, y + 16], 200, 340, fill=SHALLOW, width=4)


def blob(cx, cy, r, wobble, n=90, seed=0):
    rnd = random.Random(seed)
    ph = [rnd.uniform(0, 6.28) for _ in range(4)]
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        k = 1 + wobble * (
            0.5 * math.sin(3 * a + ph[0]) + 0.3 * math.sin(5 * a + ph[1]) + 0.2 * math.sin(9 * a + ph[2])
        )
        pts.append((cx + r * 1.15 * k * math.cos(a), cy + r * 0.92 * k * math.sin(a)))
    return pts


island = blob(W / 2, H / 2, 720, 0.16, seed=3)
d.polygon(blob(W / 2, H / 2, 760, 0.16, seed=3), fill=SHALLOW)
d.polygon(island, fill=SAND)
d.polygon(blob(W / 2, H / 2, 680, 0.16, seed=3), fill=GRASS)

# foresta a ovest
for _ in range(90):
    x = random.gauss(560, 140)
    y = random.gauss(1000, 170)
    r = random.randint(26, 40)
    d.ellipse([x - r, y - r, x + r, y + r], fill=FOREST)
    d.ellipse([x - r * 0.45, y - r * 0.6, x + r * 0.1, y - r * 0.05], fill=(86, 128, 74))

# montagne a nord-est
for i, (x, y, s) in enumerate(
    [(1180, 560, 170), (1340, 620, 140), (1060, 640, 120), (1250, 740, 110), (1440, 760, 100)]
):
    d.polygon([(x - s, y + s * 0.8), (x, y - s * 0.8), (x + s, y + s * 0.8)], fill=ROCK)
    d.polygon([(x - s * 0.32, y - s * 0.25), (x, y - s * 0.8), (x + s * 0.32, y - s * 0.25)], fill=SNOW)
    d.polygon([(x, y - s * 0.8), (x + s, y + s * 0.8), (x + s * 0.25, y + s * 0.8)], fill=(118, 108, 98))

# lago e fiume
d.ellipse([820, 860, 1060, 1000], fill=WATER)
river = [(1000, 980), (1060, 1100), (1020, 1220), (1080, 1340), (1040, 1480), (1080, 1600)]
d.line(river, fill=WATER, width=26, joint='curve')
d.line([(1150, 760), (1080, 850), (1000, 900)], fill=WATER, width=18, joint='curve')

# sentiero tratteggiato tra i villaggi
path = [(420, 600), (600, 700), (760, 780), (900, 1060), (1180, 1150), (1400, 1240), (1500, 1110)]
for (x1, y1), (x2, y2) in zip(path, path[1:]):
    n = int(math.hypot(x2 - x1, y2 - y1) // 34)
    for k in range(n):
        if k % 2 == 0:
            a, b = k / n, min(1, (k + 1) / n)
            d.line([(x1 + (x2 - x1) * a, y1 + (y2 - y1) * a), (x1 + (x2 - x1) * b, y1 + (y2 - y1) * b)],
                   fill=PATH, width=10)


def house(x, y, s=1.0):
    w, h = 54 * s, 40 * s
    d.rectangle([x - w / 2, y - h / 2, x + w / 2, y + h / 2], fill=WALL, outline=PATH, width=4)
    d.polygon([(x - w / 2 - 8, y - h / 2), (x, y - h / 2 - 34 * s), (x + w / 2 + 8, y - h / 2)], fill=ROOF)


for x, y in [(400, 590), (470, 630), (1490, 1100), (1560, 1150), (1440, 1160)]:
    house(x, y)

# castello al centro-sud
cx, cy = 900, 1260
d.rectangle([cx - 90, cy - 60, cx + 90, cy + 70], fill=WALL, outline=PATH, width=5)
for tx in (cx - 110, cx + 70):
    d.rectangle([tx, cy - 120, tx + 40, cy + 70], fill=WALL, outline=PATH, width=5)
    d.polygon([(tx - 8, cy - 120), (tx + 20, cy - 175), (tx + 48, cy - 120)], fill=ROOF)
d.rectangle([cx - 22, cy + 10, cx + 22, cy + 70], fill=PATH)

# rosa dei venti in basso a destra
rx, ry, R = 1690, 1560, 110
d.ellipse([rx - R, ry - R, rx + R, ry + R], outline=WALL, width=6)
for a in range(4):
    ang = a * math.pi / 2
    tip = (rx + R * 0.95 * math.sin(ang), ry - R * 0.95 * math.cos(ang))
    l = (rx + 22 * math.cos(ang), ry + 22 * math.sin(ang))
    r = (rx - 22 * math.cos(ang), ry - 22 * math.sin(ang))
    d.polygon([tip, l, (rx, ry)], fill=WALL)
    d.polygon([tip, r, (rx, ry)], fill=(200, 192, 176))

img.save(sys.argv[1])
