# Il sito di presentazione

<https://stella.lucadj.eu/>: presenta Stella, propone il download dell'ultima versione stabile (letta
dalle release di GitHub, con il file adatto al sistema di chi visita), i video tutorial e i rimandi alla guida,
alle novità e alla CLI. In inglese alla radice, in italiano in `it/`. La versione web dell'app sta accanto, in
`app/` (stabile) e `beta/`.

- `template.html`: la pagina, con segnaposto `{{chiave}}` presi da `texts.mjs`.
- `texts.mjs`: tutti i testi nelle due lingue e l'elenco dei video (`videos`: titolo per lingua, minuti,
  indirizzo YouTube per lingua; finché l'indirizzo è vuoto il video non compare).
- `style.css`, `site.js`: stile e script del download; `img/`: logo e logo Predigarama; gli screenshot vengono
  da `docs/guida/img` e `docs/guide/img` (elenco `shots` in `build.mjs`).
- `dcount/index.html`: pagina nascosta con i download letti dalle release di GitHub, su `/dcount/` (nessun link dal sito, `noindex`).
- `build.mjs <cartella>`: costruisce il sito nella cartella data (`node site/build.mjs pages`). L'azione Web lo fa a
  ogni tag e sulle PR che toccano `site/`, e pubblica tutto su GitHub Pages.

Per vedere il sito in locale: `node site/build.mjs /tmp/pages && npx serve /tmp/pages` (o un qualsiasi server
statico; aperto come file:// il download non legge GitHub).

## Dominio

Il sito risponde a `stella.lucadj.eu`: un record CNAME `stella` → `lucadj77.github.io` nel DNS di `lucadj.eu` (Hostinger) e il dominio personalizzato nelle impostazioni Pages del repo (Settings → Pages → Custom domain, con «Enforce HTTPS»). Con la pubblicazione tramite GitHub Actions il file `CNAME` non serve. Il vecchio indirizzo `lucadj77.github.io/stella/` rimanda a quello nuovo, sottocartelle comprese.

## Privacy

Il sito non usa cookie e non salva niente nel browser, quindi non serve un banner. I font (`fonts/`, dai pacchetti
@fontsource, sottoinsieme latino) e le copertine dei video (scaricate da `build.mjs` in `img/yt/` durante la
costruzione) stanno dentro il sito: chi visita non contatta Google né YouTube finché non apre un video, che è un
semplice link. Le visite si contano con GoatCounter (account `lucadj77`, pannello su
<https://lucadj77.goatcounter.com/>), che non usa cookie né raccoglie dati personali. L'unica altra richiesta
esterna è quella a GitHub per sapere l'ultima versione da scaricare.
