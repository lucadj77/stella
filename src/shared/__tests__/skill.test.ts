import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { COMMAND_PLACEHOLDER, fillSkill, VERSION_PLACEHOLDER } from '../skill'

const source = readFileSync('skill/stella/SKILL.md', 'utf8')
const command = '"/Users/me/Apps/Stella.app/Contents/MacOS/Stella" --cli'

describe('fillSkill', () => {
  it('fills only the version line and the command block', () => {
    const skill = fillSkill(source, '1.4.1', command)
    expect(skill).toContain('This skill is for Stella 1.4.1.')
    expect(skill).toContain('```\n' + command + '\n```')
    // le frasi dei passi 1 e 4 nominano ancora i segnaposto
    expect(skill).toContain('(not the `' + COMMAND_PLACEHOLDER + '` placeholder)')
    expect(skill).toContain('holds just `' + COMMAND_PLACEHOLDER + '`')
    expect(skill).toContain('`' + VERSION_PLACEHOLDER + '` in the first sentence')
    expect(skill.split(command).length - 1).toBe(1)
  })

  it('keeps the command placeholder in the web version', () => {
    const skill = fillSkill(source, '1.4.1', '')
    expect(skill).toContain('```\n' + COMMAND_PLACEHOLDER + '\n```')
    expect(skill).toContain('This skill is for Stella 1.4.1.')
  })
})
