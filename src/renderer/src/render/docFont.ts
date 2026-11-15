import { resolveFont } from '../../../shared/model/variables'
import type { DocumentContext } from '../../../shared/model/document'

/**
 * La famiglia di caratteri del testo del documento, come la scrive la pagina; undefined = quella
 * di base. Le finestre dell'anatomia e dello schema la usano per andare a capo come la pagina
 */
export function docFontFamily(
  f: string,
  variables: DocumentContext['variables']
): string | undefined {
  return f.trim() ? `'${resolveFont(f, variables)}', sans-serif` : undefined
}
