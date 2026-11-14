// gruppo I: documenti (documento con anteprima, inserisci carta, tabella, anatomia, schema del tavolo)
import { launch, makeProject, mockOpen, shot, shotEl } from './lib.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'
const lang = process.argv[2]
const it = lang === 'it'
const { app, win, T } = await launch({ lang, h: 960, open: false })
const project = makeProject(lang)
const dialog = () => win.locator('[role="dialog"]').last()
// chiude la finestra con un clic sullo sfondo (Esc arriva solo se il fuoco è dentro la finestra)
const closeDialog = async () => {
  await win
    .locator('.dialog-backdrop')
    .last()
    .click({ position: { x: 5, y: 5 } })
  await win
    .locator('.dialog-backdrop')
    .last()
    .waitFor({ state: 'detached', timeout: 5000 })
    .catch(() => {})
  await win.waitForTimeout(400)
}
const tool = (key) => win.locator('.document-toolbar button', { hasText: T[key] }).first()
// il puntatore resta sul tasto: spostato via per non lasciare un suggerimento nella foto
const open = async (key) => {
  await tool(key).click()
  await win.mouse.move(1, 1)
}

// un regolamento di esempio nel progetto, con carta, tabella, anatomia e schema del tavolo
const S = it
  ? {
      set: 'Personaggi',
      items: 'Oggetti',
      name: 'nome',
      str: 'forza',
      text: 'testo',
      knight: 'Cavaliere',
      wizard: 'Strega'
    }
  : {
      set: 'Characters',
      items: 'Items',
      name: 'name',
      str: 'strength',
      text: 'text',
      knight: 'Knight',
      wizard: 'Witch'
    }
const doc = it
  ? `---
title: Regolamento
author: Luca
version: 0.3
---

# Regolamento

## Materiale

Ogni giocatore riceve una mano di **{mano}** carte personaggio e 3 {moneta}.

![Il cavaliere, forza 4](card:${S.set}/${S.name}=${S.knight}?width=40)

| Carta | Forza | Costo |
| :-- | :-: | :-: |
| ${S.knight} | 4 | 2 {moneta} |
| ${S.wizard} | 3 | 1 {moneta} {legno} |

## Le carte

\`\`\`anatomy
card: ${S.set}/${S.name}=${S.knight}?width=50
- ${S.name}: Nome del personaggio
- ${S.str}: Forza, si somma al tiro del dado {spada}
- ${S.text} (left): **Abilità**: si usa una volta per turno
\`\`\`

## Preparazione

\`\`\`setup
size 300x200
zone 0,0 300x90 "Giocatore 1"
deck ${S.set}/1?side=back 10,10 count=6 "Personaggi"
card ${S.set}/${S.name}=${S.knight} 150,10 "Carta iniziale"
text 150,80 width=100 "Al centro: **{mano}** carte scoperte"
arrow 240,40 -> 285,40 "pesca"
\`\`\`
`
  : `---
title: Rules
author: Luca
version: 0.3
---

# Rules

## Components

Each player gets a hand of **{hand}** character cards and 3 {coin}.

![The knight, strength 4](card:${S.set}/${S.name}=${S.knight}?width=40)

| Card | Strength | Cost |
| :-- | :-: | :-: |
| ${S.knight} | 4 | 2 {coin} |
| ${S.wizard} | 3 | 1 {coin} {wood} |

## The cards

\`\`\`anatomy
card: ${S.set}/${S.name}=${S.knight}?width=50
- ${S.name}: Name of the character
- ${S.str}: Strength, added to the die roll {sword}
- ${S.text} (left): **Ability**: usable once per turn
\`\`\`

## Setup

\`\`\`setup
size 300x200
zone 0,0 300x90 "Player 1"
deck ${S.set}/1?side=back 10,10 count=6 "Characters"
card ${S.set}/${S.name}=${S.knight} 150,10 "Starting card"
text 150,80 width=100 "In the middle: **{hand}** face-up cards"
arrow 240,40 -> 285,40 "draw"
\`\`\`
`
mkdirSync(`${project}/docs`, { recursive: true })
writeFileSync(`${project}/docs/${it ? 'Regolamento' : 'Rules'}.md`, doc)
await mockOpen(app, project)
await win.getByText(T['start.openProject']).click()
await win.waitForTimeout(2500)
await win
  .locator('.sidebar')
  .getByText(it ? 'Regolamento' : 'Rules', { exact: true })
  .first()
  .click()
await win.waitForTimeout(2500)
await shot(win, `${lang}/documento`)

// inserisci carta
await open('documents.insertCard')
await win.waitForTimeout(1200)
await shotEl(win, `${lang}/inserisci-carta`, dialog(), 24)
await closeDialog()

// cursore dentro un blocco, poi il tasto che lo apre per modificarlo
const caretIn = (needle) =>
  win.evaluate((needle) => {
    const ta = document.querySelector('.document-editor textarea')
    const i = ta.value.indexOf(needle)
    ta.focus()
    ta.setSelectionRange(i + 2, i + 2)
    ta.dispatchEvent(new Event('select', { bubbles: true }))
  }, needle)
await caretIn('| ' + S.knight)
await open('documents.table')
await win.waitForTimeout(1500)
await shotEl(win, `${lang}/doc-tabella`, dialog(), 24)
await closeDialog()
await caretIn('```anatomy')
await open('documents.anatomy')
await win.waitForTimeout(2500)
await shotEl(win, `${lang}/anatomia`, dialog(), 24)
// il punto della forza trascinato un po' più in basso a destra
const handle = dialog().locator('.anatomy-handle').nth(1)
const hb = await handle.boundingBox()
await win.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2)
await win.mouse.down()
await win.mouse.move(hb.x + hb.width / 2 + 30, hb.y + hb.height / 2 - 4, { steps: 8 })
await win.mouse.up()
await win.mouse.move(1, 1)
await win.waitForTimeout(800)
console.log('anatomy code:', await dialog().locator('.insert-card-code').innerText())
await shotEl(win, `${lang}/anatomia-punto`, dialog().locator('.anatomy-detail'), 12)
await closeDialog()
await caretIn('```setup')
await open('documents.setup')
await win.waitForTimeout(2500)
await shotEl(win, `${lang}/schema-tavolo`, dialog(), 24)
await closeDialog()
await app.close()
