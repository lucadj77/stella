# Versione web

La versione web è la stessa app nel browser, senza installazione: serve dove un programma non si
può installare o avviare, per esempio sui computer aziendali che bloccano i file .exe non firmati.
Lavora sulle cartelle dei progetti del computer come l'app desktop, e i progetti sono gli stessi
file. È pubblicata su GitHub Pages, accanto al sito di presentazione: <https://stella.lucadj.eu/app/> è l'ultima versione
ufficiale, <https://stella.lucadj.eu/beta/> l'ultima beta (o l'ultima ufficiale, se è più
recente). Nel menu ⚙, **Versione** passa dall'una all'altra. Le due stanno sullo stesso sito e
condividono ciò che il browser ricorda (progetti recenti, impostazioni).

## Browser

Serve la File System Access API, che c'è solo nei browser basati su Chromium: Chrome, Edge, Opera.
Brave la tiene spenta: si attiva in `brave://flags/#file-system-access-api` e si riavvia Brave.
Firefox, Safari e Brave senza l'impostazione mostrano una pagina che lo spiega. Il permesso sulla cartella del progetto
si chiede a ogni sessione: il browser lo domanda quando si apre il progetto.

## Cosa manca rispetto all'app desktop

L'elenco è anche nell'app, nella voce **Cosa ha in più la versione desktop** in fondo alla
schermata iniziale (`src/renderer/src/components/DesktopFeaturesDialog.tsx`): quando una funzione
arriva nel web va tolta da lì.

- PDF (componenti e documenti): le pagine vanno alla finestra di stampa del browser, da cui si sceglie "Salva come PDF"
  (margini nessuno, grafica di sfondo attiva). Niente CMYK.
- Immagini PNG, JPG e WebP: si ottengono dall'SVG della carta (lo stesso dell'esportazione in SVG)
  disegnato su un canvas, non da una cattura della pagina. Il risultato può differire di poco
  nella posizione delle lettere. Lo stesso vale per i fogli di Tabletop Simulator.
- Tabletop Simulator: i file vanno solo nella **Cartella di destinazione** scelta con
  **Scegli…**, e la prima volta si incolla il percorso completo della stessa cartella nel campo
  sotto: il browser non lo dice, e il file del mazzo ne ha bisogno per trovare le immagini
  (`src/shared/realPath.ts`, ricordato nel browser per ogni cartella). Un percorso che non finisce
  con il nome della cartella scelta viene rifiutato. Su macOS Chrome non apre le
  cartelle dentro `~/Library`, dove sta `Saved Objects`: si sceglie un'altra cartella, per
  esempio `Documenti/Stella TTS`, e una volta sola si crea in `Saved Objects` un collegamento a
  essa dal Terminale (da verificare con Tabletop Simulator):

  ```bash
  ln -s ~/Documents/"Stella TTS" ~/Library/"Tabletop Simulator"/Saves/"Saved Objects"/"Stella TTS"
  ```

- Google Fonts: nel browser Google dà file WOFF2 divisi per alfabeto, e si salva solo quello
  latino (lettere accentate comprese). Nome, peso e stile si ricavano dal nome del file, perché
  il browser non ha il brotli per leggerli dal WOFF2.
- Font del computer: con la Local Font Access API (Chrome ed Edge, dopo il permesso). Le raccolte
  `.ttc` e i font che vietano l'incorporamento non si copiano.
- Backup: senza una cartella scelta stanno nello spazio privato del sito nel browser, che si
  perde cancellando i dati del sito. Il backup automatico all'apertura parte solo se la cartella
  scelta è già autorizzata. Il ripristino chiede in quale cartella estrarre il backup: il
  browser apre la finestra di scelta solo subito dopo un clic, quindi la si apre per prima.
- Importazione da Tabletop Creator: la cartella di destinazione si sceglie (o si crea) dalla
  finestra del browser e deve essere vuota.
- I cataloghi di game-icons.net e dei font Google sono quelli della versione pubblicata: non si
  aggiornano dall'app.
- Non ci sono: comando `stella` e skill per gli agenti IA, controllo degli aggiornamenti (il sito
  è sempre all'ultima versione), dimensione dell'interfaccia (si usa lo zoom del browser).

## Come funziona

- `src/web/main.ts` crea `window.api` (`src/web/api.ts`) e avvia la stessa interfaccia di
  `src/renderer`. Le differenze nell'interfaccia passano da `window.api.isWeb`.
- Il codice dei progetti è quello di `src/main/project`: in `vite.web.config.mts` i moduli
  `fs/promises`, `path`, `zlib` e `url` di Node sono sostituiti dagli shims in `src/web/shims`, che
  lavorano sulla File System Access API.
- Ogni cartella scelta diventa un percorso virtuale `/<nome della cartella>`
  (`src/web/fs/roots.ts`). Le cartelle autorizzate e i progetti recenti stanno nell'IndexedDB del
  browser.
- Immagini e font del progetto si caricano come URL `blob:` (`src/web/assets.ts`) al posto del
  protocollo `gc-asset://`.
- Le esportazioni usano `src/main/export/run.ts` con un iframe invisibile al posto della finestra
  nascosta di Electron (`src/web/exportFrame.ts`).
- I dati dell'app (impostazioni dei backup, backup senza cartella scelta) stanno nell'Origin
  Private File System del sito, montato come `/.stella` (`DATA_ROOT` in `src/web/fs/roots.ts`);
  `src/web/shims/electron.ts` vi fa puntare `app.getPath`.
- I cataloghi inclusi (`resources/catalogs`, importati con `?asset`) diventano file della build e
  si leggono con `fetch` (plugin `assetFiles` in `vite.web.config.mts`).
- Le parti che nel browser vanno fatte in un altro modo (font Google e del computer, scelta delle
  immagini) sono in `src/web/library.ts`.

## Sviluppo e pubblicazione

```bash
npm run dev:web      # server di sviluppo
npm run build:web    # build in out/web
npm run preview:web  # prova della build
```

L'azione **Web** (`.github/workflows/web.yml`) costruisce la versione web sulle PR e la pubblica
su GitHub Pages a ogni tag `v*`, insieme alla release, oppure a mano da Actions. A ogni
pubblicazione `scripts/web-versions.mjs` sceglie due tag: l'ultima versione ufficiale per
`app/` e la più recente in assoluto per `beta/`; ognuna si costruisce dal suo tag.
Finché nessuna versione ufficiale ha la versione web (la 1.1.0 non la aveva), in `app/` va la beta. Una volta sola
nel repository servono **Settings → Pages → Source: GitHub Actions** e, in **Settings →
Environments → github-pages**, una regola che permetta i tag `v*` (di base l'ambiente accetta solo
il ramo main e rifiuta la pubblicazione dai tag).
