import { describe, expect, it } from 'vitest'
import { projectFolderName } from '../projectName'

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
