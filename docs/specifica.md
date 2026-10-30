# Specifica funzionale

Definisce gli oggetti dell'app, le proprietà modificabili di ciascuno, variabili, stili, campi calcolati ed esportazione. Le unità sono millimetri, i colori `#RRGGBB` o `#RRGGBBAA`, le dimensioni del testo in punti (pt).

Ogni proprietà segnata con ◆ può essere esposta in tabella, cioè diventare una colonna del foglio dati (`livello.proprietà`) modificabile carta per carta. Le altre valgono per tutte le carte del template.

## 1. Proprietà comuni a tutti i livelli

| Proprietà            | Valori                                                       | Note                                                                 |
| -------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------- |
| nome                 | testo univoco nel template                                   | è anche il nome della colonna nel foglio                             |
| visibile ◆           | sì/no                                                        |                                                                      |
| bloccato             | sì/no                                                        | non selezionabile sulla tela                                         |
| x, y ◆               | mm                                                           | posizione dell'angolo in alto a sinistra rispetto al bordo di taglio |
| larghezza, altezza ◆ | mm                                                           |                                                                      |
| rotazione ◆          | gradi                                                        | attorno al punto di ancoraggio                                       |
| punto di ancoraggio  | 9 posizioni                                                  | centro di rotazione; resta fermo cambiando le misure dal pannello    |
| opacità ◆            | 0–100%                                                       |                                                                      |
| fusione              | normale, moltiplica, scolora, sovrapponi                     |                                                                      |
| ombra                | colore, sfocatura, distanza x e y                            |                                                                      |
| vincoli              | sinistra, destra, centro, entrambi (orizzontale e verticale) | comportamento quando cambia la dimensione del template o del gruppo  |
| sorgente del valore  | fissa, colonna, formula                                      | vedi sezione 7                                                       |

Stato (ottobre 2026): fusione e vincoli ci sono. I vincoli si applicano quando si cambia il formato del template scegliendo "lascia i livelli"; "scala" ridimensiona il livello in proporzione alla carta. Nei gruppi vale il vincolo di ciascun figlio. Nelle celle il contorno si scrive `colore/spessore/tratteggio`, per esempio `red/0.3/dashed` o `#333/0.5/dotted`.

**Avanzate.** Nel pannello proprietà ogni sezione mostra sempre le voci più usate e raccoglie le altre in **Avanzate**, chiusa (si ricorda se la si apre). Passando sopra una voce compare a sinistra una freccia: ↓ la sposta in Avanzate, ↑ la riporta tra quelle sempre visibili. La disposizione è una preferenza dell'interfaccia, uguale per tutti i progetti, per sezione (geometria, aspetto, testo, immagine, forma); **Ripristina la disposizione predefinita** in fondo ad Avanzate torna a quella di base. Di base stanno in Avanzate: punto di ancoraggio e vincoli; fusione, dissolvenza, ombra e blocco; per il testo spaziatura tra lettere e paragrafi, rientro, margini interni, maiuscole, sottolineato, barrato, a capo e contorno; per le immagini riflessioni, regolazioni, raggio, contorno e immagine mancante.

La dissolvenza dell'opacità (pannello Aspetto) rende il livello trasparente in modo graduale. Si sceglie la direzione (verso il basso, l'alto, destra, sinistra, con un angolo, verso i bordi o verso il centro) e con tre cursori dove comincia, dove finisce e quanto resta visibile alla fine; una barra mostra l'effetto. Non si imposta dal foglio.

## 2. Testo

| Proprietà                | Valori                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------- |
| contenuto ◆              | testo con formattazione inline e variabili (sezione 2.1)                           |
| stile                    | nome di uno stile di testo (sezione 6)                                             |
| font, peso, corsivo ◆    | famiglia di Google Fonts o font del progetto                                       |
| dimensione ◆             | pt                                                                                 |
| colore ◆                 | colore o variabile colore                                                          |
| allineamento orizzontale | sinistra, centro, destra, giustificato                                             |
| allineamento verticale   | alto, centro, basso                                                                |
| interlinea               | % della dimensione                                                                 |
| spaziatura caratteri     | ‰                                                                                  |
| spaziatura paragrafi     | mm                                                                                 |
| rientro prima riga       | mm                                                                                 |
| margini interni          | mm sui quattro lati                                                                |
| trasformazione           | nessuna, MAIUSCOLO, minuscolo, Iniziali                                            |
| decorazione              | sottolineato, barrato                                                              |
| contorno del testo       | colore, spessore in mm o in % della dimensione del testo                           |
| adattamento              | nessuno, riduci per stare nel riquadro (dimensione minima e massima), tronca con … |
| a capo                   | automatico, nessuno                                                                |
| icone inline             | altezza rispetto alla riga (%), spostamento verticale                              |

Stato: ci sono tutte le proprietà della tabella tranne il troncamento con … e la trasformazione in Iniziali, che segue la regola del browser (ogni parola). I margini interni sono uguali sui quattro lati o, con **Margini per lato**, diversi per ciascuno. Senza a capo automatico ogni paragrafo resta su una riga.

### 2.1 Markup del testo

Il testo si salva, nel progetto e nel foglio, con un unico markup: Markdown per la formattazione di base più un'estensione per colore, dimensione, evidenziazione e stili. L'editor della carta lo mostra già formattato e lo scrive tramite la barra strumenti, ma si può scrivere a mano anche in Excel. Non si usa HTML.

#### Markdown

| Scrivi                       | Ottieni                                                  |
| ---------------------------- | -------------------------------------------------------- |
| `**testo**`                  | grassetto                                                |
| `*testo*`                    | corsivo                                                  |
| `++testo++`                  | sottolineato                                             |
| `~~testo~~`                  | barrato                                                  |
| `==testo==`                  | evidenziato con il colore di evidenziazione del progetto |
| `^testo^` / `~testo~`        | apice / pedice                                           |
| `# Titolo`, `## Sottotitolo` | paragrafo con lo stile `heading1` / `heading2`           |
| `> testo`                    | paragrafo con lo stile `note`                            |
| `- voce` / `1. voce`         | elenco puntato / numerato                                |
| `---`                        | linea separatrice                                        |
| a capo                       | nuovo paragrafo                                          |
| riga vuota                   | paragrafo vuoto (spazio verticale)                       |
| `\` a fine riga              | a capo senza nuovo paragrafo                             |
| `_testo_`                    | non va mai a capo, come `[testo]{nowrap}`                |

Gli stili `heading1`, `heading2` e `note` esistono in ogni progetto e si modificano come gli altri.

Diversamente dal Markdown, ogni a capo inizia un nuovo paragrafo: è ciò che ci si aspetta scrivendo in una cella di Excel con Alt+Invio. Gli asterischi staccati dal testo (`3 * 4`) restano asterischi.

#### Attributi: `[testo]{...}`

Le parentesi quadre delimitano il testo, le graffe subito dopo dicono come formattarlo. Gli attributi si combinano separati da spazi. Le parole chiave sono in inglese, come tutti gli identificatori dell'app (sezione 2.2).

**Carattere**

| Attributo                               | Esempio                                       | Effetto                                                                         |
| --------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------- |
| `.name`                                 | `[pino]{.keyword}`                            | applica uno stile                                                               |
| `color=`                                | `[Attenzione]{color=red}` · `{color=#A33A2A}` | colore del testo, da palette o esadecimale                                      |
| `highlight=`                            | `[raro]{highlight=yellow}`                    | colore di evidenziazione dietro il testo                                        |
| `size=`                                 | `{size=14}` · `{size=+2}` · `{size=80%}`      | dimensione in pt, relativa o in percentuale                                     |
| `font=`                                 | `{font=Cinzel}` · `{font=Open_Sans}`          | famiglia; `_` al posto degli spazi                                              |
| `weight=`                               | `{weight=800}`                                | peso del carattere                                                              |
| `stroke=`                               | `{stroke=white/0.3}` · `{stroke=white/8%}`    | contorno delle lettere: colore/spessore in mm o in % della dimensione del testo |
| `spacing=`                              | `{spacing=50}`                                | spaziatura caratteri in ‰, vale anche per le immagini nel testo                 |
| `raise=`                                | `{raise=1}`                                   | spostamento dalla linea di base in pt                                           |
| `upper`, `lower`, `smallcaps`           | `[Fase]{smallcaps}`                           | trasformazione                                                                  |
| `nowrap`                                | `[4 monete]{nowrap}`                          | la porzione non va a capo                                                       |
| `bold`, `italic`, `underline`, `strike` | `{.flavor italic}`                            | come i segni Markdown, utili negli stili                                        |
| `left`, `center`, `right`, `justify`    | `{.flavor center}`                            | allineamento, solo per un paragrafo o in uno stile                              |

**Riquadro attorno al testo**

Trasformano la porzione di testo in un riquadro in linea, che segue la riga come un'icona.

| Attributo     | Esempio                             | Effetto                                                                                  |
| ------------- | ----------------------------------- | ---------------------------------------------------------------------------------------- |
| `border=`     | `[Rapido]{border=red/0.3}`          | bordo attorno al testo, colore/spessore in mm                                            |
| `fill=`       | `[Rapido]{fill=#EDE4D3}`            | colore di sfondo del riquadro                                                            |
| `radius=`     | `{radius=1}` · `{radius=round}`     | raggio degli angoli in mm, `round` per una pillola o un cerchio                          |
| `pad=`        | `{pad=0.5}` · `{pad=0.5/1}`         | margine interno in mm (verticale/orizzontale)                                            |
| `bg=`         | `[7]{bg=square}` · `[3]{bg=shield}` | immagine di sfondo: una variabile immagine o un file; il testo è centrato sopra          |
| `bg-color=`   | `{bg=shield bg-color=blue}`         | tinta dell'immagine di sfondo                                                            |
| `bg-size=`    | `{bg-size=140%}` · `{bg-size=4}`    | dimensione dello sfondo rispetto alla riga o in mm; di base si adatta al testo più `pad` |
| `text-raise=` | `[-1]{bg=cuore text-raise=1}`       | sposta in su (in pt, negativo in giù) solo il testo dentro il riquadro, non il riquadro  |

Esempi:

- `[7]{bg=square color=white weight=800}`: il numero 7 in bianco dentro l'icona quadrata.
- `[3]{bg=shield bg-color=blue color=white size=-1}`: un 3 dentro uno scudo colorato di blu.
- `[{forza}]{bg=circle bg-color=red color=white}`: il valore del campo forza dentro un cerchio rosso.
- `[Rapido]{border=red/0.3 radius=round pad=0.3/1}`: una parola chiave in una pillola bordata.

Le forme `circle`, `square`, `rounded`, `hexagon` e `diamond` sono sempre disponibili come sfondo senza definire variabili.

#### Variabili e campi

| Scrivi                        | Ottieni                                                                          |
| ----------------------------- | -------------------------------------------------------------------------------- |
| `{spada}`                     | variabile del progetto (icona, testo formattato, colore, valore)                 |
| `{forza}`                     | valore di un campo della carta, anche calcolato                                  |
| `{spada*3}` · `{spada*forza}` | icona ripetuta tre volte o tante volte quanto vale il campo                      |
| `{img}` · `{img*3}`           | l'immagine che il livello immagine `img` mostra su quella carta, una o tre volte |
| `\{`, `\*`, `\[`              | carattere letterale                                                              |

Se una variabile e un campo hanno lo stesso nome vince il campo, e l'app lo segnala. Il nome di un livello immagine (o della colonna da cui prende il valore) richiama l'immagine che quel livello mostra sulla carta, non il nome del file: con `img` = `spada`, `Ottieni {img}` disegna la spada. Nelle ripetizioni anche un campo di testo dà il nome dell'immagine: con `risorsa` = `legno` o `{legno}`, `{risorsa*2}` vale `{legno*2}`.

`{nome}` che non è né un campo né una variabile si cerca tra le immagini di `assets/` (sezione 3.1) e si disegna come icona alta quanto la riga. Se non si trova, il testo resta com'è, sottolineato in rosso, e il problema compare sotto la carta.

#### Aiuto alla scrittura

Nell'editor della carta, nei campi di testo del pannello e nelle celle della tabella:

- digitando `{` compaiono variabili e campi, con anteprima;
- dentro `{...}` dopo `]` compaiono gli attributi, ciascuno con una riga che spiega cosa fa, poi i valori possibili (stili dopo `.`, colori dopo `color=`, forme dopo `bg=`);
- il markup è colorato e gli errori (attributo sconosciuto, variabile inesistente, immagine ambigua) sono sottolineati con la spiegazione al passaggio del mouse.

Stato attuale: i suggerimenti funzionano nel pannello proprietà, nei campi della carta e nelle celle della tabella (↑↓ per scegliere, Invio o Tab per inserire, Esc per chiudere); gli errori sono elencati sotto il campo e sotto la carta. Mentre si scrive, il campo colora il markup: graffe e quadre, nomi di campi e variabili, stili, attributi e valori, segni Markdown e caratteri letterali; gli errori sono sottolineati. Tra i suggerimenti le variabili immagine mostrano l'icona, e sotto l'elenco si vede l'anteprima della variabile scelta: l'icona, il testo già formattato, il colore o il valore.

#### Editor del formato e degli stili

Nei campi del pannello e della carta, il pulsante "Aa Formatta…" apre un editor visuale degli attributi: si seleziona del testo (che diventa `[testo]{...}`) oppure si mette il cursore dentro una porzione `[testo]{...}` esistente per modificarla. L'editor mostra un'anteprima, i campi per ciascun attributo e il testo degli attributi come si scrive, sincronizzato. "Rimuovi formattazione" toglie le parentesi; "Salva come stile…" salva gli attributi come stile del progetto e sostituisce la formattazione con `{.nome}`.

Gli stili del progetto sono elencati nella sezione "Stili" della barra laterale e si modificano con lo stesso editor; uno stile del progetto con il nome di uno predefinito lo sostituisce. Rinominare uno stile aggiorna i testi che lo usano (`{.nome}`, `[testo]{.nome}`), lo stile dei livelli e gli stili che si basano su di esso.

#### Esempio completo

```
# Cavaliere
Quando attacchi, pesca **una carta**.
Bonus +1 {spada} contro i [pino]{.keyword}.
Costo: [3]{bg=circle bg-color=blue color=white}

{.flavor center} *Il castello non cadrà stanotte.*
```

### 2.2 Lingua

L'interfaccia è in inglese, con la traduzione italiana come prima lingua aggiuntiva. Tutto ciò che si scrive nei file resta in inglese e non dipende dalla lingua dell'interfaccia: parole chiave del markup, nomi degli stili predefiniti, funzioni delle formule, chiavi dei file di progetto, colonna `amount`, forme predefinite. I nomi scelti dall'utente (livelli, campi, variabili, stili, set) restano come li scrive.

### 2.3 Font

Un font si indica con il nome della famiglia (`Cinzel`, `Open Sans`), nel livello o nel markup (`font=Open_Sans`). Al posto del nome si può scrivere una variabile di testo tra graffe, `{titoli}`, nel campo del font, negli stili e nel markup (`font={titoli}`): cambiando il testo della variabile cambia il font di tutti i livelli che la usano, come per le variabili colore. Il campo del font propone le variabili di testo e mostra il font che ne risulta.

- I file di font del progetto stanno in `assets/fonts/` (`.ttf`, `.otf`, `.woff`, `.woff2`), anche in sottocartelle. All'apertura del progetto l'app legge da ogni file famiglia, peso e stile, compresi i font variabili, e li usa in anteprima e nell'esportazione; dopo aver copiato un font serve **Ricarica**. Se un file non si legge, la famiglia è il nome della sottocartella (`fonts/Open Sans/...`) o la parte del nome del file prima di `-`.
- Nunito, il font predefinito, è incluso nell'app e funziona senza rete.
- Anche i font installati sul computer si possono usare, ma un progetto che li usa non si vede uguale su un altro computer: conviene copiarli in `assets/fonts/` quando la licenza lo permette.
- Un font che non è né nel progetto, né nell'app, né installato viene segnalato sotto la carta, sotto il campo del font e al termine dell'esportazione. Il testo usa intanto un font predefinito.

## 3. Immagine

| Proprietà                 | Valori                                                                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| sorgente ◆                | file in `assets/`, variabile immagine, oppure colonna o formula che restituisce un nome di file (risoluzione dei nomi: sezione 3.1) |
| ritaglio ◆                | parte dell'immagine da usare: x, y, larghezza, altezza in % del file; nessuno = immagine intera                                     |
| adattamento               | riempi (ritaglia), riempi (lascia uscire), adatta (bande vuote), allunga, dimensione originale, ripeti                              |
| allineamento interno      | 9 posizioni                                                                                                                         |
| zoom, spostamento x e y ◆ | %, mm                                                                                                                               |
| rotazione dell'immagine ◆ | gradi; ruota l'immagine dentro il riquadro, che resta fermo                                                                         |
| specchia                  | orizzontale, verticale ◆                                                                                                            |
| tinta ◆                   | colore e intensità; ricolora le icone monocromatiche                                                                                |
| regolazioni               | scala di grigi, luminosità, contrasto, saturazione                                                                                  |
| raggio angoli             | mm                                                                                                                                  |
| contorno                  | colore, spessore                                                                                                                    |
| immagine mancante         | mostra segnaposto, nascondi livello                                                                                                 |

Stato: **ripeti** affianca l'immagine alla sua dimensione originale (300 DPI per le immagini raster), a partire dalla posizione data dall'allineamento interno; lo zoom cambia la dimensione delle piastrelle. La rotazione dell'immagine gira intorno al centro dell'immagine; l'adattamento tiene conto della rotazione: con **riempi** l'immagine ruotata copre sempre tutto il riquadro (vale anche per **riempi (lascia uscire)**, che ha la stessa misura ma non ritaglia: la parte che esce dal riquadro resta visibile, fino al bordo della carta; utile con zoom oltre il 100% o per un'immagine che sborda di proposito), con **adatta** ci sta tutta dentro. Un'immagine orizzontale ruotata di 90° riempie così un riquadro verticale senza bande. Con **ripeti** ruota tutta la trama. Il **ritaglio** non modifica il file: sceglie la parte dell'immagine che il livello usa, e adattamento, allineamento, zoom e rotazione trattano quella parte come se fosse l'immagine intera. Si sceglie con il pulsante **Ritaglia…**, che mostra l'immagine intera con un rettangolo da spostare e ridimensionare, libero o con le proporzioni del riquadro del livello (così con **riempi** non si perde altro), oppure con i campi in percentuale. Nel foglio la colonna `livello.crop` vale `x y larghezza altezza` in percentuale (`10 0 50 50`; il simbolo % è facoltativo), `none` per l'immagine intera anche se il template ha un ritaglio, vuota per il ritaglio del template. Le regolazioni si applicano prima della tinta. Il contorno può essere continuo, tratteggiato o a punti, come quello delle forme.

### 3.1 Risoluzione dei nomi di file

Ovunque si indichi un'immagine (livello, campo, formula, variabile, `bg=`) basta il nome del file, senza percorso e senza estensione. Accanto al campo dell'immagine, nel pannello delle proprietà e nei campi della carta, un pulsante apre le miniature delle immagini di `assets/`, con ricerca approssimata per nome e filtro per cartella; un clic scrive il nome. Nell'editor di formattazione il campo **Sfondo** (`bg=`) si scrive a mano, con i suggerimenti, o si sceglie con lo stesso pulsante, che qui propone prima le forme predefinite e le variabili immagine e poi le immagini di `assets/`.

1. Si cerca in tutto `assets/`, sottocartelle comprese.
2. Un nome con estensione (`spada.png`) o con percorso (`icone/spada`) vale così com'è.
3. Senza estensione si accettano `.svg`, `.png`, `.webp`, `.jpg`, `.jpeg`.
4. Se il nome corrisponde a più file (`spada.png` e `spada.svg`, oppure `spada.png` in due sottocartelle) l'app non sceglie da sola: segnala l'ambiguità sulla carta e in tabella, e chiede di aggiungere estensione o percorso.
5. Una variabile immagine con lo stesso nome di un file prevale sul file.

## 4. Forma

| Proprietà     | Valori                                                                                                     |
| ------------- | ---------------------------------------------------------------------------------------------------------- |
| tipo          | rettangolo, ellisse, poligono regolare (n lati), stella (n punte, rapporto interno), linea, da un'immagine |
| raggio angoli | mm, uguale o diverso per ogni angolo                                                                       |
| riempimento ◆ | nessuno, colore, gradiente lineare o radiale, immagine ripetuta                                            |
| contorno ◆    | colore, spessore, posizione (interno, centrato, esterno), tratteggio, terminazioni                         |
| punti         | modificabili sulla tela per poligoni e tracciati                                                           |

Stato (ottobre 2026): il riempimento accetta un colore o un gradiente in sintassi CSS, sia nel pannello sia nelle celle: `linear-gradient(90deg, #A33A2A, #FFD27A 70%)` o `radial-gradient(white, rosso)`. Nei gradienti si possono usare le variabili di colore. Il passaggio tra due colori è ammorbidito: si mescolano in OKLab con un'accelerazione graduale, così il centro non si spegne e non si vede uno spigolo sui colori intermedi. La linea va da un punto A a un punto B: si trascinano gli estremi sulla carta (Maiuscolo tiene l'angolo a scatti di 15°) o si scrivono le coordinate. La forma "da un'immagine" usa la sagoma di una PNG con trasparenza o di una SVG del progetto (nelle immagini senza trasparenza, le parti scure); l'altezza segue le proporzioni dell'immagine. L'immagine ripetuta come riempimento non c'è: si ottiene con un livello immagine in modalità "ripeti".

## 5. Gruppo

| Proprietà               | Valori                                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| figli                   | qualsiasi livello, compresi altri gruppi                                                                        |
| ritaglia ai bordi       | sì/no; con il primo figlio come maschera                                                                        |
| disposizione automatica | nessuna, riga, colonna, griglia; spaziatura e allineamento                                                      |
| ripetizione ◆           | ripete il contenuto N volte, con N fisso o da un campo (per esempio un'icona di forza ripetuta `{forza}` volte) |

Stato (ottobre 2026): disposizione e ripetizione ci sono. Con la disposizione il riquadro del gruppo diventa l'area in cui i figli si mettono, uno dopo l'altro nell'ordine del pannello livelli, con la spaziatura scelta. "Contenuto" sposta l'insieme all'inizio, al centro o alla fine dell'area (nella griglia in entrambe le direzioni); "ogni figlio" allinea ciascun figlio nell'altra direzione. I figli tengono la loro misura e quelli nascosti non occupano spazio; nella griglia le celle hanno la misura del figlio più grande.

"Ripeti" accetta un numero o un campo, per esempio `{forza}`, e si può cambiare anche dalla colonna `nome.repeat`. Una cella vuota vale 0; nel template senza dati un campo vale 1. Le copie seguono la disposizione; senza disposizione l'insieme dei figli si ripete in riga. Con "ritaglia" la maschera resta ferma e non si ripete. Nell'editor le copie si vedono ma non si selezionano: si modifica il primo esemplare.

## 6. Variabili e stili

### 6.1 Variabili

Definite a livello di progetto, si richiamano con `{nome}` in qualunque testo e in qualunque campo.

| Tipo             | Contenuto                                                           | Esempio                                         |
| ---------------- | ------------------------------------------------------------------- | ----------------------------------------------- |
| immagine         | file, tinta, altezza, spostamento, rotazione, ribaltamento, opacità | `{spada}` → icona della spada in rosso          |
| testo formattato | testo di sostituzione e stile o formattazione                       | `{pino}` → "pino" in verde e grassetto          |
| colore           | un colore con nome                                                  | `{rosso}` usabile in qualsiasi proprietà colore |
| valore           | testo o numero costante                                             | `{max_mano}` → 7                                |

Ogni variabile ha un'anteprima nell'elenco. Rinominare una variabile aggiorna i riferimenti in template e fogli.

Stato attuale: le variabili sono nella sezione "Variabili" della barra laterale, con un editor che mostra l'anteprima in una frase di prova, e si salvano in `stella.json` (docs/formato.md). Le variabili immagine hanno file, tinta, dimensione rispetto alla riga e spostamento verticale; quelle di testo possono contenere markup e richiamare altre variabili; quelle valore entrano nelle formule come i campi; quelle colore valgono in ogni proprietà colore dei livelli e negli attributi del markup (`color=`, `bg-color=`, `fill=`, `border=`, `highlight=`), scritte come `rosso` o `{rosso}`, e compaiono tra i suggerimenti. Nelle proprietà colore dei livelli (riempimento, anche dentro un gradiente, colore del testo, contorno, ombra, tinta) `{nome}` può essere anche un campo della carta, per esempio un livello valore calcolato con `=IF({forza}>3; "rosso"; "#2F5DA8")`: il valore del campo può essere un codice, un nome di colore o una variabile colore. Come nei testi, un campo vince su una variabile con lo stesso nome; un campo vuoto non colora. I livelli valore compaiono tra i suggerimenti del campo colore. Rinominare una variabile aggiorna i richiami nei template, nelle celle dei fogli, nelle altre variabili e negli stili (`{nome}`, `{nome*3}`, `color=nome`, e il nome senza graffe nelle proprietà colore e immagine); dove un campo ha lo stesso nome, `{nome}` è il campo e resta com'è. ⌘Z annulla la rinomina. Una variabile immagine con tinta "colore del testo" (`currentColor`) prende il colore del testo in cui è inserita. Una variabile immagine può avere uno sfondo (`bg`: forma predefinita, file o un'altra variabile immagine, con `bgColor` e `bgPad`, lo spazio attorno all'immagine): nei testi, nei livelli immagine, negli schemi del tavolo e negli export dei documenti l'immagine si disegna al centro dello sfondo, in un quadrato (model/shapes.ts). Un `bg=` del markup che richiama una variabile con sfondo usa solo l'immagine della variabile.

Le immagini nel testo, variabili o file di `assets/`, accettano attributi dopo il nome, che per quel solo uso prevalgono su quelli della variabile: `{spada tint=red size=150% rotate=90 flip=h opacity=50%}`, anche con le ripetizioni (`{spada*3 tint=red}`).

| Attributo  | Esempio       | Effetto                                                                                      |
| ---------- | ------------- | -------------------------------------------------------------------------------------------- |
| `tint=`    | `tint=red`    | ricolora l'immagine; `none` tiene i colori originali, `currentColor` usa il colore del testo |
| `size=`    | `size=150%`   | altezza rispetto alle icone normali (anche `1.5`)                                            |
| `raise=`   | `raise=10`    | spostamento verticale in % della riga; negativo abbassa                                      |
| `rotate=`  | `rotate=90`   | rotazione in gradi, in senso orario                                                          |
| `flip=`    | `flip=h`      | ribaltamento orizzontale (`h`), verticale (`v`), entrambi (`hv`) o `none`                    |
| `opacity=` | `opacity=50%` | opacità                                                                                      |

Se il nome è un campo, il suo valore diventa il nome dell'immagine: con `icona` = `spada`, `{icona tint=red}` dà `{spada tint=red}`. Una variabile immagine usata come sorgente di un livello immagine porta con sé tinta, ribaltamento e opacità; la rotazione è quella del livello.

### 6.1.1 Variabili di sistema

Valori che Stella conosce da sé, scritti come i campi nei testi e nelle formule. Il punto nel nome li distingue dalle variabili del progetto, che non lo ammettono; un campo o una variabile con lo stesso nome ha comunque la precedenza.

| Variabile         | Valore                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------- |
| `{project.name}`  | nome del progetto (nella lingua delle carte, se tradotto)                                 |
| `{set.name}`      | nome del set (nella lingua delle carte, se tradotto)                                      |
| `{template.name}` | nome del template della carta (anche quello scelto nella colonna `template`)              |
| `{card.number}`   | riga della carta nel set, da 1                                                            |
| `{set.rows}`      | righe del set                                                                             |
| `{set.cards}`     | carte del set con le copie: somma di `amount` (vuoto vale 1)                              |
| `{card.copies}`   | `amount` della carta                                                                      |
| `{card.copy}`     | copia disegnata, da 1; diversa per ogni copia solo esportando PDF e immagini con le copie |
| `{card.side}`     | `front` o `back`                                                                          |
| `{date}`          | data di oggi, AAAA-MM-GG                                                                  |

Dove manca il contesto (l'editor senza carta in anteprima, la miniatura di un template senza set) i valori del set e della carta sono vuoti. In Tabletop Simulator tutte le copie mostrano `{card.copy}` = 1, perché il mazzo ripete la stessa immagine.

L'aiuto interno (pulsante **Aiuto**, F1) elenca markup, campi e variabili, variabili di sistema, formule e scorciatoie.

### 6.2 Stili di testo

Uno stile raggruppa proprietà di carattere (font, peso, corsivo, dimensione, colore, trasformazione, decorazione, contorno) e, se applicato a un intero livello, anche di paragrafo (allineamento, interlinea, spaziature).

- Uno stile può basarsi su un altro ed ereditarne le proprietà non ridefinite.
- Si applica a un intero livello di testo (proprietà `style`), a un paragrafo (`{.name}` a inizio riga) o a una porzione (`[testo]{.name}`).
- Modificare uno stile aggiorna tutte le carte che lo usano.
- La formattazione locale prevale sullo stile.

### 6.3 Colori

- **Nomi predefiniti.** I nomi di colore standard del web (`red`, `yellow`, `blue`, `darkgreen`, ... sono 148 in tutto) funzionano ovunque senza creare variabili.
- **Palette del progetto.** Le variabili di tipo colore formano la palette. Una variabile con lo stesso nome di un colore predefinito lo ridefinisce in tutto il progetto: per esempio `red` = `#A33A2A`.
- **Selettore.** Il campione accanto a ogni campo colore apre il selettore dell'app: area saturazione/valore, cursori per tonalità e trasparenza, codice esadecimale, campi RGB o HSL (si sceglie quale, e la scelta resta), contagocce che prende un colore da qualunque punto dello schermo, colori del progetto e gli ultimi 12 colori scelti (comuni a tutti i progetti). Scrive sempre `#RRGGBB`, o `#RRGGBBAA` se il colore è trasparente; un colore del progetto si scrive per nome. Esc o un clic fuori lo chiudono.

## 7. Campi calcolati

Scelta rivista il 2026-10-18: i calcoli stanno nel template, non nei set (vedi docs/requisiti.md).

- **Fonte del valore.** Ogni livello prende il valore principale da una colonna del foglio (di base quella con il suo nome), da un valore fisso o da una formula.
- **Livello valore.** Un livello di tipo `value` non si disegna: contiene un valore della carta che le formule e i testi degli altri livelli usano come `{nome}`. Una colonna con lo stesso nome lo cambia carta per carta; può avere a sua volta una formula. I livelli valore si calcolano in ordine, quindi uno può usare quelli che lo precedono.
- **Campi disponibili.** `{campo}` vale, nell'ordine di precedenza: il livello valore calcolato, la cella non vuota della riga, il valore del livello nel template. Senza dati (nell'editor) le formule mostrano il risultato con i valori del template. Una cella vuota lascia il valore del template; una cella con soli spazi lo svuota (per le colonne delle proprietà, come `titolo.size`, conta come vuota).
- **Composizione.** Una formula senza `=` iniziale compone testo: `{nome}.png`, `Forza {forza}`. Se contiene `+ - * /` e il risultato è numerico, si calcola: `{forza}+2`.
- **Espressione.** Con `=` iniziale è un'espressione come in Excel: `=IF({forza}>3; "Forte"; "Debole")`. Testi tra virgolette, confronti `= <> < > <= >=`, `&` per unire testi, argomenti separati da `;` o `,`. Una virgola tra due cifre (`2,5`) è il separatore dei decimali se la lingua principale usa la virgola (`numberFormat` in stella.json, vedi docs/formato.md), altrimenti è un errore: `=MIN(2,5; 3)` non diventa `MIN(2; 5; 3)`. I numeri del foglio e i risultati scritti sui livelli di testo seguono il formato della lingua della carta; nomi di file, colori e misure no. Funzioni (nomi in inglese): `IF`, `AND`, `OR`, `NOT`, `MIN`, `MAX`, `ABS`, `ROUND`, `FLOOR`, `CEILING`, `UPPER`, `LOWER`, `LEN`, `CONCAT`, `ISBLANK`, `COUNTIN` (quante volte un testo compare in un altro, senza badare alle maiuscole: `COUNTIN({risorse}; "legno")`), `INLIST` (vero se il valore è in un elenco: voci separate da `;` o scritte con le virgole in un solo testo, `1-5` vale per i numeri da 1 a 5, i testi senza badare alle maiuscole: `INLIST({cell.index}; "3, 8, 11")`), `MOD` (resto della divisione, con il segno del divisore come in Excel), `PICK` (l'elemento n-esimo di una lista, da 1, che ricomincia dopo l'ultimo: `PICK({cell.index}; "a"; "b")`; un solo argomento con le virgole si divide in una lista), `CELLNUMBER` (nel contenuto di una griglia, il numero continuo della casella: `CELLNUMBER("up"; "rows"; "snake"; "all"; 1)` dà 1 2 3 4 / 8 7 6 5; `"down"` decrescente, `"columns"` per colonna, `"straight"` in sequenza, `"visible"` salta le caselle nascoste, l'ultimo argomento è il numero da cui partire).
- **Numeri.** Un campo è un numero anche scritto come lo mostra un foglio: `1,5`, `50%` (vale 0,5), `1 234,50 €`, `1.234,5`. Nei calcoli e nei confronti vale il numero; dove non si calcola resta com'è scritto, quindi `=IF({forza}>1; {prob}; "")` dà `50%`.
- I campi mancanti e gli errori sono segnalati sotto la carta e nel pannello proprietà.

### 7.1 Lingue

Un progetto può avere più lingue (`languages` in `stella.json`, la prima è la principale; vedi docs/formato.md). I testi tradotti stanno nelle colonne `campo@lingua` del foglio, accanto a quelle della lingua principale.

- **Lingua delle carte.** Il selettore accanto al nome del progetto sceglie in che lingua mostrare le carte: anteprime, griglia, editor e documenti. In un'altra lingua una cella `nome@en` non vuota prende il posto di `nome`; una vuota lascia il testo della lingua principale. Doppio clic sulla carta e clic su un campo vanno alla colonna tradotta, se il foglio la ha.
- **Cosa si traduce.** Solo ciò che si legge: il testo dei livelli di testo, `{campo}` dentro i testi, le formule senza `=` dei livelli di testo e dei livelli valore. Nomi di immagini e font, colori, ripetizioni e formule con `=` usano i valori della lingua principale: così `=IF({tipo}="Attacco"; ...)` funziona in ogni lingua e `{nome}.png` resta il nome del file. Per cambiare apposta un'immagine o un'altra proprietà in una lingua si usa la sua colonna tradotta: `icona@en`, `nome.size@en`.
- **Testi fissi e variabili.** Un livello di testo o valore con fonte fissa ha un campo per ogni altra lingua sotto il suo testo (`texts`, `values`), e così le variabili di testo e valore nella loro finestra. Un campo vuoto usa il testo della lingua principale. Le formule con `=` confrontano sempre i valori della lingua principale, ma il loro risultato si traduce se è una variabile: `=IF({tipo}="Attacco";"{attacco}";"{difesa}")` scrive la variabile `attacco` nella lingua della carta.
- **Documenti.** `language: en` (o `lang: en`) nella testa di un documento disegna le sue carte in inglese e traduce le variabili del testo; senza, il documento usa la lingua principale, qualunque sia la lingua scelta nell'app. Il pannello **Pagina** ha **Lingua delle carte**. `stella export-doc --lang en` esporta in un'altra lingua senza cambiare il file. Una lingua che il progetto non ha è segnalata come problema del documento.
- **Traduzioni mancanti.** `stella check` elenca come avvisi, senza farlo fallire, i testi fissi e le variabili di testo con parole ma senza traduzione, le variabili e i livelli valore tradotti in un'altra lingua ma non in questa, e le celle `@lingua` vuote quando la lingua principale ha parole; `--lang en` controlla una lingua sola e lega le carte in quella lingua. La finestra **Lingue** mostra il numero per ogni lingua. Nell'app i testi non tradotti non sono segnati in rosso.
- **Nomi.** Progetto e set hanno un nome per lingua (`names`), usato da `{project.name}` e `{set.name}`. I nomi dei file esportati restano quelli della lingua principale.
- **Esportazione.** La finestra **Esporta** sceglie la lingua, o tutte. La lingua principale va nella cartella di sempre, le altre in una sottocartella con il loro codice (`export/en/`); per Tabletop Simulator `export/en/tts` e, nella cartella di Tabletop Simulator, `<progetto>/en`. Da riga di comando: `stella render --lang en`, `stella export --profile NOME --lang en|all`.
- **Finestra Lingue** (menu **Progetto**): aggiunge e toglie lingue, scrive i nomi tradotti e aggiunge ai fogli le colonne da tradurre (una per ogni colonna letta da un livello di testo o valore, tranne quelle con soli numeri).

Prossimi passi: controllo dei caratteri che il font non ha, comando per esportare e reimportare i testi da tradurre.

## 8. Template e set

### 8.1 Template

| Proprietà        | Valori                                                                                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| dimensioni       | mm, scelte alla creazione e modificabili; preset: poker 63×88, bridge 57×89, mini 44×63, tarocchi 70×120, quadrata 70×70, segnalino tondo, plancia A4 |
| forma            | rettangolo con raggio, cerchio, esagono, sagoma di un'immagine                                                                                        |
| abbondanza       | mm (default 3)                                                                                                                                        |
| area sicura      | mm dal bordo di taglio, solo come guida                                                                                                               |
| retro            | nessuno, unico per il set, per carta (livelli del retro collegati al foglio)                                                                          |
| griglia e guide  | passo in mm, guide manuali                                                                                                                            |
| nome delle carte | campo (colonna o livello) mostrato sotto ogni carta nella vista del set; di base la prima colonna non vuota                                           |

Quando si cambiano le dimensioni di un template che contiene già livelli, l'app chiede cosa fare:

- **ridimensiona in proporzione**: posizioni, dimensioni e testi scalano con il nuovo formato (se le proporzioni cambiano, si sceglie se adattare alla larghezza, all'altezza o deformare);
- **mantieni**: i livelli restano dove sono e si applicano solo i vincoli di ciascun livello (sezione 1);
- **annulla**.

Accanto a larghezza e altezza, sia del template (nel pannello proprietà e nella finestra del nuovo template) sia dei livelli, un lucchetto mantiene le proporzioni: chiuso, cambiando una misura l'altra segue. Sul livello vale anche per le maniglie sulla carta, comprese quelle sui lati (l'altra misura cresce centrata); senza lucchetto Maiuscolo tiene le proporzioni solo per il trascinamento in corso. Lo stato del lucchetto è una preferenza dell'interfaccia, ricordata per tipo di livello e per i template.

Stato (ottobre 2026): la forma della carta può essere rettangolo con raggio, cerchio o ellisse, esagono regolare (il più grande che sta nella carta, al centro, con i lati piatti in alto se la carta è più larga che alta, con le punte in alto altrimenti; riempie la carta quando il lato corto è il lato lungo × √3/2, e **Adatta la carta all'esagono** cambia il lato corto in questo modo) o la sagoma di un'immagine del progetto (PNG con trasparenza o SVG), salvata come tracciato SVG in coordinate 0–1. La forma ritaglia la carta nell'editor, nelle anteprime, nelle immagini e nel PDF senza abbondanza; con l'abbondanza la carta resta rettangolare e la forma compare come linea di taglio, perché la tipografia la ritaglia da lì. L'area sicura segue la forma. In Tabletop Simulator il mazzo resta di carte rettangolari, con la forma disegnata all'interno. Le guide manuali si aggiungono dal pannello del template (verticali e orizzontali), si spostano trascinandole sulla carta e si tolgono trascinandole fuori; i livelli vi si agganciano quando è attivo l'aggancio agli oggetti, e una guida trascinata si aggancia ai lati e al centro della carta e dell'area sicura.

Le voci della barra laterale (set, template, stili, variabili) si riordinano trascinandole; ⌘Z annulla. Quando un elenco non è in ordine alfabetico, accanto al + compare **A–Z**, che lo riporta in ordine alfabetico. L'ordine si salva nel progetto (docs/formato.md).

Con più livelli selezionati il pannello delle proprietà mostra, sotto le azioni sulla selezione, le proprietà comuni: rotazione, ancoraggio, vincoli e aspetto per tutti i livelli disegnati, più quelle del tipo quando i livelli sono tutti dello stesso tipo. Nome, fonte del valore, posizione e dimensioni restano di ciascun livello. I campi mostrano i valori del primo livello; ogni modifica vale per tutti, e nelle proprietà composte (contorno, ombra, vincoli) arriva agli altri livelli solo la voce cambiata. ⌘Z annulla in un passo.

Soffermando il puntatore su una voce della barra laterale compare accanto alla barra un'anteprima del contenuto: per un set le prime tre carte (fronte), per un template il fronte e il retro con i dati della prima carta di un set che lo usa (altrimenti con i valori predefiniti), per uno stile una frase di prova con i suoi attributi, per una variabile l'icona, il colore, il testo o il valore.

Nei campi numerici del pannello delle proprietà, trascinare l'etichetta a destra o a sinistra cambia il valore come un cursore: un passo ogni 4 pixel, con Maiuscolo passi da 10, con Alt decimi di passo. I campi con un minimo e un massimo (rotazione, opacità) hanno anche un cursore accanto alla casella. Le frecce su e giù cambiano il valore di un passo, come prima.

### 8.2 Set

| Proprietà            | Valori                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| template             | uno per set                                                                                                                     |
| foglio               | foglio del file dati                                                                                                            |
| copie                | colonna `amount` (1 se vuota)                                                                                                   |
| viste                | tabella con anteprima; griglia di anteprime (zoom, fronte/retro, filtro, selezione multipla per modifiche in blocco)            |
| ordine delle carte   | manuale, trascinando righe in tabella o carte nella griglia; è l'ordine delle righe nel foglio e quello di esportazione         |
| ordinamento e filtro | per qualsiasi colonna, solo nella vista, senza cambiare l'ordine salvato; si può rendere definitivo con "Applica questo ordine" |

- Ordinamento e filtro: nella tabella un clic sull'intestazione ordina per quella colonna (crescente, decrescente, poi l'ordine del foglio); nella griglia si sceglie la colonna dal menu. I numeri si ordinano come numeri, i testi senza markup, maiuscole e accenti, le celle vuote vanno in fondo. Il filtro cerca il testo in tutte le colonne o in una sola. Con ordinamento o filtro attivi le righe non si trascinano; **Applica questo ordine** riordina il foglio (⌘Z annulla), **Mostra tutto** torna alla vista normale.
- Selezione multipla: nella tabella e nella griglia Maiuscolo seleziona un intervallo e ⌘ aggiunge o toglie una carta. Nella griglia, trascinando sullo spazio vuoto intorno alle carte si traccia un rettangolo che seleziona le carte che tocca (con Maiuscolo o ⌘ si aggiungono a quelle già selezionate). ⌘A seleziona tutte le carte della vista, Esc torna alla sola carta in anteprima; sopra la griglia una barra dice quante carte sono selezionate. Trascinando una carta che fa parte della selezione si spostano tutte, nel loro ordine. Duplica ed Elimina valgono per tutte le carte selezionate. Con più carte selezionate il modulo accanto all'anteprima diventa la modifica in blocco: un campo mostra il valore solo se è uguale in tutte le carte, altrimenti resta vuoto con la scritta "valori diversi"; scrivere in un campo mette lo stesso valore in tutte le carte selezionate, i campi non toccati non cambiano. ⌘Z annulla.
- PagSu e PagGiù passano alla carta precedente o successiva, nell'ordine della vista (con ordinamento e filtro), sia nella tabella sia nella griglia. Valgono anche mentre si scrive in un campo della carta accanto all'anteprima, e il cursore resta nello stesso campo della carta nuova; non valgono mentre si modifica una cella della tabella.
- Il template del set si cambia dal menu nell'intestazione del set; i dati restano gli stessi, e le colonne che il nuovo template non usa vengono ignorate. ⌘Z annulla.
- Sotto l'anteprima della carta, **Modifica template** apre nell'editor il template del set.
- Il cestino accanto a un set lo toglie dal progetto dopo una conferma. Al salvataggio il suo foglio esce dal file dei dati e va in `deleted/` come file a sé (stesso formato, con formattazione, data e ora nel nome), così il nome torna libero per un altro set; prima di salvare ⌘Z annulla. Con un file .csv il foglio resta. I fogli che non erano collegati a nessun set restano nel file.
- Il cestino accanto a un template lo elimina dopo una conferma, spostando il file in `deleted/` nel progetto, con data e ora nel nome (il cestino del sistema non funziona in tutte le cartelle, per esempio quelle sincronizzate). Un template usato da un set non si elimina: prima vanno eliminati i set che lo usano.
- **Rinomina set** cambia il nome del set; se il foglio dei dati ha lo stesso nome, al salvataggio cambia nome anche il foglio (xlsx e ods), con formattazione e formule. Un set collegato a un foglio con un nome diverso, o un file .csv, tiene il foglio com'è. I profili di esportazione che scelgono il set seguono il nome nuovo. ⌘Z annulla.
- **Rinomina** nell'editor cambia il nome di un template: il nome nuovo va nei set, nei derivati che lo usano come base e nella colonna `template` delle carte; al salvataggio il file in `templates/` cambia nome. La rinomina non si annulla con ⌘Z (si rinomina di nuovo), e la cronologia di ⌘Z dei set riparte.

### 8.3 Generare le carte

**Genera…** nell'intestazione del set crea le righe del foglio combinando insiemi di valori, con un'anteprima prima di aggiungerle.

- **Insiemi.** Ogni insieme ha una colonna di destinazione, un elenco di valori e quanti valori mettere su ogni carta. I valori si scrivono uno per riga o separati da `,` o `;`; `1-5` o `1..5` diventa 1, 2, 3, 4, 5. **Da una cartella…** riempie l'elenco con i nomi delle immagini di una cartella degli asset.
- **Più insiemi** si combinano in tutti i modi possibili (prodotto cartesiano): 6 semi × i numeri 1-5 danno 30 carte. Due insiemi con la stessa colonna finiscono nella stessa cella, separati da uno spazio: `{spade} 3`.
- **Più valori per carta.** Con più di un valore per carta si sceglie se ammettere le ripetizioni e se conta l'ordine: combinazioni o permutazioni, con o senza ripetizioni. I valori si uniscono con il separatore scelto (di base nessuno). 4 risorse, 3 per carta, con ripetizioni e senza ordine danno 20 carte.
- **Limiti per valore.** Per ogni valore si possono fissare un minimo e un massimo di presenze sulla carta, diversi da valore a valore (per esempio oro al massimo una volta, legno almeno una).
- **Come icona.** Se attivo, ogni valore si scrive come `{valore}`, così il testo mostra l'icona o la variabile con quel nome; i numeri e i valori già tra graffe restano come sono. Per le colonne che alimentano un livello immagine è spento di base, perché lì serve il nome del file.
- **Filtro.** Un'espressione come quelle dei campi calcolati (sezione 7, senza `=`) che tiene solo le carte per cui è vera. Usa `{colonna}` per il contenuto della cella e `{colonna_1}`, `{colonna_2}`… per i singoli valori scelti, oltre a `COUNTIN`. Esempio: `COUNTIN({costo}; "oro") + COUNTIN({costo}; "gemma") <= 1`.
- **Copie.** Valore della colonna `amount` per ogni carta generata.
- **A caso.** **Come** sceglie tra **Tutte le combinazioni** e **A caso**. A caso si chiede il numero di carte; ogni insieme può riempire più colonne (**+ Colonna**, campo `more` del modello) e per ogni carta estrae `pick` valori per colonna. Con le ripetizioni ogni estrazione è indipendente; senza, lo stesso valore non torna in nessuna colonna dell'insieme. I limiti per valore contano le presenze in tutte le colonne dell'insieme: l'estrazione sceglie solo tra i valori ancora sotto il massimo e, quando i posti rimasti bastano appena per i minimi, tra quelli sotto il minimo; poi i valori si mescolano tra le colonne. Se i limiti non si possono rispettare la finestra lo segnala. Le carte scartate dal filtro, o già uscite con **Tutte diverse**, si estraggono di nuovo, fino a 200 tentativi per carta chiesta (al massimo 50000). Il **seme** (mulberry32) rende l'estrazione ripetibile; **Rimescola** ne sceglie uno nuovo.
- **Anteprima.** Mostra quante carte nasceranno (e su quante combinazioni, se c'è un filtro) e le prime righe con le icone. Oltre 5000 carte la generazione si ferma e lo segnala.
- **Aggiungi in fondo** accoda le righe a quelle del set; **Sostituisci le carte** cancella prima le righe esistenti, dopo una conferma. **Aggiorna le carte** (solo se il set ha già carte) scrive le colonne generate nelle righe presenti, una carta generata per riga nell'ordine del foglio, senza toccare le altre colonne né `amount`: per esempio, dopo aver generato 30 carte da 6 semi e i numeri 1-5, si riempie la colonna del ritratto con le 30 immagini di una cartella. Le carte generate in più si aggiungono in fondo; se sono meno, le ultime righe restano come sono. Le colonne che mancano nel foglio si aggiungono in fondo. ⌘Z annulla.

## 9. Esportazione

Le esportazioni si salvano come profili nel progetto, così si possono rilanciare. Ogni profilo indica i set da includere e se rispettare le copie.

Stato (ottobre 2026): il comando **Esporta…** (⌘E / Ctrl+E) nella barra in alto apre una finestra che comincia dall'obiettivo (stampare a casa, tipografia, Tabletop Simulator, immagini). Le opzioni stanno a sinistra in tre livelli: le scelte che contano, a pulsanti con un disegno; sezioni chiuse con il riassunto dei valori nel titolo; una frase sopra **Esporta** che dice cosa verrà scritto (`exportSummary` in `src/shared/exportPreview.ts`). Le opzioni che con le altre scelte non si applicano restano spente, con il motivo. Le opzioni usate per ultime si salvano in `stella.json` sotto la chiave `export`, una per tipo, e `export.last` ricorda il tipo e la lingua dell'ultima esportazione. In basso, il menu **Profilo ▾** sceglie un profilo con nome, il cui tipo e le cui opzioni (set e cartella compresi) passano nella finestra; **Salva in** aggiorna il profilo scelto con le opzioni attuali, **Salva come nuovo profilo…** ne crea uno nuovo ed **Elimina** lo toglie. I profili si scrivono subito nel progetto, sotto `export.named`. Le carte si disegnano in una finestra nascosta con lo stesso codice dell'anteprima, quindi l'esportazione coincide con ciò che si vede, comprese le modifiche non ancora salvate. Le immagini mancanti in `assets/` escono come segnaposto e la finestra elenca le carte coinvolte.

Accanto alle opzioni c'è l'anteprima vera, in piccolo: si disegna solo il file mostrato, gli altri quando li si sceglie con ‹ ›, e finché immagini e font non sono pronti c'è «Attendere…». **Ingrandisci** apre l'anteprima grande, che mostra uno alla volta i file che l'esportazione scriverà, senza scrivere nulla: le immagini delle carte con il nome del file, le pagine del PDF con i segni di taglio, i fogli di Tabletop Simulator con la carta nascosta. L'anteprima e l'esportazione usano lo stesso piano (`src/shared/exportPlan.ts`), quindi impaginazione e nomi coincidono.

Il ▾ accanto a **Esporta…** ha **Ripeti l'ultima esportazione** (⇧⌘E / Ctrl+Maiusc+E), che esporta con `export.last` senza aprire la finestra e mostra avanzamento e risultato in un avviso, e i profili del progetto, che aprono la finestra con il profilo scelto.

### 9.1 Immagini

| Opzione       | Valori                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| formato       | PNG, JPG, WebP (qualità per JPG e WebP)                                                                 |
| risoluzione   | 150, 300, 600 DPI o personalizzata                                                                      |
| abbondanza    | inclusa, esclusa                                                                                        |
| lati          | fronte, retro, entrambi                                                                                 |
| sfondo        | fuori dagli angoli arrotondati: bianco o trasparente (PNG e WebP, senza abbondanza)                     |
| nome dei file | modello con `%set`, `%n` (posizione nel set), `%copy`, `%side`, `{campo}`; per esempio `%set/%n_{nome}` |

Con fronte e retro senza `%side` nel modello, il lato si aggiunge in fondo al nome (`_front`, `_back`); con le copie succede lo stesso per `%copy`. I nomi ripetuti ricevono `_2`, `_3`.

### 9.2 PDF di stampa

| Opzione              | Valori                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| pagina               | A4, A3, Letter, personalizzata; verticale, orizzontale                                                                    |
| margini e spaziatura | mm                                                                                                                        |
| disposizione         | automatica (massimo di carte per pagina) o righe × colonne                                                                |
| rotazione            | con la disposizione automatica, carte ruotate di 90° se dritte non entrano nella pagina o ne entrano di più               |
| abbondanza           | inclusa o no; se inclusa le carte si toccano e i segni di taglio sono esterni                                             |
| segni di taglio      | nessuno, angoli, linee intere; lunghezza, spessore, colore, sopra o sotto le carte                                        |
| fronte-retro         | nessuno; pagine alternate con retro speculari (rilegatura lato lungo o corto); compensazione del disallineamento x e y    |
| poster               | le carte più grandi della pagina si dividono su più pagine che si sovrappongono (mm), con il nome di ogni parte (A1, B1…) |
| piegatura            | fronte e retro affiancati sulla stessa pagina, con linea di piegatura                                                     |
| file                 | unico, uno per set, uno per lato                                                                                          |
| set di seguito       | i set uno dopo l'altro sulla stessa pagina invece che ciascuno da una pagina nuova (non con un file per set)              |
| fogli di prova       | PDF a parte con tutte le carte in piccolo, con set e numero                                                               |

Il poster vale con la disposizione automatica: una carta che non entra nella pagina, nemmeno ruotata, si divide in parti uguali che si sovrappongono almeno quanto indicato (di base 10 mm), scegliendo l'orientamento con meno pagine. Ogni pagina porta i segni di taglio della carta dove cadono, dei trattini corti nei margini dove comincia la parte accanto e, sotto, il nome della parte con set e numero della carta. I retri seguono come pagine a parte, senza fronte-retro. Le carte ruotate girano in senso orario; nel fronte-retro i retri ruotano in modo da combaciare con i fronti quando si gira il foglio. Senza abbondanza gli angoli sono arrotondati come nel template; togliendo l'opzione la carta resta un rettangolo. Con l'abbondanza le carte sono sempre rettangolari. Nel fronte-retro i retri si specchiano sulle colonne quando si gira il foglio sul lato lungo di una pagina verticale (o sul lato corto di una orizzontale), altrimenti sulle righe.

Con la piegatura ogni carta occupa una cella larga il doppio, con il fronte a sinistra e il retro a destra, entrambi dritti: piegando lungo i trattini (sopra e sotto la coppia) il retro finisce dietro il fronte. Con l'abbondanza la coppia la ha solo all'esterno; senza, le carte sono rettangoli di taglio. Fronte-retro, scelta dei lati, rotazione e poster non valgono.

Con **Uno dopo l'altro sulla stessa pagina** (`continuous`) i set vicini nel PDF non cominciano su una pagina nuova. Set con la stessa griglia (stessa misura della carta, stessa rotazione) diventano una sola sequenza di carte: 10 + 8 carte con 9 per pagina stanno in 2 pagine invece di 3. Un set con un'altra griglia comincia su una riga nuova sotto il precedente, se nella pagina c'è posto in altezza; ogni set tiene le sue colonne, la sua rotazione e la sua centratura orizzontale, le righe della pagina si centrano in verticale e tra un set e l'altro resta lo spazio dei segni di taglio. Con i segni a linee intere le linee verticali restano all'altezza del loro set, perché non attraversino gli altri: si taglia prima tra un set e l'altro. I set divisi a poster restano su pagine loro; nella piegatura si uniscono solo set con la stessa griglia. Con un file per set l'opzione non vale.

Il foglio di prova è un PDF in più (`nome_proof.pdf`) con tutte le carte del set in piccolo, una per riga del foglio senza copie, con set e numero sotto; i retri compaiono se si esportano.

Il PDF è vettoriale, con i font incorporati e in RGB. **Converti in CMYK** passa il PDF a Ghostscript (`-sColorConversionStrategy=CMYK`), se è installato sul computer (cercato nel PATH e nelle cartelle di Homebrew). Senza Ghostscript, o se la conversione non riesce, il PDF resta RGB e la finestra lo segnala. La conversione usa il profilo predefinito di Ghostscript: per un profilo colore preciso della tipografia serve ancora un programma di prestampa.

### 9.3 Tabletop Simulator

| Opzione            | Valori                                                                                                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| griglia            | automatica per set (righe e colonne scelte in base al numero di carte, per ridurre gli spazi vuoti) oppure fissa, fino a 10×7; l'ultima posizione è riservata alla carta nascosta |
| dimensione massima | 4096 o 8192 px per lato                                                                                                                                                           |
| retro              | unico o foglio dei retri                                                                                                                                                          |
| destinazione       | cartella del progetto, cartella di Tabletop Simulator, entrambe                                                                                                                   |
| oggetto salvato    | file JSON del mazzo pronto da caricare                                                                                                                                            |
| Nickname           | vuoto (di base) oppure da un campo a scelta                                                                                                                                       |
| Description        | vuota oppure da un campo a scelta                                                                                                                                                 |
| oggetti            | per set: carte (mazzo), segnalini (`Custom_Token`) o tessere (`Custom_Tile`), con spessore e, per le tessere, colore del bordo                                                    |

La griglia automatica sceglie, tra 2 × 2 e 10 × 7, quella con meno posizioni vuote e, a parità, il foglio più vicino al quadrato. Le carte non superano 300 DPI. Le copie non si ripetono sul foglio: il mazzo richiama più volte la stessa posizione. Si scrivono `<set>.json` (oggetto salvato), `<set>.png` (miniatura) e i fogli in `images/`; i fogli si richiamano con indirizzi locali (`file:///C:\...` su Windows, `file:////Users/...` sul Mac e su Linux, senza codifica degli spazi, come Tabletop Creator: è la forma che il Cloud Manager di TTS sa caricare), quindi il mazzo funziona sul computer che l'ha esportato. Per giocare online le immagini vanno caricate su un servizio web e gli indirizzi cambiati in Tabletop Simulator. La cartella predefinita di Tabletop Simulator è `~/Library/Tabletop Simulator/Saves/Saved Objects` su macOS, `Documenti/My Games/Tabletop Simulator/Saves/Saved Objects` su Windows; dentro si crea una cartella con il nome del progetto.

Le opzioni per set stanno in `objects`, per nome del set: `{ "type": "card" | "token" | "tile", "thickness": 2, "edgeColor": "#FFFFFF" }`; un set assente è un mazzo di carte. Rinominando un set la sua voce segue. Segnalini e tessere non usano i fogli: ogni carta è un'immagine (`<set>_<n>.png`, e `<set>_<n>_back.png` per il retro delle tessere) fino a 300 DPI e alla dimensione massima scelta. Il segnalino è la carta ritagliata sulla sua forma, su fondo trasparente con 1 mm di margine, perché Tabletop Simulator ritaglia il pezzo seguendo la trasparenza; il retro della carta non si usa, perché sotto il segnalino mostra il fronte specchiato. La tessera è il rettangolo della carta su fondo bianco e la sua forma viene dalla carta: rettangolo (Type 0), rettangolo con raggio (3), esagono (1), cerchio o ellisse (2); una sagoma diventa un rettangolo. Il colore del bordo è la tinta della tessera (`ColorDiffuse`), che in Tabletop Simulator colora solo i lati; può essere un colore del progetto, scritto per nome. Lo spessore è in mm. Più pezzi vanno in un sacchetto (`Bag`), una voce per copia; un pezzo solo è l'oggetto salvato.

Tabletop Simulator non ha una scala assoluta: a scala 1 ogni tipo di oggetto ha una misura fissa, qualunque sia l'immagine. Misurate con il righello di TTS (in unità, che mostra come pollici): una carta è larga 2,25 (una carta da 63 mm), una tessera 2 sul lato lungo, un segnalino circa 3,2 sul lato lungo dell'immagine. Stella prende 2,25 unità = 63 mm (`TTS_UNITS_PER_MM` in `src/shared/export.ts`) e dà a carte, segnalini e tessere la scala (X e Z) che li porta alla loro misura in mm; la scala Y resta 1 e lo spessore in mm diventa `Thickness` in unità. Le carte da 63 mm restano a scala 1. Le misure di base sono stime prese a occhio: se un tipo risulta sproporzionato si correggono le costanti.

### 9.4 Preset per tipografie

I preset per i servizi di stampa e per la stampa in casa non sono più nel menu dei profili: **Tipografia** e **Stampare a casa** (A4, Letter con l'app in inglese) partono dal loro preset, e per le immagini la scelta **Per chi** applica quello di MakePlayingCards o di The Game Crafter. Un preset cambia le opzioni ma lascia i set e la cartella scelti.

| Preset                                  | Opzioni                                                                                                          |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| MakePlayingCards, un'immagine per carta | PNG a 300 DPI con abbondanza, fronte e retro, senza copie, fronti e retri in cartelle separate (`%set/%side/%n`) |
| The Game Crafter, un'immagine per carta | PNG a 300 DPI con abbondanza, fronte e retro, senza copie (`%set/%n_%side`)                                      |
| Stampa in casa, A4 o Letter             | PDF fronte-retro (lato lungo), senza abbondanza, segni di taglio agli angoli, con le copie                       |

La dimensione in pixel dipende dal template. MakePlayingCards chiede per le carte poker almeno 822 × 1122 px a 300 DPI, cioè 36 px (3,05 mm) di abbondanza per lato; The Game Crafter stampa a 300 DPI con 1/8" (3,2 mm) di abbondanza e altrettanto di area sicura. I 3 mm predefiniti dei template vanno bene per entrambi: una carta 63 × 88 con 3 mm esce a 815 × 1110 px. Prima di ordinare conviene controllare le specifiche sul sito del servizio, che possono cambiare.

## 10. Icone, font e crediti

Proposta completa e motivazioni in `proposta-icone-font.md` (cartella condivisa del progetto). I cataloghi stanno nell'app (`resources/catalogs/`), quindi la ricerca funziona anche senza rete; si rigenerano con gli script in `scripts/`. Quello che si importa finisce in `assets/` e da lì in poi è un file come gli altri: il progetto resta autonomo e si apre anche su un altro computer.

### 10.1 Icone di game-icons.net

Dalla finestra di scelta delle immagini e dalla finestra di una variabile icona, **Importa icone…** apre il catalogo di game-icons.net (circa 4200 icone, 36 autori), costruito dal repository ufficiale per avere l'autore di ogni icona.

- A sinistra i tag del sito (134, in 19 gruppi), tradotti in italiano; i tag sono stati raccolti una volta dalle pagine del sito e si aggiornano con `scripts/fetch-icon-tags.mjs`.
- La ricerca è approssimata (tollera errori di battitura) e guarda il nome inglese dell'icona, i tag in inglese e in italiano, alcune parole italiane associate ai tag (per esempio "spada" per le lame) e l'autore. Il nome dell'icona pesa più dei tag.
- La tinta e lo sfondo scuro servono solo all'anteprima: il file si salva nero, e il colore sulla carta si sceglie con il livello come per ogni SVG.
- Si possono scegliere più icone e rinominarle prima di importarle. Un nome non valido o ripetuto blocca l'importazione; se il file esiste già o il nome breve diventa ambiguo, compare un avviso ma si può procedere.
- Importando una sola icona, la si assegna subito al livello o alla variabile; una variabile nuova senza nome prende il nome dell'icona.
- Le icone si salvano in `assets/icons/<nome>.svg` (viewBox 512 × 512, un solo tracciato) con una voce in `assets/sources.json`.

Licenza: CC BY 3.0, tranne due autori in CC0. CC BY chiede di citare l'autore: vedi 10.3.

### 10.1.1 Raccolte Kenney

Nella stessa finestra, sopra la ricerca, si sceglie la raccolta: game-icons.net oppure due raccolte di Kenney (kenney.nl), costruite dai pacchetti ufficiali con `scripts/make-kenney-catalogs.mjs`.

- **Icone e motivi**: le 255 icone di Board Game Icons, in 10 categorie (carte, dadi, pedine, segnalini...), e i 168 motivi ripetibili di Pattern Pack e Pattern Pack Extra. Diventano SVG a un colore come quelle di game-icons.net, quindi si colorano con la tinta. I motivi occupano tutto il riquadro, senza margine, perché affiancati non mostrino giunture; il bianco originale diventa trasparente.
- **Carte, dadi e pedine**: le 523 immagini PNG del Boardgame Pack (carte da gioco, fiches, dadi, pedine in sette colori). Si salvano in `assets/images/` così come sono e non si ricolorano. Sono piccole (64 px i dadi, 140 × 190 px le carte): in stampa vanno usate a dimensioni ridotte.

Licenza: CC0, non serve citare l'autore. La voce in `assets/sources.json` resta comunque, con il pacchetto di provenienza.

### 10.1.2 Altre collezioni con Iconify

L'ultima scheda della finestra, **Iconify (online)**, usa l'API pubblica di Iconify (`api.iconify.design`, senza chiave) per le altre collezioni di icone, oltre 200. Funziona solo con la rete; le richieste partono dal processo principale.

- A sinistra l'elenco delle collezioni con il numero di icone e un pallino per la licenza: verde per le licenze libere (MIT, Apache, ISC, BSD, OFL, MPL, CC0...), blu per le CC BY, che chiedono di citare l'autore, arancione per quelle restrittive per un gioco pubblicato (condivisione allo stesso modo, uso non commerciale, GPL, licenza non dichiarata). Le restrittive si possono nascondere; è un'informazione, non un divieto.
- Scrivendo nella ricerca si cerca online (fino a 999 risultati) in tutte le collezioni o in quella scelta. Senza ricerca, una collezione scelta mostra tutte le sue icone, con le categorie in un menu. Le anteprime si scaricano a pagine di 240.
- Le icone a un colore usano `currentColor`: nel file diventa nero e si salvano in `assets/icons/<nome>.svg`, ricolorabili con la tinta come le altre. Quelle delle collezioni a più colori (emoji, bandiere...) vanno in `assets/images/` così come sono.
- Il disegno si richiede di nuovo al momento dell'importazione; dal disegno si tolgono script e attributi di evento. Il file ha solo il viewBox della collezione, senza larghezza e altezza.
- La voce in `assets/sources.json` ha come fonte "Iconify: <collezione>", come id `prefisso:nome`, come autore l'autore della collezione e la licenza SPDX dichiarata; i crediti la raggruppano come le altre.

### 10.1.3 Aggiornare i cataloghi

**Aggiorna catalogo**, nella scheda game-icons.net della finestra delle icone e nella scheda Google Fonts della finestra dei font, scarica i dati più recenti:

- game-icons.net: l'archivio del repository ufficiale da GitHub (circa 4 MB) e le pagine dei tag già noti dal sito; se una pagina non risponde, per quel tag restano le icone di prima. I tag nuovi del sito non si aggiungono: servono le traduzioni, quindi passano dallo script.
- Google Fonts: il pacchetto npm `google-font-metadata` dal registro di npm (circa 5 MB), lo stesso usato da `scripts/make-font-catalog.mjs`.

Il catalogo aggiornato si salva nella cartella dei dati dell'app (`catalogs/`), non nell'app, e vale finché ha almeno tante voci quanto quello incluso: una versione nuova di Stella con un catalogo più grande torna a usare il proprio. Un catalogo scaricato con meno della metà delle voci di quello in uso viene scartato.

### 10.2 Font di Google Fonts

Il pulsante **Aa** accanto al campo del font apre una finestra con tre schede:

- **Progetto**: i font in `assets/fonts/` più quelli dell'app, con l'anteprima del testo di prova; un clic sceglie la famiglia.
- **Google Fonts**: il catalogo (circa 1900 famiglie) con filtro per categoria e ricerca approssimata. L'anteprima si scarica da Google mentre si scorre, quindi richiede la rete. Aprendo una famiglia si scelgono pesi e corsivi (di base normale e grassetto, più il corsivo se c'è) e **Scarica** salva i file in `assets/fonts/<Famiglia>/` insieme al testo della licenza, aggiunge le voci a `assets/sources.json` e assegna la famiglia al livello.
- **Sul computer**: i font installati, letti dalle cartelle dei font del sistema (macOS, Windows, Linux) alla prima apertura della scheda. Un clic usa la famiglia così com'è installata; **Copia nel progetto** copia i file in `assets/fonts/<Famiglia>/` e li registra in `assets/sources.json` (fonte "computer", con l'autore e, se il file la dichiara, la licenza OFL, Apache o UFL; altrimenti "da verificare"). Non si copiano i font che stanno solo in una raccolta (`.ttc`, frequenti su macOS) né quelli il cui produttore vieta l'incorporamento (OS/2 fsType); restano usabili, ma solo su quel computer.

Si scaricano file TTF statici, uno per peso: nel PDF si incorporano come TrueType, mentre i font variabili diventerebbero Type 3. Un progetto che usa un font del computer senza copiarlo si vede uguale solo dove quel font è installato. Le licenze di Google Fonts (OFL, Apache, UFL) permettono l'uso nei giochi stampati; per circa 160 famiglie il catalogo non indica la licenza, che si ricava al momento del download.

### 10.3 Crediti

Nella finestra di esportazione, **Crediti…** compone il testo da mettere nel regolamento o sulla scatola a partire da `assets/sources.json`: le icone raggruppate per fonte, licenza e autore, poi i font con la loro licenza. Di base si citano solo i file usati dalle carte; togliendo la spunta si citano tutti quelli importati. Il testo si copia o si salva in `export/credits.txt`. Le immagini copiate a mano in `assets/` non sono elencate.

## 11. Schermata di ingresso

All'avvio l'app mostra la schermata di ingresso, non l'ultimo progetto aperto. Contiene:

- **Nuovo progetto…**: chiede nome e posizione (predefinita `Documenti/Stella`, poi l'ultima usata) e crea la cartella `<posizione>/<nome>` con `stella.json` e le cartelle `data/`, `templates/` e `assets/`. Il file dati `data/cards.xlsx` si scrive al primo salvataggio di un set. Dal nome della cartella si tolgono i caratteri non validi nei nomi di file; la cartella deve essere nuova o vuota.
- **Apri progetto…**: sceglie una cartella che contiene `stella.json` (o `naibi.json` e `gamecreator.json`, nei progetti creati con i nomi precedenti dell'app).
- **Cosa vuol dire Stella?**: link discreto in basso a destra, apre una finestra che racconta l'origine del nome.
- **Importa da Tabletop Creator…**: converte un progetto Tabletop Creator in un progetto nuovo, senza modificare l'originale.
- **Strumenti IA…**: mostra la skill per gli agenti IA, da copiare o salvare come file; c'è anche nella barra del progetto. Vedi [cli.md](cli.md).
- **Progetti recenti**: fino a 24, dal più recente, con miniatura, nome, data dell'ultima apertura e cartella. Un progetto spostato o cancellato resta nell'elenco come "cartella non trovata"; la × toglie un progetto dall'elenco senza toccare la cartella.

La miniatura è la prima carta del primo set che ha carte (altrimenti il primo template), disegnata come nell'esportazione. Si crea alla prima apertura e si aggiorna a ogni salvataggio. Elenco e miniature stanno nei dati dell'app (`recent-projects.json` e `thumbnails/` nella cartella dati utente di Electron), non nel progetto: aprire un progetto non scrive nulla nella sua cartella.

Nel progetto, la barra in alto ha nome e cartella del progetto, **Esporta…**, **Backup…**, **Strumenti IA…** e, vicini, **Salva**, **Ricarica** e **Chiudi**; **Chiudi** torna alla schermata di ingresso e chiede conferma se ci sono modifiche non salvate.

## 12. Backup

**Backup…** nella barra in alto apre la finestra dei backup del progetto aperto.

- Un backup contiene i file salvati del progetto, senza la cartella `export` e senza i file nascosti. Ogni backup è un file zip, `<progetto> <data> <ora>.zip` (con `auto` alla fine se è automatico), con i dati, i template e le impostazioni.
- I file di `assets` (immagini, icone, font) non stanno nello zip ma nella sottocartella `assets` della cartella dei backup, comune a tutti i backup del progetto: ogni contenuto si salva una volta sola, con il nome dato dal suo hash, e lo zip ne contiene l'elenco (`stella-backup.json`: percorso nel progetto → file). Un backup aggiunge solo le immagini nuove o cambiate; quando si tolgono backup automatici, si tolgono anche i file che nessun backup rimasto usa. La finestra mostra lo spazio occupato da tutti i backup del progetto.
- I backup stanno fuori dal progetto, in una sottocartella con il nome del progetto dentro la cartella dei backup (di base `Documenti/Stella/Backup`, modificabile). Così non finiscono nei backup successivi e non occupano spazio nella cartella del progetto.
- **Automatici.** Di base, all'apertura di un progetto si crea un backup, a meno che l'ultimo abbia meno di un'ora; si tengono gli ultimi 10 automatici per progetto (numero modificabile). I backup fatti a mano non si cancellano mai da soli. Il backup automatico non ritarda l'apertura.
- **A mano.** **Crea un backup ora**; se ci sono modifiche non salvate, il pulsante diventa **Salva e crea un backup**.
- **Ripristino.** Estrae il backup in una cartella nuova accanto al progetto, con il nome del backup, rimette al loro posto i file di `assets` presi dalla cartella comune, e apre la cartella. Il progetto attuale non si modifica, quindi un ripristino non fa perdere nulla.
- Le impostazioni (automatico sì o no, quanti tenerne, cartella) valgono per tutti i progetti e stanno nei dati dell'app, non nel progetto.
