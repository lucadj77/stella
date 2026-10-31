#!/usr/bin/env python3
"""Storyboard di un video per la revisione: una schermata per ogni didascalia, numerata, col testo.

Le schermate e testi.tsv vengono da una prova veloce con SNAP:
  FAST=1 SNAP=/tmp/v/snap27 xvfb-run -a node scripts/video/immagini.mjs it
Poi:
  python3 scripts/video/storyboard.py /tmp/v/snap27 "Storyboard video 27" out.html [--prima vecchio.tsv] [n=nota ...]
Con --prima (il testi.tsv dello storyboard già visto) le schermate con lo stesso testo tengono il
vecchio numero; quelle nuove o cambiate prendono un sottonumero (10.1, 10.2…) dopo l'ultima
schermata rimasta uguale, e sono evidenziate. Le note sono coppie numero=testo, col numero del
file (003.png → 3): la schermata con una nota conta come cambiata anche se il testo è lo stesso.
La pagina è un file HTML unico, con le immagini dentro (JPEG ridotte), da pubblicare come Artifact.
"""
import base64
import html
import io
import sys
from pathlib import Path

from PIL import Image

import difflib

snap, title, out = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3])
rest = sys.argv[4:]
before = None
if rest[:1] == ['--prima']:
    before = [l.split('\t', 2) for l in Path(rest[1]).read_text().splitlines() if l.strip()]
    rest = rest[2:]
notes = dict(a.split('=', 1) for a in rest)
rows = [l.split('\t', 2) for l in (snap / 'testi.tsv').read_text().splitlines() if l.strip()]

# il numero da mostrare e se la schermata è nuova o cambiata
labels: dict[str, tuple[str, bool]] = {n: (str(int(n)), False) for n, _, _ in rows}
removed: list[str] = []
if before is not None:
    old = [r[2] for r in before]
    new = [r[2] for r in rows]
    last, sub = 0, 0
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, old, new, autojunk=False).get_opcodes():
        if op == 'equal':
            for k in range(i2 - i1):
                last, sub = int(before[i1 + k][0]), 0
                labels[rows[j1 + k][0]] = (str(last), False)
        else:
            removed += [str(int(before[k][0])) for k in range(i1, i2)]
            for k in range(j1, j2):
                sub += 1
                labels[rows[k][0]] = (f'{last}.{sub}', True)
for n, _, _ in rows:
    if str(int(n)) in notes and before is not None:
        labels[n] = (labels[n][0], True)


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
    label, changed = labels[n]
    cls = 'frame' + (' chapter' if kind == 'title' else '') + (' changed' if changed else '')
    items.append(
        f'<figure class="{cls}" id="f{num}">'
        f'<figcaption><span class="n">{label}</span>'
        f'{"<span class=tag>titolo</span>" if kind == "title" else ""}'
        f'{"<span class=new>nuova o cambiata</span>" if changed else ""}'
        f'<span class="t">{html.escape(text)}</span></figcaption>'
        f'{f"<p class=note>{html.escape(note)}</p>" if note else ""}'
        f'<img loading="lazy" alt="Schermata {num}" src="data:image/jpeg;base64,{jpeg(img)}">'
        '</figure>'
    )

changed = [(labels[n][0], int(n)) for n, _, _ in rows if labels[n][1] and (snap / f'{n}.png').exists()]
summary = ''
if before is not None:
    links = ' '.join(f'<a href="#f{i}">{lab}</a>' for lab, i in changed) or 'nessuna'
    summary = f'<p><strong>Nuove o cambiate rispetto alla versione precedente:</strong></p><p class="jump">{links}</p>'
    if removed:
        summary += f'<p>Tolte: {", ".join(removed)}.</p>'
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
.changed {{ background: var(--chip); padding: 12px; border-radius: 6px; border-top: 2px solid var(--accent); }}
.new {{ font-size: .75rem; text-transform: uppercase; letter-spacing: .06em; background: var(--accent); color: var(--bg); padding: 1px 8px; border-radius: 4px; }}
.jump {{ display: flex; flex-wrap: wrap; gap: 6px; }}
.jump a {{ color: var(--accent); font-variant-numeric: tabular-nums; }}
.note {{ margin: 0; padding: 6px 10px; background: var(--chip); border-radius: 4px; font-size: .9rem; }}
img {{ display: block; width: 100%; height: auto; border: 1px solid var(--line); border-radius: 4px; }}
</style>
<main>
<header><h1>{html.escape(title)}</h1>
<p>Una schermata per ogni didascalia, nell'ordine del video. Per le correzioni basta il numero: «la 23 non si capisce», «fra la 40 e la 41 manca un passaggio».</p>{summary}</header>
{''.join(items)}
</main>
'''
out.write_text(page)
print(out, len(items), 'fotogrammi', round(len(page) / 1e6, 1), 'MB')
