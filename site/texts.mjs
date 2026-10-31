// Testi del sito in italiano e inglese. Le chiavi sono le stesse del template.
export const texts = {
  it: {
    lang: 'it',
    otherLang: 'en',
    otherLangLabel: 'English',
    otherLangHref: '../',
    root: '../',
    img: '../img/it/',
    title: 'Stella Game Center – carte, plance e regolamenti per i tuoi prototipi',
    description:
      'Stella è un programma libero per Mac, Windows e Linux che disegna carte, plance, segnalini, dadi e gli altri componenti di un gioco a partire da un foglio di calcolo.',
    nav: {
      download: 'Scarica',
      web: 'Prova nel browser',
      tutorial: 'Tutorial',
      guide: 'Guida',
      news: 'Novità',
      discord: 'Discord'
    },
    hero: {
      claim: 'Carte, plance, segnalini e dadi del tuo gioco, da un foglio di calcolo',
      text: 'Disegni il template una volta, scrivi i dati in un foglio di calcolo e Stella disegna tutti i componenti: anteprime, PDF per la stampa, mazzi, segnalini, tessere, plance e dadi pronti da caricare in Tabletop Simulator, e il regolamento con le carte vere dentro. Software libero, per Mac, Windows e Linux.',
      download: 'Scarica per',
      downloadGeneric: 'Scarica',
      version: 'versione stabile',
      web: 'Prova nel browser',
      shot: 'La finestra del progetto di Stella con le carte di un set',
      loading: 'cerco l’ultima versione…',
      install: 'Come si installa'
    },
    features: {
      title: 'Cosa fa',
      items: [
        [
          'Template a livelli',
          'Testi, immagini, forme, icone e griglie; ogni livello può prendere il suo valore da una colonna del foglio o da una formula.'
        ],
        [
          'Dati in Excel',
          'Ogni set di carte è un foglio: una riga per carta. Modifichi dall’app o da Excel, Numbers e Google Sheets, e le carte si aggiornano.'
        ],
        [
          'Testo con markup',
          'Grassetto, colori, icone e variabili dentro il testo delle carte, con stili condivisi e traduzioni in più lingue.'
        ],
        [
          'Stampa e Tabletop Simulator',
          'PDF da stampare con crocini e fronte-retro, oppure immagini singole. Per Tabletop Simulator Stella crea direttamente gli oggetti del gioco: mazzi, segnalini, tessere, plance e dadi a sei facce compaiono già pronti in Saved Objects, da mettere sul tavolo con un clic.'
        ],
        [
          'Regolamento con le carte',
          'I documenti in Markdown mostrano le carte vere, l’anatomia della carta e lo schema del tavolo, e si esportano in PDF, Word e HTML.'
        ],
        [
          'Importa da Tabletop Creator',
          'I progetti di Tabletop Creator si aprono e si convertono, con template, dati e immagini.'
        ]
      ]
    },
    local: {
      title: 'I tuoi dati restano sul tuo computer',
      intro:
        'Un progetto di Stella è una normale cartella sul tuo computer: il foglio di calcolo con i dati, i template, le immagini e i documenti. Niente account, niente cloud, niente abbonamenti.',
      items: [
        [
          'Nessun dato inviato',
          'Stella non manda i tuoi progetti da nessuna parte e non raccoglie statistiche su come la usi. Il tuo gioco resta tuo, anche prima di annunciarlo.'
        ],
        [
          'File aperti, sempre leggibili',
          'Fogli Excel, immagini e testi in Markdown: si aprono con altri programmi anche senza Stella, oggi e tra dieci anni.'
        ],
        [
          'La cartella va dove vuoi',
          'Su una chiavetta, in Dropbox o Google Drive per lavorare da più computer, in un repository git per tenere la storia delle modifiche.'
        ]
      ],
      note: 'Stella si collega a internet solo per controllare gli aggiornamenti, per scaricare font e icone quando li scegli tu e per leggere un foglio Google se ne colleghi uno.'
    },
    shots: {
      title: 'Uno sguardo',
      items: [
        ['editor.png', 'L’editor del template: livelli, tela e proprietà'],
        ['documento.png', 'Un regolamento con le carte vere e l’anteprima della pagina'],
        ['griglia-caselle.png', 'Una plancia con il livello griglia']
      ]
    },
    download: {
      title: 'Scarica',
      intro:
        'L’ultima versione stabile è la {version}. Stella non è firmata con un certificato Apple o Microsoft: alla prima apertura macOS e Windows chiedono conferma.',
      mac: 'Mac',
      macArm: 'Chip Apple (M1 e successivi)',
      macIntel: 'Processore Intel',
      macNote:
        'Apri il .dmg e trascina Stella in Applicazioni. Al primo avvio: Impostazioni di Sistema → Privacy e sicurezza → Apri comunque.',
      win: 'Windows',
      winSetup: 'Installer',
      winPortable: 'Versione portable (non si installa)',
      winNote:
        'Se SmartScreen mostra «Windows ha protetto il PC»: Ulteriori informazioni → Esegui comunque.',
      linux: 'Linux',
      linuxAppImage: 'AppImage',
      linuxDeb: 'Pacchetto .deb (Debian, Ubuntu)',
      linuxNote: 'L’AppImage va reso eseguibile (chmod +x) e richiede libfuse2.',
      install: 'Come si installa e come si supera l’avviso di macOS e Windows, passo per passo',
      all: 'Tutte le versioni su GitHub',
      beta: 'Le versioni beta si attivano dall’app, in ⚙ Aggiornamenti.',
      support: 'Stella è gratuita: se ti è utile, puoi offrirmi un caffè con PayPal.',
      failed: 'Non riesco a leggere l’ultima versione: scaricala dalla pagina delle release.'
    },
    web: {
      title: 'Provare Stella nel browser',
      text: 'La versione web serve a provare Stella senza installare nulla, o a usarla sui computer dove non si può installare: funziona in Chrome, Edge o Opera e lavora sugli stessi progetti del tuo computer.',
      limits:
        'Ha però dei limiti rispetto all’app: il PDF passa dalla finestra di stampa del browser e non c’è la conversione in CMYK, l’esportazione per Tabletop Simulator chiede qualche passaggio in più, i font di Google hanno solo l’alfabeto latino, mancano il comando stella e gli aggiornamenti dei cataloghi di icone e font. Per usare al meglio tutte le funzioni ti consiglio la versione desktop.',
      download: 'Scarica la versione desktop',
      open: 'Apri la versione web',
      beta: 'versione beta',
      more: 'Cosa manca rispetto all’app',
      moreHref:
        'https://github.com/lucadj77/stella/blob/main/docs/guida/README.md#16-la-versione-web'
    },
    tutorial: {
      title: 'Tutorial',
      text: 'Video brevi per imparare subito a usare Stella Game Center, e approfondimenti su un argomento alla volta.',
      soon: 'I primi video arrivano a breve.',
      playlist: 'Tutti i video nella playlist di YouTube',
      news: 'Escono di continuo nuovi tutorial: iscriviti al canale YouTube per sapere ogni volta che ne pubblico uno.',
      subscribe: 'Iscriviti al canale',
      // i gruppi della sezione, nell'ordine in cui compaiono
      groups: {
        start: ['Inizia qui', 'Il percorso consigliato per cominciare.'],
        components: ['Componenti', 'Carte, plance, segnalini, tessere e dadi.'],
        text: ['Testo e formule', 'Cosa c’è scritto sulle carte e come cambia da una all’altra.'],
        data: ['Dati e lingue', 'Il foglio di calcolo e i giochi in più lingue.'],
        table: ['Dal file al tavolo', 'Stampa, Tabletop Simulator e regolamento.'],
        tools: ['Strumenti', 'Per lavorare meglio e senza perdere niente.'],
        deep: [
          'Approfondimenti',
          'Un argomento alla volta, con tutte le opzioni e un progetto da scaricare per seguire passo passo.'
        ]
      },
      project: 'Scarica il progetto del video {n}',
      watch: 'Guarda su YouTube'
    },
    guide: {
      title: 'Guida e novità',
      guideTitle: 'Guida utente',
      guideText:
        'Tutte le funzioni, capitolo per capitolo, con gli screenshot. Si legge su GitHub.',
      guideLink: 'Apri la guida (italiano)',
      guideLinkEn: 'User guide (English)',
      newsTitle: 'Novità',
      newsText: 'Cosa cambia a ogni versione, in italiano e inglese.',
      newsLink: 'Leggi il changelog',
      cliTitle: 'Per chi lavora con un agente IA',
      cliText: 'Il comando stella e una skill lasciano a un agente la modifica di template e dati.',
      cliLink: 'Leggi docs/cli.md',
      cliHref: 'https://github.com/lucadj77/stella/blob/main/docs/cli.md',
      discordTitle: 'Domande e aiuto',
      discordText:
        'Sul server Discord, in italiano e in inglese, si chiede aiuto, si propongono idee e si mostrano i propri prototipi.',
      discordLink: 'Entra nel server Discord'
    },
    contact: {
      title: 'Scrivimi',
      pageTitle: 'Scrivimi – Stella Game Center',
      intro:
        'Domande, problemi, idee per Stella o il racconto del gioco che stai creando: scrivimi qui e ti rispondo all’indirizzo che indichi.',
      name: 'Nome',
      email: 'La tua email',
      subject: 'Oggetto',
      subjectHint: 'facoltativo',
      message: 'Messaggio',
      send: 'Invia',
      sending: 'Invio in corso…',
      ok: 'Grazie, il messaggio è partito. Ti rispondo appena posso.',
      error:
        'Il messaggio non è partito. Riprova tra poco, oppure apri una segnalazione su GitHub.',
      inactive: 'Il modulo non è ancora attivo.',
      privacy:
        'Il modulo invia solo quello che scrivi qui (nome, email, oggetto e messaggio), tramite il servizio Web3Forms, e solo a me. L’email mi serve per risponderti: non la uso per altro e non la passo a nessuno. Il resto del sito e il programma non raccolgono dati personali.',
      issues: 'Per segnalare un errore puoi anche aprire una segnalazione su GitHub.',
      back: 'Torna al sito'
    },
    footer: {
      license: 'Stella è software libero, licenza GNU GPL 3 o successive. Il gioco che crei è tuo.',
      source: 'Codice sorgente su GitHub',
      discord: 'Discord',
      support: 'Offrimi un caffè',
      contact: 'Scrivimi',
      by: 'Un progetto di Luca Di Gialleonardo · Predigarama Games'
    }
  },
  en: {
    lang: 'en',
    otherLang: 'it',
    otherLangLabel: 'Italiano',
    otherLangHref: 'it/',
    root: './',
    img: 'img/en/',
    title: 'Stella Game Center – cards, boards and rulebooks for your prototypes',
    description:
      'Stella is a free program for Mac, Windows and Linux that draws cards, boards, tokens, dice and the other components of a game from a spreadsheet.',
    nav: {
      download: 'Download',
      web: 'Try in the browser',
      tutorial: 'Tutorials',
      guide: 'Guide',
      news: 'What’s new',
      discord: 'Discord'
    },
    hero: {
      claim: 'Your game’s cards, boards, tokens and dice, from a spreadsheet',
      text: 'Draw the template once, write the data in a spreadsheet and Stella draws every component: previews, PDFs for printing, decks, tokens, tiles, boards and dice ready to load into Tabletop Simulator, and the rulebook with the real cards inside. Free software, for Mac, Windows and Linux.',
      download: 'Download for',
      downloadGeneric: 'Download',
      version: 'stable version',
      web: 'Try in the browser',
      shot: 'The Stella project window with the cards of a set',
      loading: 'looking for the latest version…',
      install: 'How to install'
    },
    features: {
      title: 'What it does',
      items: [
        [
          'Layered templates',
          'Text, images, shapes, icons and grids; every layer can take its value from a sheet column or a formula.'
        ],
        [
          'Data in Excel',
          'Each card set is a sheet: one row per card. Edit in the app or in Excel, Numbers and Google Sheets, and the cards follow.'
        ],
        [
          'Text with markup',
          'Bold, colours, icons and variables inside the card text, with shared styles and translations in several languages.'
        ],
        [
          'Print and Tabletop Simulator',
          'Print-ready PDFs with crop marks and duplex, or single images. For Tabletop Simulator, Stella creates the game objects directly: decks, tokens, tiles, boards and six-sided dice show up ready-made in Saved Objects, one click away from the table.'
        ],
        [
          'Rulebook with the cards',
          'Markdown documents show the real cards, the card anatomy and the table setup, and export to PDF, Word and HTML.'
        ],
        [
          'Import from Tabletop Creator',
          'Tabletop Creator projects open and convert, with templates, data and images.'
        ]
      ]
    },
    local: {
      title: 'Your data stays on your computer',
      intro:
        'A Stella project is an ordinary folder on your computer: the spreadsheet with the data, the templates, the images and the documents. No account, no cloud, no subscription.',
      items: [
        [
          'Nothing is sent',
          'Stella does not send your projects anywhere and does not collect statistics on how you use it. Your game stays yours, even before you announce it.'
        ],
        [
          'Open files, always readable',
          'Excel sheets, images and Markdown text: they open in other programs even without Stella, today and ten years from now.'
        ],
        [
          'The folder goes where you want',
          'On a USB stick, in Dropbox or Google Drive to work from several computers, in a git repository to keep the history of your changes.'
        ]
      ],
      note: 'Stella goes online only to check for updates, to download fonts and icons when you pick them, and to read a Google sheet if you link one.'
    },
    shots: {
      title: 'A look',
      items: [
        ['editor.png', 'The template editor: layers, canvas and properties'],
        ['documento.png', 'A rulebook with the real cards and the page preview'],
        ['griglia-caselle.png', 'A board with the grid layer']
      ]
    },
    download: {
      title: 'Download',
      intro:
        'The latest stable version is {version}. Stella is not signed with an Apple or Microsoft certificate: macOS and Windows ask for confirmation the first time.',
      mac: 'Mac',
      macArm: 'Apple silicon (M1 and later)',
      macIntel: 'Intel processor',
      macNote:
        'Open the .dmg and drag Stella to Applications. On first launch: System Settings → Privacy & Security → Open Anyway.',
      win: 'Windows',
      winSetup: 'Installer',
      winPortable: 'Portable version (no install)',
      winNote: 'If SmartScreen says “Windows protected your PC”: More info → Run anyway.',
      linux: 'Linux',
      linuxAppImage: 'AppImage',
      linuxDeb: '.deb package (Debian, Ubuntu)',
      linuxNote: 'Make the AppImage executable (chmod +x); it needs libfuse2.',
      install: 'How to install and get past the macOS and Windows warning, step by step',
      all: 'All versions on GitHub',
      beta: 'Beta versions are enabled in the app, under ⚙ Updates.',
      support: 'Stella is free: if you find it useful, you can buy me a coffee with PayPal.',
      failed: 'The latest version could not be read: download it from the releases page.'
    },
    web: {
      title: 'Try Stella in the browser',
      text: 'The web version lets you try Stella without installing anything, or use it on computers where nothing can be installed: it runs in Chrome, Edge or Opera and works on the same projects on your computer.',
      limits:
        'It does have limits compared with the app: PDFs go through the browser print dialog with no CMYK conversion, the Tabletop Simulator export needs a few extra steps, Google fonts come with the Latin alphabet only, and there is no stella command and no catalog updates for icons and fonts. To get the most out of every feature, I recommend the desktop version.',
      download: 'Download the desktop version',
      open: 'Open the web version',
      beta: 'beta version',
      more: 'What the desktop app adds',
      moreHref:
        'https://github.com/lucadj77/stella/blob/main/docs/guide/README.md#16-the-web-version'
    },
    tutorial: {
      title: 'Tutorials',
      text: 'Short videos to start using Stella Game Center right away, and deep dives on one topic at a time.',
      soon: 'The first videos are coming soon.',
      playlist: 'All the videos in the YouTube playlist',
      news: 'New tutorials come out all the time: subscribe to the YouTube channel to hear about each new one.',
      subscribe: 'Subscribe to the channel',
      groups: {
        start: ['Start here', 'The suggested path to get started.'],
        components: ['Components', 'Cards, boards, tokens, tiles and dice.'],
        text: [
          'Text and formulas',
          'What is written on the cards and how it changes from one to the next.'
        ],
        data: ['Data and languages', 'The spreadsheet and games in several languages.'],
        table: ['From file to table', 'Printing, Tabletop Simulator and the rulebook.'],
        tools: ['Tools', 'To work better and never lose anything.'],
        deep: [
          'Deep dives',
          'One topic at a time, with every option and a project to download and follow along.'
        ]
      },
      project: 'Download the project of video {n}',
      watch: 'Watch on YouTube'
    },
    guide: {
      title: 'Guide and news',
      guideTitle: 'User guide',
      guideText: 'Every feature, chapter by chapter, with screenshots. It is read on GitHub.',
      guideLink: 'Open the guide (English)',
      guideLinkEn: 'Guida utente (italiano)',
      newsTitle: 'What’s new',
      newsText: 'What changes in each version, in English and Italian.',
      newsLink: 'Read the changelog',
      cliTitle: 'Working with an AI agent',
      cliText: 'The stella command and a skill let an agent edit templates and data.',
      cliLink: 'Read docs/cli.en.md',
      cliHref: 'https://github.com/lucadj77/stella/blob/main/docs/cli.en.md',
      discordTitle: 'Questions and help',
      discordText:
        'On the Discord server, in English and Italian, you can ask for help, suggest ideas and show your prototypes.',
      discordLink: 'Join the Discord server'
    },
    contact: {
      title: 'Contact me',
      pageTitle: 'Contact – Stella Game Center',
      intro:
        'Questions, problems, ideas for Stella, or the story of the game you are making: write here and I will reply to the address you give.',
      name: 'Name',
      email: 'Your email',
      subject: 'Subject',
      subjectHint: 'optional',
      message: 'Message',
      send: 'Send',
      sending: 'Sending…',
      ok: 'Thank you, your message is on its way. I will reply as soon as I can.',
      error: 'The message was not sent. Try again in a moment, or open an issue on GitHub.',
      inactive: 'The form is not active yet.',
      privacy:
        'The form sends only what you write here (name, email, subject and message), through the Web3Forms service, and only to me. I need your email to reply: I do not use it for anything else and I do not pass it on. The rest of the site and the program collect no personal data.',
      issues: 'To report a bug you can also open an issue on GitHub.',
      back: 'Back to the site'
    },
    footer: {
      license: 'Stella is free software, GNU GPL 3 or later. The game you make is yours.',
      source: 'Source code on GitHub',
      discord: 'Discord',
      support: 'Buy me a coffee',
      contact: 'Contact me',
      by: 'A project by Luca Di Gialleonardo · Predigarama Games'
    }
  }
}

// I video dei tutorial: numero su YouTube, titolo e riga di presentazione per lingua, indirizzo YouTube
// (vuoto finché non è caricato)
export const videos = [
  {
    n: 1,
    it: 'Panoramica delle funzioni di base',
    en: 'An overview of the basic functions',
    about: {
      it: 'Cosa fa Stella, in quattro minuti: template, set, esportazione.',
      en: 'What Stella does, in four minutes: templates, sets, export.'
    },
    minutes: 4,
    url: {
      it: 'https://www.youtube.com/watch?v=GYwoJcKFGSg',
      en: 'https://www.youtube.com/watch?v=qe6E6msuJDw'
    }
  },
  {
    n: 2,
    it: 'Il tuo primo componente da zero',
    en: 'Your first component from scratch',
    about: {
      it: 'Un template e un set da un progetto vuoto, passo per passo.',
      en: 'A template and a set from an empty project, step by step.'
    },
    minutes: 10,
    url: {
      it: 'https://www.youtube.com/watch?v=l7tMw_gYE7k',
      en: 'https://www.youtube.com/watch?v=dIXdNuigAnY'
    }
  },
  {
    n: 3,
    it: 'Da Stella a Tabletop Simulator',
    en: 'From Stella to Tabletop Simulator',
    about: {
      it: 'Mazzi, segnalini e plance pronti da caricare in Tabletop Simulator.',
      en: 'Decks, tokens and boards ready to load into Tabletop Simulator.'
    },
    minutes: 5,
    url: {
      it: 'https://www.youtube.com/watch?v=73utF9RZoKU',
      en: 'https://www.youtube.com/watch?v=k01RVCPnH1s'
    }
  },
  {
    n: 4,
    it: 'Testo, icone, stili e formule',
    en: 'Text, icons, styles and formulas',
    about: {
      it: 'Il testo sulle carte: icone nel testo, stili e le prime formule.',
      en: 'Text on the cards: icons in the text, styles and the first formulas.'
    },
    minutes: 5,
    url: {
      it: 'https://www.youtube.com/watch?v=2I0ABob4DoQ',
      en: 'https://www.youtube.com/watch?v=SKoi6EaFY6k'
    }
  },
  {
    n: 5,
    it: 'Il regolamento e gli altri documenti',
    en: 'The rulebook and other documents',
    about: {
      it: 'Il regolamento con le carte vere dentro, esportato in PDF e Word.',
      en: 'The rulebook with the real cards in it, exported to PDF and Word.'
    },
    minutes: 5,
    url: {
      it: 'https://www.youtube.com/watch?v=psMiWRUQ4k4',
      en: 'https://www.youtube.com/watch?v=skHh2Uz2VxE'
    }
  },
  {
    n: 6,
    it: 'Stella con un agente IA',
    en: 'Stella with an AI agent',
    about: {
      it: 'Il comando stella e la skill per lavorare con un agente IA.',
      en: 'The stella command and the skill for working with an AI agent.'
    },
    minutes: 4,
    url: {
      it: 'https://www.youtube.com/watch?v=ymvGmxgpxgA',
      en: 'https://www.youtube.com/watch?v=7EylDX9GKOU'
    }
  },
  {
    n: 7,
    it: 'Plance, tessere, segnalini e dadi',
    en: 'Boards, tiles, tokens and dice',
    about: {
      it: 'Gli altri componenti oltre alle carte: forme, misure e dadi.',
      en: 'The components beyond cards: shapes, sizes and dice.'
    },
    minutes: 9,
    url: {
      it: 'https://www.youtube.com/watch?v=8wrjo3743w8',
      en: 'https://www.youtube.com/watch?v=uFpBpGkuAYc'
    }
  },
  {
    n: 8,
    it: 'Le griglie: caselle, numeri e regole',
    en: 'Grids: cells, numbers and rules',
    about: {
      it: 'Griglie di caselle per plance e tracciati: numeri, regole e contenuti diversi.',
      en: 'Grids of cells for boards and tracks: numbers, rules and different content.'
    },
    minutes: 10,
    url: {
      it: 'https://www.youtube.com/watch?v=uJCO9J_bdLI',
      en: 'https://www.youtube.com/watch?v=TtTKJ9p3pxA'
    }
  },
  {
    n: 9,
    it: 'Stampare i componenti',
    en: 'Printing your components',
    about: {
      it: 'Il PDF da stampare a casa o in tipografia, fronte e retro.',
      en: 'The PDF for home or print shop, fronts and backs.'
    },
    minutes: 9,
    url: {
      it: 'https://www.youtube.com/watch?v=y1hWXNolGC8',
      en: 'https://www.youtube.com/watch?v=lV4Sccgbm0I'
    }
  },
  {
    n: 10,
    it: 'I dati dal foglio di calcolo',
    en: 'Data from the spreadsheet',
    about: {
      it: 'Le carte da un foglio Excel, LibreOffice o Google Sheets.',
      en: 'Cards from an Excel, LibreOffice or Google Sheets file.'
    },
    minutes: 9,
    url: {
      it: 'https://www.youtube.com/watch?v=EtS5nl_aKAg',
      en: 'https://www.youtube.com/watch?v=hlKHMJOoNos'
    }
  },
  {
    n: 11,
    it: 'Immagini, icone e font',
    en: 'Images, icons and fonts',
    about: {
      it: 'Immagini, cataloghi di icone e font per i componenti.',
      en: 'Images, icon catalogs and fonts for your components.'
    },
    minutes: 6,
    url: {
      it: 'https://www.youtube.com/watch?v=LhgecwJeUWU',
      en: 'https://www.youtube.com/watch?v=Rw60_QDED9Q'
    }
  },
  {
    n: 12,
    it: 'Un gioco in più lingue',
    en: 'A game in several languages',
    about: {
      it: 'Gli stessi componenti in più lingue, dal foglio e nei testi fissi.',
      en: 'The same components in several languages, from the sheet and in fixed texts.'
    },
    minutes: 6,
    url: {
      it: 'https://www.youtube.com/watch?v=1eV4QzH_3XI',
      en: 'https://www.youtube.com/watch?v=gszofbPThzU'
    }
  },
  {
    n: 13,
    it: 'L’assistente formule',
    en: 'The formula assistant',
    about: {
      it: 'Le formule costruite a parole, senza scriverle a mano.',
      en: 'Formulas built in plain words, without typing them.'
    },
    minutes: 11,
    url: {
      it: 'https://www.youtube.com/watch?v=z-LHAFi0z3Y',
      en: 'https://www.youtube.com/watch?v=5Go9c8dgOSc'
    }
  },
  {
    n: 16,
    it: 'Generare le carte e dividere un’immagine',
    en: 'Generating cards and splitting an image',
    about: {
      it: 'Tante carte in un colpo solo, e una mappa divisa tra le carte.',
      en: 'Many cards in one go, and a map split across cards.'
    },
    minutes: 7,
    url: {
      it: 'https://www.youtube.com/watch?v=tiB1KT81WlE',
      en: 'https://www.youtube.com/watch?v=p46_avMl4dU'
    }
  },
  {
    n: 17,
    it: 'Backup e recupero',
    en: 'Backups and recovery',
    about: {
      it: 'Annullare, i backup automatici, il ripristino e il cestino.',
      en: 'Undo, automatic backups, restoring and the trash.'
    },
    minutes: 5,
    url: {
      it: 'https://www.youtube.com/watch?v=2fPQwU0LlFg',
      en: 'https://www.youtube.com/watch?v=AeSwGYOWRCs'
    }
  },
  {
    n: 18,
    it: 'Lavorare più veloce',
    en: 'Working faster',
    about: {
      it: 'Le scorciatoie e i gesti per il lavoro di tutti i giorni.',
      en: 'Shortcuts and gestures for everyday work.'
    },
    minutes: 5,
    url: {
      it: 'https://www.youtube.com/watch?v=p1nM-sH1cvE',
      en: 'https://www.youtube.com/watch?v=sdlhIDNbUyg'
    }
  },
  {
    n: 14,
    it: 'Un gioco completo, dall’idea al tavolo',
    en: 'A complete game, from idea to table',
    about: {
      it: 'Carte, monete, plancia, dado e regolamento, fino al PDF e a Tabletop Simulator.',
      en: 'Cards, coins, board, die and rulebook, all the way to the PDF and Tabletop Simulator.'
    },
    minutes: 20,
    url: {
      it: 'https://www.youtube.com/watch?v=hQx902sBZIQ',
      en: 'https://www.youtube.com/watch?v=zRINs94xW4o'
    }
  },
  {
    n: 15,
    it: 'Installare Stella e la versione web',
    en: 'Installing Stella and the web version',
    about: {
      it: 'Mac, Windows e Linux, gli avvisi della prima apertura, gli aggiornamenti e la versione nel browser.',
      en: 'Mac, Windows and Linux, the first-launch warnings, updates and the browser version.'
    },
    minutes: 3,
    url: {
      it: 'https://www.youtube.com/watch?v=Jx6QC7Ucfrw',
      en: 'https://www.youtube.com/watch?v=n_9rcC9e_14'
    }
  },
  {
    n: 19,
    it: 'Snap point e tag per Tabletop Simulator',
    en: 'Snap points and tags for Tabletop Simulator',
    about: {
      it: 'Dove si agganciano gli oggetti sulla plancia, e quali: tag dei template, snap su livelli e griglie.',
      en: 'Where objects snap on the board, and which ones: template tags, snaps on layers and grids.'
    },
    minutes: 6,
    url: {
      it: 'https://www.youtube.com/watch?v=nJ9AjWRp_0E',
      en: 'https://www.youtube.com/watch?v=XSceyDoLmw8'
    }
  },
  {
    n: 20,
    it: 'Approfondimento: il testo',
    en: 'Deep dive: text',
    about: {
      it: 'Formattazione, adattamento al riquadro, markup e stili, con tutte le opzioni.',
      en: 'Formatting, fitting the box, markup and styles, with every option.'
    },
    minutes: 13,
    url: {
      it: 'https://www.youtube.com/watch?v=zLVh4VNaADg',
      en: 'https://www.youtube.com/watch?v=-zQmXMRJBog'
    },
    // il progetto da scaricare per seguire il video
    project: {
      it: 'progetti/mercanti.zip',
      en: 'progetti/merchants.zip'
    }
  },
  {
    n: 21,
    it: 'Approfondimento: icone e variabili',
    en: 'Deep dive: icons and variables',
    about: {
      it: 'Icone nel testo, variabili di ogni tipo, icone ripetute, nei dati e dalle formule.',
      en: 'Icons in text, every kind of variable, repeated icons, icons in the data and from formulas.'
    },
    minutes: 11,
    url: {
      it: 'https://www.youtube.com/watch?v=gYUayFjoemo',
      en: 'https://www.youtube.com/watch?v=Sg-ktAAh1Ww'
    },
    project: {
      it: 'progetti/contratti.zip',
      en: 'progetti/contracts.zip'
    }
  },
  {
    n: 22,
    it: 'Approfondimento: due campi, tutta la carta',
    en: 'Deep dive: two fields, the whole card',
    about: {
      it: 'Due livelli Valore e tutto il resto della carta calcolato da formule e variabili.',
      en: 'Two Value layers, and the rest of the card computed by formulas and variables.'
    },
    minutes: 10,
    url: {
      it: 'https://www.youtube.com/watch?v=sOHOWDYIoPk',
      en: 'https://www.youtube.com/watch?v=43E0tSVZQHM'
    },
    project: {
      it: 'progetti/incontri.zip',
      en: 'progetti/encounters.zip'
    }
  },
  {
    n: 23,
    it: 'Approfondimento: le formule',
    en: 'Deep dive: formulas',
    about: {
      it: 'Le funzioni una alla volta su un bestiario: testo, calcoli, confronti, elenchi, colori, variabili di sistema e griglie.',
      en: 'The functions one at a time on a bestiary: text, calculations, comparisons, lists, colors, system variables and grids.'
    },
    minutes: 15,
    url: {
      it: 'https://www.youtube.com/watch?v=ipwS6RiEa50',
      en: 'https://www.youtube.com/watch?v=h3hayhBaID0'
    },
    project: {
      it: 'progetti/bestiario.zip',
      en: 'progetti/bestiary.zip'
    }
  },
  {
    n: 24,
    it: 'Approfondimento: il tabellone',
    en: 'Deep dive: the game board',
    about: {
      it: 'Un tabellone da 38 cm pezzo per pezzo, la plancia giocatore, le pedine, la stampa a poster e Tabletop Simulator.',
      en: 'A 38 cm board piece by piece, the player board, pawns, poster printing and Tabletop Simulator.'
    },
    minutes: 28,
    url: {
      it: 'https://www.youtube.com/watch?v=I2RtWcY2YWo',
      en: 'https://www.youtube.com/watch?v=_Dvf3MXblf0'
    },
    project: {
      it: 'progetti/tabellone.zip',
      en: 'progetti/game-board.zip'
    }
  },
  {
    n: 25,
    it: 'Approfondimento: giocare con il caso',
    en: 'Deep dive: playing with chance',
    about: {
      it: 'Una griglia di risorse riempita a caso: tutto a caso, con le quantità, con le caselle vuote e dal foglio.',
      en: 'A resource grid filled at random: all random, with quantities, with empty cells and from the sheet.'
    },
    minutes: 12,
    url: {
      it: 'https://www.youtube.com/watch?v=bp4MGWdtzHo',
      en: 'https://www.youtube.com/watch?v=NcbSnlPjj3o'
    },
    project: {
      it: 'progetti/risorse.zip',
      en: 'progetti/resources.zip'
    }
  },
  {
    n: 27,
    it: 'Approfondimento: immagini e forme',
    en: 'Deep dive: images and shapes',
    about: {
      it: 'Adattamenti, ritaglio, trama, colorazione, contorno, forme, riempimenti e la sezione Aspetto, su carte luogo, segnalini e tessere esagonali.',
      en: 'Fit, crop, texture, tint, stroke, shapes, fills and the Appearance section, on place cards, tokens and hexagonal tiles.'
    },
    minutes: 16,
    url: {
      it: 'https://www.youtube.com/watch?v=klhDqqy7_iw',
      en: 'https://www.youtube.com/watch?v=WJUt8pr3BTI'
    },
    project: {
      it: 'progetti/spedizione.zip',
      en: 'progetti/expedition.zip'
    }
  }
]

// Le playlist con tutti i video, una per lingua
// i gruppi della sezione Tutorial e l'ordine dei video in ciascuno (i numeri restano quelli di YouTube)
export const videoGroups = {
  start: [15, 1, 2, 14],
  components: [7, 8, 11, 16],
  text: [4, 13],
  data: [10, 12],
  table: [9, 3, 19, 5],
  tools: [6, 17, 18],
  deep: [20, 21, 22, 23, 24, 25, 27]
}

export const playlists = {
  it: 'https://www.youtube.com/playlist?list=PLd3mtbjgiPEo',
  en: 'https://www.youtube.com/playlist?list=PLC6t-d7-3DO0'
}

// Chiave di Web3Forms per il modulo di contatto (manda i messaggi solo all'indirizzo di Luca, quindi può
// stare nella pagina). Vuota: il modulo resta visibile ma dice che non è ancora attivo.
export const contactKey = 'bf5614a4-6724-4594-b19c-7ce1473a371a'
