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
await set
  .locator('input')
  .first()
  .fill(it ? 'risorse' : 'resources')
await set.locator('input[type=number]').first().fill('2')
await set.locator('textarea').fill(it ? 'legno, pietra, grano' : 'wood, stone, wheat')
await win.waitForTimeout(300)
await set.getByText(T['generate.repeat']).click()
await win.waitForTimeout(800)
await shotEl(win, `${lang}/genera`, dialog(), 24)
await close()
// esportazione
await win.getByRole('button', { name: T['app.export'] }).click()
await win.waitForTimeout(1200)
await shotEl(win, `${lang}/esporta-immagini`, dialog(), 24)
await dialog().getByText(T['export.pdf'], { exact: true }).first().click()
await win.waitForTimeout(800)
await shotEl(win, `${lang}/esporta-pdf`, dialog(), 24)
await dialog().getByRole('button', { name: T['export.preview'] }).click()
await win.waitForTimeout(2500)
await shotEl(win, `${lang}/esporta-anteprima`, dialog(), 24)
await close('export.close')
await dialog().getByText(T['export.tts'], { exact: true }).first().click()
await win.waitForTimeout(800)
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
