# Project format

This is the English version of [formato.md](formato.md). When the two differ, the Italian file is the reference.

A Stella project is a folder:

```
project/
  stella.json           # name, data file, list of sets
  data/cards.xlsx       # one sheet per set (or a .csv for a single set)
  templates/<name>.json # the card templates
  notes/<name>.md       # project notes in Markdown, written in the app or with any editor
  docs/<name>.md        # project documents (rulebook, sell sheet…) in Markdown
  assets/               # images and icons
  assets/icons/         # icons imported from game-icons.net
  assets/fonts/         # project fonts (ttf, otf, woff, woff2)
  assets/sources.json   # origin and license of the files imported from the app
```

The notes in `notes/` are free notes: the app shows them in the **Notes** section of the sidebar and saves them while you write; an AI reads them with `stella notes` (see [cli.en.md](cli.en.md)). A deleted note goes to `deleted/`.

The documents in `docs/` are the texts that go with the game (rulebook, sell sheet, appendices): the app shows them in the **Documents** section with the preview beside them and saves them while you write. They are Markdown (`#`, `##` and `###` headings, paragraphs separated by a blank line, lists, `>` quotes, tables with `|`, `---` rules, code blocks), with Stella's markup inside the lines (see [specifica.md](specifica.md), 2.1, in Italian), text and value variables, and `{project.name}` and `{date}`. An image `![caption](source)` alone on a line (several images on the same line sit side by side) shows a file from the assets or, with a `card:` source, a card of the project drawn as it is now: `card:<set>/<n>` is the card of row n (from 1), `card:<set>/<column>=<value>` the first card with that value in the column (exact match first, then ignoring case). After `?`, joined by `&`, the options `side=front|back`, `width=<mm>` (by default the real width of the card) and `align=left|center|right`. An asset file also accepts after `?` the options `width=<mm>` (by default the size of the image, reduced to the page) and `align`, as in `icons/map.png?width=40&align=right`; an `http(s)` address stays whole. The alignment applies to the whole row of images: the first one that sets it counts, centred by default. In the set name and in the value, `%29`, `%3F` and `%26` stand for `)`, `?` and `&`. At the top of the file, between two `---` lines, the page settings can appear, one per line as `key: value`: `page` (`A4`, `A5`, `Letter`), `margin` (mm), `font` and `headingFont` (family, also `{variable}`; empty for the default one and for the body one), `size` (body size in points), `lineHeight` (multiples of the body size), `paragraphSpacing` (points after each paragraph), `align` (`left`, `justify`), `color` and `headingColor` (code or project colour), `language` (or `lang`: the language in which the document draws the cards and translates the variables, a code from `languages`; without it, the main language). Settings that are not written have the default value (A4, 18 mm, 11 pt, 1.4, 6 pt, left); the **Page** panel of the app writes them and removes those back at the default. The other entries at the top are the document's properties (as in Obsidian: `title`, `tags`, `author`…): simple YAML, with text values, quoted, on several lines or as lists (`[a, b]` or `- item` lines). They are not printed, unless `showProperties: true`, which shows them in a two-column table at the top of the document and in the exports. The app rewrites only the properties that changed; a name that differs by one letter from a setting (`colour`) is reported as a wrong setting. A ` ```anatomy ` code block is the anatomy of a card: a line `card: <set>/<n or column=value>[?side=…&width=…]` and a line `- <layer>[ (left|right)]: <label>` for each layer to explain; the app draws the card with the labels linked to the layers. In an anatomy and in a table setup, `width: <n>%` makes the block take at most that share of the line width (10-100%) and `font: <n>%` sets the size of the labels relative to the base size (30-300%); the colon is optional. A ` ```setup ` block is the table setup diagram, one element per line with measures in mm from the top-left corner: `size <W>x<H>` (table size, optional), `zone <x>,<y> <W>x<H> ["label"]`, `card <card> <x>,<y> [rotate=0|90|180|270] ["label"]`, `deck <card> <x>,<y> [count=<n>] [rotate=…] ["label"]`, `text <x>,<y> [width=<mm>] "text"`, `arrow <x>,<y> -> <x2>,<y2> ["label"]`, `image <file or {variable}> <x>,<y> [width=<mm>] [rotate=…]`, plus the optional `width <n>%` and `font <n>%` lines. `<card>` is a reference as after `card:` (prefix optional), with `%20` for spaces; in quoted texts `\"` is a quote; blank lines and lines starting with `#` are ignored. A rotated card takes the rotated box, with `x,y` at its top-left corner. The export (from the app or with `stella export-doc`) writes in `export/docs/` `<name>.pdf`, `<name>.html` (self-contained), `<name>.docx` (Word) or `<name>.md` with the folder `<name> images/`. A deleted document goes to `deleted/` with the extension `.doc.md`. `stella docs` shows them to an AI, `stella check` reports the references that cannot be found.

`assets/sources.json` is written when icons are imported or fonts downloaded from the app: for each file (path relative to `assets/`) it gives the kind (`icon` or `font`), source, identifier, author, license in SPDX form (`CC-BY-3.0`, `OFL-1.1`…), address and import date. It is used to compose the credits; entries for files that no longer exist are removed at the next write. Files added by hand do not appear.

```json
{
  "icons/sword.svg": {
    "kind": "icon",
    "source": "game-icons.net",
    "id": "lorc/broadsword",
    "title": "broadsword",
    "author": "Lorc",
    "license": "CC-BY-3.0",
    "url": "https://game-icons.net/1x1/lorc/broadsword.html",
    "imported": "2026-10-18"
  }
}
```

## stella.json

Projects created when the app was called Naibi have `naibi.json`, older ones (GameCreator) `gamecreator.json`: they open like the others and keep saving to that file. If a folder has more than one, `stella.json` wins, then `naibi.json`.

```json
{
  "formatVersion": 1,
  "name": "Demo",
  "dataFile": "data/cards.xlsx",
  "sets": [{ "name": "Characters", "template": "character", "sheet": "Characters" }]
}
```

`sheet` is optional: when missing, the sheet with the same name as the set is used. `hiddenColumns` (optional) lists the columns hidden in the table and in the card fields; `showComputed: true` also shows the fixed and formula layers, read-only. `pinnedProperties` (optional) lists the properties pinned in the card fields, as `layer.property` columns. They are view preferences only: they do not change the cards.

`styles` (optional) holds the project's text styles, written with the same attributes as the markup (docs/specifica.md, 2.1). The styles `heading1`, `heading2` and `note` always exist and can be redefined here. Until there is a style editor they are edited by hand.

```json
"styles": {
  "keyword": "weight=800 color=#7A3FA0 smallcaps",
  "flavor": "italic size=90% color=#6B6255 center"
}
```

`variables` (optional) holds the project variables (docs/specifica.md, 6.1), one per name, with a `type` field:

```json
"variables": {
  "sword": { "type": "image", "src": "sword", "tint": "red", "scale": 1.2, "raise": 10 },
  "pine": { "type": "text", "text": "[pine]{color=green weight=700}" },
  "red": { "type": "color", "color": "#A33A2A" },
  "hand": { "type": "value", "value": "7" }
}
```

- `image`: `src` is the name of a file in `assets/`; `tint` (optional) recolours the icon; `scale` is the height relative to normal icons in the text (1 = normal); `raise` moves the icon up, in % of the line; `rotate` (degrees, clockwise), `flip` (`h`, `v`, `hv`) and `opacity` (0-1) are optional. `bg` (optional) puts a background behind the image wherever the variable is used: a built-in shape (`circle`, `square`, `rounded`, `hexagon`, `diamond`), a file in `assets/` or another image variable; `bgColor` colours it (without it a shape takes the text colour and an image keeps its colours, or the tint of its variable) and `bgPad` is the space between the image and the edge of the background, as a fraction of the side on each side (0-0.45, default 0.18). Example: `"acqua": { "type": "image", "src": "goccia", "tint": "white", "bg": "circle", "bgColor": "#C0392B" }`.
- `text`: text with markup that takes the place of `{name}`. `texts` (optional) gives the text in the other project languages, by code: `"texts": { "it": "[pino]{color=green}" }`; a missing language or an empty text uses `text`.
- `color`: a colour usable by name in every colour property; a standard name (`red`) redefined here changes in the whole project.
- `value`: constant text or number, usable in texts and formulas. `values` (optional) gives the value in the other languages, like `texts`: texts and formulas without `=` use it, formulas with `=` always use `value`.

A card field with the same name as a variable wins over the variable.

`export` (optional) remembers the options of the last export, with one key per kind: `images`, `pdf`, `tts`. The app writes it when exporting; the option names are in `src/shared/export.ts` and their meaning in docs/specifica.md, section 9. Under `named` are the named profiles, each with `name`, `kind` and `options`. The project's `export/` folder holds the exported files and can be regenerated.

`languages` (optional) lists the project languages as two- or three-letter codes, with an optional variant (`pt-BR`); the first is the main one, that of the columns without `@`. With fewer than two languages the project has a single language. `names` (optional, in the project and in each set) gives the name in the other languages, by code; a missing name is the one of the main language. See docs/specifica.md, 7.1.

```json
"languages": ["en", "it"],
"names": { "it": "Assedio" },
"sets": [{ "name": "Heroes", "template": "hero", "names": { "it": "Eroi" } }]
```

`order` (optional) remembers the order chosen by hand by dragging the sidebar entries, with one key per list: `templates`, `styles`, `variables`. Without the key the list is alphabetical; names that do not appear go to the end, alphabetically. The order of the sets is that of `sets`. Under `groups` are the groups of styles and variables in the sidebar, by name: `"groups": { "variables": { "gold": "Resources" } }`; a missing entry has no group.

```json
"order": { "variables": ["sword", "shield", "red"] }
```

## Data sheets

- The first row holds the headers; every following row is a card.
- `amount` is the number of copies (1 when empty or missing).
- A header with the name of a template layer replaces its value; `layer.property` replaces another property (for example `name.color`).
- Empty cells keep the template value.
- `field@language` (for example `name@it`, `name.size@it`) is the translation of `field` into one of the project languages: it applies only when the cards are shown in that language, and an empty cell keeps the value of the main language.

### Why xlsx

The reference data file stays `.xlsx`. It is a public standard (ECMA-376, ISO/IEC 29500) and the format best read and written by Excel, Numbers, LibreOffice and Google Sheets. It also keeps several sets in one file, preserves formulas and has no encoding or separator problems.

- `.csv` is supported for a single set, but cannot hold several sheets and gives trouble in Excel with accents and the separator (comma or semicolon depending on the system language).
- `.ods` (OpenDocument, ISO/IEC 26300) is as open as xlsx and is read and written like xlsx: several sets in one file, and when saving only the cells of the columns with a header are rewritten (cells with the same text stay as they were, with formulas, formatting and notes). Excel handles it worse, though, which is why the recommended format stays xlsx. It is chosen when the project is created, or by changing `dataFile` in `stella.json`.

## Templates

One JSON file per template in `templates/`. Units are millimetres, text size is in points. Each layer lists only the properties that differ from the defaults: the full list is in `src/shared/model/template.ts` and the defaults in `src/shared/model/normalize.ts`.

```json
{
  "name": "character",
  "width": 63,
  "height": 88,
  "bleed": 3,
  "cornerRadius": 3,
  "front": [
    {
      "type": "text",
      "name": "name",
      "x": 6,
      "y": 4.5,
      "w": 51,
      "h": 9.5,
      "size": 14,
      "weight": 800,
      "fit": "shrink"
    },
    { "type": "image", "name": "cover", "x": 4, "y": 15.5, "w": 55, "h": 31, "src": "{name}" },
    {
      "type": "shape",
      "name": "band",
      "x": 4,
      "y": 4,
      "w": 55,
      "h": 10.5,
      "radius": 2,
      "fill": "#2F5DA8"
    }
  ],
  "back": []
}
```

- A derived template has a format of its own: see below.
- Optional: `kind`, the kind of component (`card` by default, `token`, `tile`, `board`, `die` for a die face, `standee` for an upright figure on a transparent background whose back is the front mirrored: `back` is not used): it changes the words in the app ("+ Token", "6 faces") and the object proposed in the Tabletop Simulator export when `objects` does not name the set. `shape` (`rect` by default, `ellipse`, `hexagon`, `path` with `shapePath`, an SVG path in 0–1 coordinates of the card), `shapeRotation` (0, 90, 180, 270: turns only the outline; with 90 and 270 the shape is drawn with the sides swapped, so `width` and `height` are usually swapped too), `shapeFlipH` and `shapeFlipV` (mirror the outline) and `guides` (`{ "x": [mm...], "y": [mm...] }`, the editor's manual guides).
- The first layer of the list is the one on top.
- Types: `text`, `image`, `shape` (`rect`, `ellipse`, `polygon`, `star`, `line`, `path`), `grid`, `group` (with `children`), `value`, `snap`. A `line` goes from the centre of the left side to the centre of the right side of its box, rotated by `rotation`: `w` is the length. A `path` has in `path` the outline in 0–1 coordinates of the box, taken from the silhouette of an image.
- A `grid` draws in its box `rows` × `columns` equal cells: `cell` (`square`, `circle`, `hex`, `triangle`, `diamond`, `path` with `cellPath`, an SVG path in 0–1 coordinates of the cell), `cellRotation` (degrees: turns the shape of each cell around its center, not the content), `interlock` (honeycomb, alternating triangles, diamonds and circles in the gaps between the others, brick-laid squares), `orientation` of the hexagons (`pointy`, `flat`), `cellRatio` (width/height of squares, circles and diamonds), `gap` and `padding` in mm, `zoom` (1 = the largest grid that fits the box without distorting the cells), `alignX` and `alignY` (`start`, `center`, `end`), `clip`, `radius` of the cells; `fill` and `stroke` of the cells, `background`, `border` and `backgroundRadius` of the background; `content` is the name of a group on the same side repeated in every cell (drawn in the first, moved in the others), with the fields `cell.index`, `cell.row`, `cell.column`, `cell.count`, `cell.random`; `cellRules` is a list of cell rules, applied in order (a later one wins): `when` is the condition, a formula with the card fields and the `cell.*` fields (the leading `=` can be left out), and where it is true the cell takes `fill` (null: none), `stroke` (null: none), `radius` or `hidden` (true: the cell, its content and its snap point are not drawn), and `values` gives a value to content layers by name (`{ "icon": "sword" }`: the main value, written as a formula with the fields and `{cell.*}`); missing properties stay those of the grid, for example `{ "when": "=MOD({cell.index}; 5) = 0", "fill": "#C62828" }`. Geometry in `src/shared/model/grid.ts`.
- The column with the layer's name replaces its main value: the text for `text`, the file for `image`, the fill for `shape` and `grid`, the visibility for `group` and `snap`.
- Tabletop Simulator: the template can have `ttsTags`, the tags of each component separated by commas (`{field}` allowed, for example `"{type}, card"`). Any layer can have `snap`, a snap point exported at the centre of the layer (at the centre of every cell for a `grid`): `{ "tags": "building", "rotated": true, "angle": null }`. `tags` are separated by commas and accept `{field}`: the point attracts only objects with one of those tags. With `rotated` the object that snaps also takes a rotation, `angle` in degrees clockwise, or the layer's own rotation when `angle` is `null`. A `snap` layer is only a snap point at the centre of its box (6 × 6 mm by default): the editor shows it as a crosshair and it is never printed. Snap points come from the front.
- A `group` with `layout` (`row`, `column`, `grid`) or with `repeat` other than 1 saves its own box (`x`, `y`, `w`, `h`): the children are laid out inside it with `gap`, `columns`, `justify` and `alignItems` (`start`, `center`, `end`). `repeat` is a number or a field, such as `"{strength}"`; the copies are not saved.
- In texts and file names, `{field}` takes the value of that column of the same row.
- In a project with several languages a `text` layer with a fixed source can have `texts` and a `value` layer with a fixed source `values`: the text or value in the other languages, by code (`"texts": { "it": "forza" }`). A missing or empty language uses `text` or `value`. In a derived template, a layer that changes `text` without also giving `texts` loses the translations of the base.

### Derived templates

A derived template has `extends` with the name of the base template and in `changes` only the differences. It inherits the rest: a change to the base reaches the derived templates, except for the properties the derived one changed. A derived template can in turn be a base.

```json
{
  "extends": "character",
  "changes": {
    "template": { "cornerRadius": 5 },
    "layers": {
      "band": { "fill": "#B3261E" },
      "name": { "color": "#FFD27A", "y": 70 },
      "crest": { "visible": false }
    },
    "added": [
      {
        "side": "front",
        "after": "name",
        "layer": { "type": "image", "name": "flame", "x": 4, "y": 4, "w": 8, "h": 8 }
      }
    ]
  }
}
```

- `changes.template`: the template properties that change, among `kind`, `bleed`, `safeMargin`, `cornerRadius`, `shape`, `shapePath`, `shapeRotation`, `shapeFlipH`, `shapeFlipV`, `guides`, `labelField`, `ttsTags`. The card size (`width`, `height`) is always that of the base.
- `changes.layers`: by name of the base layer, the changed properties. A compound property (stroke, shadow, value source) is written in full.
- `changes.added`: layers that exist only in the derived template, in the order they are inserted. `side` is `front` or `back`; `parent` the name of the inherited group that contains them (missing: top level of the side); `after` the layer after which they come in the list, that is right below it (missing: on top).
- Inherited layers cannot be deleted or reordered: to remove them from the card write `"visible": false`. Their names are those of the base, and so are the columns.
- When a layer is renamed in the base, Stella updates the differences of the derived templates. A difference for a layer the base no longer has is ignored and Stella reports it.
- Stella 1.1 and earlier do not read derived templates.

### Template per card

An optional `template` column in the sheet chooses the template of a single card; empty means the template of the set. The chosen template must have the size of the set's one, because the cards of a set are printed together; otherwise the card uses the set's template and Stella reports it.

The analysis of the Tabletop Creator format this structure derives from is in [analisi-ttc.md](analisi-ttc.md) (in Italian).
