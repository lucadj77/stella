import { describe, expect, it } from 'vitest'
import { convertDextrous, cssColor, requirements } from '../dextrous'
import { htmlToMarkup } from '../nandeck/html'
import type { RawLayer } from '../../model/normalize'

// Un progetto e due layout come li scarica Dextrous, ridotti a ciò che serve

const project = {
  title: 'Demo',
  componentReferencesArray: [
    { id: 'C1', name: 'mostri' },
    { id: 'C2', name: 'gettoni' }
  ],
  inlineClasses: [{ name: 'fuoco', style: { fontSize: '1.5em', color: 'rgba(200, 0, 0, 1)' } }],
  cardTypeArray: [
    {
      id: 'C1',
      DDD: { componentType: 'card' },
      layoutDocID: 'L1',
      defaultImageFolders: { i1: 'mostri' },
      csvURL: '',
      cards: [
        {
          data: {
            _copies: 2,
            _nickname: 'Drago',
            i1: 'drago.png',
            t2: '<p>Sputa <span class="fuoco">fuoco</span> {fiamma.png}</p>',
            s2: ''
          }
        },
        { data: { _copies: 1, _nickname: 'Orco', i1: 'mostri/orco.png', t2: '', s2: 'hide' } }
      ],
      backs: {
        type: 'unique cards',
        layoutDocID: 'L1',
        cards: [{ data: { t2: '<p>retro</p>' } }, { data: { t2: '' } }]
      }
    },
    {
      id: 'C2',
      DDD: { componentType: 'token' },
      layoutDocID: 'L2',
      cards: [{ data: { _copies: 3, i1: 'x.png' } }],
      backs: { type: 'same as front', layoutDocID: 'L2', cards: [] }
    }
  ]
}

const layout1 = {
  id: 'L1',
  name: 'mostro',
  layoutData: {
    id: 0,
    type: 'image',
    imageDataKey: 'card_background',
    style: {
      width: '240px',
      height: '336px',
      borderRadius: '12px 12px 12px 12px',
      background:
        'radial-gradient(rgba(255, 0, 0, 1) 20%, rgba(0, 0, 255, 1) 80%) no-repeat 50% 50%',
      fontName: 'Cambria'
    },
    childZones: [
      {
        id: 1,
        type: 'image',
        imageDataKey: 'ritratto',
        image: 'anteprima.png',
        style: {
          left: '24px',
          top: '24px',
          width: '192px',
          height: '192px',
          backgroundSize: 'cover'
        }
      },
      {
        id: 2,
        type: 'text',
        textDataKey: 'testo',
        text: 'esempio',
        toggleIfNoContent: true,
        style: {
          left: '24px',
          top: '240px',
          width: '192px',
          height: '72px',
          fontSize: '16px',
          textAlign: 'center',
          alignItems: 'flex-end',
          background: 'rgba(0, 0, 0, 0.5)'
        }
      },
      {
        id: 3,
        type: 'image',
        imageDataKey: 'logo',
        image: 'logo.png',
        isStatic: true,
        style: { left: '0px', top: '0px', width: '48px', height: '48px' }
      }
    ]
  }
}

const layout2 = {
  id: 'L2',
  name: 'dischetto',
  layoutData: {
    id: 0,
    type: 'image',
    style: {
      width: '96px',
      height: '96px',
      clipPath: `polygon(${Array.from({ length: 32 }, (_, i) => {
        const a = (i / 32) * 2 * Math.PI
        return `${50 + 50 * Math.cos(a)}% ${50 + 50 * Math.sin(a)}%`
      }).join(', ')})`,
      background: 'rgba(255, 255, 255, 1)'
    },
    childZones: [
      {
        id: 1,
        type: 'image',
        imageDataKey: 'immagine',
        style: { top: '0px', left: '0px', backgroundSize: 'cover' }
      },
      {
        id: 4,
        type: 'image',
        imageDataKey: 'riga',
        style: {
          left: '8px',
          top: '60px',
          width: '80px',
          height: '24px',
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'center',
          gap: '4px'
        },
        childZones: [
          { id: 5, type: 'text', textDataKey: 'a', style: { width: '24px', height: '24px' } },
          { id: 6, type: 'text', textDataKey: 'b', style: { width: '24px', height: '24px' } }
        ]
      }
    ]
  }
}

const find = (layers: RawLayer[], name: string): RawLayer | undefined => {
  for (const l of layers) {
    if (l.name === name) return l
    const inner = l.children && find(l.children, name)
    if (inner) return inner
  }
  return undefined
}

describe('Dextrous', () => {
  it('converts CSS colors', () => {
    expect(cssColor('rgba(107, 69, 156, 1)')).toBe('#6B459C')
    expect(cssColor('rgba(0, 0, 0, 0.38)')).toBe('#00000061')
    expect(cssColor('rgba(0, 0, 0, 0)')).toBeNull()
    expect(cssColor('#abc')).toBe('#AABBCC')
  })

  it('lists the layouts and image folders the project needs', () => {
    const req = requirements(project, [layout1], ['mostri/drago.png', 'other/fiamma.png'])
    expect(req.components.map((c) => [c.name, c.layouts.map((l) => l.found)])).toEqual([
      ['mostri', ['mostro', 'mostro']],
      ['gettoni', [null]]
    ])
    const mostri = req.folders.find((f) => f.name === 'mostri')!
    expect(mostri).toMatchObject({ images: 2, found: 1, missing: ['orco.png'] })
    // l'immagine di una zona non fissa è un'anteprima: non serve
    expect(req.folders.flatMap((f) => f.missing)).not.toContain('anteprima.png')
    expect(req.folders.flatMap((f) => f.missing)).toContain('logo.png')
  })

  it('converts layouts into templates', () => {
    const r = convertDextrous(project, [layout1, layout2], ['drago.png', 'orco.png', 'logo.png'])
    const [mostri, gettoni] = r.templates
    expect(mostri).toMatchObject({ name: 'mostri', width: 63.5, height: 88.9, cornerRadius: 3.175 })
    // in fondo la forma con la sfumatura della carta
    const bg = mostri.front!.at(-2)!
    expect(bg).toMatchObject({ type: 'shape', name: 'background', w: 63.5, h: 88.9 })
    expect(bg.fill).toBe('radial-gradient(#FF0000 20%, #0000FF 80%)')
    const text = find(mostri.front!, 'testo')!
    expect(text).toMatchObject({
      type: 'text',
      text: '',
      size: 12,
      align: 'center',
      valign: 'bottom'
    })
    expect(text.font).toBe('Cambria')
    expect(find(mostri.front!, 'testo_bg')).toMatchObject({
      fill: '#00000080',
      visible: '=LEN({testo})>0'
    })
    // la zona fissa tiene l'immagine del layout
    expect(find(mostri.front!, 'logo')).toMatchObject({ src: 'logo', source: { kind: 'fixed' } })
    expect(find(mostri.front!, 'ritratto')).toMatchObject({ src: '', fit: 'cover', x: 6.35 })
    // la zona dopo sta sopra: in Stella è prima nell'elenco
    const names = mostri.front!.map((l) => l.name)
    expect(names.indexOf('logo')).toBeLessThan(names.indexOf('ritratto'))
    expect(mostri.back!.map((l) => l.name)).toContain('testo_back')

    expect(gettoni).toMatchObject({ kind: 'token', shape: 'ellipse', backFromFront: true })
    // una zona senza misura riempie la zona madre
    expect(find(gettoni.front!, 'immagine')).toMatchObject({ w: 25.4, h: 25.4 })
    // contenitore flex → gruppo con la disposizione, le figlie nell'ordine delle zone
    const group = find(gettoni.front!, 'riga_group')!
    expect(group).toMatchObject({ type: 'group', layout: 'row', justify: 'center', gap: 1.058 })
    expect(group.children!.map((l) => l.name)).toEqual(['a', 'b'])
  })

  it('converts rows, backs, styles and inline icons', () => {
    const r = convertDextrous(project, [layout1, layout2], ['drago.png', 'orco.png', 'fiamma.png'])
    const sheet = r.sheets[0]
    const rows = sheet.rows.map((row) =>
      Object.fromEntries(sheet.headers.map((h, i) => [h, row[i]]))
    )
    expect(rows[0]).toMatchObject({
      amount: '2',
      name: 'Drago',
      ritratto: 'drago',
      testo: 'Sputa [fuoco]{.fuoco} {fiamma}',
      testo_back: 'retro'
    })
    expect(rows[1]).toMatchObject({ amount: '1', ritratto: 'orco', 'testo.visible': 'false' })
    expect(r.file.styles).toEqual({ fuoco: 'size=150% color=#C80000' })
    expect(r.file.variables).toEqual({ fiamma: { type: 'image', src: 'fiamma', tint: null } })
    expect(r.templates[0].labelField).toBe('name')
    expect(r.sheets[1].rows).toEqual([['3', 'x']])
    expect(r.missingImages).toEqual(['logo.png', 'x.png'])
  })

  it('still creates the project without a layout', () => {
    const r = convertDextrous(project, [layout1], [])
    expect(r.missingLayouts).toEqual(['gettoni'])
    expect(r.templates[1].front).toEqual([])
    expect(r.notes[0].key).toBe('dextrous.missingLayouts')
  })

  it('converts text classes in HTML', () => {
    expect(htmlToMarkup('<span class="Fuoco">x</span>', new Map([['.fuoco', '.fuoco']])).text).toBe(
      '[x]{.fuoco}'
    )
  })
})
