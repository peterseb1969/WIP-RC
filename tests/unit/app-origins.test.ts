import { describe, it, expect } from 'vitest'
import { appUrl, installHost, RELOGIN_WINDOW_MS, shouldReloadForLogin } from '@/lib/app-origins'

// Every app is served at the root of its own origin, <label>.<host>, RC
// included. RC links another app by swapping its own label for the app's.

describe('installHost', () => {
  it('drops the first label of RC\'s hostname', () => {
    expect(installHost('rc.wip.localhost')).toBe('wip.localhost')
    expect(installHost('rc.dev-test.internal')).toBe('dev-test.internal')
  })

  it('is null for a hostname no install serves apps on', () => {
    expect(installHost('localhost')).toBeNull()
    expect(installHost('.localhost')).toBeNull()
    expect(installHost('rc.')).toBeNull()
  })
})

describe('appUrl', () => {
  it('links another app at the root of its own origin', () => {
    expect(appUrl('shop', { protocol: 'https:', hostname: 'rc.wip.localhost', port: '8443' }))
      .toBe('https://shop.wip.localhost:8443/')
    expect(appUrl('shop', { protocol: 'https:', hostname: 'rc.kb.internal', port: '' }))
      .toBe('https://shop.kb.internal/')
  })

  it('has no link when RC is not on an app origin (the local dev server)', () => {
    expect(appUrl('shop', { protocol: 'http:', hostname: 'localhost', port: '5174' })).toBeNull()
  })
})

describe('shouldReloadForLogin', () => {
  it('reloads once, and not again while the last reload is recent', () => {
    expect(shouldReloadForLogin(1_000_000, null)).toBe(true)
    expect(shouldReloadForLogin(1_000_000, 1_000_000 - 5_000)).toBe(false)
    expect(shouldReloadForLogin(1_000_000, 1_000_000 - RELOGIN_WINDOW_MS - 1)).toBe(true)
  })
})
