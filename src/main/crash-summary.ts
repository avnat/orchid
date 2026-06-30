// Pure parser for macOS crash logs (.ips). An .ips file is two JSON objects:
// a one-line header, then the report body. We distil it to a compact, readable
// summary for the crash report. No electron/fs imports, so it's unit-testable.

function safeParse(s: string): Record<string, unknown> | null {
  try {
    return JSON.parse(s) as Record<string, unknown>
  } catch {
    return null
  }
}

interface Frame {
  symbol?: string
  symbolLocation?: number
  imageIndex?: number
  imageOffset?: number
}

/** Distil a macOS .ips crash report into a short summary (exception + faulting thread frames). */
export function summarizeCrashIps(text: string): string {
  try {
    const nl = text.indexOf('\n')
    const header = nl > 0 ? safeParse(text.slice(0, nl)) : null
    const body = safeParse(nl > 0 ? text.slice(nl + 1) : text)
    if (!body) return text.slice(0, 4000) // not parseable — send a raw snippet

    const bundle = body.bundleInfo as { CFBundleShortVersionString?: string } | undefined
    const ver = (header?.app_version as string) ?? bundle?.CFBundleShortVersionString ?? '?'
    const os = (body.osVersion as { train?: string } | undefined)?.train ?? '?'
    const lines: string[] = [`crash · Orchid ${ver} · ${os}`]

    const exc = body.exception as { type?: string; signal?: string; codes?: string } | undefined
    if (exc) lines.push(`exception: ${[exc.type, exc.signal, exc.codes].filter(Boolean).join(' ')}`)

    const term = body.termination as { indicator?: string; namespace?: string; code?: number } | undefined
    if (term?.indicator) lines.push(`termination: ${term.indicator}`)

    const ft = typeof body.faultingThread === 'number' ? body.faultingThread : 0
    const threads = body.threads as Array<{ name?: string; queue?: string; frames?: Frame[] }> | undefined
    const thread = threads?.[ft]
    if (thread) {
      const label = [thread.name, thread.queue && `[${thread.queue}]`].filter(Boolean).join(' ')
      lines.push(`thread ${ft}${label ? ' ' + label : ''}:`)
      for (const f of (thread.frames ?? []).slice(0, 16)) {
        lines.push('  ' + (f.symbol ? `${f.symbol}+${f.symbolLocation ?? 0}` : `img${f.imageIndex}+${f.imageOffset}`))
      }
    }
    return lines.join('\n')
  } catch {
    return text.slice(0, 4000)
  }
}
