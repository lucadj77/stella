// gruppo F: generatore, esportazione, crediti, backup
import { launch, shot, shotEl } from './lib.mjs'
const lang = process.argv[2]
const it = lang === 'it'
const { app, win, T } = await launch({ lang, h: 1000 })
const dialog = () => win.locator('[role="dialog"]').last()
const close = async (key = 'dialog.cancel') => {
  await dialog().getByRole('button', { name: T[key], exact: true }).last().click()
  await win.waitForTimeout(400)
}
// generatore sul set Mercato
await win
  .locator('.sidebar')
  .getByText(it ? 'Mercato' : 'Market', { exact: true })
  .click()
await win.waitForTimeout(800)
// Genera sta nel menu Strumenti del set
await win.getByRole('button', { name: `${T['set.tools']} ▾` }).click()
await win.getByRole('menuitem', { name: T['set.generate'] }).click()
await win.waitForTimeout(800)
const set = dialog().locator('.generate-set').first()
// la colonna nuova si scrive con «Altra colonna…»
await set.locator('select').first().selectOption({ label: T['generate.otherColumn'] })
await set.locator('.generate-column-free input').fill(it ? 'risorse' : 'resources')
await set.locator('input.num').first().fill('2')
await set.locator('textarea').fill(it ? 'legno, pietra, grano' : 'wood, stone, wheat')
await win.waitForTimeout(300)
await set.getByText(T['generate.repeat']).click()
await win.waitForTimeout(800)
await shotEl(win, `${lang}/genera`, dialog(), 24)
// a caso: i numeri 1-4 su quattro colonne, il 4 da 1 a 3 volte
await dialog().getByText(T['generate.random'], { exact: true }).click()
await set.locator('.generate-column-free input').fill('text1')
for (const n of [2, 3, 4]) {
  await set.getByRole('button', { name: T['generate.addField'] }).click()
  await set
    .locator('.generate-more select')
    .last()
    .selectOption({ label: T['generate.otherColumn'] })
  await set
    .locator('.generate-more input')
    .last()
    .fill('text' + n)
}
await set.locator('input.num').first().fill('1')
await set.locator('textarea').fill('1-4')
await set.locator('.generate-limits summary').click()
await set.locator('.generate-limit-grid input').nth(6).fill('1')
await set.locator('.generate-limit-grid input').nth(7).fill('3')
await dialog().locator('input.num').nth(-2).fill('12')
await win.waitForTimeout(800)
await shotEl(win, `${lang}/genera-caso`, dialog(), 24)
await close()
// esportazione, con le sezioni chiuse come la prima volta
await win.evaluate(() => localStorage.removeItem('exportSections'))
await win.getByRole('button', { name: T['app.export'], exact: true }).click()
await win.waitForTimeout(1200)
// l'anteprima a lato si disegna dopo una breve pausa: si aspetta che sia pronta
await dialog().getByText(T['export.goal.images'], { exact: true }).first().click()
await win.waitForTimeout(3000)
await shotEl(win, `${lang}/esporta-immagini`, dialog(), 24)
await dialog().getByText(T['export.goal.home'], { exact: true }).first().click()
await win.waitForTimeout(3000)
await shotEl(win, `${lang}/esporta-pdf`, dialog(), 24)
await dialog().getByRole('button', { name: T['export.enlarge'], exact: true }).click()
await win.waitForTimeout(2500)
await shotEl(win, `${lang}/esporta-anteprima`, dialog(), 24)
await close('export.close')
await dialog().getByText(T['export.goal.tts'], { exact: true }).first().click()
await win.waitForTimeout(3000)
await shotEl(win, `${lang}/esporta-tts`, dialog(), 24)
await dialog().getByRole('button', { name: T['credits.open'] }).click()
await win.waitForTimeout(1200)
await shotEl(win, `${lang}/crediti`, dialog(), 24)
await close('dialog.close').catch(() => win.keyboard.press('Escape'))
await close('export.close').catch(() => win.keyboard.press('Escape'))
// backup
await win.getByRole('button', { name: `${T['app.projectMenu']} ▾` }).click()
await win.getByRole('menuitem', { name: T['app.backup'] }).click()
await win.waitForTimeout(1500)
await shotEl(win, `${lang}/backup`, dialog(), 24)
await close('dialog.close')
// come nell'app installata su Mac
await app.evaluate(({ ipcMain }) => {
  ipcMain.removeHandler('ai:command')
  ipcMain.handle('ai:command', () => ({
    command: '"/Applications/Stella.app/Contents/MacOS/Stella" --cli',
    ready: true
  }))
})
await win.locator('.toolbar .settings-button').click()
await win.getByRole('button', { name: T['app.aiTools'] }).click()
await win.waitForTimeout(1500)
await shotEl(win, `${lang}/strumenti-ia`, dialog(), 24)
await app.close()
