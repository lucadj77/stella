#!/usr/bin/env python3
"""Storyboard di un video per la revisione: una schermata per ogni didascalia, numerata, col testo.

Le schermate e testi.tsv vengono da una prova veloce con SNAP:
  FAST=1 SNAP=/tmp/v/snap27 xvfb-run -a node scripts/video/immagini.mjs it
Poi:
  python3 scripts/video/storyboard.py /tmp/v/snap27 "Storyboard video 27" out.html [nota per n ...]
Le note facoltative sono coppie numero=testo (es. 43="in attesa della scelta sul contorno").
La pagina è un file HTML unico, con le immagini dentro (JPEG ridotte), da pubblicare come Artifact.
"""
import base64
import html
import io
import sys
from pathlib import Path

from PIL import Image

snap, title, out = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3])
notes = dict(a.split('=', 1) for a in sys.argv[4:])
rows = [l.split('\t', 2) for l in (snap / 'testi.tsv').read_text().splitlines() if l.strip()]


def jpeg(p: Path) -> str:
    im = Image.open(p).convert('RGB')
    im.thumbnail((960, 960))
    b = io.BytesIO()
    im.save(b, 'JPEG', quality=70, optimize=True)
    return base64.b64encode(b.getvalue()).decode()


items = []
for n, kind, text in rows:
    img = snap / f'{n}.png'
    if not img.exists():
        continue
    num = int(n)
    note = notes.get(str(num))
    cls = 'frame chapter' if kind == 'title' else 'frame'
    items.append(
        f'<figure class="{cls}" id="f{num}">'
        f'<figcaption><span class="n">{num}</span>'
        f'{"<span class=tag>titolo</span>" if kind == "title" else ""}'
        f'<span class="t">{html.escape(text)}</span></figcaption>'
        f'{f"<p class=note>{html.escape(note)}</p>" if note else ""}'
        f'<img loading="lazy" alt="Schermata {num}" src="data:image/jpeg;base64,{jpeg(img)}">'
        '</figure>'
    )

page = f'''<title>{html.escape(title)}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
/* layout: una colonna di fotogrammi, numero e didascalia sopra ogni schermata */
:root {{ --bg: #f6f6f3; --fg: #23231f; --muted: #6b6b63; --line: #deded6; --accent: #c4502c; --chip: #f1e1d9;
  --sans: system-ui, -apple-system, "Segoe UI", sans-serif; }}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{ --bg: #1b1b19; --fg: #ecece6; --muted: #a3a39a; --line: #34342f; --accent: #e8794f; --chip: #3a2a23; color-scheme: dark }} }}
:root[data-theme="dark"] {{ --bg: #1b1b19; --fg: #ecece6; --muted: #a3a39a; --line: #34342f; --accent: #e8794f; --chip: #3a2a23; color-scheme: dark }}
body {{ background: var(--bg); color: var(--fg); font-family: var(--sans); font-size: 15px; line-height: 1.45;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 24px 48px; }}
main {{ max-width: 980px; margin: 0 auto; display: grid; gap: 28px; }}
header h1 {{ font-size: 1.5rem; margin: 0 0 4px; text-wrap: balance; }}
header p {{ margin: 0; color: var(--muted); max-width: 65ch; }}
.frame {{ margin: 0; display: grid; gap: 8px; padding-top: 16px; border-top: 1px solid var(--line); }}
.frame.chapter {{ border-top: 2px solid var(--accent); }}
figcaption {{ display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; }}
.n {{ font-variant-numeric: tabular-nums; font-weight: 700; color: var(--accent); min-width: 2.2em; }}
.tag {{ font-size: .75rem; text-transform: uppercase; letter-spacing: .06em; background: var(--chip); color: var(--accent); padding: 1px 8px; border-radius: 4px; }}
.t {{ flex: 1 1 20ch; min-width: 0; }}
.note {{ margin: 0; padding: 6px 10px; background: var(--chip); border-radius: 4px; font-size: .9rem; }}
img {{ display: block; width: 100%; height: auto; border: 1px solid var(--line); border-radius: 4px; }}
</style>
<main>
<header><h1>{html.escape(title)}</h1>
<p>Una schermata per ogni didascalia, nell'ordine del video. Per le correzioni basta il numero: «la 23 non si capisce», «fra la 40 e la 41 manca un passaggio».</p></header>
{''.join(items)}
</main>
'''
out.write_text(page)
print(out, len(items), 'fotogrammi', round(len(page) / 1e6, 1), 'MB')
