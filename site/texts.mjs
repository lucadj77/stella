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
      news: 'Novità'
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
      text: 'Video brevi, senza voce: il testo compare accanto a ciò che va guardato.',
      soon: 'I primi video arrivano a breve.',
      playlist: 'Tutti i video nella playlist di YouTube',
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
      cliHref: 'https://github.com/lucadj77/stella/blob/main/docs/cli.md'
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
      license:
        'Stella è software libero, licenza GNU GPL 3 o successive. Le carte che crei sono tue.',
      source: 'Codice sorgente su GitHub',
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
      news: 'What’s new'
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
      text: 'Short videos, no voice: the text appears next to what to look at.',
      soon: 'The first videos are coming soon.',
      playlist: 'All the videos in the YouTube playlist',
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
      cliHref: 'https://github.com/lucadj77/stella/blob/main/docs/cli.en.md'
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
      license: 'Stella is free software, GNU GPL 3 or later. The cards you make are yours.',
      source: 'Source code on GitHub',
      support: 'Buy me a coffee',
      contact: 'Contact me',
      by: 'A project by Luca Di Gialleonardo · Predigarama Games'
    }
  }
}

// I video dei tutorial: titolo per lingua e indirizzo YouTube (vuoto finché non è caricato)
export const videos = [
  {
    it: 'Panoramica delle funzioni di base',
    en: 'An overview of the basic functions',
    minutes: 4,
    url: {
      it: 'https://www.youtube.com/watch?v=0JnZ92Jy_JU',
      en: 'https://www.youtube.com/watch?v=51ZJAKmUprc'
    }
  },
  {
    it: 'Il tuo primo componente da zero',
    en: 'Your first component from scratch',
    minutes: 10,
    url: {
      it: 'https://www.youtube.com/watch?v=kUgGQ_ab8Yg',
      en: 'https://www.youtube.com/watch?v=YISuOjfzjJU'
    }
  },
  {
    it: 'Da Stella a Tabletop Simulator',
    en: 'From Stella to Tabletop Simulator',
    minutes: 5,
    url: {
      it: 'https://www.youtube.com/watch?v=XxKgcgba9wE',
      en: 'https://www.youtube.com/watch?v=N6VXi-RPIpg'
    }
  },
  {
    it: 'Testo, icone, stili e formule',
    en: 'Text, icons, styles and formulas',
    minutes: 5,
    url: {
      it: 'https://www.youtube.com/watch?v=2I0ABob4DoQ',
      en: 'https://www.youtube.com/watch?v=SKoi6EaFY6k'
    }
  },
  {
    it: 'Il regolamento e gli altri documenti',
    en: 'The rulebook and other documents',
    minutes: 5,
    url: {
      it: 'https://www.youtube.com/watch?v=psMiWRUQ4k4',
      en: 'https://www.youtube.com/watch?v=skHh2Uz2VxE'
    }
  },
  {
    it: 'Stella con un agente IA',
    en: 'Stella with an AI agent',
    minutes: 4,
    url: {
      it: 'https://www.youtube.com/watch?v=ymvGmxgpxgA',
      en: 'https://www.youtube.com/watch?v=7EylDX9GKOU'
    }
  },
  {
    it: 'Plance, tessere, segnalini e dadi',
    en: 'Boards, tiles, tokens and dice',
    minutes: 9,
    url: {
      it: 'https://www.youtube.com/watch?v=02s-e9wMHU8',
      en: 'https://www.youtube.com/watch?v=WUIWgrg5zLk'
    }
  },
  {
    it: 'Le griglie e le formule nelle caselle',
    en: 'Grids and cell formulas',
    minutes: 14,
    url: {
      it: 'https://www.youtube.com/watch?v=wY4PRv9vN1o',
      en: 'https://www.youtube.com/watch?v=DgaXcUt2N-M'
    }
  },
  {
    it: 'Stampare i componenti',
    en: 'Printing your components',
    minutes: 9,
    url: {
      it: 'https://www.youtube.com/watch?v=TG-WWQqBDUk',
      en: 'https://www.youtube.com/watch?v=RbO56oqJSFo'
    }
  },
  {
    it: 'I dati dal foglio di calcolo',
    en: 'Data from the spreadsheet',
    minutes: 9,
    url: {
      it: 'https://www.youtube.com/watch?v=EtS5nl_aKAg',
      en: 'https://www.youtube.com/watch?v=hlKHMJOoNos'
    }
  },
  {
    it: 'Immagini, icone e font',
    en: 'Images, icons and fonts',
    minutes: 6,
    url: {
      it: 'https://www.youtube.com/watch?v=LhgecwJeUWU',
      en: 'https://www.youtube.com/watch?v=Rw60_QDED9Q'
    }
  },
  {
    it: 'Un gioco in più lingue',
    en: 'A game in several languages',
    minutes: 6,
    url: {
      it: 'https://www.youtube.com/watch?v=1eV4QzH_3XI',
      en: 'https://www.youtube.com/watch?v=gszofbPThzU'
    }
  },
  {
    it: 'L’assistente formule',
    en: 'The formula assistant',
    minutes: 12,
    url: {
      it: 'https://www.youtube.com/watch?v=azgDlcktVfk',
      en: 'https://www.youtube.com/watch?v=V2qYi4r4uJA'
    }
  },
  {
    it: 'Generare le carte e dividere un’immagine',
    en: 'Generating cards and splitting an image',
    minutes: 6,
    url: {
      it: 'https://www.youtube.com/watch?v=TR5Eiuatdec',
      en: 'https://www.youtube.com/watch?v=heP9Y82zsjA'
    }
  },
  {
    it: 'Backup e recupero',
    en: 'Backups and recovery',
    minutes: 5,
    url: {
      it: 'https://www.youtube.com/watch?v=2fPQwU0LlFg',
      en: 'https://www.youtube.com/watch?v=AeSwGYOWRCs'
    }
  }
]

// Le playlist con tutti i video, una per lingua
export const playlists = {
  it: 'https://www.youtube.com/playlist?list=PLd3mtbjgiPEo',
  en: 'https://www.youtube.com/playlist?list=PLC6t-d7-3DO0'
}

// Chiave di Web3Forms per il modulo di contatto (manda i messaggi solo all'indirizzo di Luca, quindi può
// stare nella pagina). Vuota: il modulo resta visibile ma dice che non è ancora attivo.
export const contactKey = 'bf5614a4-6724-4594-b19c-7ce1473a371a'
