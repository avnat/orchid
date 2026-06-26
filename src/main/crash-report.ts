import { net } from 'electron'

// Crash reports are appended to a private Google Form → Google Sheet ("Report"
// paragraph field). The form's submit endpoint is public by design, so there is
// NO secret in the app. If these are ever blank, reporting is inert.
const FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSch9X5B83BCODNUFTckK5VvOXFcsnuD4CBKKhWF9sw8de55FQ/formResponse'
const ENTRY = 'entry.619067849'

/** Strip the OS username from any home paths so reports don't leak it. */
function redact(text: string): string {
  return text.replace(/\/Users\/[^/\s]+/g, '/Users/~').replace(/\/home\/[^/\s]+/g, '/home/~')
}

/**
 * Fire-and-forget crash report. Never throws, never blocks, never surfaces an
 * error to the user — if the network or Google is unavailable, it silently does
 * nothing. Safe to call from an uncaughtException handler.
 */
export function reportCrash(
  kind: string,
  detail: string,
  meta: { version: string; os: string; arch: string }
): void {
  try {
    if (!FORM_URL || !ENTRY) return
    const stamp = new Date().toISOString()
    const body =
      `[${kind}] Orchid ${meta.version} · macOS ${meta.os} · ${meta.arch} · ${stamp}\n\n` +
      redact(detail || '(no detail)').slice(0, 8000)
    const params = `${ENTRY}=${encodeURIComponent(body)}`
    const req = net.request({ method: 'POST', url: FORM_URL })
    req.setHeader('Content-Type', 'application/x-www-form-urlencoded')
    req.on('error', () => {}) // swallow — a failed report must never reach the user
    req.on('response', (res) => {
      res.on('data', () => {})
      res.on('error', () => {})
    })
    // Don't let a hung connection linger.
    const timer = setTimeout(() => {
      try {
        req.abort()
      } catch {
        /* ignore */
      }
    }, 6000)
    req.on('close', () => clearTimeout(timer))
    req.write(params)
    req.end()
  } catch {
    /* reporting must never itself crash the app */
  }
}
