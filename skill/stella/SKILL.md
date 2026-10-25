---
name: stella
description: Work on Stella (formerly Naibi) card game projects (folders with stella.json or naibi.json, a spreadsheet of cards, JSON templates and assets). Use when asked to create, inspect, fix or extend cards, sets, templates, variables, styles or text markup in a Stella project, or to render or export its cards.
---

# Working on Stella projects

Stella is a desktop app for designing game cards and other printed game components. A project is a plain folder; every card is a row of a spreadsheet, drawn through a template. You can do everything by editing the files and by running the `stella` command, which checks the project and draws the cards so you can look at them.

## Before you start: command and updates

This skill is for Stella {{STELLA_VERSION}}. Once per session, before the first stella command, do these steps. If you cannot reach the network or write files, say so to the user and carry on with what you have.

1. **Find the command.** If the block in the next section shows a command (not the `{{STELLA_COMMAND}}` placeholder), run it with `version`. Otherwise, or if that fails, try in order: on macOS `"/Applications/Stella.app/Contents/MacOS/Stella" --cli` (or the same under `~/Applications`); on Windows `"%LOCALAPPDATA%\Programs\stella\stella-cli.cmd"` (in PowerShell `& "$env:LOCALAPPDATA\Programs\stella\stella-cli.cmd"`); an app updated from Naibi, the earlier name of Stella, can stay at the old place: on macOS `"/Applications/Naibi.app/Contents/MacOS/Stella" --cli`, on Windows `%LOCALAPPDATA%\Programs\naibi\stella-cli.cmd`; on Linux `"/opt/Stella/stella" --cli`; then `stella` on the PATH. `<command> version` prints the version; a desktop app older than 1.2.0-beta.28 answers "unknown command" instead: treat it as older.
2. **No command found** means the user has only the web version of Stella. Ask whether to install the stella command: it is the Stella program without windows, about 250 MB with the Chromium it draws with, and needs Node.js 20 or later with npm. If `node --version` fails or is older, say so and offer to install Node.js LTS first, only with the user's consent: on Windows `winget install OpenJS.NodeJS.LTS`; on macOS `brew install node` when Homebrew is there, otherwise ask the user to run the installer from nodejs.org (it needs an administrator password); on Linux the distribution's package manager. If the user agrees, find the version to install (see **Channels** below) and run `npm install -g https://github.com/lucadj77/stella/releases/download/v<version>/stella-cli-<version>.tgz`. The command is then `stella`. If npm reports a permission error, tell the user rather than using sudo yourself.
   **Channels.** Stella has a stable channel (official versions) and a beta channel (test versions too). Use the stable one: `https://api.github.com/repos/lucadj77/stella/releases/latest` gives the latest official release, its `tag_name` is `v<version>`. Use the beta channel only if the installed stella-cli is already a beta (its version has a `-`, like `1.3.0-beta.2`) or the user asks for it: then read `https://api.github.com/repos/lucadj77/stella/releases?per_page=30` and take the highest version among the `tag_name`s that are not drafts (a beta comes before the official version with the same number: `1.3.0-beta.2` < `1.3.0`).
3. **Updates of the command.** If the command is `stella` from npm (the stella-cli package) and the latest release of its channel is newer than its version, tell the user and install the new one with the same `npm install -g` line. Never move a user from beta to an older official version. If it is the desktop app, never install anything: if a newer release exists, tell the user that the app updates itself (it shows a notice, or **Help → Check for updates**; the channel is chosen in the ⚙ menu, **Updates**).
4. **Update this skill.** If this skill's version differs from the command's version, download `https://raw.githubusercontent.com/lucadj77/stella/v<command version>/skill/stella/SKILL.md`, fill in only two places in it: the line of the block under **The stella command** that holds just `{{STELLA_COMMAND}}` gets the command you found, and `{{STELLA_VERSION}}` in the first sentence of this section gets the version. Leave the other mentions of the placeholders, like the ones in steps 1 and 4, as they are. Write it over this skill's file, tell the user, and read it again. Then the skill always matches the program that draws the cards.

## The stella command

Run it as:

```
{{STELLA_COMMAND}}
```

followed by a command. `<project>` is the project folder (the one with `stella.json`; projects made when the app was called Naibi keep `naibi.json`, which works the same).

On Windows, in PowerShell, put `&` before a quoted command: `& "C:\...\stella-cli.cmd" info "D:\Games\My game"`. Wait for the command to finish and check its exit code before going on.
The Windows installer (1.2.0-beta.9 and later) already lets sandboxed agents read Stella's folder. If your sandbox still cannot read it, do not change permissions yourself: ask the user to run the command outside the sandbox, or to grant read and execute once from a normal PowerShell, as explained in Stella's docs/cli.md (`icacls "<Stella folder>" /grant "*S-1-15-2-1:(OI)(CI)(RX)" /T`).

| Command                                                                                                        | What it does                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `info <project>`                                                                                               | Sets (template, rows, cards, columns), templates and their layers, variables, styles, assets, export profiles                                                                                                                                                                                   |
| `check <project> [--set S]`                                                                                    | Lists the problems of every card: missing images or fonts, unknown variables, markup and formula errors; without `--set`, also the problems of the documents. Exit code 1 if there are problems                                                                                                 |
| `check-data <project>`                                                                                         | How the data file is read: for each sheet the sets that use it, the columns their templates read and the sheet lacks, and problems (title above the headings, empty rows, merged cells, Excel errors, formulas without a saved result). Run it first on a data file the user brought from Excel |
| `template <project> <name>`                                                                                    | Layers of a template with position, size and where each value comes from. `--json` prints the full template                                                                                                                                                                                     |
| `rows <project> <set> [--json\|--csv]`                                                                         | The set's rows (tab-separated by default; `\n` stands for a line break inside a cell)                                                                                                                                                                                                           |
| `set-rows <project> <set> <file.json\|file.csv>`                                                               | Replaces all rows of the set (headers included) with the file's content. A backup of the project is made first                                                                                                                                                                                  |
| `pull-sheets <project> [<link>]`                                                                               | Replaces the data of each set with the tab of the same name in a Google sheet shared by link (no link: the one saved in the project, `googleSheet` in stella.json; a new link is saved). Backup first. Use it when the user keeps the data in Google Sheets                                     |
| `rename-set <project> <set> <name>`                                                                            | Renames a set, its sheet in the data file and the export profiles that pick it. A backup is made first                                                                                                                                                                                          |
| `rename-template <project> <template> <name>`                                                                  | Renames a template and its file; the sets, derived templates and `template` column of the cards follow. A backup is made first                                                                                                                                                                  |
| `render <project> [--set S] [--card 1,3,5-7] [--side front\|back\|both] [--dpi 150] [--out folder] [--lang L]` | Draws cards as PNG files, by default in `<project>/export/stella-render/<set>/<n>.png`. Open the images to check your work                                                                                                                                                                      |
| `export <project> --profile NAME [--lang L\|all]`                                                              | Runs an export profile saved in the project (PDF, images or Tabletop Simulator), in one language or all                                                                                                                                                                                         |
| `new <name> <parent folder>`                                                                                   | Creates an empty project                                                                                                                                                                                                                                                                        |
| `notes <project> [<name>]`                                                                                     | The project notes (`notes/*.md`): the user's reminders and decisions about the project. Read them before working                                                                                                                                                                                |
| `docs <project> [<name>]`                                                                                      | The project documents (`docs/*.md`: rules, sell sheet, appendix), all or one, each followed by its problems (cards or images not found, unknown names)                                                                                                                                          |
| `export-doc <project> [<name>] [--format pdf\|html\|docx\|md] [--out folder]`                                  | Exports the documents, all or one, as the app's **Export document…**: PDF (default), standalone HTML, Word (.docx) or Markdown with PNG cards, by default in `export/docs/`                                                                                                                     |
| `stats <project> <set> [--column C]`                                                                           | How many cards (copies included) have each value of every column, or of one; sum, average, min and max of numeric columns. Use it to check balance                                                                                                                                              |
| `begin <project> [--note TEXT]`                                                                                | Start of your work. Fails with exit code 3 if the Stella app has unsaved changes in the project; otherwise the app locks itself                                                                                                                                                                 |
| `end <project>`                                                                                                | End of your work: the app unlocks and reloads the project                                                                                                                                                                                                                                       |

`info`, `check`, `template`, `stats`, `notes` and `docs` accept `--json`.

## Workflow

1. Run `begin` before changing anything in the project, with `--note` saying in a few words what you are doing. If it fails because the app has unsaved changes, stop: tell the user to save (or reload) in the Stella app, and start again only when they say so. Reading commands (`info`, `check`, `template`, `rows`, `render`) do not need `begin`.
2. Run `info` and `notes` to learn the project before changing anything; the notes hold what the user wants remembered. Card numbers (`--card`, `#3` in `check`) are row numbers of the set, from 1.
3. Change data with `rows` + `set-rows` (read the rows as JSON, edit, write them back). Never write the .xlsx/.ods file directly: `set-rows` keeps the other sheets and the cells you do not change (formulas, dates, formatting) intact; a changed cell becomes plain text, or a number when it reads back the same. Cells with a number format in Excel are read as Excel shows them (`50%`, `1 234.50 €`, decimal point, non-breaking space for thousands); writing `60%` or `3.50 €` back into such a cell stores the number and keeps the format. Changing cells of existing sheets leaves the rest of an .xlsx untouched (charts included); adding, renaming or deleting a set rewrites the whole file and drops charts and pivot tables.
4. Rename sets and templates only with `rename-set` and `rename-template`: renaming files by hand breaks the references to them. Change templates, variables and styles by editing the JSON files. Keep the existing formatting style; keep unknown keys as they are. `set-rows`, `rename-set` and `rename-template` also refuse on their own (exit code 2) when the app has unsaved changes, or when the app is open on the project and you did not run `begin`.
5. After every change run `check`, then `render` the cards you touched and look at the images. Fix what is wrong before reporting.
6. Always run `end` when you have finished, also when you stop because of an error or a question for the user: until then the app stays locked. The app reloads the project by itself.

To leave a note for the user or for your next session, write a Markdown file in `notes/` (between `begin` and `end`, so the open app picks it up); change an existing note only when asked.

Ask before deleting sets, templates, layers or assets, and before replacing many rows the user did not ask to change.

## Project folder

```
project/
  stella.json             # name, data file, sets, styles, variables, export profiles
  data/cards.xlsx        # one sheet per set (.xlsx, .ods, or .csv for a single set)
  templates/<name>.json  # one file per template
  notes/<name>.md        # project notes in Markdown, written by the user in the app
  docs/<name>.md         # documents of the game (rules, sell sheet…) in Markdown, see below
  assets/                # images (svg, png, webp, jpg), any subfolder
  assets/fonts/          # project fonts (ttf, otf, woff, woff2)
  assets/sources.json    # origin and license of imported icons and fonts (written by the app)
  export/                # exported files, can be regenerated
  deleted/               # templates and set sheets deleted in the app; not part of the project
```

Older projects have `naibi.json` or `gamecreator.json` instead of `stella.json`; the format is the same.

### stella.json

```json
{
  "formatVersion": 1,
  "name": "Demo",
  "dataFile": "data/cards.xlsx",
  "sets": [{ "name": "Characters", "template": "character", "sheet": "Characters" }],
  "styles": { "keyword": "weight=800 color=#7A3FA0 smallcaps" },
  "variables": {
    "sword": { "type": "image", "src": "sword", "tint": "red", "scale": 1.2 },
    "quick": { "type": "text", "text": "[Quick]{border=#7A3FA0/0.3 radius=round}" },
    "red": { "type": "color", "color": "#A33A2A" },
    "hand": { "type": "value", "value": "7" }
  }
}
```

- `dataReadOnly: true` means the user edits the data only in the data file itself (e.g. in Excel): `set-rows` and `pull-sheets` refuse, and you must not write the data file; change templates instead, or ask the user to edit the spreadsheet.
- `sets[].sheet` is optional (default: the set's name). Several sets may name the same sheet: they share its rows and each draws them with its own template; `rename-set` then keeps the sheet's name. `sets[].hiddenColumns` (columns hidden in the app's table) and `sets[].showComputed` (also show fixed and formula layers, read only) are view preferences only; they never change the cards. A set's template is `templates/<template>.json`.
- `styles`: name → markup attributes. `heading1`, `heading2` and `note` always exist and can be redefined.
- `variables`: `image` (`src` file name; optional `tint`, `scale` (height relative to the line, 1 = normal), `raise` (% of the line), `rotate` (degrees), `flip` (`h`, `v`, `hv`), `opacity` 0-1), `text` (markup that replaces `{name}`), `color` (usable by name in every colour property, which also accepts `{field}` to take a card field such as a value layer; redefining a CSS colour name such as `red` changes it everywhere), `value` (constant text or number, also usable in formulas).
- `export` holds the options of the last export of each kind and the named profiles (`export.named`), written by the app; `order` holds the sidebar order. Leave existing ones alone unless asked; when the user asks for an export and the project has no fitting profile (`info` lists them), add one to `export.named` and run it with `export --profile`. A profile is `{ "name": "Print", "kind": "pdf" | "images" | "tts", "options": { ... } }`; options left out take the app's defaults, so `{}` is a valid start. Useful options: all kinds `sets` (set names, empty = all), `copies` (true = repeat cards by `amount`; default true for PDF and TTS, false for images); PDF `page` (`A4`, `A3`, `Letter`), `landscape`, `margin` (mm, 10), `bleed` (false), `marks` (`corners`, `lines`, `none`), `sides` (`front`, `back`, `both`), `duplex` (`none`, `long`, `short`: backs on alternate pages, mirrored), `split` (`single`, `set`, `side`); images `format` (`png`, `jpg`, `webp`, `svg`), `dpi` (300), `bleed`, `sides`, `pattern` (file names, `%set/%n`); TTS `destination` (`project` = `export/tts/`, `tts` = Tabletop Simulator's Saved Objects folder, `both`), `objects` (below). PDF and image files go to `export/` unless `folder` is set. In Tabletop Simulator options (`export.tts` or a named profile of kind `tts`), `objects` maps a set name to what it becomes: `{ "type": "card" | "token" | "tile" | "board" | "die", "thickness": 2, "edgeColor": "#FFFFFF" }` (thickness in mm, edge color for tiles and boards; `die` makes one six-sided die from every six cards, card 1 on face 1, and wants a square template); a set not listed is a deck of cards.

## Data sheets

- The first row holds the headers, each following row is a card.
- `amount` is the number of copies (1 when empty or missing).
- A column named like a template layer replaces that layer's main value: the text of a `text` layer, the file of an `image` layer, the fill of a `shape` or `grid`, the visibility of a `group`, the value of a `value` layer.
- A column `layer.property` replaces another property for that card: `name.color`, `cover.zoom`, `badge.visible`, `title.size`. Values are written as in the template (numbers, `true`/`false`, colours); a stroke is `colour/width/dashed`, for example `red/0.3/dotted`.
- An empty cell keeps the template's value. A cell with only spaces empties the main value.
- Other columns are free fields, usable as `{column}` in texts and formulas.
- Write line breaks inside a cell as real newlines in JSON (`"\n"`).
- `column@lang` (for example `name@en`, `name.size@en`) is the translation of `column` into one of the project's languages (see below).

## Templates

Units: millimetres for positions and sizes, points for text size, degrees for rotation. The card's trim edge is at 0,0; `bleed` extends beyond it (background layers usually start at `-bleed`). A layer only lists the properties that differ from the defaults; the first layer in `front`/`back` is the one on top.

```json
{
  "name": "character",
  "width": 63,
  "height": 88,
  "bleed": 3,
  "safeMargin": 3,
  "cornerRadius": 3,
  "labelField": "name",
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
    },
    {
      "type": "shape",
      "name": "background",
      "x": -3,
      "y": -3,
      "w": 69,
      "h": 94,
      "fill": "#F4EFE4",
      "source": { "kind": "fixed" }
    }
  ],
  "back": []
}
```

Template keys: `name`, `width`, `height`, `bleed` (default 3), `safeMargin`, `cornerRadius`, optional `shape` (`rect`, `ellipse`, `hexagon`, `path` with `shapePath`, an SVG path in 0-1 card coordinates), `labelField` (field that names the cards in the app), `guides` (`{ "x": [...], "y": [...] }`).

Layer names are unique in a template and are also column names: use short names without dots, braces or brackets.

### Derived templates

A template can be based on another one and store only its differences. The app and `stella template` show the resolved layers; the file looks like this:

```json
{
  "extends": "character",
  "changes": {
    "template": { "cornerRadius": 5 },
    "layers": { "band": { "fill": "#B3261E" }, "badge": { "visible": false } },
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

- `changes.template` may change `bleed`, `safeMargin`, `cornerRadius`, `shape`, `shapePath`, `guides`, `labelField`; the card size always comes from the base.
- `changes.layers` maps a base layer name to the properties that differ; compound values (stroke, shadow, source) are written whole.
- `changes.added` lists layers that exist only in the derived template: `side`, optional `parent` (an inherited group) and `after` (the layer just above it in the list; missing means on top).
- Inherited layers cannot be deleted or reordered: hide them with `"visible": false`. Do not write `front`/`back` in a derived template.
- When you rename a layer of a base template by hand, rename it in the `changes` of its derived templates too (the app does this itself).
- A sheet column `template` picks the template of a single card (empty: the set's template). It must have the same size as the set's template.

### Properties of every layer (defaults)

`name`, `visible` (true), `locked` (false), `x`, `y` (0; top-left corner), `w` (20), `h` (10), `rotation` (0, degrees, around `anchor`), `anchor` (`center`; one of `top-left`, `top`, `top-right`, `left`, `center`, `right`, `bottom-left`, `bottom`, `bottom-right`), `opacity` (1), `blend` (`normal`, `multiply`, `screen`, `overlay`), `shadow` (null or `{ "color", "blur", "dx", "dy" }` in mm), `fade` (null or `{ "kind": "linear"|"radial", "angle", "from", "to", "start", "end" }`, values 0-1, angle 180 = top to bottom), `constraints` (`{ "h": "left", "v": "top" }`, used when the template is resized), `source`.

`source` decides where the layer's main value comes from on each card:

- `{ "kind": "column", "column": null }` (default): the column with the layer's name (or `column` if set); without a cell, the template value.
- `{ "kind": "fixed" }`: always the template value; columns are ignored.
- `{ "kind": "formula", "expr": "..." }`: computed (see Formulas).

### text

`text` (markup), `style` (null or a style name for the whole layer), `font` ("Nunito"), `weight` (400), `italic` (false), `size` (10 pt), `color` ("#000000"), `align` (`left`, `center`, `right`, `justify`), `valign` (`top`, `middle`, `bottom`), `lineHeight` (1.2), `letterSpacing` (0, ‰), `paragraphSpacing` (0 mm), `indent` (0 mm, first line), `padding` (0 mm) or `paddingSides` ([top, right, bottom, left]), `transform` (`none`, `upper`, `lower`, `capitalize`), `underline`, `strike` (false), `wrap` (true), `stroke` (null or `{ "color", "width" }`, width in mm or `"8%"` of the text size), `fit` (`none`, `shrink`, `truncate`), `minSize` (6 pt, for `shrink`).

`font` is a family name: a font in `assets/fonts/`, Nunito (bundled), or a font installed on the computer (installed fonts make the project look different elsewhere; prefer copying them into `assets/fonts/` when the licence allows). It can be a text variable: `"{titles}"`.

### image

`src` (file name or image variable; may contain fields: `"{name}"`), `fit` (`cover`, `overflow` = like cover but the part outside the frame stays visible, `contain`, `stretch`, `original`, `tile`), `crop` (null, or `{ "x", "y", "w", "h" }` as fractions 0-1 of the image file: only that part is used, then fitted; in a cell `layer.crop` is written as four percentages `x y w h`, e.g. `10 0 50 50`, or `none`), `align` (anchor inside the frame, `center`), `zoom` (1), `imageRotation` (0, rotates the picture inside the frame), `offsetX`, `offsetY` (0 mm), `flipH`, `flipV` (false), `tint` (null or a colour; recolours monochrome icons), `grayscale` (false), `brightness`, `contrast`, `saturation` (1), `radius` (0 mm), `stroke` (null or `{ "color", "width", "dash"? }`), `missing` (`placeholder` or `hide`).

Getting icons: a new project has no images. Look in `assets/` first; otherwise, with the user's consent, take monochrome icons from Iconify, which the app's **Import icons** dialog also uses: search with `https://api.iconify.design/search?query=sword&prefix=game-icons` (the result's `icons` are `prefix:name`; game-icons.net, CC BY 3.0, has thousands of game icons; `prefixes=game-icons,mdi` searches several collections), download `https://api.iconify.design/<prefix>/<name>.svg`, replace `currentColor` with `#000` (then `tint` recolours it) and save it as `assets/icons/<short name>.svg`. Record each file in `assets/sources.json`, which the app uses for the credits (keep the entries already there): `{ "icons/sword.svg": { "kind": "icon", "source": "Iconify: Game Icons", "id": "game-icons:broadsword", "title": "broadsword", "author": "GameIcons", "license": "CC-BY-3.0", "url": "https://icon-sets.iconify.design/game-icons/?icon-filter=broadsword", "imported": "2026-10-24" } }`; the collection's name, author and licence (SPDX id) are in `https://api.iconify.design/collections?prefix=<prefix>`. Tell the user when a licence asks for credit (CC BY) or has conditions (SA, NC, GPL). Without network, ask the user to import icons in the app.

Image names: file name without path or extension is enough (`sword` finds `assets/icons/sword.svg`). Extensions tried: .svg, .png, .webp, .jpg, .jpeg. If two files match (`sword.png` and `sword.svg`, or the same name in two folders) the name is ambiguous: add the extension or part of the path (`icons/sword`). An image variable with the same name wins over a file.

### shape

`shape` (`rect`, `ellipse`, `polygon`, `star`, `line`, `path`), `fill` ("#CCCCCC"; a colour, a colour variable, `none`/null, or a CSS gradient such as `linear-gradient(90deg, #A33A2A, #FFD27A 70%)` or `radial-gradient(white, red)`), `stroke` (null or `{ "color", "width", "dash"?: "dashed"|"dotted" }`), `radius` (0 mm, rect/polygon/star corners), `sides` (6, polygon sides or star points), `innerRatio` (0.5, star), `path` (SVG path in 0-1 coordinates of the box, for `path`). A `line` goes from the middle of the left side to the middle of the right side of its box, rotated by `rotation`; `w` is its length.

### grid

Equal cells drawn inside the box: `cell` (`square`, `circle`, `hex`, `triangle`, `diamond`; default `square`), `rows` and `columns` (4), `interlock` (false; true = honeycomb hexagons, triangles alternating up/down, diamonds and circles in the gaps of the row above, squares as bricks), `orientation` (`pointy` or `flat`, hexagons), `cellRatio` (1, width/height of squares, circles, diamonds), `gap` (1 mm between cells), `padding` (0 mm between cells and the grid border), `zoom` (1 = the largest grid that fits the box without stretching cells; 0.5 half size), `alignX`/`alignY` (`start`, `center`, `end`), `clip` (false), `radius` (0 mm, cell corners, ignored for circles), `fill` ("#FFFFFF", cells; colour, variable, gradient or null), `stroke` (cells, `{ "color": "#333333", "width": 0.3 }`), `background` (null; fills behind and between the cells), `border` (null; stroke of the background), `backgroundRadius` (0 mm), `content` (""; the name of a group of the same side repeated in every cell: the group is drawn at its own position as the content of the first cell and moved by the cell distance into the others; on cards the group itself is hidden). Inside the content group these fields change per cell: `{cell.index}` (1-based, by rows), `{cell.row}`, `{cell.column}`, `{cell.count}`, `{cell.random}` (1..999999, fixed per card and cell); combine with `MOD` and `PICK` in formulas, e.g. a text layer with source formula `=IF(MOD({cell.index}; 10) = 0; "[" & {cell.index} & "]{color=red}"; {cell.index})`. The column with the layer's name sets the cell fill.

### group

`children` (layers), `clip` (false; when true the bottom child, last in the list, is the mask), `layout` (`none`, `row`, `column`, `grid`), `gap` (2 mm), `columns` (3), `justify`, `alignItems` (`start`, `center`, `end`), `repeat` ("1"; a number or a field such as `"{strength}"`: the children are repeated that many times). A group with a layout or a repeat keeps its own `x`, `y`, `w`, `h`; otherwise its box is the extent of its children. The column with the group's name sets its visibility.

### value

`value`: a hidden per-card value, usable as `{name}` in texts and formulas of other layers. A column with the same name changes it per card; it can have a formula. Value layers are computed in order.

## Text markup

Markdown for basics plus `[text]{attributes}`. No HTML. Every line break starts a new paragraph (a cell written with Alt+Enter); `\` at the end of a line breaks without a new paragraph. `_4{coin}_` keeps its content on one line (same as `[4{coin}]{nowrap}`; not italic, unlike Markdown); text and icons otherwise wrap freely. An underscore inside a word stays literal; escape a lone one as `\_`.

| Write                                                                  | Get                                                                           |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `**bold**`, `*italic*`, `++underline++`, `~~strike~~`, `==highlight==` | inline formatting                                                             |
| `^sup^`, `~sub~`                                                       | superscript, subscript                                                        |
| `# Title`, `## Subtitle`, `> note`                                     | paragraph with style heading1, heading2, note                                 |
| `- item`, `1. item`                                                    | lists                                                                         |
| `---`                                                                  | separator line                                                                |
| `[text]{.keyword}`                                                     | apply a style                                                                 |
| `[text]{color=red size=+2 weight=800}`                                 | attributes, combined with spaces                                              |
| `{.flavor center} text`                                                | style or attributes for a whole paragraph (at the start of the line)          |
| `{field}`, `{variable}`                                                | value of a card field, or a project variable                                  |
| `{sword}`                                                              | an image inline (image variable, or any image in assets), as tall as the line |
| `{sword*3}`, `{sword*strength}`                                        | repeated 3 times, or as many times as the field says                          |
| `{sword tint=red size=150% raise=10 rotate=90 flip=h opacity=50%}`     | inline image with options (also with repeats: `{sword*2 tint=red}`)           |
| `{cover}`, `{cover*3}`                                                 | the picture that image layer `cover` shows on this card                       |
| `\{`, `\*`, `\[`                                                       | literal characters                                                            |

Character attributes: `.style`, `color=`, `highlight=`, `size=` (14, +2, -1, 80%), `font=` (`Open_Sans`, underscores for spaces, or `{variable}`), `weight=`, `stroke=colour/width`, `spacing=` (‰), `raise=` (pt), `upper`, `lower`, `smallcaps`, `nowrap` (the span never breaks across lines), `bold`, `italic`, `underline`, `strike`, `left`, `center`, `right`, `justify`.

Box attributes turn the text into an inline box: `border=colour/width`, `fill=`, `radius=` (mm or `round`), `pad=` (mm, or vertical/horizontal `0.3/1`), `bg=` (a background image: `circle`, `square`, `rounded`, `hexagon`, `diamond`, an image variable or file), `bg-color=`, `bg-size=` (% of the line or mm), `text-raise=` (pt; moves only the text inside the box, while `raise=` moves the whole box). Example: `[{strength}]{bg=circle bg-color=red color=white weight=800}`.

Colours: hex (`#A33A2A`), the 148 CSS colour names, colour variables (`red` or `{red}`). A field and a variable with the same name: the field wins. An unknown `{name}` that is neither a field, a variable nor an image is reported by `check`.

### System variables

Stella fills these by itself; write them like fields, in text and in formulas: `{project.name}`, `{set.name}`, `{template.name}`, `{card.number}` (row in the set, from 1), `{set.rows}`, `{set.cards}` (cards with copies, sum of `amount`), `{card.copies}` (the card's `amount`), `{card.copy}` (copy being drawn, from 1; different per copy only in PDF and image exports with copies, and in TTS exports with `copiesIn: "sheet"`), `{card.side}` (`front` or `back`), `{date}` (today, `YYYY-MM-DD`). A field or project variable with the same name wins. Example footer: `{set.name} {card.number}/{set.rows}`.

## Documents

`docs/<name>.md` files are the documents of the game: rules, sell sheet, appendix, FAQ. The user writes them in the app's **Documents** section, with a live preview; you write them as files (between `begin` and `end`). They are Markdown: `#`, `##`, `###` headings, paragraphs separated by an empty line (a single line break joins the lines), `-` and `1.` lists (indent two spaces for a sub-item), `>` boxes, `|` tables with a `|---|` line under the header (cells take markup and images or cards written as `![](icons/sword.svg?width=8)` / `![](card:Set/1?width=20)`; an optional comment line right under the last row sets the look: `<!-- table width=90% columns=25,55,20 border=#c8c8c2 borderWidth=0.25 lines=all|rows|outer|none header=#f3f3f0 fill=none stripes=#fafaf7 -->`, widths in % (table of the text width, columns of the table), colors also as variables, `none` for no background), `---` lines and fenced code. A colored box around any blocks: a line `<!-- box fill=#fff3c4 border=#e0b000 borderWidth=0.3 padding=3 radius=2 -->` before them and `<!-- /box -->` after (all options optional; `fill=none`, sizes in mm; no nested boxes). Inside the lines the card markup above works: styles, attributes, image variables and assets (`{sword}`), text and value variables, `{project.name}` and `{date}`; card fields do not.

An image alone on a line shows a card of the project, drawn as it is now, so it follows changes to data and templates: `![Caption](card:Set/name=Wizard)` is the first card of the set whose `name` column is `Wizard` (exact, then ignoring case), `![](card:Set/3)` the card on row 3. Prefer a column with unique values to the row number, which changes when rows move. Options after `?`, joined by `&`: `side=back`, `width=40` (mm; default the real card size), `align=left|center|right`. Write `%29`, `%3F`, `%26` for `)`, `?`, `&` in the set name or value. Several images on one line sit side by side; `![](icons/map.png)` shows an image from assets; it takes `?width=40&align=right` too (width in mm, default the image size reduced to the page). The alignment applies to the whole line of images: the first one that sets it wins, default center. Page settings go at the very top, between two `---` lines, one `key: value` per line (omit those you keep at the default): `page` (`A4` default, `A5`, `Letter`), `margin` (mm, 18), `font` and `headingFont` (family name or `{variable}`; empty = default / same as text), `size` (pt, 11), `lineHeight` (1.4), `paragraphSpacing` (pt after each paragraph, 6), `align` (`left` or `justify`), `color` and `headingColor` (hex or project color name), `language` (project language code for the cards and variables; default the main language). Any other key in that block is a document property, as in Obsidian (`title`, `tags: [a, b]`, `author`…): keep the user's properties when you rewrite the file; they are not printed unless `showProperties: true`. Example:

```
---
page: A5
size: 10
headingFont: Alegreya
headingColor: red
---
```

Documents export to `export/docs/` as PDF, standalone HTML, Word (.docx) or plain Markdown with PNG cards: in the app with **Export document…**, from the command line with `export-doc` (for example `export-doc <project> Rules --format pdf`). Open the PDF to check the layout.

A card anatomy (the card with labels pointing at its parts) is a fenced block:

````
```anatomy
card: Characters/name=Wizard?width=50
- name: Name of the character
- strength (left): Strength, added to the die roll
```
````

`card:` takes the same reference as `card:` images (prefix optional). Each `- layer: label` line names a layer of the card's template (the column-like layer name) and its label; markup works in labels; `(left)`/`(right)` forces the side, otherwise the nearest side is used. A `sides: both` line draws front and back side by side: front labels go left, back labels right, and back layers are marked `(back)`, e.g. `- logo (back): Game logo`. `check` reports unknown layers.

A table setup diagram (how to lay out the game) is a fenced block, one element per line, sizes in mm from the top left corner:

````
```setup
size 300x230
zone 0,0 300x112 "Player 1"
deck Characters/1?side=back 10,10 count=6 "Characters"
card Characters/name=Wizard 165,10 rotate=90 "The wizard"
text 165,85 width=80 "In the middle: **3** face-up cards"
arrow 260,40 -> 290,40 "draw"
image icons/coin.png 270,75 width=12
```
````

`size WxH` is optional (without it the drawing fits its elements). Card references are as in `card:` images (prefix optional), with `%20` for spaces; `rotate` is in degrees, clockwise (any angle; 90 and 270 turn the card sideways), and a rotated card takes the upright box that contains it, with `x,y` at its top left; a deck is drawn as a small stack (`count` defaults to 5). Text and labels go in double quotes (`\"` for a quote) and can use markup. Cards are usually 63x88 mm: leave room for labels (about 5 mm under a card). `check` reports bad lines and missing cards.

Run `docs` (or `check`) after writing: it lists the references that are not found, with their line.

## Formulas

A layer with `source.kind = "formula"`, or a value layer, computes its value:

- Without a leading `=` the expression composes text: `{name}.png`, `Strength {strength}`; with `+ - * /` and a numeric result it is computed: `{strength}+2`.
- With a leading `=` it is an Excel-like expression: `=IF({strength}>3; "Strong"; "Weak")`. Strings in double quotes, comparisons `= <> < > <= >=`, `&` joins text, arguments separated by `;` or `,`. Functions: `IF`, `AND`, `OR`, `NOT`, `MIN`, `MAX`, `ABS`, `ROUND`, `FLOOR`, `CEILING`, `UPPER`, `LOWER`, `LEN`, `CONCAT`, `ISBLANK`, `COUNTIN(text; part)`, `MOD(n; d)` (remainder, sign of the divisor as in Excel), `PICK(n; a; b; ...)` (the n-th item, 1-based, starting again after the last; a single argument with commas is split into a list).
- `{field}` is, in order of precedence: a computed value layer, the row's non-empty cell, the layer's template value; text and value variables work too.
- A field is a number also when written the way a spreadsheet shows it: `1,5`, `50%` (0.5), `1 234.50 €`. Calculations and comparisons use the number; elsewhere the text stays as written.

## Projects in several languages

`languages` in stella.json lists language codes, the main one first: `"languages": ["it", "en"]`. Columns without `@` hold the main language; `name@en` holds the English text of `name`, next to it in the sheet. An empty translated cell falls back to the main language. `names` (in the project and in each set) gives the translated names used by `{project.name}` and `{set.name}`: `"names": { "en": "Heroes" }`.

- Only what is read is translated: text layers, `{field}` inside texts, formulas without `=`. Image and font names, colours and formulas with `=` always use the main language, so `=IF({type}="Attacco"; ...)` keeps working. To change an image in one language use its translated column (`icon@en`).
- Fixed texts: a text layer with `"source": { "kind": "fixed" }` takes `"texts": { "en": "strength" }`, a fixed value layer `"values": { "en": "..." }`; text and value variables take `texts` / `values` the same way. A missing or empty language uses the main text. Formulas with `=` compare main-language values; to translate their result, return a variable: `=IF({type}="Attacco";"{attack}";"{defence}")` with `attack` and `defence` text variables that have `texts`.
- Documents: `language: en` (or `lang: en`) in the front matter draws the document's cards and variables in English; without it the main language. `export-doc --lang en` overrides it.
- `check` lists missing translations as warnings (not counted in the exit code): `check --lang en` for one language, binding the cards in it.
- To translate a set, add the `@lang` columns for its text columns (not the ones with only numbers) with `set-rows`, keeping every other column as it is, then `render --lang en` and look at the images.
- `render --lang L` draws in that language (in `export/stella-render/L/`); `export --profile NAME --lang L|all` exports one or all languages, the others in a subfolder named after their code.

## Language

All keys, keywords, style names, functions and `amount` are English. Names chosen by the user (layers, columns, sets, variables, styles) stay in the user's language; keep them as they are and match the language of existing card text when writing new text.
