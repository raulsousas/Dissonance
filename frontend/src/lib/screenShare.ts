/**
 * Screen-share failure handling.
 *
 * `getDisplayMedia` reports very different situations with similar errors. This
 * maps them to something the user can act on. Sharing a browser tab needs no OS
 * permission, so "the tab works but screens/windows do not" almost always means
 * the operating system is blocking the browser (macOS: Screen Recording).
 */

export type ScreenShareFailure =
  | { kind: 'cancelled' }
  | { kind: 'os-permission'; title: string; description: string }
  | { kind: 'source-unavailable'; title: string; description: string }
  | { kind: 'unsupported'; title: string; description: string }
  | { kind: 'unknown'; title: string; description: string }

function errorInfo(err: unknown): { name: string; message: string } {
  if (err && typeof err === 'object') {
    const e = err as { name?: unknown; message?: unknown }
    return {
      name: typeof e.name === 'string' ? e.name : '',
      message: typeof e.message === 'string' ? e.message : '',
    }
  }
  return { name: '', message: '' }
}

/** True for constraint problems, which are thrown before the picker is shown. */
export function isConstraintError(err: unknown): boolean {
  const { name } = errorInfo(err)
  return name === 'TypeError' || name === 'OverconstrainedError'
}

export function classifyScreenShareError(err: unknown): ScreenShareFailure {
  const { name, message } = errorInfo(err)
  const text = message.toLowerCase()

  // Chrome: closing the picker is "Permission denied"; the OS blocking it is
  // "Permission denied by system".
  if (name === 'NotAllowedError' || name === 'AbortError') {
    if (text.includes('system')) {
      return {
        kind: 'os-permission',
        title: 'O sistema bloqueou o compartilhamento de tela',
        description:
          'No macOS, abra Ajustes do Sistema > Privacidade e Segurança > Gravação de Tela, ative o navegador e reinicie-o.',
      }
    }
    return { kind: 'cancelled' }
  }

  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return {
      kind: 'source-unavailable',
      title: 'Não foi possível capturar essa tela ou janela',
      description:
        'No macOS, confira a permissão de Gravação de Tela do navegador. Para jogos, use o modo janela sem bordas: jogos em tela cheia exclusiva não podem ser capturados.',
    }
  }

  if (name === 'NotFoundError' || text.includes('not supported') || text.includes('unsupported')) {
    return {
      kind: 'unsupported',
      title: 'Compartilhamento de tela indisponível',
      description: 'Este navegador ou dispositivo não permite compartilhar a tela.',
    }
  }

  return {
    kind: 'unknown',
    title: 'Falha ao compartilhar a tela',
    description: 'Tente novamente ou escolha outra tela, janela ou aba.',
  }
}
