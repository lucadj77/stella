# Novità

Ogni versione ha una parte in inglese e una in italiano, in quest'ordine: Stella mostra quella
nella lingua dell'interfaccia quando segnala un aggiornamento. Le versioni con un suffisso, come
`1.2.0-beta.1`, sono beta. Come si prepara una versione è spiegato in
[docs/rilascio.md](docs/rilascio.md).

## 1.6.0-beta.1

### English

- **Units**: in ⚙ you can choose millimeters, centimeters or inches for positions, sizes and margins everywhere in the app. Files stay in millimeters.
- **Shape orientation**: in the template properties the card shape can be turned a quarter (width and height swap, so a flat-top hexagon becomes pointy-top), turned upside down or mirrored. Only the outline turns, not the content.
- **Grid cells**: a new **Cell rotation** turns the shape of every cell, whatever its kind, and cells can take their shape from an image. The cells and their content stay in place.
- **Tint**: a semi-transparent tint is laid over the image instead of making it transparent. Black at 20% darkens a picture that stays opaque; a solid tint still recolors icons.
- **Backup names**: a manual backup can get a name, and the name of any backup can be changed from the list. Named automatic backups are no longer deleted.
- **Standees**: new component for upright figures on a transparent background. The back is the front mirrored, drawn by Stella, to print, cut and glue; in Tabletop Simulator they become standing tokens with the chosen thickness.
- **Number fields**: in the windows (export, generator, crop, table setup, backup) numbers can be typed freely. The value is checked when you leave the field or press Enter, and Esc cancels the edit.
- **Table setup**: stacked components follow the template shape and each has a thin outline.
- **Search in the properties panel**: a field at the top of the panel (⌘F / Ctrl+F) keeps only the properties whose name contains the text, or the whole section when the text is in its title.
- **Shortcuts**: I, G and V add an image, a grid and a value layer, like T, R and E. ⌘O / Ctrl+O and ⌘W / Ctrl+W open and close the project in the desktop app.
- **Tabletop Simulator proportions**: tokens and standees are sized on their width, so a tall standee no longer comes out about twice as large. Landscape cards (a board as wide as two cards) are placed sideways at their true size instead of four times larger.
- **Standee thickness**: 15 mm by default, so the figure stands up.
- **Pinned properties**: in the card fields of a set, the pin next to a layer property keeps it under its field even with the properties closed and when you change card.
- **Text outline**: drawn around the letters with rounded corners. A thick outline no longer gets cut at the edge of the box and no longer makes spikes on sharp curves.
- **Tabletop Simulator export**: files go to both the project folder and Tabletop Simulator's saved objects by default.
- **Outline from an image**: works with semi-transparent images too, and if the image cannot be read the message says why.

### Italiano

- **Unità di misura**: in ⚙ si sceglie tra millimetri, centimetri e pollici per posizioni, misure e margini in tutta l'app. I file restano in millimetri.
- **Orientamento della forma**: nelle proprietà del template la forma della carta si gira di un quarto (larghezza e altezza si scambiano, così un esagono con un lato in alto diventa con la punta in alto), si capovolge o si specchia. Gira solo il contorno, non il contenuto.
- **Caselle della griglia**: la nuova **Rotazione della casella** gira la forma di ogni casella, di qualsiasi tipo, e le caselle possono prendere la forma da un'immagine. Le caselle e il loro contenuto restano al loro posto.
- **Colorazione**: una colorazione semitrasparente si stende sopra l'immagine invece di renderla trasparente. Il nero al 20% scurisce un'immagine che resta opaca; una colorazione piena ricolora le icone come prima.
- **Nome dei backup**: a un backup fatto a mano si può dare un nome, e il nome di ogni backup si cambia dall'elenco. I backup automatici con un nome non si cancellano più.
- **Pedine**: nuovo componente per le figure in piedi su fondo trasparente. Il retro è il fronte specchiato, disegnato da Stella, da stampare, ritagliare e incollare; in Tabletop Simulator diventano segnalini in piedi con lo spessore scelto.
- **Campi numerici**: nelle finestre (esportazione, generatore, ritaglio, schema del tavolo, backup) i numeri si scrivono liberamente. Il valore si controlla uscendo dal campo o con Invio, ed Esc annulla la modifica.
- **Schema del tavolo**: i componenti impilati seguono la forma del template e hanno un sottile contorno.
- **Ricerca nel pannello delle proprietà**: un campo in cima al pannello (⌘F / Ctrl+F) lascia solo le proprietà il cui nome contiene il testo, o l'intera sezione se il testo è nel suo titolo.
- **Scorciatoie**: I, G e V aggiungono un livello immagine, griglia e valore, come T, R ed E. ⌘O / Ctrl+O e ⌘W / Ctrl+W aprono e chiudono il progetto nell'app per computer.
- **Proporzioni in Tabletop Simulator**: segnalini e pedine si misurano sulla larghezza, quindi una pedina alta non esce più grande circa il doppio. Le carte orizzontali (una plancia larga quanto due carte) sono messe di traverso, nella misura vera invece che quattro volte più grandi.
- **Spessore delle pedine**: 15 mm di base, perché la figura stia in piedi.
- **Proprietà fissate**: nei campi della carta di un set, la puntina accanto a una proprietà del livello la tiene sotto il suo campo anche con le proprietà chiuse e cambiando carta.
- **Contorno del testo**: si disegna attorno alle lettere con gli angoli arrotondati. Un contorno spesso non viene più tagliato dal bordo del riquadro e non fa punte nelle curve strette.
- **Esportazione per Tabletop Simulator**: di base i file vanno sia nella cartella del progetto sia negli oggetti salvati di Tabletop Simulator.
- **Contorno da un'immagine**: funziona anche con le immagini semitrasparenti, e se l'immagine non si legge il messaggio dice perché.

## 1.5.0

### English

#### New

- **Easier first steps**: the first time, the start screen offers **Start from scratch** and **Explore the example**, with the three steps of the work and links to the videos and the guide. A new project shows a strip with the four first steps, an empty set shows **+ Add the first component**, and Help (F1) has a **First steps** tab. The **?** next to window titles opens the matching guide section.
- **Component kind**: a new template starts from **What are you making?** (card, token, tile, board or die face). The kind suggests suitable formats, changes the words of the set (**+ Token**, "6 faces") and chooses the Tabletop Simulator object.
- **Export by goal**: the export window starts from **Print at home**, **Print shop** (new preset with bleed and crop marks), **Tabletop Simulator** or **Images**.
- **Images**: **Image** in the editor opens the image picker right away, and image files dragged from the computer become image layers or cell values.
- **Table setup**: larger window with full screen and zoom, multiple selection, align and distribute, order, copy and paste.
- **Image variables** can have a background (a shape, an image or another variable) wherever they are used.
- **Card anatomy and table setup**: width as a share of the line and caption size (`width: 60%`, `font: 90%`).
- **Formula assistant**: new **Repeat an icon** case; single fields and plain texts are chosen from the list first.
- **Set table**: cells show the text as it looks on the card, with bold, colors, icons and variables.
- **Web version**: the example project opens in the browser too.

#### Changed

- **Value on cards** is a single line with **Column**, **Fixed**, **Formula** and **fx**, at the top of the properties; it fits narrow panels.
- Editor tools have names next to the icons; shapes are in a **Shapes** menu. In the set, **+ Column**/**Columns** are now **+ Field**/**Fields**, and **Generate…**, **Split image…** and the checks are in a **Tools** menu.
- **?** help tips replace the always visible instructions.
- Confirmations appear in a Stella window, with a red button for actions that delete something.
- Shortcuts show ⌘ on the Mac and Ctrl on Windows and Linux.
- **Edit template** under the preview opens the editor with that card loaded.
- **Styles** and **Variables** in the sidebar show their count and start closed above six items.
- Clearer texts (**Copies**, **Name in TTS (Nickname)**, singular forms), new layer names in the interface language, small texts at least 12 px.
- The video tutorials linked from the start screen are the new versions recorded with 1.5.

#### Fixed

- Dark theme: captions in the table setup and card anatomy windows could not be read.
- Web version: automatic backups no longer fail with an error in the browser console.

### Italiano

#### Novità

- **Primi passi più facili**: la prima volta la schermata iniziale propone **Parti da zero** ed **Esplora l'esempio**, con i tre passi del lavoro e i link ai video e alla guida. Un progetto nuovo mostra una striscia con i quattro primi passi, un set vuoto mostra **+ Aggiungi il primo componente**, e l'Aiuto (F1) ha la scheda **Primi passi**. Il **?** accanto al titolo delle finestre apre la parte della guida che ne parla.
- **Tipo di componente**: un template nuovo parte da **Cosa stai creando?** (carta, segnalino, tessera, plancia o faccia di dado). Il tipo propone i formati adatti, cambia le parole del set (**+ Segnalino**, «6 facce») e sceglie l'oggetto di Tabletop Simulator.
- **Esportazione per obiettivo**: la finestra di esportazione parte da **Stampare a casa**, **Tipografia** (preset nuovo con abbondanza e segni di taglio), **Tabletop Simulator** o **Immagini**.
- **Immagini**: **Immagine** nell'editor apre subito la scelta dell'immagine, e i file immagine trascinati dal computer diventano livelli immagine o valori delle celle.
- **Schema del tavolo**: finestra più grande con schermo intero e zoom, scelta di più elementi, allinea e distribuisci, ordine, copia e incolla.
- **Variabili immagine**: possono avere uno sfondo (una forma, un'immagine o un'altra variabile), ovunque si usino.
- **Anatomia della carta e schema del tavolo**: larghezza come parte della riga e dimensione delle didascalie (`width: 60%`, `font: 90%`).
- **Assistente formule**: nuovo caso **Ripeti un'icona**; un solo campo o un testo semplice si scelgono prima dall'elenco.
- **Tabella del set**: le celle mostrano il testo come appare sulla carta, con grassetto, colori, icone e variabili.
- **Versione web**: anche nel browser si apre il progetto di esempio.

#### Modifiche

- **Valore sulle carte** è una riga sola con **Colonna**, **Fisso**, **Formula** e **fx**, in cima alle proprietà, e sta anche nei pannelli stretti.
- Gli strumenti dell'editor hanno il nome accanto all'icona; le forme stanno nel menu **Forme**. Nel set **+ Colonna**/**Colonne** diventano **+ Campo**/**Campi**, e **Genera…**, **Dividi immagine…** e i controlli stanno nel menu **Strumenti**.
- I **?** sostituiscono le istruzioni sempre visibili.
- Le conferme compaiono in una finestra di Stella, con il pulsante rosso per le azioni che cancellano qualcosa.
- Le scorciatoie mostrano ⌘ sul Mac e Ctrl su Windows e Linux.
- **Modifica template** sotto l'anteprima apre l'editor con quella carta già caricata.
- **Stili** e **Variabili** nella barra laterale mostrano il numero delle voci e oltre sei voci partono chiusi.
- Testi più chiari (**Copie**, **Nome in TTS (Nickname)**, singolari), nomi dei livelli nuovi nella lingua dell'interfaccia, testi piccoli di almeno 12 px.
- I video tutorial collegati dalla schermata iniziale sono le versioni nuove registrate con la 1.5.

#### Correzioni

- Tema scuro: le didascalie nelle finestre dello schema del tavolo e dell'anatomia della carta non si leggevano.
- Versione web: i backup automatici non danno più un errore nella console del browser.

## 1.5.0-beta.4

### English

- **Set table**: cells show the text as it looks on the card, with bold, colors, icons and variables; `{sword*strength}` shows as many swords as the row says. The written text shows on hover and while editing the cell.
- **Formula assistant**: in a text blank that holds a single field or a plain text, the list comes first and the text is a closed line **Text: {strength} · edit**; the text field opens by itself only for mixed or formatted texts. The text field no longer has an orange outline, which looked like an error.
- **Formula assistant**: new **Repeat an icon** case on text layers: "Show the icon sword as many times as strength". The text field of a text layer says where to find the assistant.
- **Web version**: **Open the example project** and **Explore the example** now work in the browser too. The example is copied into the storage the browser keeps for the site and is saved there.
- **Sidebar**: **Styles** and **Variables** show how many items they hold and start closed above six items; the choice is remembered for each project. Empty **Documents** and **Notes** show **+ Document** and **+ Note** buttons.
- **Value on cards** fits narrow panels: the heading and the **fx** button are on top, the three choices take the whole width below.
- Small texts are at least 12 px, and the buttons in the sidebar headings are larger.
- Web version: automatic backups no longer fail with an error in the browser console.

### Italiano

- **Tabella del set**: le celle mostrano il testo come appare sulla carta, con grassetto, colori, icone e variabili; `{spada*forza}` mostra tante spade quante dice la riga. Il testo scritto si vede passando il mouse e quando si modifica la cella.
- **Assistente formule**: in uno spazio di testo con un solo campo o un testo semplice viene prima l'elenco, e il testo è una riga chiusa **Testo: {forza} · modifica**; il campo del testo si apre da solo solo per i testi misti o formattati. Il campo non ha più il bordo arancione, che sembrava un errore.
- **Assistente formule**: nuovo caso **Ripeti un'icona** sui livelli di testo: «Mostra l'icona spada tante volte quanto forza». Il campo del testo di un livello di testo dice dove trovare l'assistente.
- **Versione web**: **Apri il progetto di esempio** ed **Esplora l'esempio** funzionano anche nel browser. L'esempio si copia nello spazio che il browser riserva al sito e si salva lì.
- **Barra laterale**: **Stili** e **Variabili** mostrano il numero delle voci e oltre sei voci partono chiusi; la scelta si ricorda per ogni progetto. **Documenti** e **Note** vuoti mostrano i pulsanti **+ Documento** e **+ Nota**.
- **Valore sulle carte** sta anche nei pannelli stretti: il titolo e il tasto **fx** sono in alto, le tre scelte occupano sotto tutta la larghezza.
- I testi piccoli sono almeno di 12 px, e i pulsanti nei titoli della barra laterale sono più grandi.
- Versione web: i backup automatici non danno più un errore nella console del browser.

## 1.5.0-beta.3

### English

- **Component kind**: a new template starts from **What are you making?**: card, token, tile, board or die face. The kind suggests suitable formats (round tokens, square and hexagonal tiles, large boards, die faces) and changes the words of the set: **+ Token**, "6 faces", "Face 3". In the Tabletop Simulator export each set starts from the object of its kind. The kind can be changed later with **Component** in the template properties; in the file it is the `kind` key.
- **Export by goal**: the export window starts from **Print at home**, **Print shop** (a new preset with bleed and crop marks), **Tabletop Simulator** or **Images**, instead of the three tabs.
- **Images**: **Image** in the editor opens the image picker right away (**No image for now** creates the layer empty). Image files dragged from the computer onto the canvas become image layers; dragged onto a cell of the table or an image field of the form they become its value. The files are copied into `assets/images`.
- **Editor tools** have their names next to the icons, and the shapes are in a **Shapes** menu.
- **Value on cards** of a layer is a single line with **Column**, **Fixed**, **Formula** and the **fx** button, always at the top of the properties.
- **Set**: **+ Column** and **Columns** are now **+ Field** and **Fields**; **Generate…**, **Split image…** and the checks are in a **Tools** menu.
- **?** help tips replace the always visible instructions in the set, in the layers panel and for the guides, and explain bleed, safe margin, card shape and component kind.

### Italiano

- **Tipo di componente**: un template nuovo parte da **Cosa stai creando?**: carta, segnalino, tessera, plancia o faccia di dado. Il tipo propone i formati adatti (segnalini tondi, tessere quadrate ed esagonali, plance grandi, facce di dado) e cambia le parole del set: **+ Segnalino**, «6 facce», «Faccia 3». Nell'esportazione per Tabletop Simulator ogni set parte dall'oggetto del suo tipo. Il tipo si cambia anche dopo, con **Componente** nelle proprietà del template; nel file è la chiave `kind`.
- **Esportazione per obiettivo**: la finestra di esportazione parte da **Stampare a casa**, **Tipografia** (un preset nuovo con abbondanza e segni di taglio), **Tabletop Simulator** o **Immagini**, al posto delle tre schede.
- **Immagini**: **Immagine** nell'editor apre subito la scelta dell'immagine (**Per ora nessuna immagine** crea il livello vuoto). I file immagine trascinati dal computer sulla tela diventano livelli immagine; trascinati su una cella della tabella o su un campo immagine del modulo ne diventano il valore. I file si copiano in `assets/images`.
- **Strumenti dell'editor**: hanno il nome accanto all'icona, e le forme stanno nel menu **Forme**.
- **Valore sulle carte** di un livello è una riga sola con **Colonna**, **Fisso**, **Formula** e il tasto **fx**, sempre in cima alle proprietà.
- **Set**: **+ Colonna** e **Colonne** diventano **+ Campo** e **Campi**; **Genera…**, **Dividi immagine…** e i controlli stanno nel menu **Strumenti**.
- I **?** sostituiscono le istruzioni sempre visibili nel set, nel pannello dei livelli e per le guide, e spiegano abbondanza, margine di sicurezza, forma della carta e tipo di componente.

## 1.5.0-beta.2

### English

- **Welcome screen**: the first time, with no recent projects, the start screen shows two big choices, **Start from scratch** and **Explore the example**, the three steps of the work (draw a template, fill a set, export) and links to the overview video, all the video tutorials and the guide. With recent projects the screen is as before, with a row of links under the list.
- **New project**: the choice of the data file format is under **Data file options**, closed by default (Excel).
- **First steps**: a new project shows a strip at the top with the four steps (draw a template, create a set, add the first component, export). Each step is ticked by itself, the button opens the next one, and the × hides the strip for good. Projects that already have components do not show it.
- **Empty set**: instead of an empty table, a set with no components shows **+ Add the first component**, and the preview says where the component will appear.
- **Edit template** under the preview opens the editor with that card already loaded, so its fields and formulas show the card's values instead of "Data: none".
- **Help** (F1): the new **First steps** tab sums up the four steps with a link to the guide for each, the first two videos and the words to know (component, template, set, layer, bleed, safe area...). It opens there when the project has no components; otherwise on the tab used last.
- The **?** next to the title of the windows New template, New set, Export, Generate and the formula assistant opens the guide section about them.
- **Shortcuts** in tooltips and messages appear in the form of the system in use: ⌘ on the Mac, Ctrl on Windows and Linux.
- **Confirmations** (delete a set, a template, a document or cards, discard changes, restore a backup...) appear in a Stella window instead of the system one, with a title, an explanation and a button that says what it does. When the action deletes something the button is red and Enter picks **Cancel**.
- **Clearer texts**: **Copies** in the card form (the `amount` column, explained in the tooltip), "1 row · 1 card" in the singular, **Name in TTS (Nickname)** and **Description in TTS** in the Tabletop Simulator export. New layers get a name in the interface language (for example `testo`, `immagine` in Italian).

### Italiano

- **Schermata di benvenuto**: la prima volta, senza progetti recenti, la schermata di ingresso mostra due scelte grandi, **Comincia da zero** ed **Esplora l'esempio**, i tre passi del lavoro (disegnare un template, compilare un set, esportare) e i collegamenti al video di panoramica, a tutti i video tutorial e alla guida. Con dei progetti recenti la schermata è quella di prima, con una riga di collegamenti sotto l'elenco.
- **Nuovo progetto**: la scelta del formato del file dei dati è sotto **Opzioni del file dei dati**, chiusa di base (Excel).
- **Primi passi**: un progetto nuovo mostra in cima una striscia con i quattro passi (disegnare un template, creare un set, aggiungere il primo componente, esportare). Ogni passo si spunta da solo, il pulsante apre quello successivo e la × nasconde la striscia per sempre. I progetti che hanno già dei componenti non la mostrano.
- **Set vuoto**: al posto della tabella vuota, un set senza componenti mostra **+ Aggiungi il primo componente**, e l'anteprima dice dove comparirà il componente.
- **Modifica template** sotto l'anteprima apre l'editor con quella carta già caricata, così campi e formule mostrano i valori della carta invece di "Dati: nessuno".
- **Aiuto** (F1): la nuova scheda **Primi passi** riassume i quattro passi con un collegamento alla guida per ciascuno, i primi due video e le parole da conoscere (componente, template, set, livello, abbondanza, area sicura...). Si apre lì quando il progetto non ha componenti; altrimenti sulla scheda usata l'ultima volta.
- Il **?** accanto al titolo delle finestre Nuovo template, Nuovo set, Esporta, Genera e dell'assistente formule apre la sezione della guida che ne parla.
- **Scorciatoie**: nei suggerimenti e nei messaggi compaiono nella forma del sistema in uso, ⌘ sul Mac e Ctrl su Windows e Linux.
- **Conferme** (eliminare un set, un template, un documento o delle carte, scartare le modifiche, ripristinare un backup...): compaiono in una finestra di Stella invece che in quella del sistema, con un titolo, una spiegazione e un pulsante che dice cosa fa. Quando l'azione cancella qualcosa il pulsante è rosso e Invio sceglie **Annulla**.
- **Testi più chiari**: **Copie** nel modulo della carta (la colonna `amount`, spiegata nel suggerimento), "1 riga · 1 carta" al singolare, **Nome in TTS (Nickname)** e **Descrizione (Description)** nell'esportazione per Tabletop Simulator. I livelli nuovi prendono un nome nella lingua dell'interfaccia (per esempio `testo`, `immagine`).

## 1.5.0-beta.1

### English

- **Table setup**: the window is much larger and has a **Full screen** button that uses the whole app window. The drawing can be zoomed with − and +, with ⌘/Ctrl + mouse wheel, by pinching the trackpad or with ⌘+ and ⌘− / Ctrl++ and Ctrl+−; **Fit** (⌘0 / Ctrl+0) shows it all again. When zoomed in, move it with the scroll bars, the wheel or by dragging with the space bar held down.
- **Table setup**: several elements can be selected with Shift or ⌘/Ctrl + click, by dragging a box on an empty spot or with ⌘A / Ctrl+A. They move together, and the panel aligns them and distributes them with equal gaps. **Order** brings an element to the front, forward, backward or to the back among the elements of the same kind.
- **Table setup**: **Image** also offers image variables, and the drawing shows their tint, rotation, flip, opacity and background.
- **Image variables** can have a **Background**: a shape (circle, square, rounded, hexagon, diamond), an image or another image variable, with its colour and the space around the image. It shows wherever the variable is used: in texts, image layers, documents (also in Word and Markdown exports) and table setups. For example a white drop in a red circle.
- **Card anatomy and table setup**: **Width (% of line)** makes the block take at most that share of the line, and **Captions (%)** changes the size of the labels. In the text they are the `width: 60%` and `font: 90%` lines.
- **Table setup**: ⌘C, ⌘X and ⌘V / Ctrl+C, Ctrl+X and Ctrl+V copy, cut and paste the selected elements, also into another table setup, and ⌘D / Ctrl+D duplicates them.
- **Dark theme**: in the table setup and card anatomy windows the captions stayed light on the white drawing and could not be read. Now they are dark, as on the page.

### Italiano

- **Schema del tavolo**: la finestra è molto più grande e ha il tasto **Schermo intero**, che usa tutta la finestra dell'app. Il disegno si ingrandisce con − e +, con ⌘/Ctrl + rotella del mouse, pizzicando il trackpad o con ⌘+ e ⌘− / Ctrl++ e Ctrl+−; **Adatta** (⌘0 / Ctrl+0) lo mostra di nuovo tutto. Ingrandito, si sposta con le barre di scorrimento, con la rotella o trascinando con la barra spaziatrice premuta.
- **Schema del tavolo**: si possono scegliere più elementi con Maiuscolo o ⌘/Ctrl + clic, trascinando un riquadro su uno spazio vuoto o con ⌘A / Ctrl+A. Si spostano insieme, e il pannello li allinea e li distribuisce con spazi uguali. **Ordine** porta un elemento in primo piano, avanti, indietro o sullo sfondo tra gli elementi dello stesso tipo.
- **Schema del tavolo**: **Immagine** propone anche le variabili immagine, e il disegno ne mostra tinta, rotazione, ribaltamento, opacità e sfondo.
- **Variabili immagine**: possono avere uno **Sfondo**, cioè una forma (circle, square, rounded, hexagon, diamond), un'immagine o un'altra variabile immagine, con il suo colore e lo spazio attorno all'immagine. Si vede ovunque si usi la variabile: nei testi, nei livelli immagine, nei documenti (anche negli export Word e Markdown) e negli schemi del tavolo. Per esempio una goccia bianca in un cerchio rosso.
- **Anatomia della carta e schema del tavolo**: **Larghezza (% riga)** fa occupare al blocco al massimo quella parte della riga, **Didascalie (%)** cambia la dimensione delle etichette. Nel testo sono le righe `width: 60%` e `font: 90%`.
- **Schema del tavolo**: ⌘C, ⌘X e ⌘V / Ctrl+C, Ctrl+X e Ctrl+V copiano, tagliano e incollano gli elementi scelti, anche in un altro schema, e ⌘D / Ctrl+D li duplica.
- **Tema scuro**: nelle finestre dello schema del tavolo e dell'anatomia della carta le didascalie restavano chiare sul disegno bianco e non si leggevano. Ora sono scure, come sulla pagina.

## 1.4.1

### English

#### Fixed

- **AI tools**: the skill given to the agent had the command and the version written in place of the placeholders everywhere, also in the sentences that talk about them. So step 1 called the real command "the placeholder", and after the automatic update of the skill the agent looked for text that is not in the file downloaded from GitHub, and could leave the command block with the placeholder. Now only the command block and the line with the version are filled in, and step 4 says exactly which two places to fill in. To fix a skill already installed, open **AI tools…** again and save or copy it.

### Italiano

#### Correzioni

- **Strumenti IA**: nella skill da dare all'agente il comando e la versione prendevano il posto dei segnaposto ovunque, anche nelle frasi che ne parlano. Così il passo 1 chiamava "segnaposto" il comando vero, e dopo l'aggiornamento automatico della skill l'agente cercava un testo che nel file scaricato da GitHub non c'è, e poteva lasciare il blocco del comando con il segnaposto. Ora si riempiono solo il blocco del comando e la riga della versione, e il passo 4 dice esattamente quali sono i due punti da riempire. Per correggere una skill già installata, riapri **Strumenti IA…** e salvala o copiala di nuovo.

## 1.4.0

### English

#### New

- **Formula assistant**: the **fx** button next to the formula of a layer, under **Value on cards** and next to the filter of the generator opens a window that builds the formula for you. It starts with **What do you want to do?** (a different value depending on a condition, every N cells, alternate, checkerboard, cycle through a list, pick at random, only if not empty, low/medium/high, calculate, join texts): the chosen case becomes a sentence to complete, with the result on the first card shown below. Blanks take a field, a variable, a cell or component number, a number, a formatted text, a colour, an image, a comparison or another formula, shown as a smaller sentence inside the sentence. Conditions can be combined with **+ and also** and **+ or**. **Advanced** shows the formula as nested boxes, and the formula text stays visible and can still be written by hand.
- **Grid**: **Text in each cell** and **Shape in each cell** create the content of the cells in one click, so its formulas can vary from cell to cell.
- **Website link** in the start screen footer and in Help (F1).

#### Changed

- **Help** (F1), **Formulas** tab, also lists `MOD` and `PICK`.
- **Grids**: **Text in each cell** and **Shape in each cell** create the layer as big as the cell, so a text background stays aligned with the cell.

#### Fixed

- **Automatic update on Windows and Linux**: installing an update stopped with *Cannot set properties of undefined (setting 'logger')*, because the updater module was loaded the wrong way. Installed versions up to 1.3.1 and 1.4.0-beta.4 cannot install this fix by themselves: download 1.4.0 once from the release page, then updates work again.

### Italiano

#### Novità

- **Assistente formule**: il tasto **fx** accanto alla formula di un livello, sotto **Valore sulle carte** e accanto al filtro del generatore apre una finestra che costruisce la formula al posto tuo. Si parte da **Cosa vuoi fare?** (un valore diverso secondo una condizione, ogni N caselle, alterna, scacchiera, scorri un elenco, scegli a caso, solo se non vuoto, basso/medio/alto, calcola, unisci testi): il caso scelto diventa una frase da completare, con sotto il risultato sulla prima carta. Gli spazi accettano un campo, una variabile, il numero della casella o del componente, un numero, un testo formattato, un colore, un'immagine, un confronto o un'altra formula, che compare come una frase più piccola dentro la frase. Le condizioni si combinano con **+ e anche** e **+ oppure**. **Avanzato** mostra la formula come caselle annidate, e il testo della formula resta visibile e si può ancora scrivere a mano.
- **Griglia**: **Testo in ogni casella** e **Forma in ogni casella** creano con un clic il contenuto delle caselle, così le sue formule possono variare da casella a casella.
- **Link al sito** nel piè di pagina della schermata iniziale e nell'Aiuto (F1).

#### Modifiche

- **Aiuto** (F1), scheda **Formule**, elenca anche `MOD` e `PICK`.
- **Griglie**: **Testo in ogni casella** e **Forma in ogni casella** creano il livello grande quanto la casella, così uno sfondo nel testo resta allineato alla casella.

#### Correzioni

- **Aggiornamento automatico su Windows e Linux**: l'installazione di un aggiornamento si fermava con *Cannot set properties of undefined (setting 'logger')*, perché il modulo degli aggiornamenti era caricato nel modo sbagliato. Le versioni installate fino alla 1.3.1 e alla 1.4.0-beta.4 non possono installare da sole questa correzione: va scaricata una volta la 1.4.0 dalla pagina della release, poi gli aggiornamenti tornano a funzionare.

## 1.4.0-beta.4

### English

- **Formula assistant**: a threshold or a number blank in a sentence opens the **Number** tab, and a number typed in the text of a comparison stays a number (`5`, not `"5"`), so comparisons with typed numbers work as expected.
- **Formula assistant**: the result of a condition reads Yes or No instead of true or false.

### Italiano

- **Assistente formule**: una soglia o uno spazio numerico di una frase apre la scheda **Numero**, e un numero scritto nel testo di un confronto resta un numero (`5`, non `"5"`): i confronti con numeri scritti a mano funzionano come ci si aspetta.
- **Assistente formule**: il risultato di una condizione si legge Sì o No invece di true o false.

## 1.4.0-beta.3

### English

- **Formula assistant, nested functions**: a function inside a blank appears as a smaller sentence inside the sentence, so the guided mode also works for nested formulas. The **Formula** tab of a blank offers the cases of **What do you want to do?** first. Conditions get **+ and also** and **+ or** (`AND`, `OR`). In **Advanced**, complete nested functions fold into one line, and **⤢** opens a nested function on its own with a path to go back.

### Italiano

- **Assistente formule, funzioni annidate**: una funzione dentro uno spazio compare come una frase più piccola dentro la frase, così il modo guidato funziona anche con le formule annidate. La scheda **Formula** di uno spazio propone per prima i casi di **Cosa vuoi fare?**. Le condizioni hanno **+ e anche** e **+ oppure** (`AND`, `OR`). In **Avanzato** le funzioni annidate complete si chiudono in una riga, e **⤢** apre una funzione annidata da sola, con il percorso per tornare indietro.

## 1.4.0-beta.2

### English

- **Website link**: the start screen footer and the Help window (F1) link to <https://stella.lucadj.eu/>, in the interface language.
- Guide: the formula assistant section shows the text box of a blank with its tabs.

### Italiano

- **Link al sito**: il piè di pagina della schermata iniziale e la finestra Aiuto (F1) rimandano a <https://stella.lucadj.eu/it/>, nella lingua dell'interfaccia.
- Guida: la sezione dell'assistente formule mostra il campo del testo di uno spazio con le sue schede.

## 1.4.0-beta.1

### English

- **Formula assistant**: the **fx** button next to the formula of a layer, under **Value on cards** and next to the filter of the generator opens a window that builds the formula box by box. You choose what kind of formula you need (a conditional result, several cases, a pick from a list, a calculation, a text operation) and fill each box with a field, a variable, a cell or component number, a number, a formatted text, a colour, an image, a comparison or another formula. **Recipes** set up common cases in one click: every N cells, alternate, checkerboard, cycle through a list, pick at random, only if not empty, by range. Each box shows its result on the first card, inside a grid you see the first cells, and the formula text stays visible and can still be written by hand.
- The assistant opens with **What do you want to do?**: a set of cards for the common cases (a different value depending on a condition, every N cells, alternate, checkerboard, cycle through a list, pick at random, only if not empty, low/medium/high, calculate, join texts). The chosen case becomes a sentence to complete, already filled in, with the result shown below; **Advanced** shows the nested boxes, **Start over** goes back to the cards. An existing formula with the shape of one of the sentences opens as that sentence. For a text box the picker keeps the text field visible: the Field, Card & cell and Variable tabs insert the value at the cursor, **Format…** formats the whole text (colour, weight…).
- **Grid**: on a grid without cell content, **Text in each cell** and **Shape in each cell** create a layer in the first cell, group it and set it as the content, so its formulas can vary from cell to cell. The assistant on a grid layer offers the same as **Vary cell by cell** instead of the cell recipes, which only work on the cell content.
- The **Help** window (F1), **Formulas** tab, now also lists `MOD` and `PICK`.

### Italiano

- **Assistente formule**: il tasto **fx** accanto alla formula di un livello, sotto **Valore sulle carte** e accanto al filtro del generatore apre una finestra che costruisce la formula casella per casella. Si sceglie che tipo di formula serve (un risultato condizionato, più casi, una scelta da un elenco, un calcolo, un'operazione sul testo) e si riempie ogni casella con un campo, una variabile, il numero della casella o del componente, un numero, un testo formattato, un colore, un'immagine, un confronto o un'altra formula. Le **ricette** impostano con un clic i casi frequenti: ogni N caselle, alterna, scacchiera, scorri un elenco, scegli a caso, solo se non vuoto, per fasce. Ogni casella mostra il suo risultato sulla prima carta, dentro una griglia si vedono le prime caselle, e il testo della formula resta visibile e si può ancora scrivere a mano.
- L'assistente si apre con **Cosa vuoi fare?**: schede per i casi frequenti (un valore diverso secondo una condizione, ogni N caselle, alterna, scacchiera, scorri un elenco, scegli a caso, solo se non vuoto, basso/medio/alto, calcola, unisci testi). Il caso scelto diventa una frase da completare, già riempita, con il risultato sotto; **Avanzato** mostra le caselle annidate, **Ricomincia** torna alle schede. Una formula esistente con la forma di una delle frasi si apre come quella frase. Per una casella di testo il selettore tiene visibile il campo del testo: le schede Campo, Componente e casella e Variabile inseriscono il valore dove c'è il cursore, **Formatta…** formatta tutto il testo (colore, peso…).
- **Griglia**: su una griglia senza contenuto delle caselle, **Testo in ogni casella** e **Forma in ogni casella** creano un livello nella prima casella, lo raggruppano e lo impostano come contenuto, così le sue formule possono variare da casella a casella. L'assistente su un livello griglia propone lo stesso come **Varia casella per casella** al posto delle ricette per le caselle, che funzionano solo sul contenuto.
- La finestra **Aiuto** (F1), scheda **Formule**, elenca anche `MOD` e `PICK`.

## 1.3.1

### English

#### Fixed

- **Template editor after a reload**: when an AI agent finishes (`stella end`) or the project is reloaded from disk, the open template now shows the layers on disk. Before, it kept showing the old layers, and saving could overwrite the agent's changes.

### Italiano

#### Correzioni

- **Editor del template dopo una ricarica**: quando un agente IA finisce (`stella end`) o il progetto si ricarica dal disco, il template aperto mostra i livelli del disco. Prima continuava a mostrare quelli vecchi, e salvando si potevano perdere le modifiche dell'agente.

## 1.3.0

### English

#### New

- **Open the example project** in the start screen: the project of the guide and the videos, in the interface language, copied into Documents/Stella/Example the first time and opened from there.
- **Website**: <https://stella.lucadj.eu/> presents Stella, with the download of the latest stable version for the visitor's system, the video tutorials and the links to the guide and the news. The web version moves to <https://stella.lucadj.eu/app/> (the beta stays in `/beta/`); the old addresses redirect.
- **Video tutorials** (overview and first component, in English and Italian), linked from the website and the guide.
- **Support Stella**: a link to free donations (PayPal) in the start screen, in Help (F1) and on the website. No reminders, no pop-ups.

#### Changed

- The app presents itself as **Stella Game Center** (start screen, window title, website); file and command names stay `Stella` and `stella`.
- **Skill for AI agents**: it explains how to add an export profile (PDF, images, Tabletop Simulator) to a project that has none, and how to take icons from Iconify, recording origin and licence in `assets/sources.json` so that the credits stay complete.

#### Fixed

- **Help (F1)** on Windows and Linux shows the shortcuts with Ctrl instead of ⌘. The user guide writes every shortcut in both forms (⌘S / Ctrl+S).

### Italiano

#### Novità

- **Apri il progetto di esempio** nella schermata iniziale: il progetto della guida e dei video, nella lingua dell'interfaccia, copiato in Documenti/Stella/Esempio la prima volta e aperto da lì.
- **Sito**: <https://stella.lucadj.eu/> presenta Stella, con il download dell'ultima versione stabile per il sistema di chi visita, i video tutorial e i rimandi alla guida e alle novità. La versione web si sposta in <https://stella.lucadj.eu/app/> (la beta resta in `/beta/`); i vecchi indirizzi rimandano a quelli nuovi.
- **Video tutorial** (panoramica e primo componente, in italiano e in inglese), collegati dal sito e dalla guida.
- **Sostieni Stella**: un collegamento per le donazioni libere (PayPal) nella schermata iniziale, nell'Aiuto (F1) e sul sito. Nessun promemoria, nessuna finestra.

#### Modifiche

- L'app si presenta come **Stella Game Center** (schermata iniziale, titolo della finestra, sito); i nomi dei file e del comando restano `Stella` e `stella`.
- **Skill per gli agenti IA**: spiega come aggiungere un profilo di esportazione (PDF, immagini, Tabletop Simulator) a un progetto che non ne ha e come prendere icone da Iconify, annotando origine e licenza in `assets/sources.json` perché i crediti restino completi.

#### Correzioni

- **Aiuto (F1)** su Windows e Linux mostra le scorciatoie con Ctrl al posto di ⌘. La guida scrive ogni scorciatoia in entrambe le forme (⌘S / Ctrl+S).

## 1.3.0-beta.1

### English

#### New

- **Website**: <https://stella.lucadj.eu/> now presents Stella, with the download of the latest stable version for the visitor's system, the tutorial videos and the links to the guide and the news. The web version moves to <https://stella.lucadj.eu/app/> (the beta stays in `/beta/`); the old addresses redirect.

- The app presents itself as **Stella Game Center** (start screen, window title, website); file and command names stay `Stella` and `stella`.
- **Open the example project** in the start screen: the project of the guide and the videos, in the interface language, copied into Documents/Stella/Example the first time and opened from there.
- **Support Stella**: a link to free donations (PayPal) in the start screen, in Help (F1) and on the website. No reminders, no pop-ups.

#### Fixed

- **Help (F1)** on Windows and Linux shows the shortcuts with Ctrl instead of ⌘. The user guide writes every shortcut in both forms (⌘S / Ctrl+S).

### Italiano

#### Novità

- **Sito**: <https://stella.lucadj.eu/> ora presenta Stella, con il download dell'ultima versione stabile per il sistema di chi visita, i video tutorial e i rimandi alla guida e alle novità. La versione web si sposta in <https://stella.lucadj.eu/app/> (la beta resta in `/beta/`); i vecchi indirizzi rimandano a quelli nuovi.

- L'app si presenta come **Stella Game Center** (schermata iniziale, titolo della finestra, sito); i nomi dei file e del comando restano `Stella` e `stella`.
- **Apri il progetto di esempio** nella schermata iniziale: il progetto della guida e dei video, nella lingua dell'interfaccia, copiato in Documenti/Stella/Esempio la prima volta e aperto da lì.
- **Sostieni Stella**: un collegamento per le donazioni libere (PayPal) nella schermata iniziale, nell'Aiuto (F1) e sul sito. Nessun promemoria, nessuna finestra.

#### Correzioni

- **Aiuto (F1)** su Windows e Linux mostra le scorciatoie con Ctrl al posto di ⌘. La guida scrive ogni scorciatoia in entrambe le forme (⌘S / Ctrl+S).

## 1.2.1

### English

A guide-only update: no change to the app or to the project files.

#### Changed

- **User guide** (`docs/guide`, Italian in `docs/guida`) brought up to date with 1.2.0: all screenshots retaken with the Stella interface, a new chapter on the web version, the grid layer with its cell content, the documents chapter split into sections with screenshots (document, insert card, tables, card anatomy, table setup), new project from an existing data file, image library and dark background, constraints table, text fitting and layer effects, duplex printing tip, formula functions with examples, CLI command table and more keyboard shortcuts.
- The scripts that take the guide screenshots are now in the repository, in `scripts/guide`.

### Italiano

Un aggiornamento della sola guida: l'app e i file di progetto non cambiano.

#### Modifiche

- **Guida utente** (`docs/guida`, inglese in `docs/guide`) allineata alla 1.2.0: tutti gli screenshot rifatti con l'interfaccia di Stella, un capitolo nuovo sulla versione web, il livello griglia con il contenuto delle caselle, il capitolo sui documenti diviso in paragrafi con screenshot (documento, inserisci carta, tabelle, anatomia della carta, schema del tavolo), nuovo progetto da un file dati esistente, libreria immagini e sfondo scuro, tabella dei vincoli, adattamento del testo ed effetti dei livelli, consiglio per la stampa fronte-retro, funzioni delle formule con esempi, tabella dei comandi della CLI e altre scorciatoie da tastiera.
- Gli script che scattano gli screenshot della guida sono ora nel repository, in `scripts/guide`.

## 1.2.0

### English

The first official version since 1.1.0, and the first with the name **Stella** (it was Naibi). It gathers the 34 betas; their details are in the 1.2.0-beta sections of CHANGELOG.md.

#### New

- **Documents**: rules, sell sheets and appendices written in Markdown with Stella's markup, with a live page preview, a formatting bar, page settings, properties, tables, boxes and images. They can contain the real cards of the game, a **card anatomy** (front and back, with labelled lines) and a **table setup** editor. Export to PDF, HTML, Word and Markdown, also with `stella export-doc`.
- **Projects in several languages**: translated columns (`name@en`), translated fixed texts and variables, a language menu to see the cards, export in one or all languages, and checks for missing translations.
- **Derived templates**, based on another template and changing only some parts.
- New **Grid** layer for boards, tracks and maps (square, round, hexagonal, triangular or diamond cells, also interlocking), with content repeated in every cell and `{cell.…}` variables.
- **Tabletop Simulator**: tokens, tiles, boards and six-sided dice besides cards, true proportions, copies drawn on the sheet if wanted, and image addresses that load on Windows and upload with the Cloud Manager.
- **Web version**, with nothing to install, at <https://lucadj77.github.io/stella/> (beta at `/beta/`).
- Data: several sets on one sheet, sheets imported from another file, **Check data file…**, a read-only option, Google Sheets, Excel number formats, and saves that change only the changed cells of an .xlsx.
- Set tools: **Statistics…**, **Check text…** (with an orange mark on cards whose text does not fit), **Compare…** with exports of only the changed cards, **Split image…**, **Generate…**, multiple selection in the grid.
- Project **Notes**, **Trash…** to restore deleted items, **Help** (F1) with markup, system variables (`{card.number}`, `{set.name}`, `{date}`…), formula functions with examples and shortcuts.
- Editing on the card (double click), image crop, a new colour picker with the project colours, Iconify and catalog updates for icons and Google Fonts, SVG export.
- Rename sets and templates; style and variable groups with **Where it is used**; new formula functions `MOD` and `PICK`.
- Tools for AI agents: `stella begin`/`end` so the app and an agent do not overwrite each other, and new commands (`stats`, `notes`, `docs`, `check-data`, `pull-sheets`, `export-doc`, `rename-set`, `rename-template`, `version`). The `stella-cli` package works without the app.
- **Update and restart** installs updates by itself (Mac, Windows setup, Linux AppImage), and in ⚙ **Updates** you choose the **Stable** or **Beta** channel. A portable version for Windows.

#### Changed

- **Naibi is now Stella**: new name, new icon, `stella` command and skill. Projects, preferences and backups made with Naibi keep working.
- The buttons are reorganized: a shorter top bar with a **Project** menu, ⋯ menus next to names, set buttons in groups, red buttons for deleting, a menu bar in the desktop app.
- Deleted templates and sets go to the project's `deleted` folder.

#### Fixed

- Many fixes from the betas and from a full code review: exports that stopped on large sheets or on Windows, data files that lost formatting, text overflow marks reported wrongly, and others listed under each beta.

### Italiano

La prima versione ufficiale dopo la 1.1.0, e la prima con il nome **Stella** (prima era Naibi). Raccoglie le 34 beta; i dettagli sono nelle sezioni 1.2.0-beta di CHANGELOG.md.

#### Nuovo

- **Documenti**: regolamenti, sell sheet e appendici scritti in Markdown con il markup di Stella, con l'anteprima della pagina sempre visibile, una barra di formattazione, impostazioni di pagina, proprietà, tabelle, riquadri e immagini. Possono contenere le carte vere del gioco, un'**anatomia della carta** (fronte e retro, con etichette e linee) e un editor della **preparazione del tavolo**. Esportazione in PDF, HTML, Word e Markdown, anche con `stella export-doc`.
- **Progetti in più lingue**: colonne tradotte (`nome@en`), testi fissi e variabili tradotti, un menu per vedere le carte in un'altra lingua, esportazione in una lingua o in tutte e controllo delle traduzioni mancanti.
- **Template derivati**, basati su un altro template e diversi solo in alcune parti.
- Nuovo livello **Griglia** per plance, tracciati e mappe (celle quadrate, tonde, esagonali, triangolari o a rombo, anche a incastro), con un contenuto ripetuto in ogni cella e le variabili `{cell.…}`.
- **Tabletop Simulator**: segnalini, tessere, plance e dadi a sei facce oltre alle carte, proporzioni vere, copie disegnate sul foglio se servono, e indirizzi delle immagini che si caricano su Windows e si caricano nel cloud con il Cloud Manager.
- **Versione web**, senza installare nulla, all'indirizzo <https://lucadj77.github.io/stella/> (la beta in `/beta/`).
- Dati: più set sullo stesso foglio, fogli importati da un altro file, **Controlla file dati…**, l'opzione di sola lettura, Google Sheets, i formati numerici di Excel e salvataggi che cambiano solo le celle modificate di un .xlsx.
- Strumenti dei set: **Statistiche…**, **Controlla testi…** (con un segno arancione sulle carte il cui testo non ci sta), **Confronta…** con l'esportazione delle sole carte cambiate, **Dividi immagine…**, **Genera…**, selezione multipla nella griglia.
- **Note** del progetto, **Cestino…** per recuperare ciò che è stato eliminato, **Aiuto** (F1) con markup, variabili di sistema (`{card.number}`, `{set.name}`, `{date}`…), funzioni delle formule con esempi e scorciatoie.
- Modifica direttamente sulla carta (doppio clic), ritaglio delle immagini, un nuovo selettore dei colori con i colori del progetto, Iconify e aggiornamento dei cataloghi di icone e Google Fonts, esportazione in SVG.
- Rinomina di set e template; gruppi di stili e variabili con **Dove si usa**; nuove funzioni `MOD` e `PICK` nelle formule.
- Strumenti per gli agenti IA: `stella begin`/`end`, così l'app e un agente non si sovrascrivono il lavoro, e nuovi comandi (`stats`, `notes`, `docs`, `check-data`, `pull-sheets`, `export-doc`, `rename-set`, `rename-template`, `version`). Il pacchetto `stella-cli` funziona anche senza l'app.
- **Aggiorna e riavvia** installa gli aggiornamenti da solo (Mac, setup di Windows, AppImage di Linux), e in ⚙ **Aggiornamenti** si sceglie il canale **Stabile** o **Beta**. Una versione portatile per Windows.

#### Cambiato

- **Naibi ora si chiama Stella**: nuovo nome, nuova icona, comando e skill `stella`. Progetti, preferenze e backup fatti con Naibi continuano a funzionare.
- I pulsanti sono riorganizzati: barra in alto più corta con il menu **Progetto**, menu ⋯ accanto ai nomi, pulsanti dei set in gruppi, pulsanti rossi per eliminare, una barra dei menu nell'app desktop.
- Template e set eliminati vanno nella cartella `deleted` del progetto.

#### Corretto

- Molte correzioni dalle beta e da una revisione completa del codice: esportazioni che si fermavano con fogli grandi o su Windows, file dati che perdevano la formattazione, segni di testo che non ci sta segnalati per errore, e le altre elencate in ogni beta.

## 1.2.0-beta.34

### English

- Tabletop Simulator export on Mac and Linux: image addresses are now written as Tabletop Creator writes them, `file:////Users/...` (four slashes) with spaces and accented letters as they are, instead of `file:///Users/...` with `%20`; "Upload all loaded files" in TTS's Cloud Manager no longer gets stuck on them. Export again to update the files.

### Italiano

- Esportazione per Tabletop Simulator su Mac e Linux: gli indirizzi delle immagini ora sono scritti come li scrive Tabletop Creator, `file:////Users/...` (quattro barre) con spazi e lettere accentate come sono, invece di `file:///Users/...` con `%20`; "Upload all loaded files" nel Cloud Manager di TTS non si blocca più. Esporta di nuovo per aggiornare i file.

## 1.2.0-beta.33

### English

- The start screen shows the new Stella icon next to the name (it still had the old green one).

### Italiano

- La schermata iniziale mostra la nuova icona di Stella accanto al nome (c'era ancora quella verde).

## 1.2.0-beta.32

### English

- **Naibi is now called Stella.** The app, the `stella` command (it replaces `naibi`), the AI skill and the web version (now at <https://lucadj77.github.io/stella/>) all take the new name. Nothing to do by hand.
- Projects with `naibi.json` (or `gamecreator.json`) open and keep saving in that file; new projects get `stella.json`.
- Recent projects, preferences and update channel are copied from Naibi at the first start; backups stay in `Documents/Naibi/Backup` if you have them there.
- On the Mac the update installs over Naibi.app and, from the next update, the app is called Stella.app (a Dock shortcut to Naibi.app may need to be added again).
- An AI agent with the old `naibi` skill is told to install the `stella` one.
- New icon: five cards forming a star, on a light pearl rounded square.
- The "What does Naibi mean?" link on the start screen is gone.

### Italiano

- **Naibi ora si chiama Stella.** L'app, il comando `stella` (al posto di `naibi`), la skill per l'IA e la versione web (ora in <https://lucadj77.github.io/stella/>) prendono il nuovo nome. Non c'è niente da fare a mano.
- I progetti con `naibi.json` (o `gamecreator.json`) si aprono e continuano a salvare in quel file; i progetti nuovi hanno `stella.json`.
- Progetti recenti, preferenze e canale degli aggiornamenti si copiano da Naibi al primo avvio; i backup restano in `Documenti/Naibi/Backup` se li hai lì.
- Sul Mac l'aggiornamento si installa al posto di Naibi.app e, dall'aggiornamento successivo, l'app si chiama Stella.app (un collegamento a Naibi.app nel Dock può andare rimesso).
- Un agente IA con la vecchia skill `naibi` viene invitato a installare quella di `stella`.
- Nuova icona: cinque carte che formano una stella, su un quadrato color perla arrotondato.
- Non c'è più il link "Cosa vuol dire Naibi?" nella schermata iniziale.

## 1.2.0-beta.31

### English

- The orange mark next to a card's name and **Check text** no longer report text layers holding only a large icon: the line was taller than the box, but the icon fit entirely.

### Italiano

- Il segno arancione vicino al nome della carta e **Controlla testi** non segnalano più i livelli di testo con solo un'icona grande: la riga era più alta del riquadro, ma l'icona ci stava tutta.

## 1.2.0-beta.30

### English

- **Update channel**: in the ⚙ menu, **Updates** chooses between **Stable** (official versions only) and **Beta** (test versions too). If you already have a beta you stay on Beta, also after the official 1.2.0. Going from Beta back to Stable does not install an older version: Naibi waits for the next official one.
- Automatic updates on Windows and Linux now install exactly the version shown in the notice.
- Web version: the official version is at the main address and the beta at `/beta/`; **Version** in the ⚙ menu switches between them.
- The AI skill installs the `naibi-cli` package from the latest official version, and from the betas only if you already have a beta or ask for it.

### Italiano

- **Canale degli aggiornamenti**: nel menu ⚙, **Aggiornamenti** sceglie tra **Stabile** (solo le versioni ufficiali) e **Beta** (anche quelle di prova). Chi ha già una beta resta su Beta, anche dopo la 1.2.0 ufficiale. Tornando da Beta a Stabile Naibi non installa una versione più vecchia: aspetta la prossima ufficiale.
- L'aggiornamento automatico su Windows e Linux installa ora esattamente la versione indicata nell'avviso.
- Versione web: la versione ufficiale sta all'indirizzo principale e la beta in `/beta/`; **Versione** nel menu ⚙ passa dall'una all'altra.
- La skill per le IA installa il pacchetto `naibi-cli` dall'ultima versione ufficiale, e dalle beta solo se ne hai già una o lo chiedi.

## 1.2.0-beta.29

### English

- Documents: **Box** puts a colored background, and if you want a border, behind any part of a document, from where it starts to where it ends: to make a piece of text stand out, or to set white images without a border apart from the page. It keeps text, lists, tables, cards and images inside; the HTML, PDF and Word exports keep it.
- ⌘Z / Ctrl+Z (and ⇧⌘Z / Ctrl+Y to redo) now work inside the table setup, card anatomy, table and box windows. What these windows write into the document can be undone with ⌘Z / Ctrl+Z in the text.
- Card details: the color picker swatch also appears for outline, border and shadow columns of the sheet (for example `rect.stroke`), even when the cell is empty.
- When an automatic update fails, the banner now says why, and every update attempt is written to `update.log` in Naibi's data folder (on Windows `%APPDATA%\Naibi\update.log`).
- Languages: fixed text layers, fixed value layers and text and value variables have a field for each other language of the project (`texts` / `values` in the files). An empty field uses the main language. Formulas with `=` still compare main-language values, but a result that is a variable, such as `"{attack}"`, is translated.
- Documents in other languages: `language: en` (or `lang: en`) at the top of a document, or **Card language** in **Page**, draws its cards and variables in that language; without it a document uses the main language. `naibi export-doc --lang en` exports in another language without changing the file.
- Missing translations: `naibi check` lists fixed texts, variables and empty `@language` cells still to translate, as warnings that do not change the exit code; `--lang en` checks one language and binds the cards in it. The **Languages** window shows how many texts are left in each language.
- Card anatomy and table setup: leader lines, points and arrows have a thin light halo, so they stay visible over dark parts of the cards.
- Card anatomy and table setup: labels are no longer cut off or drawn larger than set when the page preview is small.

### Italiano

- Documenti: **Riquadro** mette uno sfondo colorato, e se si vuole un bordo, dietro qualunque parte di un documento, da dove comincia a dove finisce: per dare risalto a un pezzo di testo o staccare dal foglio immagini bianche senza bordo. Dentro possono stare testo, elenchi, tabelle, carte e immagini; le esportazioni HTML, PDF e Word lo mantengono.
- ⌘Z / Ctrl+Z (e ⇧⌘Z / Ctrl+Y per rifare) funzionano ora nelle finestre dello schema del tavolo, dell'anatomia della carta, della tabella e del riquadro. Quello che queste finestre scrivono nel documento si annulla con ⌘Z / Ctrl+Z nel testo.
- Dettaglio della carta: il quadratino del selettore del colore compare anche per le colonne del foglio con contorno, bordo e ombra (per esempio `rect.stroke`), anche con la cella vuota.
- Quando l'aggiornamento automatico non riesce, l'avviso ora dice il motivo, e ogni tentativo viene scritto in `update.log` nella cartella dei dati di Naibi (su Windows `%APPDATA%\Naibi\update.log`).
- Lingue: livelli di testo fissi, livelli valore fissi e variabili di testo e valore hanno un campo per ogni altra lingua del progetto (`texts` / `values` nei file). Un campo vuoto usa la lingua principale. Le formule con `=` confrontano sempre i valori della lingua principale, ma un risultato che è una variabile, come `"{attacco}"`, si traduce.
- Documenti in altre lingue: `language: en` (o `lang: en`) in testa a un documento, o **Lingua delle carte** in **Pagina**, disegna carte e variabili del documento in quella lingua; senza, il documento usa la lingua principale. `naibi export-doc --lang en` esporta in un'altra lingua senza cambiare il file.
- Traduzioni mancanti: `naibi check` elenca testi fissi, variabili e celle `@lingua` vuote ancora da tradurre, come avvisi che non cambiano il codice di uscita; `--lang en` controlla una lingua sola e lega le carte in quella lingua. La finestra **Lingue** mostra quanti testi restano in ogni lingua.
- Anatomia della carta e schema del tavolo: linee, punti e frecce hanno un sottile alone chiaro, così restano visibili sopra le parti scure delle carte.
- Anatomia della carta e schema del tavolo: le etichette non sono più tagliate né più grandi del corpo scelto quando l'anteprima della pagina è piccola.

## 1.2.0-beta.28

### English

- Grid **cell content**: a group of the same side can be repeated in every cell of a grid. Draw it in the first cell (**Move to the first cell** puts it there); the other cells get a moved copy. Inside the group `{cell.index}`, `{cell.row}`, `{cell.column}`, `{cell.count}` and `{cell.random}` (fixed for each card) change from cell to cell, for score tracks, numbered boards or icons in sequence.
- New formula functions `MOD` (remainder) and `PICK` (the n-th item of a list, starting again after the last).
- Document tables: cells can hold images and cards next to formatted text, and the table window has the formatting bar, **Image** and **Insert card** for the cell being edited. Under **Look**: table and column widths, which lines to draw (all, between rows, outline, none), line color and thickness, heading and row backgrounds and alternate rows. The look is kept in the HTML, PDF and Word exports.
- The style menu of the small formatting bar (card anatomy, table setup) has **Format…**, which opens the formatting window on the selected text or, with nothing selected, on the whole text.
- Table setup: cards, decks and images rotate freely, with a round handle above them (Shift for 15° steps) or by typing the degrees; **+90°** still turns by a quarter.
- Card anatomy can show **front and back** side by side, with the front labels on the left and the back labels on the right.
- AI agents with the web version only: **AI tools…** is now in the web version too. The skill finds the naibi command by itself (the desktop app if installed), and if there is none it offers to install the `naibi-cli` package, published with every release (`npm install -g`, needs Node.js). It keeps the package and itself up to date with the installed version; the desktop app keeps updating itself. New `naibi version` command.
- In the web version, **Open file** is no longer shown for exported files the browser cannot display (Word, archives): it downloaded a second copy of a file already saved in the project folder.

### Italiano

- **Contenuto delle caselle** della griglia: un gruppo dello stesso lato si può ripetere in ogni casella di una griglia. Si disegna nella prima casella (**Porta nella prima casella** ce lo sposta); le altre ne ricevono una copia spostata. Dentro il gruppo `{cell.index}`, `{cell.row}`, `{cell.column}`, `{cell.count}` e `{cell.random}` (fisso per ogni carta) cambiano da casella a casella, per tracciati del punteggio, plance numerate o icone in sequenza.
- Nuove funzioni delle formule `MOD` (resto della divisione) e `PICK` (l'elemento n-esimo di una lista, che ricomincia dopo l'ultimo).
- Tabelle dei documenti: nelle celle si possono mettere immagini e carte accanto al testo formattato, e la finestra della tabella ha la barra di formattazione, **Immagine** e **Inserisci carta** per la cella che si sta scrivendo. In **Aspetto**: larghezza della tabella e delle colonne, quali linee disegnare (tutte, tra le righe, il contorno, nessuna), colore e spessore delle linee, sfondo dell'intestazione e delle righe e righe alternate. L'aspetto resta nelle esportazioni HTML, PDF e Word.
- Il menu Stile della barra di formattazione piccola (anatomia della carta, schema del tavolo) ha **Formatta…**, che apre la scheda di formattazione sul testo selezionato o, senza selezione, su tutto il testo.
- Schema del tavolo: carte, mazzi e immagini ruotano liberamente, con una maniglia tonda sopra (Maiuscolo per scatti di 15°) o scrivendo i gradi; **+90°** gira ancora di un quarto.
- L'anatomia della carta può mostrare **fronte e retro** affiancati, con le etichette del fronte a sinistra e quelle del retro a destra.
- Agenti IA con la sola versione web: **Strumenti IA…** c'è ora anche nella versione web. La skill trova da sola il comando naibi (l'app desktop, se c'è) e, se non c'è, propone di installare il pacchetto `naibi-cli`, pubblicato con ogni release (`npm install -g`, serve Node.js). Tiene aggiornati il pacchetto e sé stessa alla versione installata; l'app desktop continua ad aggiornarsi da sola. Nuovo comando `naibi version`.
- Nella versione web **Apri il file** non compare più per i file esportati che il browser non sa mostrare (Word, archivi): scaricava una seconda copia di un file già salvato nella cartella del progetto.

## 1.2.0-beta.27

### English

- Every color field has the button that opens the color picker: in the card details, the stroke, border and shadow properties now have it too (it changes the color and keeps width and the rest), and so does editing a shape's color directly on the card.

### Italiano

- Ogni campo colore ha il tasto che apre il selettore: nel dettaglio della carta ora ce l'hanno anche contorno, bordo e ombra (cambia il colore e lascia spessore e il resto), e anche la modifica del colore di una forma direttamente sulla carta.

## 1.2.0-beta.26

### English

- New **Grid** layer in the template editor, for boards, tracks and maps: square, round, hexagonal, triangular or diamond cells in rows and columns, with gap, cell fill and outline and corner radius. **Interlocking** makes a honeycomb of hexagons (point or side up), alternating triangles, diamonds and circles fitting between each other, or brick-like squares. The grid has its own background, behind and between the cells, and a border. At 100% zoom the grid fills the frame without stretching the cells; position in the frame and clipping are under Advanced.
- The color picker shows the project's colors: the color variables (a dot marks them, and hovering shows the variable name) and then the color codes used in templates, styles, variables and sheets, most used first.
- Images in documents: **Image** in the formatting bar opens a window to choose the file, the width in mm, the alignment (left, center, right) and the caption; with the cursor on an image it edits it. In the text: `![Map](icons/map.png?width=40&align=right)`. Cards accept `align` too.
- In the web version, **Open file** after an export opens the exported document directly: PDF, HTML and Markdown in a new tab, other files are downloaded.
- Card anatomy and table setup have a small formatting bar for labels and texts: bold, italic, underline, strikethrough and the project styles, on the selected text.
- Buttons that delete or remove something are red.
- In the editor a selected layer can be dragged even where another layer covers it (for example after choosing it with Alt+click or in the layer list); a click without dragging still selects the layer on top.
- Fixed: in the web version, editing a paragraph could change the text a few characters after the cursor, because the colored overlay of the text wrapped lines in different places than the text box.

### Italiano

- Nuovo livello **Griglia** nell'editor dei template, per plance, tracciati e mappe: caselle quadrate, tonde, esagonali, triangolari o a rombo, in righe e colonne, con spaziatura, riempimento e contorno delle caselle e raggio degli angoli. **A incastro** dispone gli esagoni ad alveare (con la punta o il lato in alto), alterna i triangoli, incastra rombi e cerchi tra loro e mette i quadrati a mattoncino. La griglia ha un suo sfondo, dietro e tra le caselle, e un bordo. A zoom 100% riempie il riquadro senza deformare le caselle; posizione nel riquadro e taglio sono in Avanzate.
- La scelta del colore mostra i colori del progetto: le variabili colore (segnate da un punto, e passandoci sopra si vede il nome della variabile) e poi i codici usati in template, stili, variabili e fogli, dal più usato.
- Immagini nei documenti: **Immagine** nella barra di formattazione apre una finestra per scegliere il file, la larghezza in mm, l'allineamento (a sinistra, al centro, a destra) e la didascalia; con il cursore su un'immagine la modifica. Nel testo: `![Mappa](icone/mappa.png?width=40&align=right)`. Anche le carte accettano `align`.
- Nella versione web, **Apri il file** dopo un'esportazione apre direttamente il documento esportato: PDF, HTML e Markdown in una nuova scheda, gli altri file si scaricano.
- Anatomia carta e schema del tavolo hanno una piccola barra di formattazione per etichette e testi: grassetto, corsivo, sottolineato, barrato e gli stili del progetto, sul testo selezionato.
- I tasti che eliminano o tolgono qualcosa sono rossi.
- Nell'editor un livello selezionato si trascina anche dove un altro livello lo copre (per esempio dopo averlo scelto con Alt+clic o nell'elenco dei livelli); un clic senza trascinare seleziona sempre il livello in cima.
- Corretto: nella versione web, modificando un paragrafo il testo poteva cambiare qualche carattere dopo il cursore, perché la copia colorata del testo andava a capo in punti diversi dalla casella di testo.

## 1.2.0-beta.25

### English

- Projects in several languages: **Languages…** in the **Project** menu sets the languages of the project (the first is the main one), the names of the project and of the sets in the other languages, and adds the columns to translate to the sheets. The translation of a column goes in a column such as `name@en`; an empty translated cell uses the main language.
- A menu next to the project name shows the cards in another language: grid, preview, editor and documents. Double-clicking the card edits the translated text.
- Only what is read is translated: image names, colours and formulas starting with `=` keep the values of the main language, so formulas work unchanged in every language. `{project.name}` and `{set.name}` use the translated names.
- **Export…** has a **Language** choice, also **All languages**: other languages go to a subfolder named after their code (`export/en`), with the same file names. On the command line: `naibi render --lang en`, `naibi export --profile NAME --lang en|all`.
- Documents have a formatting bar above the text: heading level, bold, italic, underline, strikethrough, bulleted and numbered lists, quote, a **Style** menu with the project styles and the advanced formatting, and the buttons to insert an image, a table, a card, a card anatomy or a table setup. The bar writes ordinary markup, and Undo works on it.
- Document properties, as in Obsidian: the YAML front matter at the top of a document (title, tags, author…) is kept and shown in a **Properties** panel where you edit, add and remove entries. They are not printed unless you tick **Show in the document**, which adds them as a table at the top of the page and of the exports.
- Documents can be duplicated, from the ⋯ menu or with a right click in the sidebar, where they can also be deleted.
- **Card anatomy** fits the screen: two columns, the cards to choose on the left, a live preview of the anatomy and the layers on the right.
- After an export, buttons open the exported files directly (for up to 6 files), besides the folder.
- New projects have all their folders from the start, `docs` included, and opening an older project adds the missing ones.

### Italiano

- Progetti in più lingue: **Lingue…** nel menu **Progetto** sceglie le lingue del progetto (la prima è la principale), i nomi del progetto e dei set nelle altre lingue, e aggiunge ai fogli le colonne da tradurre. La traduzione di una colonna va in una colonna come `nome@en`; una cella tradotta vuota usa la lingua principale.
- Un menu accanto al nome del progetto mostra le carte in un'altra lingua: griglia, anteprima, editor e documenti. Il doppio clic sulla carta modifica il testo tradotto.
- Si traduce solo ciò che si legge: nomi delle immagini, colori e formule che cominciano con `=` tengono i valori della lingua principale, così le formule funzionano in ogni lingua senza cambiarle. `{project.name}` e `{set.name}` usano i nomi tradotti.
- **Esporta…** ha la scelta **Lingua**, anche **Tutte le lingue**: le altre lingue vanno in una sottocartella con il loro codice (`export/en`), con gli stessi nomi di file. Da riga di comando: `naibi render --lang en`, `naibi export --profile NOME --lang en|all`.
- I documenti hanno una barra di formattazione sopra il testo: livello del titolo, grassetto, corsivo, sottolineato, barrato, elenchi puntati e numerati, citazione, un menu **Stile** con gli stili del progetto e la formattazione avanzata, e i tasti per inserire un'immagine, una tabella, una carta, un'anatomia o uno schema del tavolo. La barra scrive il markup normale, e Annulla funziona anche su questo.
- Proprietà del documento, come in Obsidian: il frontmatter YAML in testa al documento (titolo, tag, autore…) si conserva e si vede nel pannello **Proprietà**, dove si modificano, aggiungono e tolgono le voci. Non si stampano, a meno di spuntare **Mostra nel documento**, che le aggiunge come tabella in testa alla pagina e alle esportazioni.
- I documenti si possono duplicare, dal menu ⋯ o con il clic destro nella barra laterale, dove si possono anche eliminare.
- **Anatomia carta** sta nello schermo: due colonne, a sinistra le carte da scegliere, a destra l'anteprima dal vivo dell'anatomia e i livelli.
- Dopo un'esportazione, dei tasti aprono direttamente i file esportati (fino a 6), oltre alla cartella.
- I progetti nuovi hanno da subito tutte le loro cartelle, `docs` compresa, e aprire un progetto creato prima aggiunge quelle che mancano.

## 1.2.0-beta.24

### English

- Documents export to Word: **Export document…** has a new **Word** choice that saves a `.docx` file to edit in Word or LibreOffice. Headings, lists, tables and quotes become Word styles; page size, margins, fonts, line spacing and colors come from the document's page settings; cards, card anatomies, table setups and images are pictures at 300 dpi; bold, italic, colors and icons in the text are kept.
- New command `naibi export-doc <project> [<name>] [--format pdf|html|docx|md] [--out folder]`: it exports the documents, all or one, without opening the app, the same way as **Export document…**. An AI agent can now write a rulebook and check the PDF by itself.

### Italiano

- I documenti si esportano in Word: **Esporta documento…** ha la nuova scelta **Word**, che salva un file `.docx` da modificare in Word o LibreOffice. Titoli, elenchi, tabelle e citazioni diventano stili di Word; formato pagina, margini, caratteri, interlinea e colori vengono dalle impostazioni della pagina del documento; carte, anatomie, schemi del tavolo e immagini sono figure a 300 dpi; grassetto, corsivo, colori e icone nel testo restano.
- Nuovo comando `naibi export-doc <progetto> [<nome>] [--format pdf|html|docx|md] [--out cartella]`: esporta i documenti, tutti o uno, senza aprire l'app, come **Esporta documento…**. Un agente IA ora può scrivere un regolamento e controllarne il PDF da solo.

## 1.2.0-beta.23

### English

- Documents can show how to set up the table: **Table setup** opens an editor where you add zones, cards, decks, texts, arrows and images and drag them into place. Cards and decks are the real cards of the project, drawn as they are now; a deck is a small stack, and cards can be turned by 90°. Labels and texts can use markup and variables.
- In the text the drawing is a ` ```setup ` block, one element per line in millimetres, which you can also write by hand or have an AI agent write (see the guide and `docs/formato.md`). With the cursor inside it, the same button opens it again. `naibi check` reports lines that are not understood and cards that are not found.
- The drawing shrinks to fit the page and is exported like the rest of the document: in the PDF and HTML as a drawing, in Markdown as a PNG.
- Fixed: in exports, the text of a card drawn rotated inside another drawing came out one letter per line.

### Italiano

- I documenti possono mostrare come preparare il tavolo: **Schema tavolo** apre un editor in cui si aggiungono zone, carte, mazzi, testi, frecce e immagini e si trascinano al loro posto. Carte e mazzi sono le carte vere del progetto, disegnate come sono ora; un mazzo è una piccola pila, e le carte si possono girare di 90°. Etichette e testi accettano il markup e le variabili.
- Nel testo lo schema è un blocco ` ```setup `, un elemento per riga in millimetri, che si può anche scrivere a mano o far scrivere a un agente IA (vedi la guida e `docs/formato.md`). Con il cursore dentro, lo stesso tasto lo riapre. `naibi check` segnala le righe che non si capiscono e le carte che non si trovano.
- Lo schema si riduce per stare nella pagina e si esporta con il resto del documento: nel PDF e nell'HTML come disegno, nel Markdown come PNG.
- Corretto: nelle esportazioni, il testo di una carta disegnata ruotata dentro un altro disegno usciva con una lettera per riga.

## 1.2.0-beta.22

### English

- The buttons are reorganized so that the top bar fits in the window again (before, at 1440 pixels the language choice was cut off). The top bar now has undo and redo, **Save**, **Export…**, a **Project** menu with the commands used less often (**Backup…**, **Trash…**, **Google Sheets…**, **Reload from disk**, **Close project**), **Help** and ⚙.
- ⚙, on every screen including the start screen, holds the interface size, theme, language and **AI tools…**.
- Rename, duplicate, delete and, for templates, derive are in a ⋯ menu next to the name of the open set or template. The same menu opens from the ⋯ of an item in the sidebar and with a right click on it.
- The buttons of a set are in groups: cards (**+ Card**, **Duplicate**, **Generate…**, **Split image…**), columns (**+ Column**, **Columns**), a **Checks** menu (**Statistics…**, **Compare…**, **Check texts…**) and **Delete** last, away from **+ Card**. Filter and sort have their own row.
- In a document, **Rename** and **Delete** are in the ⋯ next to the title; the export button is now **Export document…**, to tell it from the export of the cards.
- The desktop app has its own menu (File, Edit, View, Help) with the same commands and their shortcuts; on Windows and Linux it appears with the Alt key. ⌘+, ⌘− and ⌘0 change the interface size.

### Italiano

- I pulsanti sono riordinati perché la barra in alto stia di nuovo nella finestra (prima, a 1440 pixel la scelta della lingua era tagliata). La barra in alto ora ha annulla e ripristina, **Salva**, **Esporta…**, un menu **Progetto** con i comandi usati di rado (**Backup…**, **Cestino…**, **Google Sheets…**, **Ricarica dal disco**, **Chiudi progetto**), **Aiuto** e ⚙.
- ⚙, in ogni schermata compresa quella di ingresso, contiene dimensione dell'interfaccia, tema, lingua e **Strumenti IA…**.
- Rinomina, duplica, elimina e, per i template, deriva stanno in un menu ⋯ accanto al nome del set o del template aperto. Lo stesso menu si apre dal ⋯ di una voce della barra laterale e con il tasto destro sulla voce.
- I pulsanti di un set sono in gruppi: carte (**+ Carta**, **Duplica**, **Genera…**, **Dividi immagine…**), colonne (**+ Colonna**, **Colonne**), un menu **Controlli** (**Statistiche…**, **Confronta…**, **Controlla testi…**) ed **Elimina** per ultimo, lontano da **+ Carta**. Filtro e ordinamento hanno una riga propria.
- In un documento **Rinomina** ed **Elimina** stanno nel ⋯ accanto al titolo; il pulsante di esportazione ora è **Esporta documento…**, per distinguerlo dall'esportazione delle carte.
- L'app per computer ha un suo menu (File, Modifica, Vista, Aiuto) con gli stessi comandi e le loro scorciatoie; su Windows e Linux compare con il tasto Alt. ⌘+, ⌘− e ⌘0 cambiano la dimensione dell'interfaccia.

## 1.2.0-beta.21

### English

- New **Documents** section in the sidebar, for the rules, a sell sheet, an appendix: Markdown text on the left, the page preview always visible on the right, saved as you type in `docs/<name>.md`. The text uses Naibi's markup, so `{heart}` draws the icon and `[text]{.keyword}` a style, as on the cards. **Insert card** chooses a card of the game and writes `![Wizard](card:Characters/name=Wizard)`: the document draws the card from the project, so it changes when the card changes. Problems (cards or images not found) are listed under the text and by `naibi check`; `naibi docs` shows the documents to an AI agent. **Card anatomy** draws a card with labels joined by lines to its parts (layers of the template), chosen in a window or written as an ` ```anatomy ` block; it is exported like the cards. **Table** fills in a table in a grid (also pasting from a spreadsheet) and edits the table where the cursor is. **Page** sets the page size, margins, text and heading fonts, text size, line spacing, space after paragraphs, alignment and colors; the preview shows the page at its real width. The settings are written at the top of the file, between two `---` lines, so an AI agent can change them too. **Export** saves the document in `export/docs/` as PDF (desktop only), as a single HTML file with cards, images and fonts inside, or as plain Markdown with the cards as PNG files.

### Italiano

- Nuova sezione **Documenti** nella barra laterale, per il regolamento, una sell sheet, un'appendice: a sinistra il testo in Markdown, a destra l'anteprima della pagina sempre visibile, con salvataggio mentre si scrive in `docs/<nome>.md`. Il testo usa il markup di Naibi, quindi `{cuore}` disegna l'icona e `[testo]{.keyword}` uno stile, come sulle carte. **Inserisci carta** sceglie una carta del gioco e scrive `![Mago](card:Personaggi/nome=Mago)`: il documento disegna la carta dal progetto, quindi cambia quando cambia la carta. I problemi (carte o immagini che non si trovano) compaiono sotto il testo e in `naibi check`; `naibi docs` mostra i documenti a un agente IA. **Anatomia carta** disegna una carta con le etichette collegate da una linea alle sue parti (i livelli del template), scelte in una finestra o scritte come blocco ` ```anatomy `; si esporta come le carte. **Tabella** compila una tabella in una griglia (anche incollando da un foglio di calcolo) e modifica quella dove si trova il cursore. **Pagina** imposta formato, margini, carattere del testo e dei titoli, dimensione del testo, interlinea, spazio dopo i paragrafi, allineamento e colori; l'anteprima mostra la pagina alla sua larghezza vera. Le impostazioni sono scritte in testa al file, tra due righe `---`, così le può cambiare anche un agente IA. **Esporta** salva il documento in `export/docs/` in PDF (solo nell'app per computer), in un unico file HTML con carte, immagini e font dentro, oppure in Markdown semplice con le carte come file PNG.

## 1.2.0-beta.20

### English

- **Check data file…**, at the bottom of the sidebar, shows how Naibi reads each sheet of the data file: the sets that use it, the columns their templates read and the sheet lacks, and problems: a title above the headings, repeated headings, columns without a heading, merged cells, Excel errors, formulas without a saved result, empty rows between the data, and charts that a save would remove. It does not change the file. The `naibi check-data` command does the same.
- From the same window, **Import a sheet from another file…** puts the rows of a sheet of another .xlsx, .ods or .csv file in place of those of a set. It first shows the new, removed and changed rows, matched by a column with all different values such as the name, and can keep the columns the file does not have; then it makes a backup of the project. The change can be undone with ⌘Z. Not in the web version yet.
- Numbers in .xlsx files are read with the cell's number format, as Excel shows them: 0.5 formatted as a percentage arrives as `50%`, 1234.5 formatted as currency as `1 234.50 €` (always with a decimal point, and a space for thousands). Formulas in templates read these values as numbers (`{chance}*2`, `=IF({cost}>1000; …)`); typing `60%` or `3.50 €` in Naibi writes the number back to the cell, keeping its format, in .ods files too.
- Saving the data of a set in an .xlsx file now changes only the changed cells and leaves the rest of the file as it was, so charts, pivot tables and anything else Naibi does not know stay, in every sheet. Naibi still rewrites the whole file, and asks first if it would lose something, when a set is added, renamed or deleted. After a save Excel recalculates the formulas when it opens the file.

### Italiano

- **Controlla file dati…**, in fondo alla barra laterale, mostra come Naibi legge ogni foglio del file dei dati: i set che lo usano, le colonne che i loro template leggono e il foglio non ha, e le anomalie: un titolo sopra le intestazioni, intestazioni ripetute, colonne senza intestazione, celle unite, errori di Excel, formule senza risultato salvato, righe vuote tra i dati e i grafici che un salvataggio toglierebbe. Non modifica il file. Il comando `naibi check-data` fa lo stesso.
- Dalla stessa finestra, **Importa un foglio da un altro file…** mette le righe di un foglio di un altro file .xlsx, .ods o .csv al posto di quelle di un set. Prima mostra le righe nuove, tolte e cambiate, riconosciute da una colonna con valori tutti diversi come il nome, e può tenere le colonne che il file non ha; poi fa un backup del progetto. La modifica si annulla con ⌘Z. Non ancora nella versione web.
- I numeri dei file .xlsx si leggono con il formato della cella, come li mostra Excel: 0,5 in percentuale arriva come `50%`, 1234,5 in valuta come `1 234.50 €` (sempre con il punto per i decimali e lo spazio per le migliaia). Le formule dei template leggono questi valori come numeri (`{probabilità}*2`, `=IF({costo}>1000; …)`); scrivendo `60%` o `3,50 €` in Naibi nella cella torna il numero, con il suo formato, anche nei file .ods.
- Salvando i dati di un set in un file .xlsx Naibi ora cambia solo le celle modificate e lascia il resto del file com'era: grafici, tabelle pivot e tutto ciò che Naibi non conosce restano, in tutti i fogli. Il file viene ancora riscritto tutto, con una domanda prima se si perderebbe qualcosa, quando si aggiunge, rinomina o elimina un set. Dopo un salvataggio Excel ricalcola le formule quando apre il file.

## 1.2.0-beta.19

### English

- Several sets can use the same sheet, each with its own template: for example "Red troops" and "Yellow troops" drawn from one "Troops" sheet. In **New set**, under **Sheet**, the sheets already in use are listed as "Troops (data of Red troops)". A change to the data in one set applies to all the sets on the sheet; renaming one of them does not rename the sheet, and deleting one leaves the sheet in the file while another set uses it. The `naibi rename-set` command behaves the same way.
- When the data file is changed outside Naibi (Excel, LibreOffice, the `naibi` command), Naibi reads it again by itself. If Naibi has unsaved changes to the data, a notice offers **Reload** or **Ignore** instead.
- The data file can be set to **read-only**, with the checkbox at the bottom of the sidebar: Naibi then never writes to it. Changes to the data are refused, renaming a set keeps the sheet name, deleting a set leaves its sheet in the file, and `naibi set-rows` and `naibi pull-sheets` refuse too. This suits a data file that you edit in Excel, with formulas and charts that a save from Naibi would lose.

### Italiano

- Più set possono usare lo stesso foglio, ognuno col suo template: per esempio "Truppe rosse" e "Truppe gialle" dallo stesso foglio "Truppe". In **Nuovo set**, alla voce **Foglio**, i fogli già usati compaiono come "Truppe (dati di Truppe rosse)". Una modifica ai dati in un set vale per tutti i set del foglio; rinominarne uno non rinomina il foglio, ed eliminarne uno lascia il foglio nel file finché lo usa un altro set. Il comando `naibi rename-set` si comporta allo stesso modo.
- Quando il file dei dati viene modificato fuori da Naibi (Excel, LibreOffice, il comando `naibi`), Naibi lo rilegge da solo. Se in Naibi ci sono modifiche ai dati non salvate, compare invece un avviso con **Ricarica** e **Ignora**.
- Il file dei dati si può mettere **in sola lettura**, con la casella in fondo alla barra laterale: Naibi non ci scrive mai. Le modifiche ai dati vengono rifiutate, rinominare un set non rinomina il foglio, eliminare un set lascia il foglio nel file, e anche `naibi set-rows` e `naibi pull-sheets` rifiutano. È pensato per un file dei dati che modifichi in Excel, con formule e grafici che un salvataggio di Naibi perderebbe.

## 1.2.0-beta.18

### English

- Saving a set whose sheet has empty rows between the cards no longer moves the cards up: each card goes back to its row, the empty rows stay where they are, and the columns Naibi does not use (notes, formulas) stay next to the right card. The same holds for .ods files. If the headings are not in row 1 (for example row 1 is empty), Naibi now also writes them back to the right row.
- Help (F1), Formulas tab: every function has an example with its result.
- **New project** can start from a data file you already have (.xlsx, .ods, .csv): Naibi works on a copy in the project's `data` folder and its sheets become sets with **New set**. The guide has a new page on using an existing Excel file.
- If the Excel data file contains charts, pivot tables, slicers or links to other files, Naibi warns before saving set data, because saving removes them from the whole file.
- Renaming a set whose sheet is already in the data file asks whether to rename the sheet too: formulas in other sheets that refer to it would break.
- Cells with an Excel error now read as the error (`#DIV/0!`, `#N/A`) instead of `[object Object]`, and FALSE reads as `false` instead of an empty cell.
- A note that is already written opens in Preview; a new one opens ready for writing.
- The colour picker has a **None** button: it writes `none` (no colour) without typing it.

### Italiano

- Salvando un set il cui foglio ha righe vuote tra le carte, le carte non salgono più: ognuna torna nella sua riga, le righe vuote restano dove sono e le colonne che Naibi non usa (note, formule) restano accanto alla carta giusta. Vale anche per i file .ods. Se le intestazioni non sono nella riga 1 (per esempio la riga 1 è vuota), Naibi ora le riscrive anche nella riga giusta.
- Aiuto (F1), scheda Formule: ogni funzione ha un esempio con il suo risultato.
- **Nuovo progetto** può partire da un file di dati che hai già (.xlsx, .ods, .csv): Naibi lavora su una copia nella cartella `data` del progetto e i suoi fogli diventano set con **Nuovo set**. La guida ha una pagina nuova su come usare un file Excel che hai già.
- Se il file dei dati Excel contiene grafici, tabelle pivot, filtri dati o collegamenti ad altri file, Naibi avvisa prima di salvare i dati dei set, perché il salvataggio li toglie da tutto il file.
- Rinominando un set il cui foglio è già nel file dei dati, Naibi chiede se rinominare anche il foglio: le formule di altri fogli che lo citano si romperebbero.
- Le celle con un errore di Excel ora si leggono come l'errore (`#DIV/0!`, `#N/D`) invece di `[object Object]`, e FALSO si legge `false` invece di una cella vuota.
- Una nota già scritta si apre in Anteprima; una nuova si apre pronta per scrivere.
- Il selettore del colore ha il pulsante **Nessuno**: scrive `none` (nessun colore) senza doverlo digitare.

## 1.2.0-beta.17

### English

- **Statistics…** in the set header: how many cards have each value of a column (formula layers too), with sum, average, minimum and maximum of numbers, counting the copies in `amount`. With a filter, only the filtered cards count. The new `naibi stats` command gives the same numbers to an AI.
- **Check text…** in the set header lists the cards (front and back) whose text does not fit in its box, even shrunk to the minimum size; in the grid those cards have an orange mark.
- **Trash…** in the toolbar: deleted templates, sets and notes, with **Restore** to put them back in the project (a set gets the template you choose).
- **Compare…** marks the cards that are new or changed since the last export or a backup (blue dot), and the export can include only those: reprint just what changed.
- **Split image…** in the set header spreads one big image across the cards (columns × rows, by rows or by columns, with or without the outer bleed in the image): the cards make up the image again when placed in a grid.
- Tabletop Simulator: two new objects per set. **Boards**: like tiles but not stackable, each one on the table next to the others. **Dice (6 faces)**: every six cards of the set make a die (card 1 on face 1 and so on, opposite faces adding up to 7), with the value shown when you roll it.
- **Google Sheets…** in the top bar: set data from a Google sheet shared by link, one tab per set (usually with the same name). The link stays in the project to refresh the data with one click; also from the command line with `naibi pull-sheets`.
- Automatic update: **Update and restart** in the new version notice downloads it, installs it and reopens Naibi (Windows setup, Linux AppImage, Mac). It works from the version after this one; the Windows portable version and the .deb are still downloaded by hand.

### Italiano

- **Statistiche…** nell'intestazione del set: quante carte hanno ogni valore di una colonna (anche dei livelli con formula), con somma, media, minimo e massimo dei numeri, contando le copie di `amount`. Con un filtro contano solo le carte filtrate. Il nuovo comando `naibi stats` dà gli stessi numeri a un'IA.
- **Controlla testi…** nell'intestazione del set elenca le carte (fronte e retro) con un testo che non sta nel riquadro, anche ridotto alla dimensione minima; nella griglia quelle carte hanno un segno arancione.
- **Cestino…** nella barra in alto: template, set e note eliminati, con **Ripristina** per rimetterli nel progetto (un set prende il template scelto).
- **Confronta…** segna le carte nuove o cambiate dall'ultima esportazione o da un backup (punto blu), e l'esportazione può includere solo quelle: si ristampa solo ciò che è cambiato.
- **Dividi immagine…** nell'intestazione del set distribuisce un'immagine grande tra le carte (colonne × righe, per righe o per colonne, con o senza l'abbondanza esterna nell'immagine): messe in griglia, le carte ricompongono l'immagine.
- Tabletop Simulator: due nuovi oggetti per set. **Plance**: come le tessere ma non impilabili, ognuna sul tavolo accanto alle altre. **Dadi (6 facce)**: ogni sei carte del set fanno un dado (la carta 1 sulla faccia 1 e così via, facce opposte che fanno 7), con il valore mostrato quando lo tiri.
- **Google Sheets…** nella barra in alto: i dati dei set da un foglio Google condiviso con il link, una scheda per set (di solito con lo stesso nome). Il link resta nel progetto per aggiornare i dati con un clic; anche da riga di comando con `naibi pull-sheets`.
- Aggiornamento automatico: **Aggiorna e riavvia** nell'avviso di una versione nuova la scarica, la installa e riapre Naibi (setup di Windows, AppImage di Linux, Mac). Vale dalla versione successiva a questa; la versione portatile di Windows e il .deb restano da scaricare a mano.

## 1.2.0-beta.16

### English

- New box attribute `text-raise=`: moves only the text inside a box (`bg=`, `fill=`, `border=`) up by the given pt, or down with a negative value, without moving the box. It also works in a style, for example `.heart = bg=heart color=white text-raise=1`, and appears in the Format dialog under the box settings.

### Italiano

- Nuovo attributo dei riquadri `text-raise=`: sposta in su dei pt indicati, o in giù con un valore negativo, solo il testo dentro un riquadro (`bg=`, `fill=`, `border=`) senza spostare il riquadro. Vale anche in uno stile, per esempio `.cuore = bg=cuore color=white text-raise=1`, e compare nella finestra Formato tra le impostazioni del riquadro.

## 1.2.0-beta.15

### English

- Project notes: a new **Notes** section at the bottom of the sidebar. The + creates a note, a click opens it in a panel beside any screen (sets, templates). Notes are written in Markdown, with a **Preview**, are renamed from their title and save themselves as you type, as `notes/<name>.md` files in the project. Deleted notes go to the `deleted` folder.
- An AI working on the project reads the notes with the new `naibi notes` command (also listed by `naibi info`); the skill asks it to read them before working.

### Italiano

- Note del progetto: una nuova sezione **Note** in fondo alla barra laterale. Il + crea una nota, un clic la apre in un pannello accanto a qualsiasi schermata (set, template). Le note si scrivono in Markdown, con un'**Anteprima**, si rinominano dal titolo e si salvano da sole mentre si scrive, come file `notes/<nome>.md` del progetto. Le note eliminate vanno nella cartella `deleted`.
- Un'IA che lavora sul progetto legge le note con il nuovo comando `naibi notes` (le elenca anche `naibi info`); la skill le chiede di leggerle prima di lavorare.

## 1.2.0-beta.14

### English

- Set view: **Reset** in the **Columns** menu goes back to the basic view. Only the columns read by layers linked to a column stay visible, with their properties in the field details, which close. Sheet columns no layer reads, for example left over from an imported TTC project, are hidden; nothing is deleted.

### Italiano

- Vista del set: **Ripristina** nel menu **Colonne** torna alla vista di base. Restano visibili solo le colonne lette dai livelli collegati a una colonna, con le loro proprietà nei dettagli dei campi, che si chiudono. Le colonne del foglio che nessun livello legge, per esempio rimaste da un progetto TTC importato, si nascondono; non si cancella niente.

## 1.2.0-beta.13

### English

- Editor, like Affinity: holding Shift while moving a layer keeps it horizontal, vertical or at 45°. While resizing, Shift switches the proportion lock (before, it could only turn it on) and ⌘ (Ctrl on Windows) resizes from the center.
- The hexagon is now regular (all sides and angles equal): as card shape, where it is the largest that fits in the card (**Fit the card to the hexagon** adjusts the short side so it fills the card), and as text background (`bg=hexagon`). Before, it was stretched to the card size. Polygon and star layers get a **Make regular** button.
- Text: underscores keep a piece of text on one line, so a number and its icon never get separated: `_4{coin}_`. The same as the new `nowrap` attribute: `[4{coin}]{nowrap}`.
- Styles and variables can be split into groups (**Group** field in their window, or by dragging an item onto a group heading or next to an item of another group). In the sidebar each group has a heading that closes with a click; with more than 12 items a field filters them by name.
- Sidebar: the Sets, Templates, Styles and Variables headings stand out as colored bands, with larger icons and buttons.
- The style and variable windows show **Where it is used**: templates with their layers, sets with card numbers, other variables and styles. Clicking a template or set opens it.
- PDF export: new **One after another on the same page** option. A set starts right after the previous one instead of on a new page, so 10 + 8 cards with 9 per page take 2 pages, not 3. A set with cards of another size starts on a new row of the same page, if there is room.

### Italiano

- Editor, come in Affinity: tenendo premuto Maiuscolo mentre si sposta un livello, questo resta in orizzontale, in verticale o a 45°. Ridimensionando, Maiuscolo inverte il blocco delle proporzioni (prima poteva solo attivarlo) e ⌘ (Ctrl su Windows) ridimensiona dal centro.
- L'esagono ora è regolare (lati e angoli tutti uguali): come forma della carta, dove è il più grande che sta nella carta (**Adatta la carta all'esagono** cambia il lato corto perché la riempia), e come sfondo nel testo (`bg=hexagon`). Prima si allungava sulle misure della carta. I livelli poligono e stella hanno un pulsante **Rendi regolare**.
- Testo: i trattini bassi tengono un pezzo di testo sulla stessa riga, così un numero e la sua icona non si separano: `_4{moneta}_`. È lo stesso del nuovo attributo `nowrap`: `[4{moneta}]{nowrap}`.
- Stili e variabili si possono dividere in gruppi (campo **Gruppo** nella loro finestra, oppure trascinando una voce sul titolo di un gruppo o accanto a una voce di un altro gruppo). Nella barra laterale ogni gruppo ha un titolo che si chiude con un clic; con più di 12 voci un campo le filtra per nome.
- Barra laterale: i titoli Set, Template, Stili e Variabili risaltano come fasce colorate, con icone e pulsanti più grandi.
- Le finestre di stili e variabili mostrano **Dove si usa**: template con i livelli, set con i numeri delle carte, altre variabili e stili. Un clic su un template o su un set lo apre.
- Esportazione in PDF: nuova opzione **Uno dopo l'altro sulla stessa pagina**. Un set comincia subito dopo il precedente invece che su una pagina nuova, quindi 10 + 8 carte con 9 per pagina occupano 2 pagine e non 3. Un set con carte di un'altra misura comincia su una riga nuova della stessa pagina, se c'è posto.

## 1.2.0-beta.12

### English

- Tabletop Simulator export: new **Objects** option, set by set. Besides **Cards** (the deck, as before), a set can become **Tokens** or **Tiles**.
  - A token is the card cut out along its shape, with a thickness; underneath, Tabletop Simulator shows the front mirrored.
  - A tile has the card front and back, the card shape (square, rounded, hexagonal or round), a thickness and an **Edge** color.
  - Thickness is in mm. The pieces of a set go into a bag, copies included.
  - Cards, tokens and tiles keep their true proportions in Tabletop Simulator: a 63 mm card keeps the usual size, smaller or larger cards and pieces are scaled to match.

### Italiano

- Esportazione per Tabletop Simulator: nuova opzione **Oggetti**, set per set. Oltre a **Carte** (il mazzo, come prima), un set può diventare **Segnalini** o **Tessere**.
  - Un segnalino è la carta ritagliata sulla sua forma, con uno spessore; sotto, Tabletop Simulator mostra il fronte specchiato.
  - Una tessera ha fronte e retro della carta, la forma della carta (quadrata, arrotondata, esagonale o rotonda), uno spessore e un colore del **Bordo**.
  - Lo spessore è in mm. I pezzi di un set vanno in un sacchetto, copie comprese.
  - Carte, segnalini e tessere mantengono in Tabletop Simulator le proporzioni vere: una carta da 63 mm resta della misura solita, carte e pezzi più piccoli o più grandi si scalano di conseguenza.

## 1.2.0-beta.11

### English

- Web version: most of what was desktop-only now works in the browser too.
  - **Icon libraries** (game-icons.net, Kenney, Iconify) and **Google Fonts** (the Latin alphabet, accented letters included).
  - **Fonts installed on the computer**, in Chrome and Edge after you allow it.
  - **Backups**. Without a chosen folder they stay in the browser, and clearing the site data deletes them.
  - **Tabletop Creator import**.
  - **Tabletop Simulator export**. Choose the Tabletop Simulator folder, then paste its full path the first time. The browser does not give the path, and the deck needs it to find the images; the site remembers it. On macOS the browser cannot open the Saved Objects folder: docs/web.md explains how to work around it.
- New **Add images…** button in the image picker, in the desktop app and in the web version. It copies images from the computer into `assets/images` of the project. A file with the same name is not overwritten: the copy gets a number.
- The **Help** window has a link to the complete user guide at the top.
- Image picker: new **Dark background** button, to see white icons. The choice is remembered.

### Italiano

- Versione web: gran parte di ciò che c'era solo nell'app desktop ora funziona anche nel browser.
  - **Librerie di icone** (game-icons.net, Kenney, Iconify) e **Google Fonts** (alfabeto latino, lettere accentate comprese).
  - **Font installati sul computer**, in Chrome ed Edge dopo averlo consentito.
  - **Backup**. Senza una cartella scelta restano nel browser, e cancellando i dati del sito si perdono.
  - **Importazione da Tabletop Creator**.
  - **Esportazione per Tabletop Simulator**. Si sceglie la cartella di Tabletop Simulator e la prima volta si incolla il suo percorso completo. Il browser non lo fornisce, e al mazzo serve per trovare le immagini; il sito lo ricorda. Su macOS il browser non può aprire la cartella Saved Objects: docs/web.md spiega come aggirarlo.
- Nuovo pulsante **Aggiungi immagini…** nella scelta delle immagini, nell'app desktop e nella versione web. Copia immagini dal computer in `assets/images` del progetto. Un file con lo stesso nome non si sovrascrive: la copia prende un numero.
- La finestra **Aiuto** ha in cima un link alla guida completa.
- Scelta delle immagini: nuovo pulsante **Sfondo scuro**, per vedere le icone bianche. La scelta viene ricordata.

## 1.2.0-beta.10

### English

- New **web version**: Naibi in the browser, with nothing to install, at https://lucadj77.github.io/naibi/. It is meant for computers where the app cannot be installed or started, for example office PCs that block unsigned programs. It works on the project folders of your computer and the projects are the same files as in the desktop app. It needs Chrome, Edge or Opera (Brave only after turning on brave://flags/#file-system-access-api), and the browser asks for permission on the project folder each time. Editing, data, templates, image export and PDF export (through the browser print window) are there; Tabletop Simulator, icon libraries, Google Fonts, backups, Tabletop Creator import and the tools for AI agents stay in the desktop app. **What the desktop app adds**, at the bottom of the start screen, lists the differences.

### Italiano

- Nuova **versione web**: Naibi nel browser, senza installare nulla, all'indirizzo https://lucadj77.github.io/naibi/. Serve sui computer dove l'app non si può installare o avviare, per esempio i PC aziendali che bloccano i programmi non firmati. Lavora sulle cartelle dei progetti del tuo computer e i progetti sono gli stessi file dell'app desktop. Richiede Chrome, Edge o Opera (Brave solo dopo aver attivato brave://flags/#file-system-access-api), e il browser chiede ogni volta il permesso sulla cartella del progetto. Ci sono modifica, dati, template, esportazione delle immagini ed esportazione PDF (dalla finestra di stampa del browser); Tabletop Simulator, librerie di icone, Google Fonts, backup, importazione da Tabletop Creator e strumenti per gli agenti IA restano nell'app desktop. **Cosa ha in più la versione desktop**, in fondo alla schermata iniziale, elenca le differenze.

## 1.2.0-beta.9

### English

- Tabletop Simulator export: new **Copies on the sheet** option, shown when Copies is on. "Once" works as before: each card appears once on the sheet and the deck file multiplies it. "Repeated on the sheet" draws each copy in its own slot, as many times as `amount` says, so the sheets can be loaded into Tabletop Simulator by hand without the deck file. With this choice `{card.copy}` numbers the copies on the sheet too.
- `naibi` command on Windows: the installed app now has `naibi-cli.cmd` next to `naibi.exe`, and **AI tools…** gives that command. Launched directly, `naibi.exe` returned to the prompt before finishing, without its exit code, and inside the sandbox of some AI agents (Codex) it closed at once. The `.cmd` waits for the end, returns the exit code and starts without Chromium's sandbox. The installer also lets sandboxed agents (Codex) read and run Naibi's folder, read-only, so no permission needs changing by hand. Copy the skill again into your agent to update it.

### Italiano

- Esportazione per Tabletop Simulator: nuova opzione **Copie nel foglio**, visibile quando Copie è attivo. "Una volta" funziona come prima: ogni carta compare una volta nel foglio e il file del mazzo la moltiplica. "Ripetute nel foglio" disegna ogni copia in una sua posizione, quante volte dice `amount`, così i fogli si possono caricare a mano in Tabletop Simulator senza il file del mazzo. Con questa scelta anche `{card.copy}` numera le copie nel foglio.
- Comando `naibi` su Windows: l'app installata ha ora `naibi-cli.cmd` accanto a `naibi.exe`, e **Strumenti IA…** indica questo comando. Lanciato direttamente, `naibi.exe` tornava al prompt prima di finire, senza codice di uscita, e dentro la sandbox di alcuni agenti IA (Codex) si chiudeva subito. Il `.cmd` aspetta la fine, restituisce il codice di uscita e parte senza la sandbox di Chromium. L'installer inoltre permette agli agenti in sandbox (Codex) di leggere ed eseguire la cartella di Naibi, senza poterla modificare, così non serve cambiare permessi a mano. Copia di nuovo la skill nel tuo agente per aggiornarla.

## 1.2.0-beta.8

### English

- Export dialog: many warnings (for example images not found and replaced with a placeholder) no longer push the buttons off the bottom of the screen. The warnings scroll in their own box, the dialog scrolls if the screen is low, and the buttons stay visible at the bottom.

### Italiano

- Finestra Esporta: molti avvisi (per esempio immagini non trovate e sostituite con un segnaposto) non spingono più i pulsanti fuori dallo schermo. Gli avvisi scorrono in un riquadro a sé, la finestra scorre se lo schermo è basso e i pulsanti restano visibili in fondo.

## 1.2.0-beta.7

### English

- Tabletop Simulator export on Windows: the saved objects now load in TTS. The image addresses in the JSON were written as standard file URLs (`/` and `%20`), which TTS on Windows does not read; they are now written as TTS writes them itself, `file:///C:\...` with backslashes. Export again to update the files.

### Italiano

- Esportazione per Tabletop Simulator su Windows: gli oggetti salvati ora si caricano in TTS. Gli indirizzi delle immagini nel JSON erano scritti come URL di file standard (`/` e `%20`), che TTS su Windows non legge; ora sono scritti come li scrive TTS stesso, `file:///C:\...` con le barre rovesciate. Esporta di nuovo per aggiornare i file.

## 1.2.0-beta.6

### English

- Tabletop Simulator export on Windows: card images could stay "still waiting" until the export stopped, even if they show in the app. The export no longer waits for Chromium to pre-decode each image, which in the hidden export window may never answer; it waits for the image to load and then draws it.

### Italiano

- Esportazione per Tabletop Simulator su Windows: le immagini delle carte potevano restare "in attesa" fino all'arresto dell'esportazione, anche se nell'app si vedono. L'esportazione non aspetta più che Chromium decodifichi in anticipo ogni immagine, cosa che nella finestra nascosta di esportazione può non rispondere mai; aspetta che l'immagine sia caricata e poi la disegna.

## 1.2.0-beta.5

### English

- Exports to Tabletop Simulator with large sheets (many cards, big images, 4096 px or more) no longer stop with "the export page did not answer within 60 s". The 60 s limit introduced in 1.2.0-beta.4 counted the whole sheet; now an export can take as long as it needs while it keeps working, and stops only when nothing moves for 60 s.
- When an export does get stuck, the error now says what it was waiting for: the names of the images or fonts that did not load, a page that stopped drawing, or a page that closed.

### Italiano

- Le esportazioni per Tabletop Simulator con fogli grandi (molte carte, immagini pesanti, 4096 px o più) non si fermano più con "the export page did not answer within 60 s". Il limite di 60 s introdotto nella 1.2.0-beta.4 contava tutto il foglio; ora un'esportazione può durare quanto serve finché procede, e si ferma solo se per 60 s non succede niente.
- Quando un'esportazione si blocca davvero, l'errore dice cosa stava aspettando: i nomi delle immagini o dei font che non si sono caricati, una pagina che ha smesso di disegnare o una pagina che si è chiusa.

## 1.2.0-beta.4

### English

- **Rename set**, next to Duplicate set: the set's sheet in the data file takes the new name when you save, with its formatting and formulas, and the export profiles that pick the set follow the new name.
- **Rename** in the template editor: the new name also goes into the sets, the derived templates and the `template` column of the cards that use it, and the template's file is renamed when you save.
- A deleted template now always goes to the project's `deleted` folder, with date and time in its name, instead of the system trash, which some folders (synced or on network drives) do not allow. To get it back, put the file back in `templates`.
- The sheet of a deleted set now leaves the data file when you save and goes to the `deleted` folder as a file of its own, with its formatting. Its name is free again for another set.
- New `naibi rename-set` and `naibi rename-template` commands, so that an AI agent renames sets and templates the same way as the app. Copy the skill again into your agent to update it.
- **System variables** for text and formulas: `{project.name}`, `{set.name}`, `{template.name}`, `{card.number}`, `{set.rows}`, `{set.cards}`, `{card.copies}`, `{card.copy}`, `{card.side}` and `{date}`. They are suggested while you type a field name, after the project's variables. `{card.copy}` gives each copy of a card its own number in PDF and image exports.
- **Help** (button in the top bar and on the start screen, or F1): the text markup, the system variables, the formula functions and the keyboard shortcuts in one window.
- Fixes from a code review: undoing all the changes of a template now reaches the app too (before, saving wrote the modified version); deleting a derived template after renaming its base no longer moves the base's file to `deleted`; saving the data file leaves untouched cells as they are (dates, formatted text, numbers with more than 15 digits), and only numbers that read back the same are written as numbers; formula syntax errors are reported on the cards and by `naibi check`; image export names are unique across sets even without `%set`; a poster margin wider than half the page no longer freezes the app; a new set with the name of a set just deleted sends the old sheet to `deleted` instead of overwriting it.
- More fixes from the same review: an export that never answers now stops with an error after 60 s instead of hanging; `naibi set-rows`, `rename-set` and `rename-template` make their backup in the app's backup folder, with the app's settings, and refuse when the app is open on the project without `begin`; an app on another computer (project on a shared disk) is noticed only if its state file is recent; the new-template dialog checks the template names, not the file names; undo after saving a renamed set no longer recreates the old sheet; two template files with the same name inside are reported instead of both loading; a renamed template no longer overwrites an existing file with the new name; two projects with the same name get separate backup folders; `MIN()` and `MAX()` without arguments are errors instead of ±Infinity; image names reserved by Windows (CON, PRN, AUX, NUL, COM1…) get a leading underscore; TTS sets with the same name no longer overwrite each other's images; `to top left` and the other two-word gradient directions work; auto-fit of a text layer is recomputed when its italic, letter spacing, text transform, alignment or stroke change; a custom DPI in the export dialog no longer snaps back to a preset; the row selection follows the duplicated rows; the built-in text styles cannot be deleted; switching set resets the grid state; the icon library files are written safely.

### Italiano

- **Rinomina set**, accanto a Duplica set: al salvataggio il foglio del set nel file dati prende il nome nuovo, con formattazione e formule, e i profili di esportazione che scelgono il set seguono il nome nuovo.
- **Rinomina** nell'editor dei template: il nome nuovo va anche nei set, nei template derivati e nella colonna `template` delle carte che lo usano, e il file del template cambia nome al salvataggio.
- Un template eliminato ora va sempre nella cartella `deleted` del progetto, con data e ora nel nome, invece che nel cestino del sistema, che in alcune cartelle (sincronizzate o su dischi di rete) non si può usare. Per recuperarlo si rimette il file in `templates`.
- Anche il foglio di un set eliminato ora, al salvataggio, esce dal file dei dati e va nella cartella `deleted` come file a sé, con la sua formattazione. Il suo nome torna libero per un altro set.
- Nuovi comandi `naibi rename-set` e `naibi rename-template`, così un agente IA rinomina set e template come fa l'app. Copia di nuovo la skill nel tuo agente per aggiornarla.
- **Variabili di sistema** per testi e formule: `{project.name}`, `{set.name}`, `{template.name}`, `{card.number}`, `{set.rows}`, `{set.cards}`, `{card.copies}`, `{card.copy}`, `{card.side}` e `{date}`. Vengono suggerite mentre scrivi il nome di un campo, dopo le variabili del progetto. `{card.copy}` dà a ogni copia di una carta il suo numero nelle esportazioni PDF e immagini.
- **Aiuto** (pulsante nella barra in alto e nella schermata iniziale, oppure F1): i marcatori del testo, le variabili di sistema, le funzioni delle formule e le scorciatoie da tastiera in una sola finestra.
- Correzioni da una revisione del codice: annullare tutte le modifiche di un template ora arriva anche all'app (prima il salvataggio scriveva la versione modificata); eliminare un template derivato dopo aver rinominato il suo base non sposta più in `deleted` il file del base; il salvataggio del file dati lascia come sono le celle non toccate (date, testo formattato, numeri con più di 15 cifre) e scrive come numeri solo quelli che si rileggono uguali; gli errori di sintassi delle formule vengono segnalati sulle carte e da `naibi check`; i nomi delle immagini esportate sono unici tra i set anche senza `%set`; un margine del poster oltre metà pagina non blocca più l'app; un set nuovo con il nome di un set appena eliminato manda il vecchio foglio in `deleted` invece di sovrascriverlo.
- Altre correzioni dalla stessa revisione: un'esportazione che non risponde ora si ferma con un errore dopo 60 s invece di restare appesa; `naibi set-rows`, `rename-set` e `rename-template` fanno il backup nella cartella dei backup dell'app, con le sue impostazioni, e rifiutano se l'app è aperta sul progetto senza `begin`; un'app su un altro computer (progetto su un disco condiviso) viene considerata solo se il suo file di stato è recente; la finestra del nuovo template controlla i nomi dei template, non quelli dei file; annullare dopo aver salvato un set rinominato non ricrea più il vecchio foglio; due file di template con lo stesso nome dentro vengono segnalati invece di caricarsi entrambi; un template rinominato non sovrascrive più un file esistente con il nome nuovo; due progetti con lo stesso nome hanno cartelle di backup separate; `MIN()` e `MAX()` senza argomenti sono errori invece di ±Infinito; i nomi di immagine riservati da Windows (CON, PRN, AUX, NUL, COM1…) prendono un trattino basso davanti; set TTS con lo stesso nome non si sovrascrivono più le immagini; `to top left` e le altre direzioni a due parole delle sfumature funzionano; l'adattamento automatico di un testo si ricalcola quando cambiano corsivo, spaziatura, trasformazione, allineamento o contorno; un DPI personalizzato nella finestra di esportazione non torna più a un valore predefinito; la selezione segue le righe duplicate; gli stili di testo predefiniti non si possono eliminare; cambiando set la griglia riparte pulita; i file della libreria di icone vengono scritti in modo sicuro.

## 1.2.0-beta.3

### English

- Naibi and an AI agent no longer overwrite each other's work. Before changing a project, the agent asks the app with the new `naibi begin` command: if the project has unsaved changes the agent stops and asks you to save; otherwise Naibi shows that an AI is working and stays locked until the agent runs `naibi end`, then reloads the project by itself. **Unlock now** frees the app if the agent stops without unlocking it. The skill in **AI tools…** explains this to the agent: copy it again into your agent to update it.

### Italiano

- Naibi e un agente IA non si sovrascrivono più il lavoro. Prima di modificare un progetto l'agente lo chiede all'app con il nuovo comando `naibi begin`: se il progetto ha modifiche non salvate l'agente si ferma e ti chiede di salvare; altrimenti Naibi mostra che un'IA sta lavorando e resta bloccato finché l'agente non esegue `naibi end`, poi ricarica il progetto da solo. **Sblocca ora** libera l'app se l'agente si ferma senza sbloccarla. La skill in **Strumenti IA…** lo spiega all'agente: copiala di nuovo nel tuo agente per aggiornarla.

## 1.2.0-beta.2

### English

- The start screen has **What's new**, which shows the news of the version in use even without a connection, and **Check for updates**, which asks GitHub right away and says so when you already have the latest version. Clicking the version next to the name also opens what's new.
- **Iconify** tab in the icon window: searches over 200 more icon collections online (Material Design, Tabler, Phosphor, emoji and many others). Each collection shows its license with a colored dot: green free, blue the author must be credited, orange restrictive (share-alike, non-commercial or GPL), which you can also hide. Imported icons go to the project with their license, like the others, and appear in the credits. Needs the network.
- **Update catalog**: the game-icons.net catalog (in the icon window) and the Google Fonts list (in the font window) can be updated from the app, to get icons and fonts published after this version.
- New color picker everywhere a color is chosen: saturation area, hue and transparency sliders, hex code, RGB or HSL fields, eyedropper to pick a color from the screen, project colors and the last colors used.
- Set grid: drag on the empty space around the cards to select several at once (⇧ or ⌘ add to the selection), ⌘A selects all the cards shown and Esc goes back to one. A bar shows how many cards are selected. Dragging one of the selected cards moves all of them.
- Image **crop**: the **Crop…** button in the image properties opens the whole image with a rectangle to drag and resize, free or with the proportions of the layer's frame, to use only part of the picture. The file is not changed. Each card can have its own crop from the card form or with the `layer.crop` column (`x y width height` in percent of the image, for example `10 0 50 50`).
- Card form: changing a layer property for a card, for example with the arrows of a number field, no longer moves that property to the top of the list while you are editing it.
- Set grid: a card can also be dropped on the empty space between or after the cards, for example to move it to the end.
- Portable version for Windows (`Naibi-…-windows-portable.exe`): it runs without installing, also from a USB stick, and keeps its data (recent projects, preferences) in a `Naibi data` folder next to the file.

### Italiano

- Nella schermata di ingresso ci sono **Novità**, che mostra le novità della versione in uso anche senza rete, e **Controlla aggiornamenti**, che chiede subito a GitHub e dice anche quando hai già l'ultima versione. Anche un clic sulla versione accanto al nome apre le novità.
- Scheda **Iconify** nella finestra delle icone: cerca online in oltre 200 altre collezioni di icone (Material Design, Tabler, Phosphor, emoji e molte altre). Ogni collezione mostra la licenza con un pallino colorato: verde libera, blu va citato l'autore, arancione restrittiva (condivisione allo stesso modo, uso non commerciale o GPL), che si può anche nascondere. Le icone importate vanno nel progetto con la loro licenza, come le altre, e compaiono nei crediti. Serve la rete.
- **Aggiorna catalogo**: il catalogo di game-icons.net (nella finestra delle icone) e l'elenco dei font Google (nella finestra dei font) si aggiornano dall'app, per avere icone e font pubblicati dopo questa versione.
- Nuovo selettore colore dovunque si sceglie un colore: area della saturazione, cursori per tonalità e trasparenza, codice esadecimale, campi RGB o HSL, contagocce per prendere un colore dallo schermo, colori del progetto e ultimi colori usati.
- Griglia del set: trascinando sullo spazio vuoto intorno alle carte se ne selezionano più insieme (⇧ o ⌘ aggiungono alla selezione), ⌘A seleziona tutte le carte mostrate ed Esc torna a una sola. Una barra dice quante carte sono selezionate. Trascinando una delle carte selezionate si spostano tutte.
- **Ritaglio** delle immagini: il pulsante **Ritaglia…** nelle proprietà dell'immagine mostra l'immagine intera con un rettangolo da spostare e ridimensionare, libero o con le proporzioni del riquadro del livello, per usare solo una parte della figura. Il file non viene modificato. Ogni carta può avere il suo ritaglio dal modulo della carta o con la colonna `livello.crop` (`x y larghezza altezza` in percentuale dell'immagine, per esempio `10 0 50 50`).
- Modulo della carta: cambiando una proprietà di un livello per una carta, per esempio con le frecce di un campo numerico, la proprietà non salta più in cima all'elenco mentre la stai modificando.
- Griglia del set: una carta si può lasciare anche sullo spazio vuoto tra le carte o dopo l'ultima, per esempio per spostarla in fondo.
- Versione portable per Windows (`Naibi-…-windows-portable.exe`): si avvia senza installarla, anche da una chiavetta, e tiene i suoi dati (progetti recenti, preferenze) nella cartella `Naibi data` accanto al file.

## 1.2.0-beta.1

### English

- Derived templates: a template can be based on another one and change only some of its parts; everything else follows the base, even when the base changes later. In the editor, a chain marks the values that come from the base and an arrow the changed ones, which a click reverts. The ↳ button in the sidebar creates one, **Make independent** turns it into a normal template. Earlier versions of Naibi cannot read derived templates.
- The **Template** field in the card form picks the template of a single card (`template` column in the sheet).
- The table and the card form show every column you can edit, including the ones the template reads but the sheet does not have yet: typing a value creates the column. The **Columns** button hides the ones you do not need and can also show fixed and formula layers, read only.
- True/false columns, such as `crest.visible`, show a checkbox.
- In the card form, the eye next to a layer's field shows or hides that layer on the card, and the sliders icon opens the layer's properties for that card without adding fields to the form. Property names are translated, and properties with a fixed set of values (shape, alignment, blend...) are menus, numbers have number fields, colors a color picker.
- Cards can be exported as SVG, with project images and fonts inside the file and texts as editable SVG text.
- Double-clicking a layer in the card preview edits it right on the card: text in a box over the layer, images from the thumbnails, shapes with a color picker. A single click still goes to the field. Alt+click on the preview moves to the field of the layer underneath; in the editor Alt+click selects the layer underneath. Thin lines and the children of arranged or repeated groups are easier to click.
- The ⤢ button enlarges the card preview in a window, with the card form next to it and the same clicks and on-card editing. Double-clicking a fixed or formula layer tells where its value comes from.
- Undo and redo are always in the top bar, for sets, templates, styles and variables. Sets and templates have Duplicate, Derive and Delete buttons next to their name, and panels are wider by default.
- **Edit template** under the card preview opens the card's own template.
- Sets open in the grid view; the table is one click away.
- A click on the canvas scrollbars no longer clears the selection (Windows).
- The window title shows the installed version of Naibi.
- Beta versions are marked as such: the start screen shows the version with a "beta" label, and GitHub lists them as pre-releases.
- If you are using a beta, Naibi also tells you about newer betas; with an official version you are only told about official versions.

### Italiano

- Template derivati: un template può partire da un altro e cambiarne solo alcune parti; il resto segue il base, anche quando il base cambia dopo. Nell'editor una catena segna i valori che vengono dal base e una freccia quelli cambiati, che un clic riporta come nel base. Il pulsante ↳ nella barra laterale ne crea uno, **Rendi indipendente** lo trasforma in un template normale. Le versioni precedenti di Naibi non leggono i template derivati.
- Il campo **Template** nel modulo della carta sceglie il template di una singola carta (colonna `template` nel foglio).
- La tabella e il modulo della carta mostrano tutte le colonne modificabili, anche quelle che il template legge ma il foglio non ha ancora: scrivendo un valore la colonna si crea. Il pulsante **Colonne** nasconde quelle che non servono e può mostrare anche i livelli fissi e con formula, in sola lettura.
- Le colonne vero/falso, come `stemma.visible`, hanno una casella da spuntare.
- Nel modulo della carta l'occhio accanto al campo di un livello mostra o nasconde quel livello sulla carta, e l'icona con i cursori apre le proprietà del livello per quella carta senza aggiungere campi al modulo. I nomi delle proprietà sono tradotti, e le proprietà con valori prestabiliti (forma, allineamento, fusione...) sono menu, i numeri hanno campi numerici, i colori il selettore.
- Le carte si esportano anche in SVG, con immagini e font del progetto dentro il file e i testi come testo SVG modificabile.
- Il doppio clic su un livello nell'anteprima della carta lo modifica direttamente sulla carta: il testo in un riquadro sopra il livello, le immagini dalle miniature, le forme con il selettore del colore. Il clic singolo porta ancora al campo. Alt+clic sull'anteprima passa al campo del livello sotto; nell'editor Alt+clic seleziona il livello sotto. Le linee sottili e i figli dei gruppi disposti o ripetuti si prendono più facilmente.
- Il pulsante ⤢ ingrandisce l'anteprima della carta in una finestra, con il modulo della carta accanto e gli stessi clic e la modifica sulla carta. Il doppio clic su un livello fisso o con formula dice da dove arriva il valore.
- Annulla e ripristina sono sempre nella barra in alto, per set, template, stili e variabili. Set e template hanno i pulsanti Duplica, Deriva ed Elimina accanto al nome, e i pannelli sono più larghi di base.
- **Modifica template** sotto l'anteprima apre il template della carta.
- I set si aprono nella vista griglia; la tabella è a un clic.
- Un clic sulle barre di scorrimento della tela non toglie più la selezione (Windows).
- Il titolo della finestra mostra la versione di Naibi installata.
- Le versioni beta sono riconoscibili: la schermata di ingresso mostra la versione con l'etichetta "beta", e su GitHub compaiono come pre-release.
- Chi usa una beta riceve gli avvisi anche delle beta più recenti; chi ha una versione ufficiale riceve solo quelli delle versioni ufficiali.

## 1.1.0

### English

- At startup Naibi checks for a new version and shows it at the top, with what's new and a button to download it. You can skip a version or be reminded at the next start.

### Italiano

- Naibi controlla all'avvio se c'è una versione nuova e la segnala in alto, con le novità e il pulsante per scaricarla. Si può saltare una versione o rimandare al prossimo avvio.

## 1.0.0

### English

- First public release, with packages for Mac (Apple silicon and Intel), Windows and Linux.
- Copy and paste layers between templates, even across projects (⌘C, ⌘X, ⌘V in the editor).

### Italiano

- Prima versione pubblica, con i pacchetti per Mac (chip Apple e Intel), Windows e Linux.
- Copia e incolla dei livelli tra template, anche di progetti diversi (⌘C, ⌘X, ⌘V nell'editor).
