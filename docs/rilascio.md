# Preparare una nuova versione

Ogni versione pubblicata ha le sue novità, scritte in [CHANGELOG.md](../CHANGELOG.md): Stella le mostra a chi ha una versione precedente quando segnala l'aggiornamento, e GitHub le usa come testo della release.

## Durante lo sviluppo

Chi unisce una modifica che si vede nell'app aggiunge una riga alla sezione della prossima versione di `CHANGELOG.md`, prima in inglese sotto `### English` e poi in italiano sotto `### Italiano`. Le righe descrivono cosa cambia per chi usa l'app, non come è fatto il codice. L'app divide le note con questi due titoli: eventuali sottotitoli vanno a un livello più basso (`####`). Per le versioni ufficiali conviene dividere le righe in **New**/**Nuovo**, **Changed**/**Cambiato** e **Fixed**/**Corretto**; per le beta basta l'elenco.

## Numerazione

I numeri hanno la forma `MAGGIORE.MINORE.CORREZIONE` e dipendono da cosa cambia per chi usa Stella:

- **correzione** (1.2.0 → 1.2.1): solo correzioni di difetti, senza voci, opzioni o campi nuovi nei file del progetto. Va a chi ha scelto la stabile, quindi deve essere a basso rischio: un piccolo miglioramento aspetta la minore successiva;
- **minore** (1.2 → 1.3): funzioni nuove, nuove opzioni, nuovi campi nei file, nuovi comandi o opzioni di `stella`, piccoli miglioramenti;
- **maggiore** (1 → 2): un progetto salvato non si apre più correttamente con la versione precedente, o i progetti vecchi vanno convertiti, o un comando `stella` cambia nome o significato, o si toglie una funzione. Il comando `stella` conta come interfaccia pubblica: gli agenti IA e la skill dipendono dai suoi nomi.

Le minori e le maggiori passano dalle beta: `1.3.0-beta.1`, `1.3.0-beta.2`, poi `1.3.0`. Una correzione esce direttamente come `1.2.1`.

## Canali

Nel menu ⚙ dell'app, **Aggiornamenti** sceglie il canale:

- **Stabile** (di base per una nuova installazione) propone solo le versioni ufficiali. Il controllo chiede a GitHub `releases/latest`, che non conta le pre-release.
- **Beta** propone anche le beta: il controllo legge le ultime 30 release e prende la più recente, beta o ufficiale.

La scelta sta in `update.json` nella cartella dei dati dell'app. Alla prima apertura di una versione che ha il canale, se la versione installata è una beta si salva Beta: così chi prova le beta resta in beta anche dopo aver ricevuto la versione ufficiale. Passando da Beta a Stabile non si torna indietro di versione: si aspetta la prima ufficiale più recente di quella installata.

L'installazione automatica (setup di Windows e AppImage di Linux) usa electron-updater puntato sui file `latest.yml` / `latest-linux.yml` della release scelta dal controllo, non sulla più recente del feed di GitHub; il Mac scarica lo zip della stessa release. La versione web stabile sta all'indirizzo principale, la beta in `beta/` (vedi [web.md](web.md)). La skill e il pacchetto `stella-cli` seguono la stabile, salvo chi ha già una beta.

## Rami

- `main` porta la prossima minore. Le beta escono da qui.
- `release/1.2` nasce dal tag `v1.2.0` e riceve solo le correzioni della 1.2. Si abbandona quando esce la 1.3.0.

Un difetto della versione stabile si corregge su un ramo nato da `release/1.2`, con una PR verso `release/1.2`; poi si alza la versione (`1.2.1`) con la sua sezione nel changelog, si pubblica con l'azione Release avviata su `release/1.2` e infine si unisce `release/1.2` in `main`. Gli unici conflitti attesi sono la versione in `package.json` (resta quella di `main`) e `CHANGELOG.md` (si tengono entrambe le sezioni, in ordine di uscita). Un difetto che c'è solo nella beta si corregge su `main` e basta.

## Al momento del rilascio

1. Controlla che la sezione `## x.y.z` in cima a `CHANGELOG.md` sia completa e che `package.json` abbia la stessa versione (`npm version x.y.z --no-git-tag-version` aggiorna anche `package-lock.json`).
2. Unisci tutto nel ramo da cui esce la versione: `main`, o `release/x.y` per una correzione della stabile.
3. Su GitHub, **Actions → Release → Run workflow** sul ramo: l'azione crea il tag della versione di `package.json` sull'ultimo commit del ramo e avvia Build e Web su quel tag. Si ferma se il tag esiste già o se manca la sezione in `CHANGELOG.md`. La stessa azione la può avviare anche un'IA con accesso a GitHub.

   In alternativa, dal Mac, nella cartella di Stella:

   ```bash
   git checkout main
   git checkout -- package-lock.json
   git pull
   git tag v1.2.0-beta.1
   git push origin v1.2.0-beta.1
   ```

   con il ramo e il numero della versione al posto di `main` e `1.2.0-beta.1`. Il comando su `package-lock.json` scarta la copia modificata da `npm install`, che altrimenti blocca `git pull`: in quel caso il tag finirebbe su una versione vecchia e GitHub lo rifiuterebbe.

4. L'azione **Build** di GitHub costruisce i pacchetti per Mac, Windows e Linux e pubblica la release con le novità; un tag con il trattino (`v1.3.0-beta.1`) diventa una pre-release. Se il tag non corrisponde alla versione di `package.json`, o manca la sezione in `CHANGELOG.md`, la release non viene creata e l'azione lo dice nel log. L'azione **Web** pubblica di nuovo il sito, con la stabile e la beta.
5. Per una versione stabile, Build manda anche le novità al canale #announcements del server Discord: un messaggio in inglese e uno in italiano presi da `CHANGELOG.md` (`scripts/discord-announce.mjs`; per vederli prima: `node scripts/discord-announce.mjs vx.y.z --dry-run`). Serve il segreto `DISCORD_WEBHOOK` del repository (Settings → Secrets and variables → Actions) con l'URL del webhook del canale; senza il segreto il passaggio non fa niente, e se Discord non risponde la release resta valida. Le beta non vengono annunciate.

Da quel momento le copie di Stella già installate segnalano la nuova versione al primo avvio, secondo il loro canale.

## Come funziona il controllo

All'avvio Stella chiede a GitHub l'ultima release del suo canale. Se è più recente della versione installata mostra una striscia in alto con **Novità** e **Aggiorna e riavvia** (o **Scarica**, che apre la pagina della release, dove l'aggiornamento automatico non c'è). **Salta questa versione** non la ripropone più; **Ricordamelo più tardi** la nasconde fino al prossimo avvio. Senza rete non compare nulla. Ogni tentativo di aggiornamento è scritto in `update.log` nella cartella dei dati dell'app.

L'app non è firmata con un certificato Apple o Microsoft: sul Mac l'aggiornamento sostituisce l'app con uno script dopo la chiusura, e Windows può segnalare il programma scaricato come sconosciuto.
