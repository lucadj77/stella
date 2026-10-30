# I video della guida

Video senza voce: testi grandi accanto agli elementi evidenziati, copertina iniziale e finale con il logo di
Predigarama Games (non durante la registrazione, dove coprirebbe l'app), musica d'ambiente generata. Si fanno dal cloud con l'app compilata
(`npm ci && npx electron-vite build`) e il playwright globale, come gli screenshot in `scripts/guide`.

```bash
A=/tmp/stella-guide/video/assets && mkdir -p $A
python3 scripts/video/musica.py $A/musica.wav 300 && ffmpeg -y -i $A/musica.wav -b:a 160k $A/musica.m4a
cp scripts/video/assets/predigarama-logo.png $A/
V=panoramica   # oppure primo-componente, tabletop, formule-testo, documenti (agente: vedi sotto)
for l in it en; do
  node scripts/video/copertine.mjs $A $l $V
  rm -rf /tmp/stella-guide/video-ud-$l
  OUT=/tmp/stella-guide/video xvfb-run -a -s "-screen 0 2000x1300x24" node --experimental-strip-types --no-warnings scripts/video/$V.mjs $l
  # l'ultimo comando stampa VIDEO <file.webm>
  sh scripts/video/monta.sh <file.webm> $A $l stella-$V-$l.mp4
done
```

- `lib.mjs`: lancia Electron con la registrazione di Playwright: 1440×900 punti con interfaccia ingrandita 1,2 volte, quindi video a 1728×1080 (1080p; `SCALE=1` per tornare a 1440×900), cursore finto (Playwright non registra il puntatore), `focus(elementi, testo, lato)` per riquadro e testo, `title(testo)` per i titoli di sezione, `click`, `type`. La durata di ogni testo dipende dalla sua lunghezza.
- `panoramica.mjs`: video 1, panoramica delle funzioni di base (circa 3 minuti), con il progetto di esempio di `scripts/guide/crea-progetto-esempio.mjs`.
- `primo-componente.mjs`: video 2, il primo componente da zero (circa 8 minuti): progetto vuoto, template con nome, immagine e icone nel testo (raccolte pronte, rinomina prima di importare), spostare, ridimensionare e ruotare sulla tela, pannello delle proprietà, livelli riordinati e raggruppati, sfondo colorato da una formula, set con le colonne nome, tipo e testo, modifica al template che aggiorna tutte le carte, PDF, in chiusura un segnalino rotondo. Con `FAST=1` attese e scrittura sono brevi, per provare il percorso; `UD=<cartella>` usa un profilo diverso.
- `tabletop.mjs`: video 3, da Stella a Tabletop Simulator (parte nell'app): il progetto di esempio con in più monete, terreni, una plancia e un dado (`progetto-tts.mjs`), un oggetto diverso per ogni set ed esportazione. Il filmato dentro Tabletop Simulator, registrato da Luca sul Mac, si aggiunge al montaggio.
- `formule-testo.mjs`: video 4, testo, icone, stili e formule (circa 5 minuti e mezzo) sul progetto di esempio: markup con i suggerimenti, errori, «Formatta», una variabile icona e le ripetizioni, uno stile, una formula IF, il colore dal foglio, le variabili di sistema, il livello valore e l'aiuto.
- `documenti.mjs`: video 5, il regolamento (circa 5 minuti): testo, grassetto dalla barra, una carta, una tabella, un riquadro, l'anatomia della carta, lo schema del tavolo, la pagina e il PDF.
- `agente.mjs`: video 6, Stella con un agente IA (circa 4 minuti). Registra insieme l'app e un terminale (pagina Chromium) dove l'agente lavora: i comandi `stella` sono veri e lavorano sul progetto aperto nell'app (`begin` la blocca, `end` la sblocca e la fa ricaricare), i file che l'agente scrive (il gioco «Elementi», 24 creature e un segnalino, il regolamento, i profili di esportazione) vengono da `progetto-ia.mjs`, le icone da game-icons.net. Lo script scrive l'elenco dei pezzi (`agente-<lingua>.json`); `componi.sh <elenco> <uscita.mp4>` alterna le due registrazioni e taglia le attese, poi l'uscita va a `monta.sh` come le altre. Per allineare le due registrazioni lo script mostra un lampo magenta a tutto schermo all'inizio e alla fine (fuori dai pezzi del video); `componi.sh` lo ritrova in entrambe e ne ricava dove cade ogni pezzo.
- `snap.mjs`: video 19, snap point e tag di Tabletop Simulator (circa 6 minuti, solo nell'app): la plancia del video 7 (`progetto-plance.mjs` con `final`) con due spazi per le carte del mercato, tag del template, livello Snap, snap ruotato, snap su un livello e in ogni casella della mappa, tasto Snap e occhio, tag per set nell'esportazione.
- `testo.mjs`: video 20, primo della serie Approfondimenti: il testo (circa 13 minuti, 9 capitoli) sul progetto «Mercanti» di `progetto-testo.mjs`, lo stesso che si scarica dal sito (`site/progetti/mercanti.zip` e `merchants.zip`, rifatti con `node scripts/video/progetto-testo.mjs <cartella> it|en` e zippati con la cartella `Mercanti` o `Merchants`). `SNAP=<cartella>` salva una schermata dopo ogni testo, per controllare la prova veloce senza guardarla. I minuti dei capitoli per la descrizione di YouTube si ricavano dai titoli, riquadri arancioni al centro dello schermo.
- `tabellone.mjs`: video 24, approfondimento sul tabellone (circa 28 minuti, 12 capitoli) sul progetto di `progetto-tabellone.mjs`, che si scarica dal sito (`site/progetti/tabellone.zip` e `game-board.zip`, zippati con la cartella `Tabellone` o `Game board`).
- `caso.mjs`: video 25, approfondimento «giocare con il caso» (circa 12 minuti, 6 capitoli) sul progetto di `progetto-risorse.mjs`, che si scarica dal sito (`site/progetti/risorse.zip` e `resources.zip`, zippati con la cartella `Risorse` o `Resources`).
- Nei video 3, 4 e 5 `SHOT=<file.png>` salva una schermata quando un elemento non si trova. La registrazione usa l'app compilata in `out/`: va ricompilata se i testi dell'interfaccia sono cambiati.
- `copertine.mjs`: copertine iniziale e finale (logo da `build/icon.svg`, nome, sottotitolo del video scelto con il terzo argomento, autore Luca Di Gialleonardo, logo Predigarama).
- `musica.py`: brano d'ambiente generato (accordi tenuti e arpeggio in Do maggiore); nessun campione, nessun diritto di terzi.
- `monta.sh`: copertine + registrazione + musica a volume basso, in un mp4 H.264/AAC.
- `assets/predigarama-logo.png`: il logo ritagliato al cerchio, con sfondo trasparente.
- Note: il tasto Salva si chiama «Salvato» quando non c'è nulla da salvare; le finestre si chiudono con il loro tasto Chiudi (Esc arriva solo se il fuoco è dentro la finestra); il documento del video cita la Strega perché il Cavaliere viene rinominato durante la registrazione.
