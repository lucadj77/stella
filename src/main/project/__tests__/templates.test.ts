import { describe, expect, it } from 'vitest'
import { formatTemplate } from '../templates'

describe('formatTemplate', () => {
  it('leaves out keys without a value, like JSON.stringify', () => {
    const value = {
      width: 63,
      skip: undefined,
      front: [{ type: 'image', name: 'a', rotation: undefined, style: { x: undefined, y: 1 } }]
    }
    const out = formatTemplate(value)
    expect(out).not.toContain('undefined')
    expect(JSON.parse(out)).toEqual(JSON.parse(JSON.stringify(value)))
  })

  it('scrive un livello per riga e va a capo nei gruppi', () => {
    const out = formatTemplate({
      width: 63,
      front: [
        {
          type: 'text',
          name: 'a',
          text: 'Ore 12:30, poi',
          x: 1,
          stroke: { color: '#FFF', width: 0.5 }
        },
        { type: 'group', name: 'g', children: [{ type: 'shape', name: 's', fill: null }] }
      ],
      back: []
    })
    expect(out).toBe(
      [
        '{',
        '  "width": 63,',
        '  "front": [',
        '    { "type": "text", "name": "a", "text": "Ore 12:30, poi", "x": 1, "stroke": {"color": "#FFF", "width": 0.5} },',
        '    {',
        '      "type": "group",',
        '      "name": "g",',
        '      "children": [',
        '        { "type": "shape", "name": "s", "fill": null }',
        '      ]',
        '    }',
        '  ],',
        '  "back": []',
        '}'
      ].join('\n')
    )
    expect(JSON.parse(out)).toBeTruthy()
  })
})

describe('file dei template', () => {
  it('un template rinominato sposta il suo file; uno eliminato va in deleted/', async () => {
    const { mkdtemp, mkdir, readdir, readFile, writeFile } = await import('fs/promises')
    const { tmpdir } = await import('os')
    const { join } = await import('path')
    const { normalizeTemplate } = await import('../../../shared/model/normalize')
    const { saveTemplate, trashTemplate } = await import('../templates')
    const folder = await mkdtemp(join(tmpdir(), 'stella-tpl-'))
    await mkdir(join(folder, 'templates'))
    await writeFile(join(folder, 'templates', 'carta.json'), '{"width": 63}\n')
    const tpl = normalizeTemplate({ name: 'base', width: 70, height: 88 })
    await saveTemplate(folder, { ...tpl, origin: 'carta' })
    expect(await readdir(join(folder, 'templates'))).toEqual(['base.json'])
    expect(await readFile(join(folder, 'templates', 'base.json'), 'utf8')).toContain('"width": 70')
    const moved = await trashTemplate(folder, 'base')
    expect(await readdir(join(folder, 'templates'))).toEqual([])
    expect(moved).toMatch(/deleted[\\/]base \d{4}-\d\d-\d\d-\d\d-\d\d-\d\d\.json$/)
    expect(await trashTemplate(folder, 'mai-salvato')).toBeNull()
  })
})
