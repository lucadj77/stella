# Illustrazioni del progetto «Spedizione» (video 27): paesaggi piatti a strati e una trama di carta ripetibile,
# generati qui, senza diritti di terzi. Uso: python3 illustrazioni-spedizione.py <cartella>
import math, random, sys
from PIL import Image, ImageDraw, ImageFilter, ImageChops
W, H = 1200, 800
OUT = sys.argv[1]

def lerp(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))
def hexc(h): h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def sky(top, bottom):
    im = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(im)
    for y in range(H):
        d.line([(0, y), (W, y)], fill=lerp(top, bottom, y / H))
    return im

def ridge(rng, base, amp, freq, rough=0.35):
    # profilo di una cresta: somma di sinusoidi con fasi a caso
    ph = [rng.random() * 6.28 for _ in range(4)]
    pts = []
    for x in range(0, W + 8, 8):
        y = base
        for k in range(4):
            y += amp * (rough ** k) * math.sin(x / W * freq * (k + 1) * 3.1 + ph[k])
        pts.append((x, y))
    return pts

def layer(im, pts, color):
    d = ImageDraw.Draw(im)
    d.polygon(pts + [(W, H), (0, H)], fill=color)

def trees(im, rng, ybase, n, color, hmin, hmax, pts=None):
    d = ImageDraw.Draw(im)
    for _ in range(n):
        x = rng.uniform(-20, W + 20)
        y = ybase
        if pts:
            i = min(len(pts) - 1, max(0, int(x / 8)))
            y = pts[i][1] + rng.uniform(4, 30)
        h = rng.uniform(hmin, hmax)
        w = h * 0.42
        d.polygon([(x, y - h), (x - w / 2, y), (x + w / 2, y)], fill=color)
        d.rectangle([x - w * 0.06, y, x + w * 0.06, y + h * 0.12], fill=color)

def sun(im, x, y, r, color, glow=None):
    if glow:
        g = Image.new('RGB', (W, H), (0, 0, 0))
        ImageDraw.Draw(g).ellipse([x - r * 2.2, y - r * 2.2, x + r * 2.2, y + r * 2.2], fill=glow)
        g = g.filter(ImageFilter.GaussianBlur(r))
        im.paste(ImageChops.add(im, g))
    ImageDraw.Draw(im).ellipse([x - r, y - r, x + r, y + r], fill=color)

def grain(im, rng, amount=10):
    n = Image.effect_noise((W, H), amount).convert('RGB')
    return ImageChops.overlay(im, Image.merge('RGB', [n.convert('L')] * 3).point(lambda v: 128 + (v - 128) // 3))

def bosco(seed=1):
    rng = random.Random(seed)
    im = sky(hexc('9FC7C9'), hexc('E8E2C4'))
    sun(im, 300, 210, 70, hexc('F6E7B0'), (60, 50, 20))
    c = ['8FA98F', '6E8F6B', '4F7350', '34573A', '22402A']
    for i, col in enumerate(c):
        p = ridge(rng, 330 + i * 95, 40 - i * 4, 1.6 + i * 0.4)
        layer(im, p, hexc(col))
        if i >= 1: trees(im, rng, 0, 40 + i * 14, hexc(col), 50 + i * 22, 90 + i * 34, p)
    return im

def montagna(seed=2):
    rng = random.Random(seed)
    im = sky(hexc('6F93C2'), hexc('D9E4EE'))
    d = ImageDraw.Draw(im)
    # la vetta, a destra del centro: il soggetto da tenere nell'inquadratura
    peak = [(500, 760), (840, 150), (1180, 760)]
    d.polygon(peak, fill=hexc('8E9AB4'))
    d.polygon([(840, 150), (1180, 760), (900, 760), (930, 420)], fill=hexc('6C7896'))
    d.polygon([(840, 150), (770, 260), (810, 250), (840, 300), (870, 245), (905, 270)], fill=hexc('F4F6FA'))
    for i, col in enumerate(['A3B2C8', '7E91AB', '5B6E88', '3D4E66']):
        p = ridge(rng, 470 + i * 90, 70 - i * 10, 1.2 + i * 0.5, 0.45)
        layer(im, p, hexc(col))
        if i >= 2: trees(im, rng, 0, 30, hexc(col), 40, 90, p)
    return im

def lago(seed=3):
    rng = random.Random(seed)
    im = sky(hexc('F2B880'), hexc('F9E3C3'))
    sun(im, 760, 380, 80, hexc('FFF1CF'), (70, 45, 10))
    for i, col in enumerate(['C99A8A', 'A07C7C']):
        layer(im, ridge(rng, 400 + i * 40, 55, 1.4 + i), hexc(col))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 480, W, H], fill=hexc('5E8C9A'))
    for k in range(40):
        y = rng.uniform(490, 790); x = rng.uniform(0, W); w = rng.uniform(40, 200)
        d.line([(x, y), (x + w, y)], fill=hexc('8FB8C2'), width=3)
    d.ellipse([700, 470, 820, 500], fill=hexc('F6E2B8'))
    p = ridge(rng, 700, 25, 2.2)
    layer(im, p, hexc('2F4B3E'))
    trees(im, rng, 0, 26, hexc('2F4B3E'), 80, 160, p)
    # la barca
    d.polygon([(380, 600), (520, 600), (495, 625), (405, 625)], fill=hexc('3A2A1E'))
    d.line([(450, 600), (450, 520)], fill=hexc('3A2A1E'), width=5)
    d.polygon([(452, 525), (452, 595), (500, 595)], fill=hexc('F4EBDC'))
    return im

def deserto(seed=4):
    rng = random.Random(seed)
    im = sky(hexc('F3C37A'), hexc('FBE9C4'))
    sun(im, 900, 200, 90, hexc('FFF4D6'), (80, 50, 10))
    for i, col in enumerate(['E8B572', 'DDA05A', 'CF8A44', 'B9733A']):
        layer(im, ridge(rng, 430 + i * 95, 45, 0.9 + i * 0.3, 0.25), hexc(col))
    d = ImageDraw.Draw(im)
    # la piramide e il cactus
    d.polygon([(180, 520), (330, 330), (480, 520)], fill=hexc('C98A4B'))
    d.polygon([(330, 330), (480, 520), (360, 520)], fill=hexc('A86E37'))
    for x, y, s in [(820, 690, 1.0), (980, 650, 0.6)]:
        g = hexc('5E7A3A')
        d.rounded_rectangle([x - 14 * s, y - 160 * s, x + 14 * s, y], 14 * s, fill=g)
        d.rounded_rectangle([x - 60 * s, y - 110 * s, x - 36 * s, y - 50 * s], 12 * s, fill=g)
        d.rectangle([x - 60 * s, y - 62 * s, x, y - 44 * s], fill=g)
        d.rounded_rectangle([x + 36 * s, y - 130 * s, x + 60 * s, y - 70 * s], 12 * s, fill=g)
        d.rectangle([x, y - 82 * s, x + 60 * s, y - 64 * s], fill=g)
    return im

def rovine(seed=5):
    rng = random.Random(seed)
    im = sky(hexc('8C7FA8'), hexc('E2C9C1'))
    sun(im, 220, 260, 55, hexc('F8E6D8'), (40, 25, 30))
    for i, col in enumerate(['A693A8', '857590']):
        layer(im, ridge(rng, 470 + i * 70, 40, 1.3 + i), hexc(col))
    d = ImageDraw.Draw(im)
    stone, dark = hexc('D8CCBC'), hexc('A99A88')
    base = 660
    for k, (x, h) in enumerate([(560, 330), (680, 250), (800, 330), (920, 150)]):
        d.rectangle([x, base - h, x + 56, base], fill=stone)
        d.rectangle([x + 40, base - h, x + 56, base], fill=dark)
        d.rectangle([x - 10, base - h - 18, x + 66, base - h], fill=stone)
    d.rectangle([540, 300, 880, 330], fill=stone)
    d.rectangle([500, base, 1010, base + 26], fill=dark)
    p = ridge(rng, 700, 18, 2)
    layer(im, p, hexc('5F5266'))
    return im

for name, f in [('bosco', bosco), ('montagna', montagna), ('lago', lago), ('deserto', deserto), ('rovine', rovine)]:
    im = grain(f(), random.Random(0))
    if name == 'rovine':
        # una vecchia stampa: poco contrasto e una dominante gialla, da sistemare con le regolazioni
        im = Image.blend(im, Image.new('RGB', (W, H), hexc('C8B88A')), 0.42)
    im.save(f'{OUT}/{name}.jpg', quality=88)

# la trama della carta, ripetibile: rumore leggero e qualche fibra
T = 300
rng = random.Random(7)
n = Image.effect_noise((T, T), 40).convert('L').filter(ImageFilter.GaussianBlur(0.8))
tex = Image.merge('RGB', [n.point(lambda v: 196 + (v - 128) // 2), n.point(lambda v: 178 + (v - 128) // 2), n.point(lambda v: 142 + (v - 128) // 2)])
d = ImageDraw.Draw(tex)
for _ in range(80):
    x, y = rng.uniform(0, T), rng.uniform(0, T); a = rng.uniform(0, 6.28); l = rng.uniform(8, 30)
    for dx in (-T, 0, T):
        for dy in (-T, 0, T):
            d.line([(x + dx, y + dy), (x + dx + l * math.cos(a), y + dy + l * math.sin(a))], fill=(132, 108, 76), width=2)
tex.save(f'{OUT}/carta.png')
