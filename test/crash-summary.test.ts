// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { summarizeCrashIps } from '../src/main/crash-summary'

function ips(header: object | null, body: object): string {
  const b = JSON.stringify(body)
  return header ? `${JSON.stringify(header)}\n${b}` : b
}

const fullBody = {
  osVersion: { train: 'macOS 26.5.1', build: '25F80' },
  bundleInfo: { CFBundleShortVersionString: '1.3.1' },
  exception: { type: 'EXC_BREAKPOINT', signal: 'SIGTRAP', codes: '0x1, 0x2' },
  termination: { indicator: 'Trace/BPT trap: 5', namespace: 'SIGNAL', code: 5 },
  faultingThread: 0,
  threads: [
    {
      name: 'CrBrowserMain',
      queue: 'com.apple.main-thread',
      frames: [
        { symbol: 'node::PerIsolatePlatformData::RunForegroundTask', symbolLocation: 268, imageIndex: 1 },
        { symbol: 'ElectronMain' }, // symbol but no symbolLocation → "+0"
        { imageIndex: 1, imageOffset: 84838524 } // no symbol
      ]
    }
  ]
}

describe('summarizeCrashIps', () => {
  it('extracts version, OS, exception, termination, and the faulting thread frames', () => {
    const out = summarizeCrashIps(ips({ app_name: 'Orchid', app_version: '1.3.1' }, fullBody))
    expect(out).toContain('Orchid 1.3.1')
    expect(out).toContain('macOS 26.5.1')
    expect(out).toContain('EXC_BREAKPOINT SIGTRAP 0x1, 0x2')
    expect(out).toContain('termination: Trace/BPT trap: 5')
    expect(out).toContain('thread 0 CrBrowserMain [com.apple.main-thread]:')
    expect(out).toContain('node::PerIsolatePlatformData::RunForegroundTask+268')
    expect(out).toContain('ElectronMain+0') // symbol with no symbolLocation
    expect(out).toContain('img1+84838524') // frame without a symbol
  })

  it('falls back to bundle version when there is no header line', () => {
    const out = summarizeCrashIps(ips(null, fullBody))
    expect(out).toContain('Orchid 1.3.1')
  })

  it('uses "?" when neither header nor bundle has a version', () => {
    const out = summarizeCrashIps(ips(null, { threads: [] }))
    expect(out).toContain('Orchid ? · ?')
  })

  it('defaults to thread 0 when faultingThread is missing, and omits an empty label', () => {
    const out = summarizeCrashIps(
      ips(null, { bundleInfo: { CFBundleShortVersionString: '1.3.1' }, threads: [{}] })
    )
    expect(out).toContain('thread 0:')
    expect(out).not.toContain('thread 0 ')
  })

  it('omits exception/termination lines when absent', () => {
    const out = summarizeCrashIps(ips(null, { threads: [] }))
    expect(out).not.toContain('exception:')
    expect(out).not.toContain('termination:')
  })

  it('returns a raw snippet when the body is not JSON', () => {
    const out = summarizeCrashIps('not json at all\nstill not json')
    expect(out).toContain('still not json')
  })

  it('returns a raw snippet when parsing throws downstream (malformed frames)', () => {
    // frames as a number makes .slice throw → caught → raw fallback
    const text = ips(null, { bundleInfo: { CFBundleShortVersionString: '1.3.1' }, faultingThread: 0, threads: [{ frames: 5 }] })
    const out = summarizeCrashIps(text)
    expect(out).toContain('1.3.1') // the raw JSON snippet still contains it
  })
})
