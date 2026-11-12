---
name: stella-nandeck
description: Finish converting a nanDECK game into a Stella project after Stella's "Import from nanDECK". Reads the project note "Import nanDECK" and the original .nde scripts, and converts by hand the lines the importer skipped or approximated. Use when a Stella project has notes/Import nanDECK.md, or when the user asks to finish or check a conversion from nanDECK.
---

# Finishing a nanDECK import in Stella

Stella's **Import from nanDECK** turns each nanDECK script (`.nde`) of a game into a template and a set: labels and LINK data go into the data sheet, frames and ranges become layers with visibility formulas, the images used are copied into `assets/`. What it could not convert, or converted only approximately, is listed in the project note `notes/Import nanDECK.md`, script by script, with the line of the script. Your job is to finish that work by hand, one line at a time, and to leave the project as close as possible to what nanDECK drew.

This skill only covers nanDECK. **For everything about Stella (the `stella` command, `begin`/`end`, the project files, templates, layers, markup, formulas) use the Stella skill (`stella`) and follow its workflow.** If the Stella skill is not installed, tell the user to install it from Stella (**Help → AI tools**) and stop.

## Before you start: updates

This skill is for Stella {{STELLA_VERSION}}. Once per session, after the Stella skill's own first steps (which find the `stella` command and its version, and update the Stella skill), compare that version with this skill's version. If they differ, or this skill still shows the placeholder, download `https://raw.githubusercontent.com/lucadj77/stella/v<command version>/skill/stella-nandeck/SKILL.md`, put the command's version in place of `{{STELLA_VERSION}}` in the first sentence of this section only, write it over this skill's file, tell the user, and read it again. Then this skill describes the importer of the Stella that made the project. If you cannot reach the network or write files, say so and carry on.

## Rules

- **Never change the nanDECK folder.** Its path is written at the top of the note ("nanDECK folder: ..."). Read the scripts and images there; write only inside the Stella project. If the folder is not there (another computer, moved), ask the user where it is.
- Work inside `begin` ... `end` of the Stella skill, and run `check` and `render` after each group of changes.
- A text or formula never reads a field that is only a sheet column: when you need a per-card value, add a `value` layer with the column's name to the template (the importer already adds one for every data column) and refer to it as `{name}`.
- Keep the layers and columns the importer made unless they are wrong. Add new layers with clear names; keep the order rule of Stella: **the first layer in the list is drawn on top**, the opposite of nanDECK, where a later line draws over an earlier one.
- Do not invent values the script does not give. When a line depends on something you cannot see (a random draw, a font that is not installed, a flood fill), explain it to the user and ask.

## Steps

1. Read the note. For each script section: the templates it became, the table **Lines not converted** (file, line, text, reason) and the list **Converted approximately**. Lines from an INCLUDE file name that file.
2. Open the script in the nanDECK folder and read the lines around each listed line: labels (`[name]=...`), frames (`<name>=...`), ranges and IF blocks decide what the line means.
3. Run the Stella skill's `info`, then `template <project> <template>` to see the layers the importer made, and `render` two or three cards. If the nanDECK folder has pictures that nanDECK made (`DISPLAY` or `SAVE` output, often `.png` sheets or `tts/` images), look at them: they are the reference of what the cards should look like.
4. Convert each line (see **Converting nanDECK lines** below). Prefer the simplest Stella feature that draws the same thing; when there is none, say so in the note.
5. For each line you handled, update its row in the note: add `✓` and a few words at the start of the reason (for example `✓ grid layer "board"`), or `✗` and why it cannot be done. Do not delete rows: the user reads them to see what changed.
6. Run `check`, `render` the cards you touched and compare them with the nanDECK pictures. Fix differences before going on.
7. At the end tell the user what you converted, what is still open and why.

## How the importer converted things

Knowing this helps you read what is already in the project.

- **Size and units.** `CARDSIZE` (default 6 × 9 cm) is the template size in mm. `UNIT` is cm unless the script says otherwise; `%` is a fraction of the card width (x, width) or height (y, height); `%%` inside a frame modifier is a fraction of the frame.
- **Cards.** The number of cards comes from the ranges used (or `CARDS`, or the LINK rows). Cards that share commands form a template; one card after all others (or as many cards as the fronts, right after them) becomes the back, even when a command without a range (a frame on every card) is drawn on both; other groups become templates named `<script> 2`, `<script> 3`. Identical consecutive rows are merged into the `amount` column, and a deck that is the same block of cards repeated (`autorange({(x)*2})`) keeps one row per card with the copies in `amount` (the order of the deck changes).
- **Labels.** `[x]=a|b|c` is a sequence: card n takes element n (cycling). `[x]=[a]|[b]` joins whole sequences, `[x]3=...` repeats one 3 times (a negative number keeps the first elements). Combination labels `C[x]k=`, `CR`, `P`, `PR` (with `D` to drop duplicates and `;a:1-2` limits) are expanded with the same engine as Stella's **Generate** window, so the rows match what Generate would make; the result is a fixed list of rows, and the user can redo it with Generate on the set if they change the elements. A label with more than one element that a command uses becomes a data column `x`. LINK columns become data columns too. Only the columns a layer reads (`{x}` in a text, a path or a formula) get a value layer; the others stay in the sheet.
- **Layer names.** A layer takes the name of its frame when the position is a whole frame (`<plus_el>`), otherwise the name of its image file without numbers (`img/muro{muro}.png` → `muro`, `muro_img` when a column already has that name), otherwise the label it shows; a fixed text takes its word (`start`) or `text_` and its letter or symbol (`text_x`, `text_plus`); on the back, a name already used on the front gets `_back` (`background_back`). A visibility group takes the name of the range label (`[ob]` → `ob`); a `LAYER` block becomes a group `opacity_50` inside it.
- **Ranges.** In nanDECK the n-th card _of the range_ takes the n-th element of a sequence, except with `LABELRANGE` (and `BASERANGE = range, ON`), where it is the n-th card of the deck; the importer follows this. A range from `LABELRANGE`, `RANGEINT`, `RANGEADD` or an `IF` on a data column becomes a visibility formula on a group (`=IF`-style: `{color}="gold"`, `COUNTIN(...)`, `AND(...)`); `IF` conditions with `_AND_`, `_OR_`, `_NOT_`, parentheses, `@` (contained in) and `#` (not contained in) become `AND`, `OR`, `NOT` and `COUNTIN({x}; "a")>0`; any other range becomes a column `<layer>.visible` with true/false. Images in the same place chosen by an `IF ... ELSEIF ... ELSE` chain become one image whose source is a formula, `=IF(cond1; "img/a.png"; IF(cond2; "img/b.png"; ""))`.
- **Values that change per card** that are just a label are written with the field in the template (an image angle `[or]` becomes `"rotation": "{or}"`). Others go into a column named after the layer (`<layer>` for its text, image or fill, `<layer>.<property>` for the rest). A text or image that is the same on every card except for a field is written once in the template with the field (`{name}`, `img/{suit}.png`); `join()` is resolved card by card in the same way, and an expression in it (`{[pers]-1}`) gives a column with the value of each card. A path built from an empty field (`img/el{x}.png` → `img/el.png`) is not a file: the layer gets `missing: "hide"`, since nanDECK draws nothing there.
- **Text.** `TEXT` and `HTMLTEXT` become text layers; `FONT`/`HTMLFONT` give font, size, color, bold, italic, underline, strikeout; outline x/y of `FONT` and the outline of `HTMLFONT` become the text stroke; `HTMLMARGINS` the padding and vertical alignment; `F` (fit) becomes `fit: shrink`. HTML tags become markup: `<b>` → `**`, `<i>` → `*`, `<u>` → `++`, `<s>` → `~~`, `<font color>` → `[...]{color=...}`, `<br>`/`<p>` → new line; an `HTMLFONT` name used as a tag, and `HTMLKEY` keys with a font, become `[...]{font=... size=... color=...}`.
- **Icons in text.** `HTMLIMAGE` and `ICON` images become image variables; their keys in the text become `{variable}` (with `size=` when the icon is not the height of the text). `ICONS` becomes one image layer per icon place, placed as nanDECK does: each icon has a space as wide as the width factor (15th parameter) times its width and as high as the height factor times its height, the image sits in the middle of its space, rows wrap when they do not fit (not with `L`) and are aligned by parameters 11 and 12; with `W` (and `H`) the first and the last icon touch the sides of the box; with `P` and an angle the icon shrinks by cos + sin of the angle so that, turned, it fits its space (not with `G`). The layers are numbered: `<label>_1`, `<label>_2` when the keys come from a label, otherwise the icon name (`pv_1`, `pv_2`); the image of each place is the icon variable, in a column when it changes, empty where a card has fewer icons. Icon variables with a key of one or two letters take the name of the image file. Keys longer than one character (14th parameter, or flag `X`) are read and `>` starts a new row; `<` (icon over the previous one), `_` (wide icon) and `+` (rotated icon) are dropped, and the flags `V` and `R` other than the order are ignored. More than 12 icons become a text of icon variables instead. Compare with a nanDECK picture when the layout matters.
- **Shapes.** `RECTANGLE`, `ROUNDRECT`, `ELLIPSE`, `CIRCLE`, `RHOMBUS`, `POLYGON`, `STAR`, `LINE`, `TRIANGLE`, `BEZIER` become shapes, `GRID` a grid layer. In nanDECK the first color is the border and the second the inside (`EMPTY` = none, missing = same as the border); the border is centered on the outline, as nanDECK draws it, so a border on a full-card shape is half cut by the card edge. A shape that covers the whole card is named `background`.
- **Images.** `IMAGE` flags: `P` → `fit: contain`, `C` → `cover`, `X` → `tile`, none → `stretch`; `H`/`V` → flip; `G` → grayscale; `U`/`S`/`W`/`E` → align top, bottom, left, right. The image angle is the same in nanDECK and Stella (checked on cards saved by nanDECK); text angles are turned the opposite way, which has not been checked on a picture yet: compare with a nanDECK picture when a rotated text matters.
- **CANVAS.** With `CANVASSIZE` and `CANVAS=range`, an `IMAGE` on card 0 that covers the canvas becomes an image layer on each canvas card with a `crop` column (`x y w h` in percent of the image), so each card shows its piece. Other commands on card 0 are listed as not converted.
- **Fonts.** Fonts used by the scripts that are not installed on the computer are listed in the note: install them, or choose another font in Stella.
- **LAYER ... ENDLAYER** becomes a group with that opacity. `SECTION ..., OFF` blocks are not drawn.
- **Paths.** A script in a subfolder (`old/deck.nde`) that names `img/a.png` reads it from the subfolder, or from the game folder when it is not there; `DIRFILES` works the same way.
- **Print lines** (`PAGE`, `BORDER`, `DPI`, `DISPLAY`, `SAVE`, `PRINT`, `DUPLEX`, `MARGINS`, `GAP` ...) are only counted: Stella's export settings replace them. Tell the user to set up the export (page, bleed, back sides) in Stella if they need the same output.

## Converting nanDECK lines

The reason in the table tells you what kind of line it is.

**command with no equivalent in Stella**: look the command up below.

| nanDECK                                                                      | In Stella                                                                                                                                                 |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HEXGRID`                                                                    | a `grid` layer with `cell: "hex"` (the importer already turns `GRID` into a square grid)                                                                  |
| `BEZIERS`, `PIE`, `LINERECT`                                                 | a `shape` with `shape: "path"`: write the SVG path in 0-1 coordinates of the layer box; dashed lines use `stroke.dash`; a straight `LINERECT` is a `line` |
| `PATTERN`                                                                    | an image layer repeated with `fit: tile`, or a group with `repeat` and a layout                                                                           |
| `TOKEN`                                                                      | elements for nanDECK's virtual table: nothing to do                                                                                                       |
| `FILL` (flood fill)                                                          | usually the inside color of the shape that encloses the point; ask if unclear                                                                             |
| `COPYCARD`                                                                   | the destination cards repeat the source cards: more `amount` on the source rows, or copied rows with `rows`/`set-rows`                                    |
| `COPY` (copies an area of the card onto another area, mirrored with `H`/`V`) | duplicate the layers of that area, moved, with `flipH`/`flipV` on images or mirrored coordinates                                                          |
| `RTFTEXT`, `RTFFILE`                                                         | a text layer with markup that reproduces the formatting                                                                                                   |
| `CHROMAKEY`, `T` flag on images                                              | Stella has no color key: ask the user for a PNG with transparency                                                                                         |
| `SEED`, `RANDOM`, `RANDOMRANGE`, random frames `~`                           | draw the values once and write them in the sheet (tell the user they are now fixed)                                                                       |
| `TAG`, `STORE`, `SET`, `CALC`                                                | compute the value per card and write it in a column (with a value layer) or use a formula                                                                 |
| `VISUAL`, `ZOOM`, `SPECIAL`, `OVERSAMPLE`, `IMAGEFILTER`                     | nothing to do                                                                                                                                             |

**function not converted**: the label or range uses a function the importer does not know (`FRAMECLOCK`, `FRAMEHEX`, `FRAMELINE`, `FRAMEDISK`, `FRAMEMAZE`, `RANDOM`, `CASESTRING`, `ENVIRONMENT`...). Work out the values it gives (frame positions, ranges, texts) from the manual and the parameters, then add the layers or columns by hand: a group of frames usually becomes several layers, or a `grid`.

**parameters not understood**: the line uses an expression or a frame group the importer could not evaluate, often card-dependent expressions such as `{num{§}?{°}}` or wildcards `<name*>`. Evaluate it for each card (`§` is the card number, `°` the frame number in a frame group, `{x?n}` the n-th element of label x, `{(x)}` the number of elements) and write the results in a column, or create one layer per frame.

**macro or special syntax**: labels with parameters (`[name](a,b)=...`), `MACRO` blocks, very long `FOR` loops. Expand them by hand for the cards that use them.

**flood fill**: see `FILL` above.

**linked data not found**: the LINK file or sheet was missing. Find the file with the user, import its rows into the set with `set-rows`, and rename the columns to the labels the script uses.

**Converted approximately** notes:

- _Text with a filled background_ (FONT without `T`) or _HTMLTEXT with a background color_: add a `shape` rect with that color right below the text layer (after it in the list), same box.
- _Properties that change between cards and cannot go in the sheet_: the importer kept the first card's value (for example a gradient or a stroke that changes). Write per-card values in a `<layer>.<property>` column if Stella accepts that property in a cell, or split the layer into one layer per variant with a visibility formula.
- _HTML tags not converted_: tables, lists, images by path, `<span style>` other than color. Rewrite the text with Stella markup (lists `- `, `{size=}`, `{font=}`, image variables `{name}`).

## nanDECK reminders

- Lines starting with `;` or `//` are comments; `{[x]= ... }` is a label written on several lines.
- `[x]=1-10` is a range when used as the first parameter, a text otherwise. Ranges: `1-5,8`, `10#3` (three cards from 10: 10-12), `[all]`.
- `LABELRANGE([label], value)`: the cards whose element of the label is `value`; operators `=`, `<>`, `<`, `>`, `<=`, `>=`, `@` (contains), and an optional third parameter that shifts the cards (used for backs after fronts).
- `AUTORANGE(n)`: the next n cards after the last card used so far.
- `FRAMEBOX(x, y, w, h, fw, fh, flag)`: a grid of frames named `<name1>`, `<name2>`, ... (letters with `L`, two digits with `P`).
- Frame modifiers: `<f, TL|TC|TR|CL|CC|CR|BL|BC|BR, w, h>` a box of that size aligned in the frame; `<f, TW|CW|BW, h>` full width; `<f, HL|HC|HR, w>` full height; `<f, PTL>` a point; `<f, HTL>` three corners for a triangle.
- `IF = [x] = value` ... `ELSE` ... `ENDIF` apply to the commands between them, card by card.
- `§` is the card number, `{...}` an expression, `[[x]]` the label whose name is the value of `[x]`.
- The full manual is in the nanDECK folder of many users (`nandeck-manual.pdf`) and on the nanDECK site; ask the user for it when a command is not described here.
