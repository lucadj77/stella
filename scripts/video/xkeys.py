# Tastiera finta per un altro programma (LibreOffice nel video 10) su un display X, con XTest.
# Uso: python3 xkeys.py :77 "fit" "key:ctrl+Home" "type:testo" "wait:500" ...
#   fit       porta le finestre principali a tutto schermo (Xvfb non ha un window manager)
#   key:a+b   una combinazione (ctrl, shift, alt e i nomi dei tasti X: Home, Return, Down, F5…)
#   type:...  scrive il testo un carattere alla volta, al ritmo di una persona; \n è Invio
#   bg:#rrggbb colore dello sfondo dello schermo (e il puntatore a freccia)
#   geom:classe,x,y,l,a  sposta e ridimensiona le finestre di quel programma (classe X, per esempio Pcmanfm)
#   move:x,y  il puntatore scivola fino a quel punto
#   click:x,y / dbl:x,y  ci scivola e fa clic (o doppio clic)
#   flash:ms  lampo magenta a tutto schermo (sincronia per componi.sh)
#   until:classe  aspetta la finestra di quel programma
#   wait:ms   aspetta
# Ogni carattere si scrive mappandone il keysym su un tasto libero: funziona con accenti e simboli
# senza dipendere dalla disposizione della tastiera.
import sys
import time
from Xlib import X, XK, display
from Xlib.ext import xtest

d = display.Display(sys.argv[1])
SPARE = 254
MODS = {'ctrl': 'Control_L', 'shift': 'Shift_L', 'alt': 'Alt_L'}


def code(name):
    return d.keysym_to_keycode(XK.string_to_keysym(name))


def tap(kc, mods=()):
    for m in mods:
        xtest.fake_input(d, X.KeyPress, m)
    xtest.fake_input(d, X.KeyPress, kc)
    xtest.fake_input(d, X.KeyRelease, kc)
    for m in reversed(mods):
        xtest.fake_input(d, X.KeyRelease, m)
    d.sync()


def key(combo):
    parts = combo.split('+')
    mods = [code(MODS[p]) for p in parts[:-1]]
    name = parts[-1]
    kc = code(name) if len(name) > 1 else None
    if not kc:
        ks = XK.string_to_keysym(name) or ord(name)
        d.change_keyboard_mapping(SPARE, [(ks, ks)])
        d.sync()
        time.sleep(0.03)
        kc = SPARE
    tap(kc, mods)


def type_text(text):
    # due tasti liberi a turno: rimappare un tasto mentre l'evento precedente è ancora in coda
    # cambierebbe la lettera appena battuta
    n = 0
    for ch in text:
        if ch == '\n':
            tap(code('Return'))
        else:
            kc = SPARE - (n % 2)
            n += 1
            ks = ord(ch) if ord(ch) < 0x100 else 0x01000000 + ord(ch)
            d.change_keyboard_mapping(kc, [(ks, ks)])
            d.sync()
            time.sleep(0.04)
            tap(kc)
        time.sleep(0.07)


def fit():
    root = d.screen().root
    w, h = d.screen().width_in_pixels, d.screen().height_in_pixels
    for win in root.query_tree().children:
        try:
            g = win.get_geometry()
            if win.get_attributes().map_state == X.IsViewable and g.width > 400:
                win.configure(x=0, y=0, width=w, height=h)
        except Exception:
            pass
    d.sync()


def windows():
    for win in d.screen().root.query_tree().children:
        try:
            if win.get_attributes().map_state == X.IsViewable:
                yield win
        except Exception:
            pass


def geom(arg):
    cls, *g = arg.split(',')
    x, y, w, h = (int(v) for v in g)
    for win in windows():
        wc = win.get_wm_class() or ()
        if any(cls.lower() in c.lower() for c in wc) and win.get_geometry().width > 300:
            win.configure(x=x, y=y, width=w, height=h)
    d.sync()


def bg(color):
    root = d.screen().root
    pixel = d.screen().default_colormap.alloc_color(*(int(color[i:i + 2], 16) * 257 for i in (1, 3, 5))).pixel
    # senza tema dei cursori Xvfb mostra una X: la freccia classica sulla radice vale per tutte le finestre
    font = d.open_font('cursor')
    arrow = font.create_glyph_cursor(font, 68, 69, (0, 0, 0), (65535, 65535, 65535))
    root.change_attributes(background_pixel=pixel, cursor=arrow)
    root.clear_area(0, 0, 0, 0)
    d.sync()


def move(x, y, ms=600):
    p = d.screen().root.query_pointer()
    x0, y0 = p.root_x, p.root_y
    n = max(8, ms // 20)
    for i in range(1, n + 1):
        k = 1 - (1 - i / n) ** 3
        xtest.fake_input(d, X.MotionNotify, x=round(x0 + (x - x0) * k), y=round(y0 + (y - y0) * k))
        d.sync()
        time.sleep(ms / 1000 / n)


def flash(ms):
    # lampo magenta a tutto schermo: il segnale di sincronia che componi.sh ritrova nella registrazione
    sc = d.screen()
    pixel = sc.default_colormap.alloc_color(65535, 0, 65535).pixel
    w = sc.root.create_window(0, 0, sc.width_in_pixels, sc.height_in_pixels, 0, sc.root_depth,
                              background_pixel=pixel, override_redirect=True)
    w.map()
    d.sync()
    time.sleep(ms / 1000)
    w.destroy()
    d.sync()


def has(cls):
    return any(any(cls.lower() in c.lower() for c in (w.get_wm_class() or ())) for w in windows())


def press(times):
    for _ in range(times):
        xtest.fake_input(d, X.ButtonPress, 1)
        xtest.fake_input(d, X.ButtonRelease, 1)
        d.sync()
        time.sleep(0.08)


for cmd in sys.argv[2:]:
    op, _, arg = cmd.partition(':')
    if op == 'fit':
        fit()
    elif op == 'key':
        key(arg)
    elif op == 'type':
        type_text(arg.replace('\\n', '\n'))
    elif op == 'bg':
        bg(arg)
    elif op == 'geom':
        geom(arg)
    elif op in ('move', 'click', 'dbl'):
        x, y = (int(v) for v in arg.split(','))
        move(x, y)
        if op != 'move':
            time.sleep(0.3)
            press(2 if op == 'dbl' else 1)
    elif op == 'flash':
        flash(int(arg or 700))
    elif op == 'until':
        # aspetta che compaia una finestra di quel programma (al massimo 30 s)
        for _ in range(300):
            if has(arg):
                break
            time.sleep(0.1)
    elif op == 'wait':
        time.sleep(int(arg) / 1000)
    time.sleep(0.15)
