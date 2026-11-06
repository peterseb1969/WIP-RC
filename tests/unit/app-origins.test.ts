import { describe, it, expect } from 'vitest'
import { appLabel, appUrl, RELOGIN_WINDOW_MS, shouldReloadForLogin } from '@/lib/app-origins'

// Apps are served under WIP's origin (/apps/<name>/) or each on its own
// origin (<name>.<host>). RC links another app by working out, from its own
// location, which of the two the install uses.

describe('appLabel', () => {
  it('reads the label from an /apps/ base path', () => {
    expect(appLabel('/apps/rc')).toBe('rc')
    expect(appLabel('/apps/rc/')).toBe('rc')
    expect(appLabel('')).toBeNull()
    expect(appLabel('/console')).toBeNull()
  })
})

describe('appUrl', () => {
  it('links another app on its own origin when RC is on its own', () => {
    expect(appUrl('shop', { protocol: 'https:', hostname: 'rc.localhost', port: '8443' }, '/apps/rc'))
      .toBe('https://shop.localhost:8443/apps/shop/')
    expect(appUrl('shop', { protocol: 'https:', hostname: 'rc.wip.example', port: '' }, '/apps/rc'))
      .toBe('https://shop.wip.example/apps/shop/')
  })

  it('links under WIP\'s origin in path mode', () => {
    expect(appUrl('shop', { protocol: 'https:', hostname: 'localhost', port: '8443' }, '/apps/rc')).toBe('/apps/shop/')
    // A host that merely starts with "rc" is not RC's own origin.
    expect(appUrl('shop', { protocol: 'https:', hostname: 'rcbox.lan', port: '' }, '/apps/rc')).toBe('/apps/shop/')
    // RC served at the root (local dev): plain path.
    expect(appUrl('shop', { protocol: 'http:', hostname: 'localhost', port: '5173' }, '')).toBe('/apps/shop/')
  })
})

describe('shouldReloadForLogin', () => {
  it('reloads once, and not again while the last reload is recent', () => {
    expect(shouldReloadForLogin(1_000_000, null)).toBe(true)
    expect(shouldReloadForLogin(1_000_000, 1_000_000 - 5_000)).toBe(false)
    expect(shouldReloadForLogin(1_000_000, 1_000_000 - RELOGIN_WINDOW_MS - 1)).toBe(true)
  })
})
