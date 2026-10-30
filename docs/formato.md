# Formato di progetto

La versione inglese è [format.md](format.md).

Un progetto Stella è una cartella:

```
progetto/
  stella.json           # nome, file dati, elenco dei set
  data/carte.xlsx       # un foglio per set (oppure un .csv per un solo set)
  templates/<nome>.json # i template delle carte
  notes/<nome>.md       # note del progetto in Markdown, scritte nell'app o con un editor qualsiasi
  docs/<nome>.md        # documenti del progetto (regolamento, sell sheet…) in Markdown
  assets/               # immagini e icone
  assets/icons/         # icone importate da game-icons.net
  assets/fonts/         # font del progetto (ttf, otf, woff, woff2)
  assets/sources.json   # provenienza e licenza dei file importati dall'app
```

Le note in `notes/` sono appunti liberi: l'app le mostra nella sezione **Note** della barra laterale e le salva mentre si scrive; un'IA le legge con `stella notes` (vedi [cli.md](cli.md)). Una nota eliminata va in `deleted/`.

I documenti in `docs/` sono i testi che accompagnano il gioco (regolamento, sell sheet, appendici): l'app li mostra nella sezione **Documenti** con l'anteprima accanto e li salva mentre si scrive. Sono Markdown (titoli `#`, `##` e `###`, paragrafi separati da una riga vuota, elenchi, citazioni `>`, tabelle con `|`, linee `---`, blocchi di codice), con il markup di Stella dentro le righe (vedi [specifica.md](specifica.md), 2.1), le variabili di testo e valore e `{project.name}` e `{date}`. Un'immagine `![didascalia](sorgente)` da sola su una riga (più immagini sulla stessa riga stanno affiancate) mostra un file degli asset o, con una sorgente `card:`, una carta del progetto disegnata com'è adesso: `card:<set>/<n>` è la carta della riga n (da 1), `card:<set>/<colonna>=<valore>` la prima carta con quel valore nella colonna (prima uguale, poi senza badare alle maiuscole). Dopo `?`, unite da `&`, le opzioni `side=front|back`, `width=<mm>` (di base la larghezza vera della carta) e `align=left|center|right`. Anche un file degli asset accetta dopo `?` le opzioni `width=<mm>` (di base la misura dell'immagine, ridotta alla pagina) e `align`, come `icone/mappa.png?width=40&align=right`; un indirizzo `http(s)` resta intero. L'allineamento vale per tutta la riga di immagini: conta il primo che lo indica, di base al centro. Nel nome del set e nel valore `%29`, `%3F` e `%26` stanno per `)`, `?` e `&`. In testa al file, tra due righe `---`, possono stare le impostazioni della pagina, una per riga come `chiave: valore`: `page` (`A4`, `A5`, `Letter`), `margin` (mm), `font` e `headingFont` (famiglia, anche `{variabile}`; vuote per quella di base e per quella del testo), `size` (corpo in punti), `lineHeight` (multipli del corpo), `paragraphSpacing` (punti dopo ogni paragrafo), `align` (`left`, `justify`), `color` e `headingColor` (codice o colore del progetto), `language` (o `lang`: la lingua in cui il documento disegna le carte e traduce le variabili, un codice di `languages`; senza, la lingua principale). Quelle non scritte hanno il valore di base (A4, 18 mm, 11 pt, 1,4, 6 pt, a sinistra); il pannello **Pagina** dell'app le scrive e toglie quelle tornate al valore di base. Le altre voci della testa sono le proprietà del documento (come in Obsidian: `title`, `tags`, `autore`…): YAML semplice, con valori di testo, tra virgolette, su più righe o elenchi (`[a, b]` o righe `- voce`). Non si stampano, a meno di `showProperties: true`, che le mostra in una tabella di due colonne in testa al documento e nelle esportazioni. L'app riscrive solo le proprietà cambiate; un nome che differisce di una lettera da quello di un'impostazione (`colour`) viene segnalato come impostazione sbagliata. Un blocco di codice ` ```anatomy ` è l'anatomia di una carta: una riga `card: <set>/<n o colonna=valore>[?side=…&width=…]` e una riga `- <livello>[ (left|right)]: <etichetta>` per ogni livello da spiegare; l'app disegna la carta con le etichette collegate ai livelli. In un'anatomia e in uno schema del tavolo `width: <n>%` fa occupare al blocco al massimo quella parte della larghezza della riga (10-100%) e `font: <n>%` dà alle etichette quella parte del corpo di base (30-300%); i due punti sono facoltativi. Un blocco ` ```setup ` è lo schema della preparazione del tavolo, un elemento per riga con misure in mm dall'angolo in alto a sinistra: `size <L>x<A>` (misura del tavolo, facoltativa), `zone <x>,<y> <L>x<A> ["etichetta"]`, `card <carta> <x>,<y> [rotate=0|90|180|270] ["etichetta"]`, `deck <carta> <x>,<y> [count=<n>] [rotate=…] ["etichetta"]`, `text <x>,<y> [width=<mm>] "testo"`, `arrow <x>,<y> -> <x2>,<y2> ["etichetta"]`, `image <file o {variabile}> <x>,<y> [width=<mm>] [rotate=…]`, più le righe facoltative `width <n>%` e `font <n>%`. `<carta>` è un riferimento come dopo `card:` (prefisso facoltativo), con `%20` per gli spazi; nei testi tra virgolette `\"` è una virgoletta; le righe vuote e quelle che iniziano con `#` si ignorano. Una carta ruotata occupa il riquadro girato, con `x,y` nel suo angolo in alto a sinistra. L'esportazione (dall'app o con `stella export-doc`) scrive in `export/docs/` `<nome>.pdf`, `<nome>.html` (autonomo), `<nome>.docx` (Word) o `<nome>.md` con la cartella `<nome> images/`. Un documento eliminato va in `deleted/` con estensione `.doc.md`. `stella docs` li mostra a un'IA, `stella check` ne segnala i riferimenti che non si trovano.

`assets/sources.json` si scrive quando si importano icone o si scaricano font dall'app: per ogni file (percorso relativo ad `assets/`) indica tipo (`icon` o `font`), fonte, identificativo, autore, licenza in forma SPDX (`CC-BY-3.0`, `OFL-1.1`…), indirizzo e data di importazione. Serve a comporre i crediti; le voci dei file che non esistono più si tolgono alla scrittura successiva. I file aggiunti a mano non compaiono.

```json
{
  "icons/spada.svg": {
    "kind": "icon",
    "source": "game-icons.net",
    "id": "lorc/broadsword",
    "title": "broadsword",
    "author": "Lorc",
    "license": "CC-BY-3.0",
    "url": "https://game-icons.net/1x1/lorc/broadsword.html",
    "imported": "2026-10-18"
  }
}
```

## stella.json

I progetti creati quando l'app si chiamava Naibi hanno `naibi.json`, quelli ancora precedenti (GameCreator) `gamecreator.json`: si aprono come gli altri e continuano a salvare in quel file. Se una cartella ne ha più di uno vale `stella.json`, poi `naibi.json`.

```json
{
  "formatVersion": 1,
  "name": "Demo",
  "dataFile": "data/carte.xlsx",
  "sets": [{ "name": "Personaggi", "template": "personaggio", "sheet": "Personaggi" }]
}
```

`sheet` è facoltativo: se manca si usa il foglio con lo stesso nome del set. `hiddenColumns` (facoltativo) elenca le colonne nascoste nella tabella e nei campi della carta; `showComputed: true` mostra anche i livelli fissi e con formula, in sola lettura. `pinnedProperties` (facoltativo) elenca le proprietà fissate nei campi della carta, come colonne `livello.proprietà`. Sono solo preferenze di vista: non cambiano le carte.

`styles` (facoltativo) contiene gli stili di testo del progetto, scritti con gli stessi attributi del markup (docs/specifica.md, 2.1). Gli stili `heading1`, `heading2` e `note` esistono sempre e si possono ridefinire qui. Finché non c'è l'editor degli stili si modificano a mano.

```json
"styles": {
  "keyword": "weight=800 color=#7A3FA0 smallcaps",
  "flavor": "italic size=90% color=#6B6255 center"
}
```

`variables` (facoltativo) contiene le variabili del progetto (docs/specifica.md, 6.1), una per nome, con un campo `type`:

```json
"variables": {
  "spada": { "type": "image", "src": "spada", "tint": "rosso", "scale": 1.2, "raise": 10 },
  "pino": { "type": "text", "text": "[pino]{color=green weight=700}" },
  "rosso": { "type": "color", "color": "#A33A2A" },
  "mano": { "type": "value", "value": "7" }
}
```

- `image`: `src` è il nome di un file in `assets/`; `tint` (facoltativo) ricolora l'icona; `scale` è l'altezza rispetto alle icone normali nel testo (1 = normale); `raise` sposta l'icona in alto, in % della riga; `rotate` (gradi, senso orario), `flip` (`h`, `v`, `hv`) e `opacity` (0-1) sono facoltativi. `bg` (facoltativo) mette uno sfondo dietro l'immagine ovunque si usi la variabile: una forma predefinita (`circle`, `square`, `rounded`, `hexagon`, `diamond`), un file di `assets/` o un'altra variabile immagine; `bgColor` lo colora (senza, una forma prende il colore del testo e un'immagine tiene i suoi colori, o la tinta della sua variabile) e `bgPad` è lo spazio tra l'immagine e il bordo dello sfondo, in frazione del lato per ogni parte (0-0,45, di base 0,18). Esempio: `"acqua": { "type": "image", "src": "goccia", "tint": "white", "bg": "circle", "bgColor": "#C0392B" }`.
- `text`: testo con markup che prende il posto di `{nome}`. `texts` (facoltativo) dà il testo nelle altre lingue del progetto, per codice: `"texts": { "en": "[pine]{color=green}" }`; una lingua assente o un testo vuoto usano `text`.
- `color`: un colore usabile per nome in ogni proprietà colore; un nome standard (`red`) ridefinito qui cambia in tutto il progetto.
- `value`: testo o numero costante, usabile nei testi e nelle formule. `values` (facoltativo) dà il valore nelle altre lingue, come `texts`: i testi e le formule senza `=` lo usano, le formule con `=` usano sempre `value`.

Un campo della carta con lo stesso nome di una variabile vince sulla variabile.

`export` (facoltativo) ricorda le opzioni dell'ultima esportazione, con una chiave per tipo: `images`, `pdf`, `tts`. La scrive l'app quando si esporta; i nomi delle opzioni sono in `src/shared/export.ts` e il loro significato in docs/specifica.md, sezione 9. Sotto `named` stanno i profili con nome, ciascuno con `name`, `kind` e `options`. La cartella `export/` del progetto contiene i file esportati e si può rigenerare.

`languages` (facoltativo) elenca le lingue del progetto come codici di due o tre lettere, con una variante facoltativa (`pt-BR`); la prima è la principale, quella delle colonne senza `@`. Con meno di due lingue il progetto ha una lingua sola. `names` (facoltativo, nel progetto e in ogni set) dà il nome nelle altre lingue, per codice; un nome assente è quello della lingua principale. Vedi docs/specifica.md, 7.1.

```json
"languages": ["it", "en"],
"names": { "en": "Siege" },
"sets": [{ "name": "Eroi", "template": "eroe", "names": { "en": "Heroes" } }]
```

`numberFormat` (facoltativo) dice come si scrivono i numeri sulle carte nella lingua principale: `plain` (1 234.5, il valore di base), `it` (1.234,5), `en` (1,234.5), `fr` (1 234,5). Con la virgola per i decimali (`it`, `fr`) nelle formule `2,5` è un numero. `numberFormats` (facoltativo) dà lo stile delle altre lingue, per codice; una lingua assente usa il suo stile abituale (`en` per l'inglese, `it` per l'italiano e il tedesco, `fr` per il francese). Il separatore delle migliaia compare solo dove il formato della cella del foglio lo prevede. Vedi `src/shared/model/numberFormat.ts`.

```json
"numberFormat": "it",
"numberFormats": { "de": "fr" }
```

`order` (facoltativo) ricorda l'ordine scelto a mano trascinando le voci della barra laterale, con una chiave per elenco: `templates`, `styles`, `variables`. Senza la chiave l'elenco è in ordine alfabetico; i nomi che non compaiono vanno in fondo, in ordine alfabetico. L'ordine dei set è quello di `sets`. Sotto `groups` stanno i gruppi di stili e variabili nella barra laterale, per nome: `"groups": { "variables": { "oro": "Risorse" } }`; una voce assente non ha gruppo.

```json
"order": { "variables": ["spada", "scudo", "rosso"] }
```

## Fogli dati

- La prima riga contiene le intestazioni; ogni riga successiva è una carta.
- `amount` indica il numero di copie (1 se vuoto o assente).
- Un'intestazione con il nome di un pannello del template ne sostituisce il valore; `pannello.proprietà` sostituisce un'altra proprietà (per esempio `nome.color`).
- Le celle vuote lasciano il valore del template.
- `campo@lingua` (per esempio `nome@en`, `nome.size@en`) è la traduzione di `campo` in una delle lingue del progetto: vale solo quando le carte si mostrano in quella lingua, e una cella vuota lascia il valore della lingua principale.

### Perché xlsx

Il file dati di riferimento resta `.xlsx`. È uno standard pubblico (ECMA-376, ISO/IEC 29500) ed è il formato letto e scritto meglio da Excel, Numbers, LibreOffice e Google Fogli. Inoltre tiene più set in un file, conserva le formule e non ha problemi di codifica o di separatore.

- `.csv` è supportato per un singolo set, ma non regge più fogli e su Excel dà problemi con accenti e separatore (virgola o punto e virgola a seconda della lingua di sistema).
- `.ods` (OpenDocument, ISO/IEC 26300) è aperto quanto xlsx e si legge e scrive come l'xlsx: più set in un file, e nel salvataggio si riscrivono solo le celle delle colonne con intestazione (le celle con lo stesso testo restano com'erano, con formule, formattazione e note). Excel però lo gestisce peggio, per questo il formato consigliato resta xlsx. Si sceglie alla creazione del progetto, o cambiando `dataFile` in `stella.json`.

## Template

Un file JSON per template in `templates/`. Le unità sono millimetri, la dimensione del testo è in punti. Ogni livello riporta solo le proprietà diverse dai default: l'elenco completo è in `src/shared/model/template.ts` e i default in `src/shared/model/normalize.ts`.

```json
{
  "name": "personaggio",
  "width": 63,
  "height": 88,
  "bleed": 3,
  "cornerRadius": 3,
  "front": [
    {
      "type": "text",
      "name": "nome",
      "x": 6,
      "y": 4.5,
      "w": 51,
      "h": 9.5,
      "size": 14,
      "weight": 800,
      "fit": "shrink"
    },
    { "type": "image", "name": "cover", "x": 4, "y": 15.5, "w": 55, "h": 31, "src": "{nome}" },
    {
      "type": "shape",
      "name": "banda",
      "x": 4,
      "y": 4,
      "w": 55,
      "h": 10.5,
      "radius": 2,
      "fill": "#2F5DA8"
    }
  ],
  "back": []
}
```

- Un template derivato ha un formato a parte: vedi sotto.
- Facoltativi: `kind`, il tipo di componente (`card` di base, `token`, `tile`, `board`, `die` per una faccia di dado, `standee` per una pedina in piedi, su fondo trasparente, con il retro uguale al fronte specchiato: `back` non si usa): cambia le parole dell'app («+ Segnalino», «6 facce») e l'oggetto proposto nell'esportazione per Tabletop Simulator quando `objects` non nomina il set. `shape` (`rect` di base, `ellipse`, `hexagon`, `path` con `shapePath`, tracciato SVG in coordinate 0–1 della carta), `shapeRotation` (0, 90, 180, 270: gira solo il contorno; con 90 e 270 la forma è disegnata con i lati scambiati, quindi di solito si scambiano anche `width` e `height`), `shapeFlipH` e `shapeFlipV` (specchiano il contorno) e `guides` (`{ "x": [mm...], "y": [mm...] }`, guide manuali dell'editor).
- Il primo livello dell'elenco è quello in cima.
- Tipi: `text`, `image`, `shape` (`rect`, `ellipse`, `polygon`, `star`, `line`, `path`), `grid`, `group` (con `children`), `value`, `snap`. Una `line` va dal centro del lato sinistro al centro del lato destro del suo riquadro, ruotato di `rotation`: `w` è la lunghezza. Un `path` ha in `path` il tracciato in coordinate 0–1 del riquadro, ricavato dalla sagoma di un'immagine.
- Una `grid` disegna nel riquadro `rows` × `columns` caselle uguali: `cell` (`square`, `circle`, `hex`, `triangle`, `diamond`, `path` con `cellPath`, tracciato SVG in coordinate 0–1 della casella), `cellRotation` (gradi: gira la forma di ogni casella intorno al centro, non il contenuto), `interlock` (alveare, triangoli alternati, rombi e cerchi negli spazi tra gli altri, quadrati a mattoncino), `orientation` degli esagoni (`pointy`, `flat`), `cellRatio` (larghezza/altezza di quadrati, cerchi e rombi), `cellSize` (`null` di base: la casella si ricava dal riquadro; `{ "w": mm, "h": mm }`: casella a misura fissa, il riquadro prende la misura che ne risulta con l'angolo in alto a sinistra fermo; per gli esagoni `w` è la misura da lato a lato, per i triangoli il lato), `gap` e `padding` in mm, `zoom` (1 = la griglia più grande che sta nel riquadro senza deformare le caselle), `alignX` e `alignY` (`start`, `center`, `end`), `clip`, `radius` delle caselle; `fill` e `stroke` delle caselle, `background`, `border` e `backgroundRadius` dello sfondo; `groups` è l'elenco dei gruppi della griglia (in coordinate della carta, come i figli di un gruppo; non si disegnano da soli e non stanno nell'elenco dei livelli); `content` è il nome di uno di questi gruppi, ripetuto in ogni casella (disegnato nella prima, spostato nelle altre), con i campi `cell.index`, `cell.row`, `cell.column`, `cell.count`, `cell.rows`, `cell.columns`, `cell.hidden` (le caselle nascoste, separate da virgole) e `cell.random`; `centered` (true di base) tiene il gruppo al centro della prima casella. Un file vecchio con il gruppo del contenuto nell'elenco dei livelli si apre con il gruppo spostato in `groups`; `cellRules` è un elenco di regole delle caselle, applicate in ordine (una dopo prevale): `when` è la condizione, una formula con i campi della carta e quelli `cell.*` (il `=` iniziale si può omettere), e dove è vera la casella prende `fill` (null: nessuno), `stroke` (null: nessuno), `radius` o `hidden` (true: non si disegnano la casella, il suo contenuto e il suo snap point), e `values` dà un valore ai livelli del contenuto per nome (`{ "icona": "spada" }`: il valore principale, scritto come una formula con i campi e `{cell.*}`); `content` nomina un gruppo di `groups` che nelle caselle della regola prende il posto del contenuto comune (disegnato nella prima casella dove vale la regola, `centered` come sopra); le proprietà assenti restano quelle della griglia, per esempio `{ "when": "=MOD({cell.index}; 5) = 0", "fill": "#C62828" }`. Geometria in `src/shared/model/grid.ts`.
- La colonna con il nome del livello ne sostituisce il valore principale: il testo per `text`, il file per `image`, il riempimento per `shape` e `grid`, la visibilità per `group` e `snap`.
- Tabletop Simulator: il template può avere `ttsTags`, i tag di ogni componente separati da virgole (ammessi i `{campi}`, per esempio `"{tipo}, carta"`). Ogni livello può avere `snap`, uno snap point esportato al centro del livello (al centro di ogni casella per una `grid`): `{ "tags": "edificio", "rotated": true, "angle": null }`. I `tags` sono separati da virgole e ammettono i `{campi}`: il punto attira solo gli oggetti con uno di quei tag. Con `rotated` l'oggetto che si aggancia prende anche una rotazione, `angle` in gradi in senso orario, o quella del livello se `angle` è `null`. Un livello `snap` è solo uno snap point al centro del suo riquadro (6 × 6 mm di base): l'editor lo mostra come un mirino e non si stampa mai. Gli snap point vengono dal fronte.
- Un `group` con `layout` (`row`, `column`, `grid`) o con `repeat` diverso da 1 salva il proprio riquadro (`x`, `y`, `w`, `h`): i figli vi si dispongono dentro con `gap`, `columns`, `justify` e `alignItems` (`start`, `center`, `end`). `repeat` è un numero o un campo, come `"{forza}"`; le copie non si salvano.
- In testi e nomi di file, `{campo}` prende il valore di quella colonna della stessa riga.
- In un progetto con più lingue un livello `text` con fonte fissa può avere `texts` e un livello `value` con fonte fissa `values`: il testo o il valore nelle altre lingue, per codice (`"texts": { "en": "strength" }`). Una lingua assente o vuota usa `text` o `value`. In un template derivato, un livello che cambia `text` senza dare anche `texts` perde le traduzioni del base.

### Template derivati

Un template derivato ha `extends` con il nome del template base e in `changes` solo le differenze. Il resto lo eredita: una modifica al base arriva ai derivati, salvo le proprietà che il derivato ha cambiato. Un derivato può a sua volta fare da base.

```json
{
  "extends": "personaggio",
  "changes": {
    "template": { "cornerRadius": 5 },
    "layers": {
      "banda": { "fill": "#B3261E" },
      "nome": { "color": "#FFD27A", "y": 70 },
      "stemma": { "visible": false }
    },
    "added": [
      {
        "side": "front",
        "after": "nome",
        "layer": { "type": "image", "name": "fiamma", "x": 4, "y": 4, "w": 8, "h": 8 }
      }
    ]
  }
}
```

- `changes.template`: le proprietà del template che cambiano tra `kind`, `bleed`, `safeMargin`, `cornerRadius`, `shape`, `shapePath`, `shapeRotation`, `shapeFlipH`, `shapeFlipV`, `guides`, `labelField`, `ttsTags`. Le misure della carta (`width`, `height`) sono sempre quelle del base.
- `changes.layers`: per nome del livello del base, le proprietà cambiate. Una proprietà composta (contorno, ombra, fonte del valore) si scrive per intero.
- `changes.added`: livelli che esistono solo nel derivato, nell'ordine in cui si inseriscono. `side` è `front` o `back`; `parent` il nome del gruppo ereditato che li contiene (assente: primo livello del lato); `after` il livello dopo il quale vengono nell'elenco, cioè subito sotto (assente: in cima).
- I livelli ereditati non si eliminano e non cambiano ordine: per toglierli dalla carta si scrive `"visible": false`. I loro nomi sono quelli del base, e quindi anche le colonne.
- Rinominando un livello nel base, Stella aggiorna le differenze dei derivati. Una differenza per un livello che il base non ha più si ignora e Stella la segnala.
- Stella 1.1 e precedenti non leggono i template derivati.

### Template per carta

Una colonna facoltativa `template` nel foglio sceglie il template di una singola carta; vuota vale il template del set. Il template scelto deve avere le misure di quello del set, perché le carte di un set si stampano insieme; altrimenti la carta usa il template del set e Stella lo segnala.

L'analisi del formato di Tabletop Creator da cui deriva questa struttura è in [analisi-ttc.md](analisi-ttc.md).
