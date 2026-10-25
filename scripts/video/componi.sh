#!/bin/sh
# Montaggio dei video con due registrazioni (terminale o scrivania, e app): unisce i pezzi nell'ordine
# dell'elenco scritto da terminale.mjs o scrivania.mjs, tagliando le attese; i pezzi con una didascalia
# la mostrano in basso. L'uscita va poi a monta.sh come le altre
# registrazioni (copertine e musica).
# Uso: sh componi.sh <agente-it.json> <uscita.mp4>
set -e
EDL=$1; OUT=$2
T=$(mktemp -d)
FPS=30
for s in term app; do
  F=$(python3 -c "import json,sys;print(json.load(open('$EDL'))['$s']['file'])")
  ffmpeg -hide_banner -loglevel error -y -i "$F" -r $FPS -pix_fmt yuv420p -c:v libx264 -preset fast -crf 18 "$T/$s.mp4"
done
python3 - "$EDL" "$T" "$OUT" <<'P'
import json, subprocess, sys
edl, T, out = sys.argv[1], sys.argv[2], sys.argv[3]
d = json.load(open(edl))
def dur(f):
    return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f]))
FPS = 30
def flashes(f):
    # i fotogrammi magenta (il segnale di sincronia di agente.mjs): l'inizio di ogni lampo, in secondi
    raw = subprocess.check_output(['ffmpeg','-v','error','-i',f,'-vf','scale=8:8','-f','rawvideo','-pix_fmt','rgb24','-'])
    on, out = False, []
    for i in range(len(raw) // 192):
        r, g, b = raw[i*192 + 108:i*192 + 111]
        m = r > 200 and g < 80 and b > 200
        if m and not on:
            out.append(i / FPS)
        on = m
    return out
# per ogni registrazione: da orologio (ms) a tempo nel video. Con i due lampi la corrispondenza è
# lineare (corregge anche la deriva); senza, l'inizio è la fine meno la durata del video
conv = {}
for s in ('term', 'app'):
    f = f'{T}/{s}.mp4'
    m = d[s].get('marks') or []
    v = flashes(f) if len(m) == 2 else []
    if len(v) >= 2:
        k = (v[-1] - v[0]) / ((m[1] - m[0]) / 1000)
        print(s, 'lampi', [round(x, 2) for x in (v[0], v[-1])], 'scala', round(k, 4))
        conv[s] = lambda t, v0=v[0], m0=m[0], k=k: v0 + (t - m0) / 1000 * k
    else:
        st = d[s]['end'] / 1000 - dur(f)
        conv[s] = lambda t, st=st: t / 1000 - st
FONT = '/usr/share/fonts/opentype/inter/Inter-Bold.otf'
def caption(i, text):
    # didascalia in basso al centro, come i testi grandi dell'app: arancione, bianco, righe brevi
    import textwrap
    tf = f'{T}/c{i:03d}.txt'
    open(tf, 'w').write('\n'.join(textwrap.wrap(text, 52)))
    return ['-vf', f"drawtext=fontfile={FONT}:textfile={tf}:fontsize=36:fontcolor=white:line_spacing=10:text_align=C:box=1:boxcolor=0xE4572E:boxborderw=24|30:x=(w-tw)/2:y=h-th-80"]
parts = []
for i, p in enumerate(d['edl']):
    a = conv[p['src']](p['from'])
    b = conv[p['src']](p['to'])
    if b - a < 0.2:
        continue
    f = f'{T}/p{i:03d}.mp4'
    subprocess.check_call(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',f'{max(0,a):.3f}','-i',f'{T}/{p["src"]}.mp4','-t',f'{b-a:.3f}',*(caption(i, p['caption']) if p.get('caption') else []),'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-r','30','-an',f])
    parts.append(f)
open(f'{T}/list.txt','w').write(''.join(f"file '{p}'\n" for p in parts))
subprocess.check_call(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',f'{T}/list.txt','-c','copy',out])
print(out, len(parts), 'pezzi', round(dur(out), 1), 's')
P
rm -rf "$T"
