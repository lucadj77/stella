// Annuncia una versione stabile nel canale #announcements del server Discord: le novità di
// CHANGELOG.md, un messaggio in inglese e uno in italiano, mandati al webhook del canale
// (segreto DISCORD_WEBHOOK). Senza webhook non fa niente. Uso:
//   node scripts/discord-announce.mjs v1.6.1            (manda)
//   node scripts/discord-announce.mjs v1.6.1 --dry-run  (stampa i messaggi)
import { execFileSync } from 'child_process'

const LIMIT = 2000 // caratteri massimi di un messaggio Discord
const REPO = 'https://github.com/lucadj77/stella'

const tag = process.argv[2] ?? ''
const dryRun = process.argv.includes('--dry-run')
const webhook = process.env.DISCORD_WEBHOOK ?? ''
if (!dryRun && !webhook) {
  console.log('DISCORD_WEBHOOK is not set: nothing to announce')
  process.exit(0)
}
if (tag.includes('-')) {
  console.log(`${tag} is a beta: not announced`)
  process.exit(0)
}

const notes = execFileSync(
  process.execPath,
  [new URL('release-notes.mjs', import.meta.url).pathname, tag],
  {
    encoding: 'utf8'
  }
)
// le note hanno una sezione "### English" e una "### Italiano"
const section = (name) => {
  const m = notes.match(new RegExp(`^### ${name}\\n([\\s\\S]*?)(?=^### |(?![\\s\\S]))`, 'm'))
  return m ? m[1].trim() : ''
}

const release = `${REPO}/releases/tag/${tag}`
const messages = [
  {
    head: `## Stella ${tag} is out`,
    body: section('English'),
    tail: `Download: https://stella.lucadj.eu/ · Full notes: <${release}>\nThe app also offers the update by itself.`,
    more: `…and more: <${release}>`
  },
  {
    head: `## È uscita Stella ${tag}`,
    body: section('Italiano'),
    tail: `Scarica: https://stella.lucadj.eu/it/ · Tutte le novità: <${release}>\nL'app propone anche l'aggiornamento da sola.`,
    more: `…e altro ancora: <${release}>`
  }
]

// sotto il limite di Discord: si tolgono le ultime voci intere e si rimanda alla release
const compose = ({ head, body, tail, more }) => {
  const items = body.split('\n').filter((l) => l.trim())
  let text = [head, items.join('\n'), tail].join('\n\n')
  while (text.length > LIMIT && items.length > 1) {
    items.pop()
    text = [head, items.join('\n') + '\n' + more, tail].join('\n\n')
  }
  return text.slice(0, LIMIT)
}

for (const m of messages) {
  if (!m.body) continue
  const content = compose(m)
  if (dryRun) {
    console.log(content + '\n\n---\n')
    continue
  }
  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // nessuna menzione: un @everyone nelle note non avvisa tutto il server
    body: JSON.stringify({ content, allowed_mentions: { parse: [] } })
  })
  if (!res.ok) {
    console.error(`Discord answered ${res.status}: ${await res.text()}`)
    process.exit(1)
  }
}
