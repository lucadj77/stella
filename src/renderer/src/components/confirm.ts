import type { Translate } from '../i18n/context'
import type { MessageKey } from '../i18n/en'
import type { Message } from '../../../shared/messages'

// Conferme dentro l'app, al posto della finestra del sistema: un titolo breve, la conseguenza e un
// tasto con il verbo; rosso quando l'azione toglie qualcosa. La finestra è ConfirmHost.

export interface ConfirmOptions {
  /** La domanda, breve: "Eliminare il set «Mazzo»?" */
  title: string
  /** Cosa succede, in una o due frasi */
  message?: string
  /** Il verbo del tasto: "Elimina il set" */
  ok: string
  /** Il tasto che lascia le cose come sono; manca: Annulla; null: nessuno (solo un avviso) */
  cancel?: string | null
  /** L'azione toglie o perde qualcosa: tasto rosso, il fuoco va su Annulla */
  danger?: boolean
}

export interface ConfirmRequest extends ConfirmOptions {
  resolve(ok: boolean): void
}

let enqueue: ((r: ConfirmRequest) => void) | null = null

/** La finestra si registra quando è montata */
export function setConfirmHost(fn: ((r: ConfirmRequest) => void) | null): void {
  enqueue = fn
}

/** Chiede una conferma; senza la finestra montata (export nascosto) usa quella del sistema */
export function askConfirm(o: ConfirmOptions): Promise<boolean> {
  const host = enqueue
  if (!host) {
    const text = [o.title, o.message].filter(Boolean).join('\n\n')
    if (o.cancel === null) {
      window.alert(text)
      return Promise.resolve(true)
    }
    return Promise.resolve(window.confirm(text))
  }
  return new Promise((resolve) => host({ ...o, resolve }))
}

/**
 * Conferma da una chiave dei testi: `key.title` è la domanda, `key` la conseguenza, `key.ok` il
 * tasto e, se c'è, `key.cancel` l'altro tasto.
 */
export function confirmKey(
  t: Translate,
  key: MessageKey,
  params?: Message['params'],
  opts: { danger?: boolean; cancel?: boolean } = {}
): Promise<boolean> {
  const sub = (s: string): MessageKey => `${key}.${s}` as MessageKey
  return askConfirm({
    title: t(sub('title'), params),
    message: t(key, params) || undefined,
    ok: t(sub('ok'), params),
    cancel: opts.cancel ? t(sub('cancel'), params) : undefined,
    danger: opts.danger
  })
}

/** Un avviso con il solo tasto OK, al posto di window.alert */
export function showNotice(t: Translate, title: string, message?: string): Promise<boolean> {
  return askConfirm({ title, message, ok: t('dialog.ok'), cancel: null })
}
