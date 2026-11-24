import { describe, expect, it } from 'vitest'
import { packageExt, projectFolderName, PROJECT_ZIP_EXT, zipBaseName } from '../projectName'

describe('projectFolderName', () => {
  it('writes _ for the spaces', () => {
    expect(projectFolderName('Assedio 2')).toBe('Assedio_2')
  })

  it('replaces characters not allowed in file names', () => {
    expect(projectFolderName('Gioco: prova/1')).toBe('Gioco_prova_1')
    expect(projectFolderName('a<b>c|d?e*f"g\\h')).toBe('a_b_c_d_e_f_g_h')
  })

  it('drops trailing dots and spaces, which Windows does not allow', () => {
    expect(projectFolderName('  Mesh...  ')).toBe('Mesh')
  })

  it('returns an empty string when nothing usable is left', () => {
    expect(projectFolderName('')).toBe('')
    expect(projectFolderName('///')).toBe('')
    expect(projectFolderName('..')).toBe('')
  })
})

describe('nomi degli ZIP', () => {
  it('toglie le estensioni di Stella e .zip', () => {
    expect(zipBaseName('Assedio.stella-project.zip')).toBe('Assedio')
    expect(zipBaseName('/tmp/Mio gioco.stella-set.zip')).toBe('Mio gioco')
    expect(zipBaseName('C:\\x\\carte.stella-template.zip')).toBe('carte')
    expect(zipBaseName('vecchio.stella.zip')).toBe('vecchio')
    expect(zipBaseName('Last_Bounty.ZIP')).toBe('Last_Bounty')
    expect(zipBaseName('senza-estensione')).toBe('senza-estensione')
  })
  it('dà le estensioni', () => {
    expect(PROJECT_ZIP_EXT).toBe('.stella-project.zip')
    expect(packageExt('set')).toBe('.stella-set.zip')
    expect(packageExt('template')).toBe('.stella-template.zip')
  })
})
