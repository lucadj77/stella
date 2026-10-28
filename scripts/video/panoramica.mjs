// Video 1: panoramica delle funzioni di base di Stella (circa 3 minuti, senza voce).
// Uso: xvfb-run -a -s "-screen 0 2000x1300x24" node --experimental-strip-types --no-warnings scripts/video/panoramica.mjs it|en
import { launch, makeProject } from './lib.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'
const lang = process.argv[2] || 'it'
const it = lang === 'it'
const r = await launch({ lang, ...(process.env.UD ? { ud: process.env.UD } : {}) })
const { win, T } = r
const project = makeProject(lang)
const S = it
  ? {
      set: 'Personaggi',
      doc: 'Regolamento',
      knight: 'Cavaliere',
      name: 'nome',
      newName: 'Paladino'
    }
  : { set: 'Characters', doc: 'Rules', knight: 'Knight', name: 'name', newName: 'Paladin' }
mkdirSync(`${project}/docs`, { recursive: true })
writeFileSync(
  `${project}/docs/${S.doc}.md`,
  it
    ? `# Regolamento\n\n## Materiale\n\nOgni giocatore riceve **{mano}** carte personaggio e 3 {moneta}.\n\n![La strega](card:${S.set}/${S.name}=${S.knight}?width=40)\n\n| Carta | Forza | Costo |\n| :-- | :-: | :-: |\n| Cavaliere | 4 | 2 {moneta} |\n| Strega | 3 | 1 {moneta} {legno} |\n\n## Il turno\n\n1. Pesca una carta.\n2. Gioca un personaggio.\n3. Attacca con {spada} o difendi.\n`
    : `# Rules\n\n## Components\n\nEach player gets **{hand}** character cards and 3 {coin}.\n\n![The witch](card:${S.set}/${S.name}=${S.knight}?width=40)\n\n| Card | Strength | Cost |\n| :-- | :-: | :-: |\n| Knight | 4 | 2 {coin} |\n| Witch | 3 | 1 {coin} {wood} |\n\n## The turn\n\n1. Draw a card.\n2. Play a character.\n3. Attack with {sword} or defend.\n`
)
const side = (sel) => win.locator('.sidebar').getByText(sel, { exact: true }).first()
// il titolo della sezione, con il numero di voci accanto
const sideSection = (key) => win.locator(`#sidebar-${key.split('.')[1]} .section-toggle`).first()
const topButton = (key) => win.locator('header.toolbar').getByText(T[key], { exact: true }).first()
// il tasto Salva si chiama «Salvato» quando non c'è nulla da salvare
const saveButton = () =>
  win
    .locator('header.toolbar button')
    .filter({ hasText: new RegExp(`^(${T['app.save']}|${T['app.saved']})$`) })
    .first()
const dialog = () => win.locator('[role="dialog"]').last()

await r.overlay()
// schermata di ingresso
await r.title(
  it
    ? 'Stella Game Center: carte, plance, segnalini, tessere, dadi e regolamenti per i tuoi prototipi'
    : 'Stella Game Center: cards, boards, tokens, tiles, dice and rulebooks for your prototypes'
)
await r.clear()
// alla prima apertura Stella mostra la schermata di benvenuto
await r.focus(
  win.locator('.welcome-choice.main'),
  it
    ? 'Comincia da zero: Stella ti indica ogni volta il passo successivo'
    : 'Start from scratch: Stella shows you the next step every time',
  'below'
)
await r.focus(
  win.locator('.welcome-other'),
  it
    ? 'Oppure apri un progetto che hai già, o importalo da Tabletop Creator'
    : 'Or open a project you already have, or import it from Tabletop Creator',
  'above'
)
// il tasto copia l'esempio in Documenti/Stella; makeProject l'ha già preparato con il regolamento
const example = win.locator('.welcome-choice').filter({ hasText: T['welcome.example'] }).first()
await r.focus(
  example,
  it ? 'Apriamo il progetto di esempio' : 'Let’s open the example project',
  'below'
)
// riquadro e testo via prima del clic: la finestra del progetto si apre senza ricaricare la pagina
await r.clear(200)
await r.click(example)
await r.clear(2000)
await r.overlay()

// la finestra del progetto
await r.focus(
  win.locator('.sidebar').first(),
  it ? 'A sinistra: tutto il progetto' : 'On the left: the whole project',
  'right'
)
await r.focus(
  sideSection('sidebar.sets'),
  it ? 'I set: ogni set è un mazzo, con i suoi dati' : 'Sets: each set is a deck, with its data',
  'right'
)
await r.focus(
  sideSection('sidebar.templates'),
  it ? 'I template: il disegno delle carte' : 'Templates: the drawing of the cards',
  'right'
)
await r.focus(
  [sideSection('sidebar.styles'), sideSection('sidebar.variables')],
  it
    ? 'Stili e variabili, condivisi da tutto il progetto'
    : 'Styles and variables, shared by the whole project',
  'right'
)
await r.focus(
  sideSection('sidebar.documents'),
  it ? 'I documenti: regolamento e altri testi' : 'Documents: rulebook and other texts',
  'right'
)
await r.focus(
  saveButton(),
  it ? 'Salva: template e dati delle carte' : 'Save: templates and card data',
  'below'
)
await r.focus(
  topButton('app.export'),
  it
    ? 'Esporta: PDF, immagini e oggetti per Tabletop Simulator'
    : 'Export: PDFs, images and Tabletop Simulator objects',
  'below'
)
await r.focus(
  topButton('app.help'),
  it
    ? 'Aiuto (F1): markup, variabili, formule e scorciatoie'
    : 'Help (F1): markup, variables, formulas and shortcuts',
  'left'
)
await r.clear()

// un set e le sue carte
await r.title(it ? 'Le carte' : 'The cards')
await r.clear()
await r.focus(
  side(S.set),
  it ? 'Un clic sul set apre le carte' : 'A click on the set opens the cards',
  'right',
  { ms: 2000 }
)
await r.click(side(S.set))
await r.clear(600)
await r.focus(
  win.locator('.card-grid').first(),
  it ? 'Ogni carta è una riga del foglio di calcolo' : 'Each card is a row of the spreadsheet',
  'above',
  { pad: 4 }
)
const card = win.locator('.card-grid .card-cell').first()
await r.click(card)
await r.clear(500)
await r.focus(
  win.locator('.card-form').first(),
  it ? 'Il modulo della carta: un campo per colonna' : 'The card form: one field per column',
  'left',
  { pad: 4 }
)
const nameField = win
  .locator('.card-form label')
  .filter({ has: win.locator('.field-label', { hasText: new RegExp(`^${S.name}$`) }) })
  .locator('input, textarea')
  .first()
await r.focus(nameField, it ? 'Proviamo a cambiare il nome…' : 'Let’s change the name…', 'left', {
  ms: 2200
})
await r.click(nameField)
await win.keyboard.press('Control+A')
await r.type(S.newName)
await r.wait(600)
await r.focus(
  win.locator('.card-grid .card-cell.selected').first(),
  it ? 'La carta si ridisegna subito' : 'The card is redrawn at once',
  'above',
  { pad: 4 }
)
await r.focus(
  saveButton(),
  it
    ? 'Al salvataggio i dati vanno nel foglio Excel del progetto'
    : 'On save, the data goes to the project’s Excel sheet',
  'below'
)
await r.focus(
  win.getByRole('button', { name: T['set.table'], exact: true }),
  it ? 'La vista tabella' : 'The table view',
  'below',
  { ms: 2000 }
)
await r.click(win.getByRole('button', { name: T['set.table'], exact: true }))
await r.clear(600)
await r.focus(
  win.locator('table').first(),
  it
    ? 'Le stesse carte come foglio di calcolo, per modifiche veloci'
    : 'The same cards as a spreadsheet, for quick edits',
  'above',
  { pad: 4 }
)
await r.clear()

// il template
await r.title(it ? 'Il template' : 'The template')
await r.clear()
await r.focus(
  win.getByRole('button', { name: T['preview.editTemplate'] }).first(),
  it ? 'Modifica template' : 'Edit template',
  'left',
  { ms: 2000 }
)
await r.click(win.getByRole('button', { name: T['preview.editTemplate'] }).first())
await r.clear(1200)
await r.overlay()
await r.focus(
  win.locator('aside.layers .layers-list').first(),
  it ? 'I livelli: testo, immagini, forme, icone…' : 'The layers: text, images, shapes, icons…',
  'right',
  { pad: 4 }
)
await r.focus(
  win.locator('.canvas-stage').first(),
  it ? 'La tela: la carta con la linea di taglio' : 'The canvas: the card with the cut line',
  'left',
  { pad: 0 }
)
await r.focus(
  win.locator('aside.properties').first(),
  it ? 'Le proprietà di ciò che è selezionato' : 'The properties of what is selected',
  'left',
  { pad: 4 }
)
const layerName = win.locator('aside.layers').getByText(S.name, { exact: true }).first()
await r.focus(
  layerName,
  it ? 'Scegliamo il livello del nome' : 'Let’s pick the name layer',
  'right',
  { ms: 2200 }
)
await r.click(layerName)
await r.clear(500)
await r.focus(
  win.locator('aside.properties').first(),
  it
    ? 'Il testo viene dalla colonna «nome»: ogni carta mostra il suo'
    : 'The text comes from the “name” column: each card shows its own',
  'left',
  { pad: 4 }
)
await r.clear()

// esportare
await r.title(it ? 'Esportare' : 'Exporting')
await r.clear()
await r.click(topButton('app.export'))
await r.clear(800)
const goal = (g) => dialog().locator('.export-goal').filter({ hasText: T['export.goal.' + g] }).first()
await r.focus(
  dialog().locator('.export-goals'),
  it
    ? 'Prima scegli cosa vuoi fare: stampa a casa, tipografia, Tabletop Simulator o immagini'
    : 'First choose what you want to do: home printing, print shop, Tabletop Simulator or images',
  'below'
)
// Tabletop Simulator: non immagini, ma oggetti pronti da caricare nel gioco
await r.click(goal('tts'))
await r.clear(800)
await r.focus(
  dialog(),
  it
    ? 'Per Tabletop Simulator escono oggetti pronti: mazzi, segnalini, tessere, plance e dadi'
    : 'For Tabletop Simulator it makes ready objects: decks, tokens, tiles, boards and dice',
  'none',
  { pad: 0, dim: false }
)
await r.clear(400)
await r.click(goal('shop'))
await r.clear(600)
await r.focus(
  goal('shop'),
  it
    ? 'Per la tipografia: abbondanza e segni di taglio già impostati'
    : 'For the print shop: bleed and crop marks already set',
  'below'
)
await r.wait(1200)
await r.focus(
  dialog().locator('.live-preview').first(),
  it
    ? 'A lato, l’anteprima vera di quello che uscirà'
    : 'On the side, the real preview of what will come out',
  'left',
  { pad: 4 }
)
await r.clear()
await r.click(dialog().getByRole('button', { name: T['export.close'], exact: true }))
await r.wait(600)

// documenti
await r.title(it ? 'I documenti' : 'Documents')
await r.clear()
await r.click(side(S.doc))
await r.clear(1500)
await r.focus(
  win.locator('.document-editor').first(),
  it
    ? 'Il testo in Markdown, con le carte vere dentro'
    : 'The text in Markdown, with the real cards inside',
  'right',
  { pad: 4 }
)
await r.focus(
  win.locator('.document-preview').first(),
  it ? 'L’anteprima della pagina, pronta per il PDF' : 'The page preview, ready for the PDF',
  'left',
  { pad: 4 }
)
await r.clear()
await r.title(
  it
    ? 'Tutto il resto è nella guida: stella.lucadj.eu'
    : 'Everything else is in the guide: stella.lucadj.eu',
  3800
)
await r.clear(600)
const p = await r.finish()
console.log('VIDEO', p)
