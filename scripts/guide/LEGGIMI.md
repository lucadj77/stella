# Rifare gli screenshot della guida

Script usati per gli screenshot di docs/guida e docs/guide (nel cloud, con l'app compilata):

```bash
cd <repo stella> && npm ci && npx electron-vite build
export OUT=/tmp/stella-guide/shots
for l in it en; do for g in a b c d e f g h i l m n; do xvfb-run -a -s "-screen 0 1600x1100x24" node --experimental-strip-types --no-warnings scripts/guide/$g.mjs $l; done; done
cp /tmp/stella-guide/shots/it/*.png docs/guida/img/ && cp /tmp/stella-guide/shots/en/*.png docs/guide/img/
```

- `crea-progetto-esempio.mjs` genera il progetto di esempio (Esempio / Example) in /Users/luca/Documenti o Documents (HOME finto).
- `lib.mjs` lancia Electron con il playwright globale (`/opt/node22/lib/node_modules/playwright`), HOME finto e la lingua scelta; le immagini vanno in `$OUT/<lingua>/` (predefinito `/tmp/stella-guide/shots`). Il numero di versione mostrato nell'app è quello di `package.json` (sotto Electron non impacchettato `app.getVersion()` darebbe la versione di Electron).
- a: ingresso e importazione TTC; b: progetto e dati; c: editor; d: testo, variabili, stili; e: immagini, icone, font; f: generatore, esportazione, crediti, backup, strumenti IA; g: selezione multipla, Iconify, selettore colore; h: finestra Aiuto (Primi passi e Testo, con una memoria nuova); i: documenti (documento, inserisci carta, tabella, anatomia, schema del tavolo); l: livello griglia e contenuto delle caselle; m: assistente formule (tasto fx); n: benvenuto del primo avvio e striscia Primi passi (casa vuota a parte).
- g: l'API di Iconify è finta, costruita dai pacchetti npm `@iconify/collections`, `@iconify-json/mdi` e `@iconify-json/twemoji` scompattati in `/tmp/stella-guide/ic` (`npm pack` e `tar xzf` di ciascuno).
- c: i pannelli delle proprietà si ritagliano sulla larghezza reale di aside.properties.
- b: il + della sezione Set si cerca per testo, perché il title può mancare.
- d: i set si aprono nella griglia, quindi d.mjs passa prima alla tabella.
- i: le finestre si chiudono con un clic sullo sfondo, perché Esc arriva solo se il fuoco è dentro la finestra.
- `lingue.png` e `lingua-carte.png` non dipendono dal nome dell'app e non vanno rifatti a ogni cambio di nome.
- Non nella guida perché non si fanno dal cloud: la scheda Google Fonts (le anteprime non si scaricano), gli oggetti in Tabletop Simulator, Excel/Numbers, gli avvisi di macOS e Windows alla prima apertura.
