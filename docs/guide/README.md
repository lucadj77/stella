# Stella user guide

Stella is an app for making cards and other printed game components from a spreadsheet. You design the card layout once, the **template**, and every row of the spreadsheet becomes a card. Cards are exported as images, as print-ready PDFs or as Tabletop Simulator objects: decks, tokens, standees, tiles, boards and dice, ready to load into the game.

This guide follows the usual order of work: create a project, design a template, enter the cards, refine texts and images, export. The examples come from a small project with three sets: characters, items and market cards.

Video tutorials on YouTube, no voice ([whole playlist](https://www.youtube.com/playlist?list=PLC6t-d7-3DO0)):

**Start here**

- 15 · [Installing Stella and the web version](https://www.youtube.com/watch?v=n_9rcC9e_14) (3 minutes)
- 1 · [An overview of the basic functions](https://www.youtube.com/watch?v=qe6E6msuJDw) (4 minutes)
- 2 · [Your first component from scratch](https://www.youtube.com/watch?v=dIXdNuigAnY) (10 minutes)
- 14 · [A complete game, from idea to table](https://www.youtube.com/watch?v=zRINs94xW4o) (20 minutes)

**Components**

- 7 · [Boards, tiles, tokens and dice](https://www.youtube.com/watch?v=uFpBpGkuAYc) (9 minutes)
- 8 · [Grids: cells, numbers and rules](https://www.youtube.com/watch?v=TtTKJ9p3pxA) (9 minutes)
- 11 · [Images, icons and fonts](https://www.youtube.com/watch?v=Rw60_QDED9Q) (6 minutes)
- 16 · [Generating cards and splitting an image](https://www.youtube.com/watch?v=p46_avMl4dU) (7 minutes)

**Text and formulas**

- 4 · [Text, icons, styles and formulas](https://www.youtube.com/watch?v=SKoi6EaFY6k) (5 minutes)
- 13 · [The formula assistant](https://www.youtube.com/watch?v=5Go9c8dgOSc) (11 minutes)

**Data and languages**

- 10 · [Data from the spreadsheet](https://www.youtube.com/watch?v=hlKHMJOoNos) (9 minutes)
- 12 · [A game in several languages](https://www.youtube.com/watch?v=gszofbPThzU) (6 minutes)

**From file to table**

- 9 · [Printing your components](https://www.youtube.com/watch?v=lV4Sccgbm0I) (9 minutes)
- 3 · [From Stella to Tabletop Simulator](https://www.youtube.com/watch?v=k01RVCPnH1s) (5 minutes)
- 19 · [Snap points and tags for Tabletop Simulator](https://www.youtube.com/watch?v=XSceyDoLmw8) (6 minutes)
- 5 · [The rulebook and other documents](https://www.youtube.com/watch?v=skHh2Uz2VxE) (5 minutes)

**Tools**

- 6 · [Stella with an AI agent](https://www.youtube.com/watch?v=7EylDX9GKOU) (4 minutes)
- 17 · [Backups and recovery](https://www.youtube.com/watch?v=AeSwGYOWRCs) (5 minutes)
- 18 · [Working faster](https://www.youtube.com/watch?v=sdlhIDNbUyg) (5 minutes)

**Deep dives**

- 20 · [Deep dive: text](https://www.youtube.com/watch?v=-zQmXMRJBog) (13 minutes), with the ["Merchants" project to download](https://stella.lucadj.eu/progetti/merchants.zip)
- 21 · [Deep dive: icons and variables](https://www.youtube.com/watch?v=Sg-ktAAh1Ww) (12 minutes), with the ["Contracts" project to download](https://stella.lucadj.eu/progetti/contracts.zip)
- 22 · [Deep dive: two fields, the whole card](https://www.youtube.com/watch?v=43E0tSVZQHM) (9 minutes), with the ["Encounters" project to download](https://stella.lucadj.eu/progetti/encounters.zip)
- 24 · [Deep dive: the game board](https://www.youtube.com/watch?v=_Dvf3MXblf0) (27 minutes), with the ["Game board" project to download](https://stella.lucadj.eu/progetti/game-board.zip)
- 25 · [Deep dive: playing with chance](https://www.youtube.com/watch?v=NcbSnlPjj3o) (12 minutes), with the ["Resources" project to download](https://stella.lucadj.eu/progetti/resources.zip)

Versione italiana: [../guida/README.md](../guida/README.md).

Questions, help and ideas, in English and Italian: the [Stella Game Center Discord server](https://discord.gg/bkP3a3CwkP).

## Contents

- [Installing Stella](#installing-stella)

1. [Basic concepts](#1-basic-concepts)
2. [Start screen](#2-start-screen)
3. [The project window](#3-the-project-window)
4. [Designing a template](#4-designing-a-template)
5. [Entering and editing cards](#5-entering-and-editing-cards)
6. [Text and markup](#6-text-and-markup)
7. [Variables and styles](#7-variables-and-styles)
8. [Images, icons and fonts](#8-images-icons-and-fonts)
9. [Formulas and calculated fields](#9-formulas-and-calculated-fields)
10. [Generating cards](#10-generating-cards)
11. [Exporting](#11-exporting)
12. [Documents](#12-documents)
13. [Backup](#13-backup)
14. [Importing from Tabletop Creator](#14-importing-from-tabletop-creator)
15. [Working with an AI agent](#15-working-with-an-ai-agent)
16. [The web version](#16-the-web-version)
17. [Project files](#17-project-files)
18. [Keyboard shortcuts](#18-keyboard-shortcuts)

## Installing Stella

Download Stella from the [Download section of the website](https://stella.lucadj.eu/#download), which offers the right file for your system, or from the [releases page on GitHub](https://github.com/lucadj77/stella/releases), which has every version. It's free and needs no account.

Stella is not signed with an Apple or Microsoft certificate: those certificates cost hundreds of dollars a year, and Stella is a free project. So the first time you open it, macOS and Windows show a warning and ask you to confirm. The program is the same one you find on GitHub, with public source code; you confirm only once, then Stella opens normally, also after automatic updates.

### Mac

1. Pick the file for your processor: `Stella-<version>-mac-arm64.dmg` for Macs with an Apple chip (M1 and later), `Stella-<version>-mac-x64.dmg` for those with an Intel processor. If you don't know which one you have: Apple menu → **About This Mac**, under **Chip** or **Processor**.
2. Open the .dmg and drag the Stella icon onto the **Applications** folder. Then eject the Stella disk from the Finder sidebar. Keep Stella in Applications (or another folder you can write to): opened from the downloaded disk, it doesn't update itself.
3. Open Stella from Applications or Launchpad. macOS says it can't verify that the app is free of malware: press **Done** (or **OK**), not **Move to Trash**.
4. Open **System Settings → Privacy & Security** and scroll down to the **Security** section: there's the line "Stella" was blocked to protect your Mac. Press **Open Anyway** and confirm with your password or Touch ID.
5. Open Stella again and, in the last warning, press **Open**. From then on you won't be asked again.

On macOS versions before Sequoia (15), a right-click (or Control-click) on the app in Applications → **Open** → **Open** also works.

If macOS says Stella "is damaged and can't be opened", or **Open Anyway** doesn't appear, remove the block from Terminal (Applications → Utilities → Terminal):

```bash
xattr -dr com.apple.quarantine /Applications/Stella.app
```

### Windows

1. Download `Stella-<version>-windows-setup.exe`. Edge or Chrome may warn that the file isn't commonly downloaded: in the downloads panel open the **…** menu next to the file and choose **Keep** (in Edge then **Show more → Keep anyway**).
2. Open the file. The blue SmartScreen window "Windows protected your PC" appears: press **More info** and then **Run anyway**. If Windows asks whether to allow the app to make changes, answer **Yes**.
3. Follow the installer: you can choose whether to install Stella just for you or for all users, and the folder. At the end Stella is in the Start menu and on the desktop.

The **portable** version, `Stella-<version>-windows-portable.exe`, doesn't install: it starts with a double-click, also from a USB stick, and keeps its data (recent projects, preferences) in the `Stella data` folder next to the file. It also goes through SmartScreen the first time. It doesn't update itself: when a new version comes out, Stella tells you and opens the page to download it.

On work computers the administrator may block unsigned programs entirely. In that case there's the [web version](#16-the-web-version), which doesn't install.

### Linux

- **AppImage** (`Stella-<version>-linux-x86_64.AppImage`), for any distribution: make it executable and start it. From the file manager: right-click → Properties → Permissions → "Allow executing file as program"; or from the terminal:

  ```bash
  chmod +x Stella-*-linux-x86_64.AppImage
  ./Stella-*-linux-x86_64.AppImage
  ```

  The AppImage needs libfuse2: on Ubuntu 24.04 and later `sudo apt install libfuse2t64`, on earlier versions `sudo apt install libfuse2`. It updates itself.

- **.deb package** (`Stella-<version>-linux-amd64.deb`), for Debian, Ubuntu and derivatives: `sudo apt install ./Stella-<version>-linux-amd64.deb`. Stella appears among the applications and also starts with the `stella` command. It doesn't update itself: for a new version, install the new .deb the same way.

### Uninstalling

On the Mac, drag Stella from the Applications folder to the Trash; on Windows, use **Settings → Apps → Installed apps → Stella → Uninstall**; on Linux, delete the AppImage, or `sudo apt remove stella`. Your projects stay where you saved them: they are ordinary folders, which Stella never deletes.

## 1. Basic concepts

| Term         | What it is                                                                                                                    |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| **project**  | a folder on disk with the `stella.json` file, the data file, the templates and the assets                                     |
| **template** | the design of a card: format, bleed and a stack of **layers** (texts, images, shapes, groups), for the front and for the back |
| **set**      | a group of cards that use the same template; it matches a sheet of the data file (`data/cards.xlsx`)                          |
| **layer**    | an element of the template. The layer name is also the name of the sheet column it takes its value from                       |
| **asset**    | the project's images, icons and fonts, in the `assets/` folder                                                                |
| **variable** | a name you call in texts with `{name}`: an icon, a formatted text, a color or a value                                         |
| **style**    | a named set of text attributes, applied to a paragraph or a word                                                              |

Data and design are always linked the same way: in the template, the text layer `name` shows on each card the content of the `name` column of its row.

Sizes are in millimeters, text sizes in points. Markup and formula keywords are in English and do not change with the interface language.

## 2. Start screen

When it starts, Stella shows the start screen.

The first time, when there are no recent projects yet, the screen welcomes you with two big choices: **Start from scratch** creates an empty project, **Explore the example** opens the example project. Below them are the three steps of the work (draw a template, fill a set, export) and links to the overview video, to all the video tutorials and to this guide. From the first project on, the screen is the one described below, with a row of links under the recent projects.

![The welcome screen on first start](img/benvenuto.png)

![The start screen with a recent project](img/ingresso.png)

- **New project…** creates an empty folder with the structure of a project.
- **Open project…** opens a folder that contains `stella.json`. Projects created when the app was called Naibi (`naibi.json`) or GameCreator (`gamecreator.json`) open too.
- **Import from Tabletop Creator…** converts a Tabletop Creator project ([chapter 14](#14-importing-from-tabletop-creator)).
- **Open the example project** opens the project used in this guide and in the videos: three sets (Characters, Items, Market), icons, variables and styles. The first time it is copied into Documents/Stella/Example, where it can be changed freely; after that the copy is opened. In the web version the copy lives in the storage the browser keeps for the site: you change and save it without choosing a folder, but it stays in that browser only.
- **Recent projects** shows up to 24 projects, with their first card as thumbnail. The × removes a project from the list without deleting the folder.

The ⚙ button at the top right, on every screen, opens the settings: the interface size, the **units** (millimeters, centimeters or inches) for positions, sizes and margins across the app (text stays in points, line widths in mm), the theme (light, dark or the system's), the language (English or Italian) and **AI tools…**, which prepares an AI agent to work on projects ([chapter 15](#15-working-with-an-ai-agent)).

When a new version is out, a strip appears at the top of the window at startup: **What's new** shows what changes, **Update and restart** downloads the new version, installs it and reopens Stella. This works for Stella installed with the setup on Windows, for the AppImage on Linux, and on the Mac for the app in Applications (or another folder you can write to); if there are unsaved changes Stella asks first. The Windows portable version, the .deb package and an app opened from the downloaded disk image have **Download** instead, which opens the page to download it; the same happens if the automatic update fails. **Skip this version** stops showing it, **Remind me later** hides it until the next start.

In the ⚙ menu, **Updates** chooses the channel. **Stable** offers only official versions; **Beta** also offers the test versions, which bring new features earlier but may have a few more bugs. If you already had a beta, you are on Beta. Going from Beta back to Stable does not install an older version: Stella waits for the next official one.

On the start screen, at the bottom right, **What's new** shows what changed in the installed version, even offline, and **Check for updates** asks GitHub right away whether a newer version exists, and says so when you already have the latest.

To create a project you write its name and location. By default the location is `Documents/Stella` and the data file is Excel (`.xlsx`). **Data file options** shows the choice of format: Excel, OpenDocument (`.ods`) or **A file you already have (.xlsx, .ods, .csv)…**. With the last one the project starts from a file you already have: Stella makes a copy in the project's `data` folder and its sheets become sets with **New set** (see [Using an Excel file you already have](existing-excel.md)).

![The window to create a new project](img/nuovo-progetto.png)

A new project is empty. At the top of the window the **First steps** strip shows the four steps to take: draw a template, create a set, add the first component and export. Each step is ticked by itself when it is done, and the button next to them opens the next one. The × hides the strip, also in other projects. Projects that already have components when they open do not show it.

![The First steps strip and a set that is still empty](img/primi-passi.png)

The "?" next to the title of some windows (new template, new set, export, generate, formula assistant) opens the section of this guide about them.

Requests for confirmation, for example before deleting a set or closing a project with unsaved changes, appear in a Stella window that says what will happen. The confirming button says what it does (**Delete the set**, **Discard the changes**); when the action deletes something it is red, and the Enter key picks **Cancel**.

## 3. The project window

![The project window, with numbered parts](img/progetto.png)

1. **Top bar.** Project name (hover it to see the folder), undo and redo (they apply to what is open: the cards, styles and variables, or the template in the editor), the card language menu (only in projects with several languages), **Save** (⌘S / Ctrl+S), **Export…**, the **Project** menu, **Help** (F1, [chapter 6](#6-text-and-markup)) and ⚙ for the settings. The **Project** menu holds the commands used less often: **Backup…**, **Trash…**, **Google Sheets…**, **Languages…** ([5.7](#57-cards-in-several-languages)), **Save a copy…** (copies the project folder to a new or empty folder; the open project stays the same, and at the end you can open the copy), **Move…** (moves the folder and reopens the project from the new place, with its backups), **Reload from disk** (reads the project again, losing unsaved changes) and **Close project**. Copy and move ask you to save your changes first, and exist only in the desktop app.
2. **Sets.** A click opens the cards of the set; the number is the total of cards, copies included.
3. **Templates.** A click opens the template in the editor; next to it is the format in millimeters.
4. Project text **styles** ([chapter 7](#7-variables-and-styles)).
5. Project **variables**, with a preview.
6. **Components of the set**, in a table or a grid.
7. **Preview** of the selected card, front or back. **Edit template** opens the card's template, that is the set's or the one chosen for the card, with this card already loaded in the editor's preview (the **Data** menu at the top right shows the set and the card number); **Enlarge** opens the card large with the form next to it.
8. **Fields of the selected component**, editable like the table cells.

The ⋯ button next to the name of the open set or template opens a menu to rename it, duplicate it, delete it and, for a template, create a derived one (**Derive**). The same menu opens from the ⋯ that appears when you hover an item in the sidebar, or with a right click on the item. Renaming a set also renames its sheet in the data file (if the sheet is already in the file Stella asks first, because formulas in other sheets that refer to it would break); renaming a template renames its file, and the new name goes into the sets, derived templates and `template` column of the cards that use it. Files are renamed when you save. A deleted template goes to the project's `deleted` folder. The sheet of a deleted set also leaves the data file when you save and goes to `deleted` as a file of its own, so its name is free again. **Trash…**, in the **Project** menu, lists what is in `deleted` (templates, sets, notes and documents, newest first) and **Restore** puts an item back in the project: a set gets the template you choose (Stella proposes the one with most columns in common), a name already taken gets a number. Restored templates and sets leave the trash when you save. Sidebar items are reordered by dragging them; the + next to each heading creates a new item. The headings of **Styles** and **Variables** show how many items they hold: with more than six items the section starts closed, and Stella remembers for each project whether you opened or closed it. Until there are documents or notes, their sections show a **+ Document** and a **+ Note** button. Styles and variables can be split into groups with the **Group** field of their window: the items of a group sit under its heading, which closes and opens with a click, after the items without a group. An item dragged onto a group heading joins that group; dragged onto another item, it takes that item's group (or none). With more than 12 items, a field above the list filters them by name. In the window of a style or variable, **Where it is used** lists the templates (with their layers), the sets (with card numbers) and the other variables and styles that refer to it; clicking a template or set opens it. Hovering over an item shows a preview: the first cards of a set, the front and back of a template, a sentence in a style, the icon or color of a variable. The **Notes** section holds notes about the project: the + creates a note, a click opens it in a panel beside any screen, where you write in Markdown (**Preview** shows it formatted) and rename it from its title. A note already written opens in **Preview**, a new one ready for writing. Notes save themselves as you type, as `notes/<name>.md` files of the project; the bin moves them to `deleted`. An AI working on the project reads them with `stella notes`. The button at the top left collapses the sidebar to icons, and the arrows next to panel headings move panels to the other side of the window.

Changes stay in memory until you save. The **Save** button reads **Saved** when there is nothing to write.

In the desktop app the same commands are also in the app menu (on the Mac in the bar at the top of the screen, on Windows and Linux with the Alt key): **File** (open, save, export, backup, trash, Google Sheets, reload, close), **Edit**, **View** (interface size with ⌘+, ⌘− and ⌘0 / Ctrl+, Ctrl− and Ctrl+0, full screen) and **Help**.

## 4. Designing a template

### 4.1 Creating a template

The + next to **Templates** opens the new template window. At the top, **What are you making?** picks the kind of component: **Card**, **Token**, **Tile**, **Board**, **Die face** or **Standee**. The kind suggests suitable formats (20, 25 and 38 mm rounds for a token, squares and hexagons for a tile, 30 cm, A3 and A4 for a board) and changes the words of the app: in the set the button becomes **+ Token** or **+ Face**, and counts say "6 faces". For a die each row of the set is a face, and six faces in a row make a die. Then you write the name, the format and the size; the lock between width and height keeps the proportions.

The kind can be changed later with **Component** in the template properties. In the Tabletop Simulator export each set starts from the object of its kind: tokens, standees, tiles, boards or dice.

A **standee** is a figure that stands upright, for example a character drawn on a transparent background. The template starts with no background and no bleed, and in the editor a checkerboard shows under the figure. You do not draw the back: it is the front mirrored, and Stella makes it on its own. So the PDF has both faces to cut out and glue together, and they always match. They print with the usual rectangular crop marks around the frame, and you cut the silhouette by hand. In Tabletop Simulator the standee becomes an upright token, with the chosen thickness (10 mm unless you change it, so that the base keeps it upright), cut out along the non-transparent part of the front.

![The new template window](img/nuovo-template.png)

### 4.2 The editor

![The template editor, with numbered parts](img/editor.png)

1. **Tools** to add a layer, each with its name: **Text** (T), **Image**, **Shapes** (a menu with rectangle (R), ellipse (E), polygon, star and line), **Grid**, **Value** and **Snap** (a Tabletop Simulator snap point, P). **Image** opens the image picker right away; **No image for now** creates the layer empty, for example when the image comes from a column. An image dragged from the computer onto the canvas becomes an image layer and is copied into `assets/images`. **Front** and **Back** switch between the sides of the card; the arrows undo and redo.
2. **Layers**, top to bottom as they overlap on the card. Next to each layer are the source of its value (sheet column, or _fx_ for a formula), the lock and the eye to hide it.
3. **Canvas** with the card. The red dashed line is the trim edge, the area outside it is the bleed, the light blue dashed line is the safe area.
4. **Properties** of the selected layer, or of the template when nothing is selected.
5. **Canvas bar**: shows or hides bleed, safe area and grid, chooses what to snap to (grid, objects) and sets the zoom.
6. **Data**: draws the canvas with the values of a card from a set, instead of the template values.

On the canvas you move layers by dragging them, resize them with the handles and rotate them with the round handle at the top (Shift for 15° steps). Holding Shift while moving, the layer moves only horizontally, vertically or at 45°, whichever direction is closest. While resizing, Shift switches the proportion lock (keeps proportions when they are free, frees them when they are locked) and ⌘ / Ctrl resizes from the center; the two can be combined. While dragging, edges snap to the grid, to other layers and to guides; holding Alt drags freely. Alt+click selects the layer underneath the selected one at the same spot: useful when a larger layer covers others. A layer that is already selected, also when chosen this way or in the layer list, can be dragged even where another layer covers it; a click without dragging selects the one on top instead. The arrow keys move the layer by 0.5 mm, with Shift by 5 mm.

In the layer list you drag a layer to change its order, or onto the middle of a group to move it inside. Shift or ⌘ / Ctrl selects several layers; ⌘G / Ctrl+G groups them. With several layers selected the properties panel shows what they have in common (opacity, rotation, visibility, and the type's own properties when they are all of the same type, for example text color and size): a change applies to all of them. The fields show the values of the first selected layer.

Selected layers are copied with ⌘C / Ctrl+C (⌘X / Ctrl+X to cut them) and pasted with ⌘V / Ctrl+V into another template, of another project too, or into the same one. They arrive with all their properties, above the selected layer. If the template already has a layer with the same name, the pasted one gets a new name (for example `nome_2`) but keeps reading the same column. In the same template the copy is moved by 2 mm so it does not cover the original.

### 4.3 Template properties

With no layer selected, the panel shows the template properties: the kind of component, size, bleed (3 mm by default), safe margin, card shape (rectangle with rounded corners, circle or ellipse, hexagon, outline taken from an image), shape orientation, manual guides and **Component name**, the field shown under each card in the grid. **Shape orientation** turns or mirrors only the outline, not the content: ⟲ and ⟳ make a quarter turn and swap width and height (a hexagon with a flat top gets a point on top), **180°** turns the shape upside down (a shield taken from an image ends up point up), ⇆ and ⇅ mirror it. With a quarter turn the layers adjust as when you change the size. The hexagon is always regular, the largest that fits in the card: to fill it, the short side must be the long side × 0.866, and the **Fit the component to the hexagon** button changes the short side that way. In polygon and star shapes, **Make regular** turns the frame into a square around the same center, so all sides and angles are equal.

When you change the size of a template that already has layers, the app asks whether to scale the layers in proportion or leave them where they are. In the second case each layer follows its **constraints**: two menus in the position section, one horizontal and one vertical, that say what the layer stays attached to when the card changes size.

| constraint                                     | what it does when the card changes size                                                              |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Stay left** / **Stay at top**                | keeps the distance from the left or top edge                                                         |
| **Follow right edge** / **Follow bottom edge** | keeps the distance from the right or bottom edge: a footer stays at the bottom even on a taller card |
| **Stay centered**                              | keeps the distance from the center of the card                                                       |
| **Stretch with component**                     | keeps the distance from both edges, so it widens or narrows: a background or a full-width band       |
| **Scale**                                      | position and size change in proportion to the card                                                   |

Constraints are useful when the same design must fit two sizes, for example a poker card and a tarot card, or when you change the size after designing: set them once and the size change arranges the layers by itself.

### 4.4 Layer properties

The properties panel is split into sections. Each section shows the most used items and keeps the others under **Advanced**. Hovering an item shows an arrow that moves it to Advanced or back out; the layout applies to all projects.

At the top of the panel there is a search field (⌘F / Ctrl+F in the editor). Typing part of an item's name keeps only the items that contain it, with the title of their section: for example "cont" shows **Stroke** under **Typography**. If the text is in a section title, the whole section shows: "pos" shows all of **Position and size**. Items found under **Advanced** appear open; Esc clears the search.

In number fields you can drag the label right or left to change the value like a slider (Shift for bigger steps, Alt for finer ones); rotation and opacity also have a slider next to the box.

<table>
<tr>
<td width="33%"><img src="img/proprieta-testo.png" alt="Properties of a text layer, with Advanced open"></td>
<td width="33%"><img src="img/proprieta-immagine.png" alt="Properties of an image layer"></td>
<td width="33%"><img src="img/proprieta-forma.png" alt="Properties of a shape"></td>
</tr>
<tr>
<td>Text</td>
<td>Image</td>
<td>Shape</td>
</tr>
</table>

At the top of every layer are its **name**, which is also the name of the sheet column, and its **value on components**, with the **fx** button of the formula assistant next to the heading and three choices below across the whole panel:

- **Column**: the sheet column, by default the one with the same name as the layer. An empty cell keeps the value written in the template.
- **Fixed**: the same value on every card.
- **Formula**: the value is calculated from the other fields of the card ([chapter 9](#9-formulas-and-calculated-fields)).

The main properties by layer type:

- **Text**: content, style, font, weight, size, color, horizontal and vertical alignment, line height, fit (shrink to fit the box, cut off at the box, spill out). Under Advanced: spacing, indent, padding, case, underline, strikethrough, wrapping and letter outline.
- **Image**: file or variable name, fit (fill by cropping, fill letting the part outside the frame show, fit inside, stretch, original size, tile), alignment, zoom, rotation of the image inside its frame, shift, tint and crop. **Crop…** shows the whole image with a rectangle to move and resize: the layer uses only that part, and the file is not changed. The rectangle can keep the proportions of the layer's frame; × removes the crop. When the image name comes from a column, the crop is tried on the image of the card shown and applies to all cards. Under Advanced: flips, adjustments (grayscale, brightness, contrast, saturation), radius, outline and what to do when the image is missing.
- **Shape**: type, fill (none, color, or linear or radial gradient), stroke (solid, dashed, dotted) and corner radius. Polygons and stars have the number of sides or points; a line goes from point A to point B; the "from an image" shape takes the outline of a PNG with transparency or of an SVG.
- **Grid**: equal cells inside the layer's frame, for boards, tracks and maps ([4.8](#48-the-grid)).
- **Group**: holds other layers, which move, rotate and hide together. **Arrange children** puts them in a row, a column or a grid with a fixed gap, with no aligning by hand: three icons in a row keep the same distance even when one is hidden. **Repeat** draws the group a fixed number of times or as many as a field says: with `{strength}`, one sword for each point of strength. With the mask, the bottom layer of the group is the shape for the others: a portrait inside a circle is a group with an ellipse at the bottom and the image above it.

Every layer has position, size, rotation and, in the **Appearance** section, opacity, visibility, blend mode, fade, shadow and lock.

For text, **Fit** decides what happens when the text does not fit the box: **Shrink to fit** lowers the size down to the **Minimum size**, **Cut off at the box** hides what goes outside, **Spill out of the box** draws it beyond the edge. For rules text, shrinking is the usual choice, with a minimum size that is still readable; **Check texts…** ([5.3](#53-sorting-and-filtering)) finds the cards where even the minimum size is not enough.

In the **Appearance** section, **opacity** makes the layer transparent; the **blend** mode says how it combines with what is below (**Multiply** darkens a background with a texture, **Screen** lightens it); the **fade** blends the opacity from one side of the layer to the other, or from the center to the edges, to let a background image vanish towards the text; the **shadow** has a color, a blur and an offset, and a light shadow under a title lifts it from a pale background. **Locked** stops the layer from being selected and moved on the canvas, handy for the background.

### 4.5 Aligning and distributing

With two or more layers selected, the buttons at the top of the panel align them to each other, to the card or to the safe area, and distribute them with equal spacing. **Arrange in a grid** places them in rows and columns.

![Aligning two selected layers](img/allinea.png)

### 4.6 The back

**Back** in the editor bar shows the layers of the back, which work like those of the front: they can be the same for every card or take values from the sheet. For standees the back is the front mirrored: you can see it but not edit it. In the set grid, **Back** shows the back of every card.

![The backs of the cards in the grid](img/griglia-retro.png)

### 4.7 Derived templates

A derived template starts from another one, its base, and changes only some parts of it: for example `card-fire` is based on `card` and changes the background and the color of the band. Everything the derived template does not change follows the base, even when the base changes later.

The ↳ button next to a template, in the sidebar, creates a derived template, which opens in the editor identical to the base. The editor header shows which template it is based on, with a link to open it.

You work as on a normal template, with a few differences:

- In the properties panel, next to each value, the chain means it comes from the base; the arrow means the derived template changed it, and clicking the arrow goes back to the base value.
- In the layers panel, the chain marks the base layers, the arrow the ones with changes (a click reverts them to the base), the + the ones that exist only in the derived template.
- Base layers cannot be deleted (Delete hides them), moved in the list or renamed: their name is also the sheet column, the same as in the base. Added layers work as usual.
- The card size is the base's.

**Make independent**, in the header, turns the derived template into a normal one with the values it has at that moment. A template that is the base of another cannot be deleted until its derived templates are made independent or deleted.

### 4.8 The grid

The **grid** layer (the tool with the cells) draws equal cells inside its frame: for boards, score tracks, maps, tables to fill in by hand. Cells are square, round, hexagonal, triangular, diamond-shaped or take their shape from an image (the outline of its non-transparent part, with its proportions), in rows and columns with a gap between them. **Cell rotation** turns the shape of each cell around its center, for any shape: the cells stay in place and their content does not turn. **Interlocking** arranges hexagons as a honeycomb (point up or side up), triangles alternating up and down, diamonds and circles in the spaces between the others, and squares like bricks. Cells have a fill, an outline and a corner radius (not circles); the **grid background** fills the space behind and between the cells up to the **grid border**, which has its own outline. With **Automatic size** (under Advanced, on by default) the cell size comes from the frame: Advanced has the cell proportions, the zoom (100% is the largest grid that fits the frame without stretching the cells) and the position in the frame. Turned off, you type the cell size (width and height; one size for hexagons and triangles) and the grid takes the size that results: the layer width and height can no longer be changed by hand, and the top-left corner stays put when rows, columns or cells change. Advanced also has the padding between cells and border, the background corner radius and cutting what goes outside. The cell fill is the layer's value, so it can change from card to card; for other properties use columns such as `grid.rows`.

![A grid layer with interlocking hexagonal cells](img/griglia-livello.png)

**Insert content in all cells** opens a window with three choices: **Value** (a text that changes from cell to cell; the formula assistant opens), **Shape or image** (rectangle, ellipse, polygon, star, an image to choose or an image variable) or **Group** (a group you already have in the layer list). The content is a group that lives inside the grid: the layer list shows it under the grid, indented, labelled “content”, and it moves with the grid. Draw it in the first cell and the other cells get a copy moved to their place; a new layer added to the group takes the size of the cell. With **Centered on the cells** (on by default) the group stays at the center of the first cell even when the grid changes; turned off, it moves freely. **Cut at the cell edge** does not draw what goes outside each cell (also for the content of the rules); **Cut what goes outside the frame**, under Advanced, cuts at the frame of the whole grid instead. In the content box **Select** selects the group, **Change…** opens the window again and **Remove** puts the group back in the layer list, above the grid. Files made with earlier versions, where the group was in the list, open with the group already moved into the grid. Inside the group the fields `{cell.index}` (1, 2, 3… by rows), `{cell.row}`, `{cell.column}`, `{cell.count}` (number of cells), `{cell.rows}` and `{cell.columns}` (rows and columns of the grid) and `{cell.random}` (a number from 1 to 999999, fixed for each card and cell) change from cell to cell: a text with the formula `=IF(MOD({cell.index}; 10) = 0; "[" & {cell.index} & "]{color=red}"; {cell.index})` numbers a score track with multiples of 10 in red, an icon with `=PICK({cell.index}; {icons})` shows the icons of an `icons` column in sequence. To number the cells in another order, use the **Running number** card of the assistant (the first one with a cell content): choose ascending or descending, by row or by column, in sequence, snaking (1 2 3 4 / 8 7 6 5: each row starts again from the side closest to where the previous one ended) or along a path (the number always steps to the next uncounted cell, straight if it can, otherwise turning: it goes around a ring of border cells, spirals on a full grid or follows a road drawn by hiding cells), all cells or only the visible ones, and the starting number; it writes a formula with `CELLNUMBER` (section 9). To place items at random but a set number of times, use the **Deal at random, with quantities** card: for each item write how many times it appears, exactly (`4`), a range (`3-5`), a minimum (`2-`), a maximum (`-3`) or nothing (as many as needed to fill). A 4×4 grid with four icons, each 4 times: `=DEAL("sword"; 4; "shield"; 4; "hand"; 4; "helmet"; 4)`. Only the position changes, different for each component and the same at every export; hidden cells are left out. In the editor the group stays selectable where it is; on the cards it only shows in the cells.

**Cell rules**, below the content, changes the look of some cells without adding layers. Each rule has a condition (**When**) and what changes where the condition is true: **Change the fill**, **Change the outline**, **Change the corner radius**, **Hide the cell** (which also removes the content and the snap point of that cell) and, when the grid has a content, **Change “…”** for each layer of the content: the text of a text, the image of an image, the color of a shape. So “put the sword icon in cells 3, 8 and 11, the text xyz in 5, 6 and 13” is two rules, with no formulas in the content; the value can use `{fields}` and `{cell.index}`, or be a formula starting with `=`. **Choose the cells…** opens the grid drawn large: click the cells (or drag over several) and the condition becomes `=INLIST({cell.index}; "3, 8, 11")`. The rule remembers the cell numbers: if you change the rows or columns of the grid, check it again. You can also write the condition: it is a formula with the fields `{cell.index}`, `{cell.row}`, `{cell.column}`, `{cell.count}` and the component fields. `=MOD({cell.index}; 5) = 0` colors one cell in five, `={cell.row} = {row}` highlights the row written in the sheet, `=INLIST({cell.index}; "1, 2, 9-11")` applies to cells 1, 2, 9, 10 and 11. The condition also reads the content layers that have a formula, by their name: if the text `grid_text` numbers the cells with `CELLNUMBER`, `=MOD({grid_text}; 10) = 0` applies every ten written numbers and not every ten positions (the value is the one before the rules). The **fx** button opens the formula assistant, with the **Component & cell** tab, the **The cells I list**, **Every N cells** (with **counting**, to choose between the position in the grid and a content layer) and **Checkerboard** sentences and the result of the first cells; under the condition you read how many cells it applies to in the first component. Rules apply in order and a later rule wins; the arrows change the order. Each rule is a box that opens and closes with a click on its header; closed, it shows the colour it sets, whether it hides the cells, whether it has its own content and how many cells it applies to. **Custom content** gives the rule its own content, chosen with the same window: in the cells of the rule it takes the place of the content of all cells (for example a star instead of the number in the special cells of a track). In the layer list the rule group sits under the grid labelled “rule 1”, “rule 2”…, and in the editor you draw it in the first cell where the rule applies.

![A score track: the group of the first cell repeated in all of them, with multiples of 10 in red](img/griglia-caselle.png)

## 5. Entering and editing cards

### 5.1 Creating a set

The + next to **Sets** asks for the name, the template and the sheet: a new sheet, with the columns the template reads, or one that is already in the data file and not yet linked.

![The new set window](img/nuovo-set.png)

The sheet can also be one already used by another set: the two sets share the rows and each draws them with its own template, for example "Red troops" and "Yellow troops" from the same "Troops" sheet. A change to the data made in one of them applies to every set on the sheet. The new set needs a name different from the sheet. Renaming a set with a shared sheet does not rename the sheet, and deleting it leaves the sheet in the file while another set uses it.

### 5.2 Table and grid

A set opens in the **grid**, with the cards drawn; **Table** shows it as a spreadsheet.

The **table** shows the text of the cells as it looks on the card: bold, colors, icons and variables, with repeated icons (`{sword*strength}`) following the value of the row. The written text, with its markup, shows when you hover over the cell and while you edit it. Otherwise it works like a spreadsheet: double-click or type to edit a cell, Alt+Enter for a new line inside the cell, drag the row number to move a card. **+ Card**, **Duplicate** and **Delete** act on the selected rows (Shift or ⌘ / Ctrl to select more than one, in the grid too). With several cards selected the form on the right edits them in bulk: what you type in a field goes into all of them, while fields with different values stay empty and do not change until you touch them.

The **Copies** field (the `amount` column of the sheet) says how many copies of each card to print; empty means 1.

An image file dragged from the computer onto a cell of the table, or onto an image field of the form, is copied into `assets/images` and its name goes into the cell.

The short explanations of the set, the editor and the template properties are behind a small **?**: the mouse pointer on it shows the text.

A set with no components shows the **+ Add the first component** button instead of the table.

The table and the form show every column you can edit: the sheet's columns and the ones the template reads but the sheet does not have yet (with an italic heading), which are created when you type a value. The **Fields** button chooses which columns to hide; **Reset** goes back to the basic view, with only the columns read by layers linked to a column (columns left in the sheet without a layer, for example from an imported TTC project, are hidden) and the field details closed. In the card form the eye next to a layer's field shows or hides that layer on the card. The sliders icon opens the layer's properties for the card (color, italic, shape, position...), with menus for fixed sets of values, number fields and a color picker: a value typed there applies to that card only and creates the `layer.property` column, while an empty field shows the template value in grey. The number on the icon tells how many properties the card changes. The pin next to a property pins it: it stays under its field even with the properties closed and when you change card, until you unpin it with the same pin. Pinned properties belong to the set and are saved in the project. Columns of fixed or formula layers do not reach the card and stay hidden; **Show fixed and formula layers** adds them read only, with the ƒ sign and the value they have on each card.

True/false columns (properties such as `crest.visible` or `name.italic`, and columns where every cell is `true` or `false`) have a checkbox: a click, or the space bar on the cell, ticks or clears it. A faded checkbox means an empty cell: the template value applies.

The **grid** shows the cards as they will be printed. The slider at the top changes the thumbnail size (also with ⌘ / Ctrl and the mouse wheel); dragging a card moves it.

![The card grid](img/griglia.png)

To select several cards in the grid, drag on the empty space around the cards: the rectangle selects the cards it touches, and with Shift or ⌘ / Ctrl adds them to the ones already selected. ⌘A / Ctrl+A selects all the cards shown (with a filter, only the ones that pass it), Esc goes back to the card in the preview. Above the grid a bar shows how many cards are selected, with **Select all** and **Keep only one**. Dragging one of the selected cards moves all of them.

![Several cards selected in the grid](img/griglia-selezione.png)

In both views, on the right, the form of the selected card has a field for every column. Clicking a layer in the preview takes you to its field; Alt+click on the same spot moves to the layer underneath, useful when a layer covers another. Double-clicking edits the layer right on the card: a box over the layer for text, the thumbnails for an image, the color picker for a shape. Esc cancels the edit, clicking outside or Ctrl+Enter closes it. Double-clicking a fixed or formula layer tells where its value comes from, with a button to open the template. The ⤢ button at the top of the preview opens the card large in a window, with the card form next to it, the same clicks and arrows to move from card to card. Page Up and Page Down move to the previous or next card, even while typing in a field of the form, which stays the same.

### 5.3 Sorting and filtering

Clicking a column heading sorts the cards (ascending, then descending, then the sheet order); in the grid you pick the column from the menu. The **Filter…** field shows only the rows that contain some text, in all columns or in one.

Sorting and filtering change only the view: the sheet and the export stay as they are. **Apply this order** reorders the sheet as you see it; **Show all** clears sorting and filter.

![Cards sorted by strength and filtered](img/ordina-filtra.png)

The checks on the set are in the **Tools** menu of the button row, together with **Generate…** and **Split image…**.

**Statistics…** shows how many cards have each value of a column, also of a formula layer, with a bar to compare them: useful to balance the set (for example how many cards per cost). For numeric columns it also gives sum, average, minimum and maximum. Copies from the `amount` column count, unless you untick the box; with an active filter only the filtered cards count.

**Check text…** looks, on every card of the set, front and back, for texts that do not fit in their box: those that spill out, those cut off and those that do not fit even shrunk to the minimum size. The list gives card, side and layers; a click selects the card. In the grid, cards with text that does not fit have an orange mark next to their name.

**Compare…** marks the cards that are new or changed since the last export or a backup, so you can reprint only those. Pick the version, and in the sets the different cards get a blue dot; **Show only these** hides the others. While comparing, the **Export…** window offers **Changed components**. The comparison looks at what the cards show (data, template, and the variables and styles they use), not at the content of image and font files; a card that only moved does not count as changed, unless it shows its number. Every export made in the app remembers the exported cards in the project's hidden file `.stella-printed.json`.

### 5.4 Property columns

Besides the main value, every property of a layer can change card by card with a `layer.property` column: for example `name.color` for the title color, or `icon.tint` for the tint of an icon. **+ Field** suggests the columns the template reads and the sheet lacks, the properties of a layer of your choice, or a free column.

![The window to add a column](img/aggiungi-colonna.png)

In cells, colors are written as names (`red`, or the name of a color variable) or in hex (`#A33A2A`); a stroke as `color/width/dash`, for example `red/0.3/dashed`; a crop as `x y width height` in percent of the image, for example `10 0 50 50` (`none` for the whole image). In the card form the **Crop…** button next to the crop field writes these numbers for you.

The **Template** field, at the top of the card form, picks the template of a single card among those with the set's size: empty means the set's, and the choice goes into the sheet's `template` column. It is useful, for example, to give a few cards of a set a derived template. In the card form the field becomes a menu with the templates that have the same size as the set's.

### 5.5 Editing the file in Excel

The data file is an ordinary spreadsheet and can also be edited with Excel, LibreOffice or Numbers, even with the project open: when you save the file, Stella reads it again by itself. If Stella has unsaved changes to the data, a notice with **Reload** and **Ignore** appears instead. To edit the data only outside Stella, tick **read-only** next to the file name at the bottom of the sidebar and save: Stella no longer writes to the data file, changes to the data in the grid and in the card panel are refused and _read-only_ appears next to the card count. Templates, previews and exports work as usual. **Check data file…**, under the checkbox, shows how Stella reads each sheet: the sets that use it, the columns their templates read and the sheet lacks, and problems (titles above the headings, merged cells, Excel errors, formulas without a saved result, empty rows); it does not change the file. From the same window, **Import a sheet from another file…** puts the rows of a sheet of another file (.xlsx, .ods, .csv) in place of those of a set: first it shows the new, removed and changed rows (matched by a column with all different values, such as the name) and lets you keep the columns the file does not have; then it makes a backup of the project. The change can be undone with ⌘Z / Ctrl+Z. When saving, Stella rewrites only the columns that have a heading: cell formatting, other sheets and columns without a heading stay as they are. A cell with an Excel formula stays a formula as long as its result does not change. If you start from an Excel file you already have, with formulas and analysis sheets, read [Using an Excel file you already have](existing-excel.md).

### 5.6 Data from Google Sheets

If you keep the data in a Google sheet, **Google Sheets…**, in the **Project** menu, brings it into the project. In the Google sheet choose **Share** → **Anyone with the link** (viewer), copy the link and paste it; **Download** reads all the tabs. Each tab goes to the set with the same name (ignoring case); from the menu you can pick another one or **do not import** the tab. If a tab lacks some columns of the set, the window lists them: after the import those columns are gone. **Import** replaces the data of the chosen sets (⌘Z / Ctrl+Z undoes it) and **Save** writes them to the project's data file, which stays the local copy: Stella works without a network too.

The link stays in the project: next time just open the window and press **Download**. A sheet not shared by link cannot be downloaded, and Stella says so. An AI can do the same with `stella pull-sheets`.

### 5.7 Cards in several languages

A project can print the same cards in several languages. **Languages…**, in the **Project** menu, opens the languages window: the first one is the main language, the one the usual columns are written in. With **Add language** you type the language code (en for English, fr for French, de for German…). Below, **Translated names** gives the name of the project and of the sets in the other languages: `{project.name}` and `{set.name}` use it. With the box at the bottom ticked, **Save** adds the columns to translate to the sheets.

![The languages window](img/lingue.png)

The translation of a column goes in a column with the same name followed by @ and the language code: `name@en` next to `name`, `text@en` next to `text`. Columns with only numbers do not need one. An empty translated cell uses the text of the main language, so you can translate a little at a time.

The menu next to the project name, at the top, picks the language the cards are shown in: grid, preview, editor and documents change at once. Double-clicking the card edits the translated text, if the column exists.

![The cards shown in English, with the nome@en column in the card form](img/lingua-carte.png)

Only what is read on the card is translated. Image names, colours and formulas starting with `=` always use the values of the main language: a formula such as `=IF({type}="Attack"; ...)` works in every language without changing it. To have a different image in one language, add its translated column, for example `icon@en`.

Each language also has its own way of writing numbers, chosen in the **Languages** window with the **Numbers** menu on its row: for English, by default, 1,234.5. Cards in English write numbers this way even when the main language uses the decimal comma (see chapter 9).

Texts that do not come from the sheet are translated where you write them. A text layer whose **Value on components** is **Fixed** has, under its text, a field for each other language; the same goes for fixed value layers and, in their window, for text and value variables. A field left empty uses the text of the main language. If a formula with `=` must write a translated text, make it return a variable: `=IF({type}="Attack";"{attack}";"{defence}")` compares the main-language value and writes the `attack` variable in the language of the card.

A document always uses the main language, even when another language is chosen at the top. For an English rulebook write `language: en` at the top of the document, or choose it in **Page**, under **Component language**: the document's cards and variables will be in English. The **Languages** window says how many texts are left to translate in each language, and `stella check` lists them one by one.

In **Export…** choose the language, or **All languages**. The main language goes to the usual folder, the others to a subfolder named after their code, for example `export/en`; file names stay the same. An AI does the same with `stella render --lang en` and `stella export --profile NAME --lang all`.

## 6. Text and markup

Card text is written with a simple markup, the same in the app and in the sheet cells. No HTML is needed.

### 6.1 Markdown

| Write                    | You get                                           |
| ------------------------ | ------------------------------------------------- |
| `**text**`               | bold                                              |
| `*text*`                 | italic                                            |
| `++text++`               | underline                                         |
| `~~text~~`               | strikethrough                                     |
| `==text==`               | highlight                                         |
| `^text^` / `~text~`      | superscript / subscript                           |
| `# Title`, `## Subtitle` | paragraph with the `heading1` or `heading2` style |
| `> text`                 | paragraph with the `note` style                   |
| `- item` / `1. item`     | bulleted / numbered list                          |
| `---`                    | divider line                                      |
| `\` at the end of a line | line break without a new paragraph                |
| `_4{coin}_`              | never breaks across lines                         |

Every line break starts a new paragraph, as when you type in an Excel cell with Alt+Enter. To keep a piece of text on one line, so that `4` and its icon never end up on different lines, wrap it in underscores: `_4{coin}_`. It is the same as `[4{coin}]{nowrap}`. An underscore inside a word (`file_name`) stays as it is; write `\_` for a lone one.

### 6.2 Attributes

Square brackets mark the text and the braces that follow say how to format it: `[Warning]{color=red weight=800}`. Attributes are separated by spaces.

| Attribute                             | Example                                        | Effect                                         |
| ------------------------------------- | ---------------------------------------------- | ---------------------------------------------- |
| `.name`                               | `[pine]{.keyword}`                             | applies a style                                |
| `color=`, `highlight=`                | `{color=#A33A2A}`                              | text or highlight color                        |
| `size=`                               | `{size=14}` · `{size=+2}` · `{size=80%}`       | size in pt, relative or in percent             |
| `font=`, `weight=`                    | `{font=Open_Sans weight=800}`                  | family (with `_` instead of spaces) and weight |
| `stroke=`                             | `{stroke=white/8%}`                            | letter outline                                 |
| `upper`, `lower`, `smallcaps`         | `[Phase]{smallcaps}`                           | uppercase, lowercase, small caps               |
| `nowrap`                              | `[4 coins]{nowrap}`                            | the span never breaks across lines             |
| `left`, `center`, `right`, `justify`  | `{.flavor center}` at the start of a paragraph | paragraph alignment                            |
| `border=`, `fill=`, `radius=`, `pad=` | `[Quick]{border=red/0.3 radius=round}`         | box around the text                            |
| `bg=`, `bg-color=`, `bg-size=`        | `[3]{bg=circle bg-color=blue color=white}`     | shape or image behind the text                 |

The shapes `circle`, `square`, `rounded`, `hexagon` and `diamond` are always available for `bg=`. To move the text inside the box up or down without moving the box, use `text-raise=` in pt, also in a style: `.heart = bg=heart color=white text-raise=1` (`raise=` moves the whole box instead).

### 6.3 Fields, variables and icons

| Write                            | You get                                                           |
| -------------------------------- | ----------------------------------------------------------------- |
| `{strength}`                     | the value of the card's `strength` field                          |
| `{sword}`                        | the `sword` variable: an icon, a text, a color or a value         |
| `{sword*3}` · `{sword*strength}` | the icon repeated three times, or as many times as the field says |
| `{wood}`                         | an image from `assets/` with that name, as tall as the line       |
| `{sword tint=red size=150%}`     | the icon with attributes for this use only                        |
| `\{`, `\*`, `\[`                 | the literal character                                             |

Stella knows some values by itself, the **system variables**, written like fields, also in formulas: `{project.name}` (the game), `{set.name}`, `{template.name}`, `{card.number}` (the card's row in the set), `{set.rows}`, `{set.cards}` (cards with copies), `{card.copies}`, `{card.copy}` (the printed copy, for example to write `{card.copy}/{card.copies}`), `{card.side}` (`front` or `back`) and `{date}`. A footer like `{set.name} {card.number}/{set.rows}` numbers the cards by itself.

The **Help** button in the top bar and on the start screen, or the F1 key, opens a summary of markup, fields and variables, system variables, formulas and shortcuts. The first tab, **First steps**, sums up the four steps from an empty project to printed components, with a link to the guide section for each, the first videos and the words to know (component, template, set, layer, bleed...). It opens there when the project has no components yet; otherwise on the tab used last. Shortcuts appear in the form of the system in use: ⌘ on the Mac, Ctrl on Windows and Linux.

![The Help window, First steps tab](img/aiuto-primi-passi.png)

<table><tr>
<td width="50%"><img src="img/aiuto.png" alt="The Help window, Text tab"></td>
<td width="50%"><img src="img/aiuto-variabili.png" alt="System variables in the Help window"></td>
</tr></table>

### 6.4 Writing help

In the text fields of the editor and of the card form, and in table cells, typing `{` shows fields and variables, with a preview of the icon, text or color. ↑ and ↓ choose, Enter or Tab insert, Esc closes. Inside braces, attributes, styles and colors are suggested the same way.

Markup is colored as you type. Errors, such as a variable that does not exist, are underlined in red and listed under the preview in **Problems on this component**.

<table>
<tr>
<td width="50%"><img src="img/suggerimenti.png" alt="Suggestions while typing a variable"></td>
<td width="50%"><img src="img/errori-markup.png" alt="An unknown variable reported under the card"></td>
</tr>
</table>

### 6.5 Formatting without writing markup

The **Aa Format…** button under a text field opens the visual editor: select part of the text, choose the attributes, and the app writes `[text]{...}`. The resulting markup is shown at the bottom. **Save as style…** turns the formatting into a project style; **Remove formatting** removes the brackets. Next to **Background** a button opens the thumbnails: built-in shapes, image variables and project images.

![The formatting editor](img/formatta.png)

## 7. Variables and styles

### 7.1 Variables

Variables are created with the + next to **Variables** and edited with a click. There are four types:

- **Icon**: an image from `assets/` with tint, size relative to the line, vertical shift, rotation, flip and opacity. With **Color of the surrounding text** the icon takes the color of the text. **Background** puts a shape (circle, square, rounded, hexagon, diamond), an image or another image variable behind the image, with **Background color** and **Space around** (the space between the image and the edge of the background). The background applies wherever the variable is used: in texts, image layers, documents and table setups. For example a `water` variable with a drop icon, white tint and a red `circle` background shows the white drop in a red circle.
- **Text**: a text, formatted if you like, that replaces `{name}`. It can call other variables.
- **Color**: a named color, usable in every color property and in markup attributes. A variable named like a built-in color (for example `red`) redefines it in the whole project.
- **Value**: a text or a number, usable in texts and formulas (for example the maximum hand size).

<table>
<tr>
<td width="50%"><img src="img/variabile-icona.png" alt="An icon variable"></td>
<td width="50%"><img src="img/variabile-testo.png" alt="A text variable"></td>
</tr>
</table>

A sample sentence at the top of the window shows the result. Renaming a variable updates the references in templates, cells, other variables, styles and documents. A variable should not have the name of a layer or a column: `{name}` would show the field, not the variable. The window points it out while you type the name, and the card lists it among its problems.

### 7.2 Text styles

A style groups text attributes under a name: it applies to a paragraph (`{.name}` at the start of a line) or to a portion of text (`[text]{.name}`). Changing a style changes every card that uses it. A style can be based on another and inherit its attributes.

`heading1`, `heading2` and `note` exist in every project and match `#`, `##` and `>`; they can be redefined.

![The style editor](img/stile.png)

### 7.3 Choosing a color

The small square next to every color field opens the color picker: the large area chooses saturation and brightness, the two bars below it hue and transparency. The hex code goes in the field next to the preview; **RGB** and **HSL** switch the three number fields (the up and down arrows change them by 1, with Shift by 10). The eyedropper picks a color from anywhere on the screen, even another window. Below are the project colors: first the color variables, marked by a dot in the corner, which are written by name and show the variable's name when you hover over them; then the codes used in the project (templates, styles, variables and sheets), most used first, leaving out those equal to a variable. At the bottom, the last colors chosen, shared by all projects. Esc or a click outside closes the picker. **None** writes `none`, that is no color: a transparent fill or no outline.

![The color picker](img/colore.png)

## 8. Images, icons and fonts

### 8.1 Project images

Images live in `assets/`, subfolders included, as SVG, PNG, WebP or JPG. Wherever you name an image, the file name is enough, without folder or extension. If two files share a name (for example `sword.png` and `sword.svg`) the app says so and asks you to add the extension or the folder.

The image button next to the fields opens thumbnails of the assets, with search and a folder filter. **Add images…** copies files from the computer into the project's `assets/images` (a file with the same name is not overwritten: the copy gets a number). **Dark background** shows the thumbnails on a dark background, to see white icons; the choice is remembered.

![Choosing an image](img/scegli-immagine.png)

Single-color icons (black SVGs on a transparent background) are recolored with the layer's **Tint** property or with the variable's tint. The tint is laid over the image: a solid color recolors it completely, a semi-transparent one tints it only partly. For example black at 20% (`#00000033`) darkens a forest, and the image stays opaque.

### 8.2 Importing icons

**Import icons…**, in the image chooser and in the window of an icon variable, opens three collections included in the app, which work offline, and an online one:

- **game-icons.net**: about 4200 icons, with categories and search. License CC BY 3.0: authors must be credited (see credits, [chapter 11.6](#116-credits)). **Update catalog** downloads the icons published after this version of the app (needs the network, takes about a minute).
- **Kenney: icons and patterns**: board game icons and tileable patterns, CC0.
- **Kenney: cards, dice and pawns**: color PNG images, CC0.
- **Iconify (online)**: over 200 more collections (Material Design, Tabler, Phosphor, emoji...), searched on the internet. Type in the search box to search all of them, or choose a collection on the left to browse it.

You can pick several icons, also from different collections, and rename them before importing. Icons go to `assets/icons/` (color ones to `assets/images/`) and their origin to `assets/sources.json`.

![Importing icons](img/importa-icone.png)

Each Iconify collection has its own license, shown by a dot: green for free licenses, blue for those that require crediting the author, orange for those that are restrictive for a published game (share-alike, non-commercial, GPL). **Hide restrictive licenses** removes them from the list and the results. The license and author of the collection go into the credits like those of the other icons.

![Iconify collections](img/iconify.png)

### 8.3 Fonts

The **Aa** button next to the font field opens the font chooser, with three tabs:

- **In the project**: the fonts in `assets/fonts/` and Nunito, the font included in the app.
- **Google Fonts**: the Google Fonts catalog, with a category filter. Choose the styles and **Download** saves the files in `assets/fonts/`, with the license. Previews need the network; once downloaded, the font works offline. **Update catalog** downloads the latest list, with the fonts published after this version of the app.
- **On this computer**: installed fonts. **Copy to project** copies the files to `assets/fonts/`, if the license allows it; otherwise the project looks the same only where that font is installed.

<table>
<tr>
<td width="50%"><img src="img/font-progetto.png" alt="Project fonts"></td>
<td width="50%"><img src="img/font-computer.png" alt="Fonts installed on the computer"></td>
</tr>
</table>

A font that cannot be found is reported under the card and at the end of the export; meanwhile the text uses a default font. Instead of a font name you can write a text variable, for example `{titles}`: changing the variable changes the font of every layer that uses it.

## 9. Formulas and calculated fields

A layer with **Value on components: Formula** calculates its value from the other fields of the card.

- **Text composition**: `{name}.png`, `Strength {strength}`.
- **Calculation**: if the formula contains `+ - * /` and the result is a number, it is calculated: `{strength}+2`.
- **Expression**: with a leading `=` it works like Excel. Text in quotes, comparisons `= <> < > <= >=`, `&` to join text, arguments separated by `;` (or by `,` followed by a space). Functions: `IF`, `AND`, `OR`, `NOT`, `MIN`, `MAX`, `ABS`, `ROUND`, `FLOOR`, `CEILING`, `UPPER`, `LOWER`, `LEN`, `CONCAT`, `ISBLANK`, `COUNTIN`, `INLIST`, `MOD`, `PICK`, `CELLNUMBER`, `DEAL`.

The functions, with an example on the cards of this guide (Dragon, strength 4, cost `{gold}{gold}{wood}`):

| function                                           | what it does                                                                                                                | example                                                            |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `IF(condition; if true; if false)`                 | chooses between two values                                                                                                  | `=IF({strength}>3; "Strong"; "Weak")` → Strong                     |
| `AND`, `OR`, `NOT`                                 | combine conditions                                                                                                          | `=IF(AND({strength}>3; {cost}<>""); "yes"; "no")` → yes            |
| `MIN`, `MAX`                                       | the smallest or largest number                                                                                              | `=MAX({strength}; 3)` → 4                                          |
| `ABS`                                              | the number without its sign                                                                                                 | `=ABS({strength}-6)` → 2                                           |
| `ROUND(number; decimals)`, `FLOOR`, `CEILING`      | round                                                                                                                       | `=ROUND({strength}/3; 1)` → 1.3                                    |
| `UPPER`, `LOWER`                                   | capitals and lower case                                                                                                     | `=UPPER({name})` → DRAGON                                          |
| `LEN`                                              | how many characters the text has                                                                                            | `=LEN({name})` → 6                                                 |
| `CONCAT`                                           | joins texts (like `&`)                                                                                                      | `=CONCAT({name}; " "; {strength})` → Dragon 4                      |
| `ISBLANK`                                          | true if the value is empty                                                                                                  | `=IF(ISBLANK({note}); "-"; {note})` → -                            |
| `COUNTIN(text; wanted)`                            | how many times a text contains another                                                                                      | `=COUNTIN({cost}; "gold")` → 2                                     |
| `INLIST(value; list)`                              | true if the value is in the list; `1-5` stands for the numbers 1 to 5                                                       | `=INLIST({type}; "dragon, orc")` → true for an orc                 |
| `MOD(number; divisor)`                             | the remainder of a division                                                                                                 | `=MOD({cell.index}; 10)` → 0 on every tenth cell                   |
| `PICK(n; value1; value2; …)`                       | the n-th value, starting again after the last                                                                               | `=PICK({strength}; "sword"; "shield"; "hand")` → sword             |
| `CELLNUMBER(direction; order; path; cells; start)` | the running number of the cell: `"up"`/`"down"`, `"rows"`/`"columns"`, `"straight"`/`"snake"`/`"path"`, `"all"`/`"visible"` | `=CELLNUMBER("up"; "rows"; "snake"; "all"; 1)` → 1 2 3 4 / 8 7 6 5 |
| `DEAL(item; times; item; times; …)`                | deals the items at random in the visible cells, each as many times as you say: `4`, `3-5`, `2-`, `-3` or empty              | `=DEAL("sword"; 4; "shield"; "")` → 4 swords, the rest shields     |

The **Help** window (F1), **Formulas** tab, has the same table with the result computed on the cards of the open project.

**Numbers with a decimal comma.** By default Stella writes numbers with a point: `=ROUND(7/3; 2)` gives 2.33. For a comma, open **Project › Languages…** and, on the main language's row, choose **Numbers: 1.234,5**. From then on the numbers on the cards are written with a comma, both those from the sheet and the results of formulas, and in formulas you write `2,5`: this is why arguments are separated with `;`. The thousands separator appears only where the sheet cell has a format with thousands (in Excel, _Use 1000 separator_); formula results don't have one, so a year stays 2026. Calculated file names, colours and sizes do not change. Without the comma, `=MIN(2,5; 3)` gives the error _write 2.5 with a dot_: you write `2.5`.

In the example the `rank` layer shows "Hero" or "Follower" depending on strength. Below the formula is its result for the first card of the set.

![A formula on a text layer](img/formula.png)

The **Value** layer (# tool) is not drawn: it holds a card value to use in formulas and in the texts of other layers as `{name}`. In the example, the `points` layer of the market cards counts the resources with `COUNTIN` and the `points_text` layer shows it.

![A value layer with a formula](img/livello-valore.png)

A value layer can also provide a colour: in colour fields (fill, text colour, stroke, shadow, tint) write the layer's `{name}`, which the field's menu suggests. The calculated value can be a code such as `#A33A2A`, a colour name or a colour variable, for example `=IF({strength}>3; "red"; "blue")`. An empty value gives a transparent colour.

A field's value is, in order of precedence: the calculated value layer, the non-empty cell of the row, the value written in the template. Formula errors are shown under the card and in the properties panel.

### 9.1 The formula assistant

The **fx** button, next to the **Value on components** heading, opens the assistant. On a layer with **Column** or **Fixed**, confirming the formula switches the layer to **Formula**. It is also next to the **Filter** of the generator (section 10), where the formula must give true or false.

With an empty formula the assistant asks **What do you want to do?** and offers the common cases as cards: a different value depending on a condition, change something every N cells (or components), alternate two values, checkerboard, cycle through a list, pick at random, show only if a field is not empty, low/medium/high, calculate a number, join texts and fields and, on text layers, **Repeat an icon** (“Show the icon sword as many times as strength”, like `{sword*strength}` in a text). Next to the generator filter the cards are conditions (compare a field with a value, a field is not empty). **Write it myself** switches to the advanced mode.

![The start screen of the assistant](img/assistente-formule-inizio.png)

Once you pick a card, the formula appears as a sentence to complete, already filled with sensible values: for example **Every 10 cells, show "Yes" otherwise "No"**. Each blank is a button: the selected one has the picker below. For a text blank (**What to show**, **Otherwise**…) the picker shows the list to choose from first; when the blank holds a single field or a plain text, the text is summed up in a line **Text: {strength} · edit**. **edit** opens the text field, which opens by itself when the blank already holds a mixed text (like “Strength {strength}”) or a formatted one. You type in the field and the **Field**, **Component & cell** and **Variable** tabs insert the chosen value where the cursor is, as `{strength}` or `{cell.index}`; **Format…** gives colour, weight and the other attributes to the whole text, for example the cell number in red every six cells. **More…** shows the remaining tabs (**Number**, **Color**, **Formula** to nest a function…), which replace the content of the blank. Under the sentence the result on the first card and, inside a grid, the result of the first cells; **Show formula** opens the formula text, which you can also write by hand. When you open an existing formula that matches one of the sentences, the assistant shows it as that sentence.

![The formula assistant on the number of the score track](img/assistente-formule.png)

![The “show” blank: the text field and the tabs that insert fields and variables into it](img/assistente-formule-testo.png)

**Nested functions.** A blank can hold another function: the **Formula** tab of the picker offers **What do you want to put here?** at the top, with the same cases as the start screen (conditions in a condition blank, calculations in a number blank), and **All functions** below. The chosen case appears as a smaller sentence inside the sentence, in a dashed box with the name of the blank at the top: for example "If strength is greater than 3 show [Every 10 cells, show… otherwise…] otherwise…". Clicking the name of the box selects it to change or empty it. A condition with **If** has **+ and also** and **+ or**, which add a comparison (`AND`, `OR`): "If strength is at least 3 and cost is less than 2"; the **×** next to a comparison removes it. If a blank holds a function that has no sentence (for example `UPPER`), the formula opens in **Advanced**.

![A nested formula: two comparisons joined by "and also" and a sentence inside the "show" blank](img/assistente-formule-annidata.png)

**Advanced** shows the formula as nested blocks: each function has its boxes with a name (for `IF`: **Condition**, **If true**, **If false**) and under each box the value it gives on the first card; **Formula** in the picker groups the functions by category (**Condition**, **Selection**, **Math**, **Text**, **Recipes**) and **Several cases** shows a chain of `IF` as a list of **When… Then…** rows with **Otherwise** at the end. Nested functions that are already complete fold into one line with their formula and the result below; a click opens them again. **⤢** next to the name of a nested function opens it on its own, with the path at the top (for example **Formula › If true**) to go back. **Guided** goes back to the sentence while the formula still has that shape; **Start over** returns to **What do you want to do?**. **Use formula** writes the formula in the field; a formula opened and not changed stays as it was.

![Advanced: the nested function opened on its own, with the path at the top](img/assistente-formule-avanzato.png)

On a **grid** layer the formula applies to the whole grid (for example the cell colour of a card): to change the colour, outline or visibility of some cells use the **cell rules**, to change texts and drawings cell by cell the formula goes on a layer of the **cell content** (section 4.8). That is why, on a grid without content, the **Cell content** section has **Insert content in all cells**: **Value** creates a text in the first cell, inside a group of the grid, and opens the assistant right away. The same window opens from the start screen of the assistant with **Vary cell by cell**.

![The buttons that create the cell content](img/griglia-contenuto-crea.png)

## 10. Generating cards

**Generate…**, in the set's **Tools** menu, creates rows by combining sets of values. Each value set has a target column, a list of values (one per line or comma separated; `1-5` becomes 1, 2, 3, 4, 5) and how many values to put on each card. The column is chosen from a list with the template's and the sheet's columns; **Other column…** lets you type a new one.

- Several value sets are combined in every possible way: 6 suits and the numbers 1-5 give 30 cards.
- With more than one value per card you choose whether repetitions are allowed and whether order matters. Under **Limits per value** you set a minimum and maximum for each value.
- **As icon** writes each value as `{value}`, so the text shows the icon with that name.
- **Filter** keeps only the cards for which an expression is true, for example `COUNTIN({cost}; "gold") <= 1`.

The preview shows how many cards will be created and the first rows. **Add at the end** appends the cards, **Replace the cards** takes the place of the existing ones. **Update the components** writes only the generated columns into the existing cards, one per row, leaving the other columns as they are: for example, first generate 30 cards from 6 suits and the numbers 1-5, then use **From a folder…** to assign 30 portraits to the portrait column. If more cards are generated, the extra ones are added at the end. ⌘Z / Ctrl+Z undoes.

![The generator: three resources, two per card, with repetition](img/genera.png)

**Random.** At the top of the window, **How** switches from **Every combination** to **Random**: instead of every combination you get as many components as you want (**How many**), with values drawn at random. A value set can fill several columns with **+ Column**, and each column gets one value drawn (or more, with **Values per column**): for example the numbers `1-4` on text1, text2, text3 and text4 give each card four random numbers from 1 to 4.

- **With repetition** on is like rolling a die for each column; off is like dealing cards from a deck: the same value never comes back in any column of the set.
- **Limits per value** counts across all the set's columns: with 4 from 1 to 3, every card has at least one 4 and at most three.
- **Filter** works as before: the cards it rejects are drawn again. **All different** rejects cards already drawn. If the filter or **All different** leave fewer cards than requested, the preview says so.
- **Seed** is the number the draw starts from: the same seed gives the same cards, **Shuffle** picks another one.

![The random generator: the numbers 1-4 on four columns, 4 from one to three times](img/genera-caso.png)

### 10.1 Splitting an image across cards

**Split image…** spreads one big image across the cards of the set: placed side by side in a grid, the cards make it up again (a map, an illustration over several cards). You choose the image layer of the template, the image, how many columns and rows, the card to start from and the order: by rows (left to right, then the row below) or by columns. Missing cards are added.

Each card shows the part of the image under its layer, as if the image covered the whole grid of trimmed cards. Stella writes in the card's columns the image (`layer.src`), the crop (`layer.crop`) and the **Stretch** fit; it removes the tint, so a template icon does not turn into a silhouette. The bleed of inner cards shows the image of the neighbouring cards. For cards on the edge there are two options: if the image also includes the bleed around the whole grid (tick the box), it is used; otherwise the layer stops at the edge of the image and the outer bleed shows what is underneath. The right proportions of the image are columns × card width by rows × card height (plus the bleed, if included): if the image differs, the window says so, because the pieces would be slightly stretched. Image layers that are not rotated and not inside groups can be split.

## 11. Exporting

**Export…** (⌘E / Ctrl+E) opens a window that starts from what you want to do: **Print at home** (a PDF with the components side by side, front and back), **Print shop** (a PDF with bleed and crop marks), **Tabletop Simulator** or **Images**. Below you choose the sets (the number next to the name says how many rows they have) and whether to repeat cards as the `amount` column says. Cards are drawn by the same engine as the preview, including unsaved changes.

The window has the options on the left and the preview on the right. The options come in three levels:

- **The choices that matter**: the few that really change the result, as buttons with a picture (for example duplex, crop marks, where to save for Tabletop Simulator).
- **Closed sections**: the rest of the options. The title of each section sums up the values inside, so you can check them without opening it; a section you open stays open next time.
- **The sentence above Export**: says what will happen, for example "22 components in 3 sets → 6 A4 pages, one PDF in export", with the details below (sheets to print, crop marks, .json files).

An option that does not apply with the other choices stays visible but disabled, with the reason written next to it (for example spacing with bleed, or the back offset without duplex).

The preview on the right is the real one: it shows the first page, image or sheet the export will write, and you browse with ‹ ›. Only the page shown is drawn, so even a large project stays fast; while the page is getting ready it says **Please wait…** and you can keep changing the options. **Enlarge** opens the large preview (see [11.3](#113-preview)).

When the export is done, the number of files written, any warnings and the links to open the file (if there are few) or the folder appear below the sentence.

**Repeating the last export.** The **Export…** button at the top has a ▾ next to it with **Repeat the last export** (⇧⌘E / Ctrl+Shift+E): it exports again with the last options used, without opening the window. Progress, with **Stop**, and then the result appear in a notice at the bottom right, with the link to the folder. The same menu lists the project profiles, which open the window already set up.

### 11.1 Images

PNG, JPG, WebP or SVG format, resolution (150, 300, 600 DPI or custom), bleed included or not, front, back or both, transparent background outside rounded corners. File names follow a pattern with `%set`, `%n` (card number), `%copy`, `%side` and `{field}`; a `/` creates subfolders.

SVG is vector and has no resolution: it scales without losing quality and opens in graphics programs (Inkscape, Illustrator, Affinity). Project images and fonts are inside the file; fonts installed on the computer are not, and whoever opens the file needs them. Texts become SVG text, one element per line, so they can be edited but no longer wrap by themselves.

![Exporting images](img/esporta-immagini.png)

### 11.2 Print PDF

The PDF is vector, with embedded fonts. The choices that matter are the paper (page size and orientation), bleed (print shop only), duplex and crop marks; with **Backs on separate pages** you also choose which sides to print. The **Layout**, **Cutting and corners** and **Pages and files** sections hold the rest: margins, spacing and layout (as many cards as fit, or columns × rows), and the options below.

- **Bleed**: with bleed the cards touch and crop marks are outside.
- **Rotation**: rotates cards when they would not fit otherwise or more of them fit.
- **Poster**: splits cards larger than the page over several pages, with an overlap.
- **Fold**: front and back side by side, to fold.
- **Crop marks**: at the corners or as full lines, with length, width and color.
- **Duplex**: backs on alternate pages, flipping on the long or short edge, with an offset for printers that do not align the two sides. To find the right offset, print a single page first, hold the sheet against the light to measure how far the back is shifted from the front, and type that value in **Back offset**; then print everything. The **Proof sheet** lets you check all the cards small before using up paper.
- **Pages**: with **One after another on the same page** a set starts right after the previous one instead of on a new page (10 + 8 cards with 9 per page fit on 2 pages instead of 3). A set with cards of another size starts on a new row, if there is room on the page.
- **Proof sheet**: a separate PDF with every card small.
- **Convert to CMYK**: needs Ghostscript installed on the computer.

![Exporting a PDF](img/esporta-pdf.png)

### 11.3 Preview

The preview next to the options shows, small, the files the export will write, without writing anything: images with their file names, PDF pages, Tabletop Simulator sheets. **Enlarge** opens it large, on the same page; browse with ‹ › or the arrow keys.

![Preview of the PDF pages](img/esporta-anteprima.png)

### 11.4 Tabletop Simulator

For each set it creates the card sheets (up to 10 × 7, with the grid chosen automatically to reduce empty slots) and the deck file to load in Tabletop Simulator. **Save to** chooses whether files go to the project folder, to Tabletop Simulator's saved objects folder, or both (the default). In the **Name and description** section, card nickname and description can come from a field; by default they are empty.

With **Copies** on, **Copies on the sheet** decides where a card's copies go: once on the sheet, with the deck file multiplying it (the default, which keeps sheets small), or repeated on the sheet as many times as `amount` says. The second is for loading the sheets into Tabletop Simulator by hand, without the deck file: each slot of the sheet is one card.

The table of sets chooses, for each set, what to create in Tabletop Simulator, in the **Object in TTS** column (the menu shows each type's icon):

- **Cards**: the deck from the sheets, as above.
- **Tokens**: one image per card, cut out along the card shape (rectangle, rounded corners, circle, hexagon or silhouette). Tabletop Simulator turns it into a thick piece whose edge takes the image color; underneath it shows the front mirrored, so the card back is not used.
- **Standees**: like tokens, but standing upright on the table. Only the front is uploaded; the transparent part stays outside the silhouette.
- **Tiles**: front and back of the card. The shape (square, rounded, hexagonal or round) comes from the card shape; a silhouette becomes a square. **Edge** is the color of the thickness.
- **Boards**: like tiles (front, back, edge and thickness), but they do not stack and do not go into a bag: each board, copies included, lands on the table next to the others. They always have rounded corners.
- **Dice (6 faces)**: every six cards of the set make one die, in sheet order: the first card goes on face 1, the second on face 2 and so on; opposite faces add up to 7 (1-6, 2-5, 3-4). If the cards are not a multiple of six, the last die repeats its first faces and the export warns about it. The die's copies are those (`amount`) of its first card. The value Tabletop Simulator shows when you roll it is the field chosen in **Name** for the card, or the face number. Use a square template: the die face is square, as wide as the card, and a rectangular card gets squashed. Stella also writes the cube model (`models/<set>_d6.obj`) next to the images.

Tokens, standees and tiles have a **Thickness**. The pieces of a set go into a bag, copies included; a set with a single piece becomes that piece. Cards, tokens, standees and tiles reach Tabletop Simulator in their true proportions: a 63 mm card has Tabletop Simulator's default size, and everything else is larger or smaller in proportion. Landscape cards, such as a board as wide as two cards, are placed sideways.

**Tags and snap points.** In the template properties, under **Component**, **TTS tags** gives every component its Tabletop Simulator tags, separated by commas. `{fields}` are allowed, for example `{type}, card`, and a deck takes the tags of all its cards. Two sets with the same template can have different tags: in the table of sets, next to each set, the **TTS tags** field starts with the template's tags and, if you change it, gives the set the tags written there instead of the template's. A **snap point** is a spot on a board (or on a tile, token or card) where objects snap when dropped close to it. There are two ways to add one:

- the **Snap** tool (P) adds a layer that is only a snap point: a blue crosshair in the editor, invisible in prints and images, with the point at the centre of its box;
- every other layer has, at the bottom of its properties, the **Tabletop Simulator** section with **Snap point**: the point goes at the centre of the layer. For a grid the option is **Snap point in each cell**, handy for the spaces of a board. A snap point on a layer of the **cell content** repeats in every cell, moved like the content.

In both cases **Snap tags** makes the point attract only objects with one of those tags (empty: all of them), and **Rotated** also gives the object a rotation: the layer's own by default, or a chosen **Snap angle**. On the canvas the crosshair has a small arrow showing where the top side of the object goes. Snap points come from the front. The **Snap** button at the bottom of the canvas hides the crosshairs without removing the snap points from the export; the eye in the layers panel instead turns the layer off, and its snap point with it.

Sheets are referenced by local addresses, so the deck works on the computer that exported it. To play online, upload the images to a web service and change the addresses in Tabletop Simulator.

![Exporting for Tabletop Simulator](img/esporta-tts.png)

### 11.5 Profiles and presets

Print shops and home printing are already in the choices: **Print shop** and **Print at home** start from their options (A4, or Letter with the app in English), and for images **For** chooses between general use, MakePlayingCards and The Game Crafter. Before ordering, check the specifications on the printer's website, which may change.

The **Profile ▾** menu at the bottom stores the current options as a named project profile, to use again later: **Save as new profile…**, **Save in** to update the chosen profile, **Delete**. Picking a profile from the menu brings back its export type and options.

### 11.6 Credits

**Credits…** composes the text for the rulebook or the box, with the icons and fonts imported from the app grouped by source, license and author. By default it lists only what the cards use. The text can be copied or saved to `export/credits.txt`. Images copied into `assets/` by hand are not listed.

![Credits of the icons used](img/crediti.png)

## 12. Documents

The **Documents** section of the sidebar holds the texts that go with the game: the rules, a sell sheet, an appendix, a FAQ. The + creates a document, a click opens it in place of the open set or template. You write on the left; on the right the preview shows the page as you type and follows the cursor, and a click on a point of the preview moves the cursor to that point of the text. Drag the border between text and preview to give more room to either; at the top right of the preview − and + change the zoom (also ⌘ / Ctrl with the scroll wheel) and the percentage goes back to the whole page. The name changes from the title; the ⋯ next to the title, and a right click on the document in the sidebar, have **Rename**, **Duplicate** (a copy whose name ends with a number) and **Delete**, which moves the document to `deleted`. Documents save themselves as you type, as `docs/<name>.md` files in the project, so another editor or an AI agent can write them too.

![A document with the page preview beside it](img/documento.png)

### 12.1 Writing and formatting

Above the text is the formatting bar: the **Text** menu turns the line into a first, second or third level heading, or back into a paragraph; **B**, _I_, U and S add or remove bold, italic, underline and strikethrough on the selected text (with no selection they leave the cursor between the two marks); the next three buttons turn the chosen lines into a bulleted list, a numbered list or a quote, and a second click removes them; **%%** (or ⌘/ / Ctrl+/) turns the selected text into a comment. **Style** applies a style of the project to the selected text and ends with **Aa Format…**, the advanced formatting of [chapter 6](#6-text-and-markup). The last buttons insert an image of the assets, a table, a card, an anatomy or a table setup. The bar writes in the text the markup you would write by hand, and ⌘Z / Ctrl+Z undoes it.

The text is Markdown, with Stella's markup from [chapter 6](#6-text-and-markup) inside the lines:

| Write                                        | You get                                                          |
| -------------------------------------------- | ---------------------------------------------------------------- |
| `# Title`, `## Title`, `### Title`           | headings on three levels                                         |
| an empty line                                | a new paragraph; a single line break stays in the same paragraph |
| `- item`, `1. item`                          | lists; an item with two spaces in front goes one level down      |
| `> text`                                     | a box for a note                                                 |
| `\| a \| b \|` with `\|---\|---\|` below     | a table; `:--`, `:-:` and `--:` align the column                 |
| `---`                                        | a line                                                           |
| `%%note%%`                                   | a comment: it stays in the file but is not shown or exported     |
| `{sword}`, `[text]{.keyword}`                | icons, variables and styles, as on the cards                     |
| `{project.name}`, `{date}`                   | the project name and today's date                                |
| `![The wizard](card:Characters/name=Wizard)` | a card of the game, with the caption "The wizard"                |
| `![](icons/map.png)`                         | an image from assets                                             |
| `![](icons/map.png?width=40&align=right)`    | an image 40 mm wide, on the right                                |

### 12.2 Cards and images

Cards are not copied into the document: Stella draws them from the project, so a change to the data or the template shows in the document at once. **Insert component** opens a window where you choose the set and the card (search by name), the side, the width in millimetres (empty for the real size) and the caption, and writes the reference at the cursor. By hand you write `card:Set/3` for the card on row 3, or `card:Set/column=value` for the card with that value in a column; after a `?` add `side=back` for the back and `width=40` for the width, joined by `&`, as in `card:Characters/name=Wizard?side=back&width=40`. A column value, like the name, is safer than the number, which changes when the rows are reordered. Several images on the same line of text sit side by side.

References follow renames. If you change the name of a set, of a column, or the value that identifies a card (for example the name `BARRACKS` becomes `BARRACKS2`), Stella updates the cards called in the documents by itself: in images, tables, table setups and anatomies. A bar at the top says how many references changed. A card's value is followed only if no other card in the set still has the old one. In the same way a layer renamed in the template changes in the anatomy labels, and a renamed variable or style changes in the text of the documents. Notes are left as they are.

![The Insert component window](img/inserisci-carta.png)

**Image** opens a window where you choose the file from the assets (with a preview), the width in millimetres (empty for the image's own size, reduced if it does not fit the page), the alignment (left, center, right) and the caption. With the cursor on an image already written, the same button opens it for editing. In the text the options go after a `?`, as for cards: `![Map](icons/map.png?width=40&align=right)`. Cards accept `align=left` or `align=right` too. The alignment applies to the whole line: with several images side by side, the first one that sets it counts.

### 12.3 Tables and boxes

**Table** opens a grid to fill in: the first row is the heading, each column has its own alignment, **+ Row** and **+ Column** make it bigger and × removes a row or a column. You can paste cells copied from Excel or another spreadsheet. With the cursor inside a table already written, the same button opens it for editing. In the text the table becomes Markdown with aligned columns.

Cells take the same markup as the text (styles, icons, variables) and also images and cards: click a cell, then use the bar above the grid for bold, italic, styles and **Format…**, **Image** for an image from the assets and **Insert component** for a card of the project; in the text they are written as `![](icons/sword.svg?width=8)` and `![](card:Characters/1?width=20)`. Under the grid, **Look** sets the table width (as % of the text, 0 for as wide as the content), the width of each column (the % field above it), which lines to draw (all, between rows only, outline only, none) with their color and thickness, and the backgrounds of the heading, of the rows and of every other row. The look is written in a comment under the table, `<!-- table width=90% columns=25,55,20 lines=rows header=#dde6f5 -->`, which other Markdown programs do not show. The HTML, PDF and Word exports keep it; the Markdown export keeps text and images only.

![The table window, with the look at the bottom](img/doc-tabella.png)

**Box** puts a colored background behind a part of the document: to make a piece of text stand out, or to set white images without a border apart from the page. With some lines selected it puts them in the box; with no selection it inserts a new box with sample text. You choose the background, a border (color and thickness), the inner space and rounded corners; with the cursor inside a box the same button changes it or removes it (**Remove box** keeps what is inside). In the text a box is two lines, `<!-- box fill=#fff3c4 border=#e0b000 -->` at the start and `<!-- /box -->` at the end: everything between them (headings, lists, tables, cards) gets the background. The HTML, PDF and Word exports keep it, the Markdown export does not.

### 12.4 Card anatomy

**Anatomy** draws a component with labels that explain its parts, joined by a line to the layers of the template. The window has two columns: on the left you choose the card as in **Insert component**, on the right you see the anatomy as it will look in the document, and below it you tick the layers to explain and write a label for each. Above the labels a small bar applies bold, italic, underline, strikethrough or a project style to the selected text of the label you are writing in. Each label goes on the side of the card nearest to its layer; card and labels shrink to fit the page. With the cursor inside an anatomy, the same button opens it for editing. In the text the anatomy is a block like this, which you can also write by hand:

![The card anatomy window](img/anatomia.png)

````
```anatomy
card: Characters/name=Wizard?width=50
- name: Name of the character
- strength: Strength, added to the die roll {sword}
- text (left): **Ability**: once per turn
```
````

`card:` is the card, written as in card references (also with `side=back` and `width`). Each `- layer: label` line explains a layer; `(left)` or `(right)` after the name chooses the side. With **Front and back** in the window (the `sides: both` line in the text) the two faces stand side by side, with the front labels on the left and the back labels on the right; back layers are written with `(back)`, for example `- logo (back): The game logo`. Labels can use markup. A layer the template does not have is reported under the text and by `stella check`.

**Width (% of line)** and **Captions (%)**, below the card choice (the `width: 60%` and `font: 90%` lines in the text), make the anatomy take at most that share of the line width and change the size of the labels relative to the base size. When the anatomy gets narrower the labels shrink first, then the card, unless it has a width written with `width=`.

### 12.5 Table setup

**Table setup** draws how to set up the table, with the real cards of the project. In the window the buttons **Zone**, **Component**, **Deck**, **Text**, **Arrow** and **Image** add an element; cards and decks are chosen as in **Insert component**, images from assets. The drawing takes almost the whole window; **Full screen** gives it the whole app window. Zoom with − and +, with ⌘/Ctrl + mouse wheel, by pinching the trackpad or with ⌘+ and ⌘− / Ctrl++ and Ctrl+−; **Fit** (⌘0 / Ctrl+0) shows the whole drawing again. When zoomed in, move the drawing with the scroll bars, the wheel, or by dragging while holding the space bar. Click an element to select it and drag it to move it, or use the arrow keys (1 mm, 5 with Shift); Shift or ⌘/Ctrl + click adds an element to the selection or removes it, a box dragged on an empty spot selects the elements it touches and ⌘A / Ctrl+A selects them all. ⌘C, ⌘X and ⌘V / Ctrl+C, Ctrl+X and Ctrl+V copy, cut and paste the selected elements, also into another table setup (pasted elements appear 5 mm lower and to the right), and ⌘D / Ctrl+D duplicates them. With several elements selected, dragging one moves them all, and the panel on the right aligns them (sides, centers) and distributes them with equal gaps horizontally or vertically; the handle at the bottom right resizes zones, texts and images, the handles at the two ends move the ends of an arrow. Cards, decks and images have a round handle above them that rotates them around their center (with Shift in 15° steps); in the panel on the right **Rotation** takes the exact degrees and **+90°** turns by a quarter. On the right you change position and sizes in millimetres, the label (or the text, with the same formatting bar as the anatomy), the number of cards in a deck and the rotation in steps of 90°; **Order** brings the element to the front, forward, backward or to the back among the elements of the same kind: zones always stay below cards, decks and images, and texts and arrows above. **Duplicate** and **Delete** do what they say. **Image** and **Change image…** also offer the image variables, which in the drawing keep their tint, rotation, flip, opacity and background. With nothing selected, **Fixed table size** gives the drawing a size in millimetres; without it, the drawing fits its elements. In the document the drawing shrinks to fit the page, and the labels stay readable; **Width (% of line)** narrows it further, down to that share of the line width, and **Captions (%)** changes the size of the captions. With the cursor inside a table setup, the same button opens it for editing. In the text it is a block like this, which you can also write by hand:

![The table setup window](img/schema-tavolo.png)

````
```setup
size 300x230
zone 0,0 300x112 "Player 1"
deck Characters/1?side=back 10,10 count=6 "Characters"
card Characters/name=Wizard 165,10 rotate=90 "The wizard"
text 165,85 width=80 "In the middle: **{hand}** face-up cards"
arrow 260,40 -> 290,40 "draw"
image icons/coin.png 270,75 width=12
```
````

Each line is an element, with sizes in millimetres from the top left corner: `zone x,y WxH "label"`, `card <card> x,y`, `deck <card> x,y count=N`, `text x,y width=W "text"`, `arrow x,y -> x2,y2 "label"`, `image <file> x,y width=W`. Cards, decks and images take `rotate=` with the degrees, clockwise (for example `rotate=90` or `rotate=30`), and cards and decks and a label in quotes; the card is written as in card references, with `%20` for spaces. `size WxH` fixes the size of the table, `width 60%` makes the drawing take at most 60% of the line and `font 90%` gives the captions 90% of the base size. Instead of an image file you can write an image variable, such as `image {coin} 270,75 width=12`. Texts and labels can use markup. Lines that are not understood and cards that are not found are reported under the text and by `stella check`.

### 12.6 Properties and page

**Properties**, above the bar, holds notes about the document, like Obsidian properties: title, author, version, tags or anything else. Each property has a name (letters, digits, `-` and `_`) and a value; a list, marked with ≡, has its items separated by commas. **+ Add property** adds one, × removes it. Properties are written at the top of the file between two `---` lines, in YAML, together with the page settings, and a document written with Obsidian or another Markdown editor keeps them. They are not printed: with **Show in the document** they appear as a table at the top of the page, in the exports too.

**Page** opens the document settings on the right: page size (A4, A5, Letter), margins, text and heading fonts, text size, line spacing, space after paragraphs, alignment (left or justified), and text and heading colors. The preview shows the page at its real width, scaled down if it does not fit. The settings are written at the top of the file, between two `---` lines, such as `size: 12` or `lineHeight: 1.6`: you can change them there too, and **Reset to default** removes them.

### 12.7 Exporting a document

**Export document…** saves the document in the project's `export/docs/` in four forms: **PDF**, to print or send, with the page size and margins of the document (desktop app only); **HTML**, one web page in a single file, with cards, images and fonts inside; **Word**, a `.docx` file to edit in Word or LibreOffice, with headings, lists, tables and quotes as Word styles, the page size, margins and fonts of the document, and cards, diagrams and images as PNG; **Markdown**, plain text for other programs, with the cards as 300 dpi PNG files and the images in a folder beside it (`<name> images`). Markdown keeps bold, italic and strikethrough; other styles are lost. Cards and images that are not found are left out, and the window reminds you when the document has problems. When the export is done, **Open file** opens the file with its default program and **Open folder** the folder that holds it. In the web version **Open file** shows PDF, HTML and Markdown in a new browser tab; for Word it is not shown, since the file is already in the project folder.

Below the text the problems are listed: cards that are not found, images not in assets, unknown names in braces; a click goes to that point of the text. `stella check` reports them with those of the cards, `stella docs` shows the documents to an AI agent and `stella export-doc` exports them without opening the app (see [cli.md](../cli.md)).

### 12.8 Find and replace

⌘F / Ctrl+F, with the cursor in the document text, opens the find bar above the text. Enter goes to the next match, ⇧Enter / Shift+Enter to the previous one, and next to it you can read which one you are looking at (for example "3 of 12"). **Match case** tells upper and lower case apart; **Whole word** finds whole words only, so "use" does not find "user". ⌥⌘F / Ctrl+H, or the arrow on the left of the bar, also shows the replace field: **Replace** changes the selected match and moves to the next, **Replace all** changes them all. ⌘Z / Ctrl+Z undoes the replacement in one step; Esc closes the bar.

**Find and replace…**, in the **Project** menu (⇧⌘F / Ctrl+Shift+F), searches the whole project: documents, notes, sheet cells, template texts, values and formulas, and text and value variables. Results are grouped by kind, with the place where they are (for example "Buildings, card 3, name" or "building › title (text)") and the text around them; a click on the place opens it. Each result has a checkbox: **Replace in N places** changes only the checked ones, and **All** and **None** check or uncheck them all. Before replacing Stella makes a backup named "Before replacing …", which you find in **Project › Backup**. Documents and notes are saved at once; changes to data, templates and variables are saved with ⌘S / Ctrl+S and ⌘Z / Ctrl+Z undoes them. The names of sets, templates, layers, columns and variables do not change: use **Rename** for those, which also updates the references.

## 13. Backup

**Backup…**, in the **Project** menu, opens the project's backups. By default the app makes an automatic backup when the project opens (at most once an hour) and keeps the last 10; those made with **Back up now** are never deleted automatically. In the field next to the button you can give the backup a name, to remember what it holds (for example "before the new rules"); clicking the name in the list changes it, for automatic backups too, which are then no longer deleted.

Backups are kept outside the project, by default in `Documents/Stella/Backup`. Images are stored once for all backups of the project, so one more backup takes little space. **Restore…** extracts the backup into a new folder next to the project and opens it: the current project is not touched.

![The backup window](img/backup.png)

## 14. Importing from Tabletop Creator

**Import from Tabletop Creator…** converts a Tabletop Creator project into a new Stella project: templates, sets, variables and images. The original folder is only read.

You choose the Tabletop Creator project folder (the one with the `.tcp` file and the `data` folder), the folder of the new project, which must be new or empty, and optionally a folder in which to look for library icons. Icons from game-icons.net and Kenney are taken from the app's catalogs.

![Importing from Tabletop Creator](img/importa-ttc.png)

At the end the app lists what it could not convert, for example image masks and 9-slice images, and the fonts used that are not installed.

## 15. Working with an AI agent

An AI agent that runs commands on your computer (for example Claude Code, Codex or Cursor) can read and change Stella projects, look for problems and draw the cards to check them. It needs the Stella **skill**, a text of instructions.

**AI tools…**, in the ⚙ menu of every screen (and in the **Help** menu of the desktop app), shows the skill with this computer's `stella` command already filled in:

1. **Copy the skill**.
2. Paste it into the agent and ask it to install it as a skill (or as project instructions, if it has no skills). Alternatively **Save as file…** writes it into a skills folder; Claude Code reads them from `.claude/skills` in your home folder or in a project.
3. Ask the agent what you need, naming the project folder.

![The tools for AI agents](img/strumenti-ia.png)

The project can stay open in Stella while the agent works. Before changing it, the agent asks the app with `stella begin`: if there are unsaved changes it stops and asks you to save; otherwise Stella shows that an AI is working and cannot be used until the agent has finished (`stella end`), then reloads the project by itself. If the agent stops without unlocking the app, **Unlock now** frees it. With a skill copied before version 1.2.0-beta.3 the agent cannot do this: copy it again.

The `stella` command can also be used directly, for example in a script. The main commands:

| command                                                        | what it does                                                                                                           |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `info <project>`                                               | sets, templates and layers, variables, styles, assets, export profiles                                                 |
| `check <project> [--set S] [--lang L]`                         | the problems of cards and documents (missing images or fonts, unknown variables, formula errors, missing translations) |
| `check-data <project>`                                         | how the data file is read, like **Check data file…**                                                                   |
| `rows <project> <set>`, `set-rows <project> <set> <file>`      | read and write the rows of a set (with a backup first)                                                                 |
| `stats <project> <set>`                                        | how many cards have each value, like **Statistics…**                                                                   |
| `render <project> [--set S] [--card 1,3,5-7] [--lang L]`       | draws the cards as PNG                                                                                                 |
| `export <project> --profile NAME [--lang L\|all]`              | runs a saved export profile                                                                                            |
| `export-doc <project> [<name>] [--format pdf\|html\|docx\|md]` | exports the documents                                                                                                  |
| `notes`, `docs`                                                | read the project's notes and documents                                                                                 |
| `rename-set`, `rename-template`, `pull-sheets`, `new`          | rename, download from Google Sheets, create a project                                                                  |
| `begin`, `end`                                                 | open and close an agent's work on the project                                                                          |

All the details, the options and how to launch the command on each system are in [docs/cli.md](../cli.md) (in Italian).

## 16. The web version

Stella also runs in the browser, with nothing to install, at <https://stella.lucadj.eu/app/> (the beta version in `/beta/`). It is for places where a program cannot be installed, for example work computers that block unsigned programs. It works on the project folders of your computer: the projects are the same files as the app's, and you can open them with one or the other.

It needs Chrome, Edge or Opera (Brave only after turning on `brave://flags/#file-system-access-api`); Firefox and Safari lack the folder access it needs. In every session the browser asks for permission on the project folder when you open it.

What differs from the desktop app (the list is also at the bottom of the start screen, under **What the desktop app adds**):

- the PDF goes through the browser's print window, where you choose **Save as PDF** (margins none, background graphics on); there is no CMYK conversion;
- for Tabletop Simulator you choose the destination folder with **Choose…** and, the first time, paste its full path in the field below, because the browser does not tell it and the deck file needs it;
- backups without a chosen folder stay in the browser, and are lost when the site data is cleared: choosing a folder is safer;
- Google fonts come with the Latin alphabet only; the computer's fonts can be copied only in Chrome and Edge, after permission;
- the icon and font catalogs are those of the published version and do not update;
- there is no `stella` command and no update check (the site is always at the latest version), and the interface size is set with the browser zoom.

## 17. Project files

```
Example/
  stella.json            name, data file, sets, styles, variables, export profiles
  data/cards.xlsx       one sheet per set (or .ods, or .csv for a single set)
  templates/<name>.json one file per template
  docs/<name>.md        documents: rules, sell sheet, appendices
  notes/<name>.md       project notes
  assets/               images and icons, subfolders included
  assets/fonts/         project fonts
  assets/sources.json   origin and license of imported icons and fonts
  export/               exported files, can be regenerated
  deleted/              deleted templates and sheets of deleted sets, which can be recovered
```

A project is self-contained: copying the folder to another computer gives the same result, except for fonts installed only on the first one. The format is described in [docs/format.md](../format.md).

## 18. Keyboard shortcuts

Every shortcut is written first with the Mac ⌘ key and then, after the slash, with Ctrl for Windows and Linux.

| Where        | Keys                                             | Action                                                                                        |
| ------------ | ------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| anywhere     | ⌘S / Ctrl+S                                      | save templates, data and settings                                                             |
| anywhere     | ⌘O / Ctrl+O, ⌘W / Ctrl+W                         | open and close the project (desktop app)                                                      |
| set          | ⌘Z / Ctrl+Z, ⇧⌘Z / Ctrl+Shift+Z                  | undo and redo data changes                                                                    |
| anywhere     | ⌘+, ⌘−, ⌘0 / Ctrl+, Ctrl−, Ctrl+0                | enlarge, shrink and reset the interface (desktop app)                                         |
| set          | ⌘A / Ctrl+A, Esc                                 | select all cards, go back to one                                                              |
| table        | Alt+Enter                                        | new line inside a cell                                                                        |
| text         | `{`, then ↑ ↓, Enter                             | field and variable suggestions                                                                |
| editor       | ⌘Z / Ctrl+Z, ⇧⌘Z / Ctrl+Shift+Z (or ⌘Y / Ctrl+Y) | undo and redo                                                                                 |
| editor       | T, R, E, I, G, V                                 | new text, rectangle, ellipse, image, grid, value                                              |
| editor       | ⌘F / Ctrl+F                                      | search the properties panel                                                                   |
| editor       | ⌘D / Ctrl+D                                      | duplicate the selected layers                                                                 |
| editor       | ⌘C / Ctrl+C, ⌘X / Ctrl+X, ⌘V / Ctrl+V            | copy, cut and paste layers                                                                    |
| editor       | ⌘G / Ctrl+G, ⇧⌘G / Ctrl+Shift+G                  | group and ungroup                                                                             |
| editor       | ⌘A / Ctrl+A                                      | select all layers                                                                             |
| editor       | Delete                                           | delete the selected layers                                                                    |
| editor       | arrows, ⇧ + arrows                               | move by 0.5 mm or 5 mm                                                                        |
| editor       | Esc                                              | clear the selection or leave the group                                                        |
| canvas       | Shift while dragging                             | move only horizontally, vertically or at 45°; switch the proportion lock; rotate in 15° steps |
| canvas       | ⌘ / Ctrl while resizing                          | resize from the center                                                                        |
| canvas       | Alt while dragging                               | move without snapping                                                                         |
| canvas, grid | ⌘ / Ctrl + mouse wheel                           | zoom                                                                                          |
| set          | PgUp, PgDn                                       | previous or next card, even while typing in the form                                          |
| card         | double click, Ctrl+Enter, Esc                    | edit a layer on the card, close the edit, cancel it                                           |
| card, editor | Alt+click                                        | selects the layer underneath                                                                  |
