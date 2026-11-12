// Lettura di uno script nanDECK (.nde): righe logiche, commenti, blocchi di etichette su più
// righe e divisione dei parametri. Il significato dei comandi sta in interp.ts.

export interface ScriptLine {
  /** Numero della riga nel file, da 1 */
  line: number
  /** File da cui viene la riga (lo script o un INCLUDE), relativo alla cartella del gioco */
  file: string
  /** Testo della riga, senza spazi ai lati */
  text: string
}

/**
 * Testo di un file nanDECK: gli script salvati in Windows sono quasi sempre in Windows-1252,
 * quelli recenti in UTF-8. Si prova UTF-8 e, se non è valido, si legge come Latin-1.
 */
export function decodeScript(data: Uint8Array): string {
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(data)
  } catch {
    text = new TextDecoder('windows-1252').decode(data)
  }
  return text.replace(/^﻿/, '')
}

/**
 * Righe logiche: si tolgono righe vuote e commenti (`;` o `//` all'inizio); un'etichetta tra
 * graffe `{[nome]= ... }` su più righe diventa una riga sola, con le righe unite senza spazi.
 */
export function scriptLines(text: string, file: string): ScriptLine[] {
  const raw = text.replace(/\r\n?/g, '\n').split('\n')
  const out: ScriptLine[] = []
  for (let i = 0; i < raw.length; i++) {
    const t = raw[i].trim()
    if (!t || t.startsWith(';') || t.startsWith('//')) continue
    const block = /^\{\s*(\[[^\]]+\]\s*=)(.*)$/.exec(t)
    if (block) {
      // un blocco che si chiude sulla stessa riga è un'etichetta normale
      let body = block[2]
      let j = i
      while (!closesBlock(body) && j + 1 < raw.length) {
        j++
        const next = raw[j].trim()
        if (next.startsWith(';')) continue
        body += next
      }
      out.push({ line: i + 1, file, text: `${block[1]}${stripClose(body)}` })
      i = j
      continue
    }
    out.push({ line: i + 1, file, text: t })
  }
  return out
}

/** Il blocco {[x]= ... } è chiuso quando le graffe aperte dentro sono bilanciate e resta una } */
function closesBlock(body: string): boolean {
  let depth = 0
  for (const c of body) {
    if (c === '{') depth++
    else if (c === '}') {
      if (depth === 0) return true
      depth--
    }
  }
  return false
}

function stripClose(body: string): string {
  let depth = 0
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (c === '{') depth++
    else if (c === '}') {
      if (depth === 0) return body.slice(0, i) + body.slice(i + 1)
      depth--
    }
  }
  return body
}

export type Statement =
  | { kind: 'label'; name: string; value: string }
  | { kind: 'frame'; name: string; value: string }
  | { kind: 'command'; name: string; value: string }
  | { kind: 'other'; text: string }

/** Tipo di riga: etichetta `[x]=`, frame `<x>=`, comando `NOME=` o `NOME` da solo */
export function statement(text: string): Statement {
  const label = /^\[([^\]]+)\]\s*=(.*)$/s.exec(text)
  if (label) return { kind: 'label', name: label[1].trim(), value: label[2].trim() }
  const frame = /^<([^<>,=]+)>\s*=(.*)$/s.exec(text)
  if (frame) return { kind: 'frame', name: frame[1].trim(), value: frame[2].trim() }
  const cmd = /^([A-Za-z][A-Za-z0-9_]*)\s*(?:=(.*))?$/s.exec(text)
  if (cmd) return { kind: 'command', name: cmd[1].toUpperCase(), value: (cmd[2] ?? '').trim() }
  return { kind: 'other', text }
}

const OPEN: Record<string, string> = { '(': ')', '[': ']', '{': '}' }

/**
 * Divide i parametri sulle virgole che stanno fuori da virgolette, parentesi tonde, quadre,
 * graffe e frame `<nome, ...>`. Ogni parametro è senza spazi ai lati.
 */
export function splitParams(text: string, sep = ','): string[] {
  const out: string[] = []
  let cur = ''
  const stack: string[] = []
  let quote = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quote) {
      cur += c
      if (c === '"') quote = false
      continue
    }
    if (c === '"') {
      quote = true
      cur += c
      continue
    }
    if (OPEN[c]) stack.push(OPEN[c])
    else if (c === '<' && /^<[A-Za-z_]/.test(text.slice(i)) && frameCloses(text, i))
      stack.push('>')
    else if (stack.length && c === stack[stack.length - 1]) stack.pop()
    if (c === sep && !stack.length) {
      out.push(cur.trim())
      cur = ''
      continue
    }
    cur += c
  }
  out.push(cur.trim())
  return out
}

/** Un `<` apre un frame se c'è una `>` più avanti prima della fine del parametro tra parentesi */
function frameCloses(text: string, from: number): boolean {
  let depth = 0
  for (let i = from + 1; i < text.length; i++) {
    const c = text[i]
    if (c === '(') depth++
    else if (c === ')') {
      if (depth === 0) return false
      depth--
    } else if (c === '>') return true
    else if (c === '<') return false
  }
  return false
}

/** Parametro senza le virgolette esterne */
export function unquote(s: string): string {
  const t = s.trim()
  return t.length >= 2 && t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1) : t
}

/** `nome(argomenti)` che occupa tutto il testo: la funzione e i suoi argomenti */
export function functionCall(text: string): { name: string; args: string[] } | null {
  const m = /^([A-Za-z][A-Za-z0-9_]*)\s*\(/.exec(text.trim())
  if (!m) return null
  const t = text.trim()
  let depth = 0
  let quote = false
  for (let i = m[0].length - 1; i < t.length; i++) {
    const c = t[i]
    if (quote) {
      if (c === '"') quote = false
      continue
    }
    if (c === '"') quote = true
    else if (c === '(') depth++
    else if (c === ')') {
      depth--
      if (depth === 0) {
        if (i !== t.length - 1) return null
        return { name: m[1].toLowerCase(), args: splitParams(t.slice(m[0].length, i)) }
      }
    }
  }
  return null
}
