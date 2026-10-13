import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getColorMode, setColorMode } from './colorMode'

function deviceIsDark(dark: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: dark && q.includes('dark'), addEventListener: () => {} }))
}

describe('colorMode', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })
  afterEach(() => vi.unstubAllGlobals())

  it('defaults to System and follows the device', () => {
    deviceIsDark(true)
    expect(getColorMode()).toBe('system')
    setColorMode('system')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    deviceIsDark(false)
    setColorMode('system')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('stores Light and Dark per browser and overrides the device', () => {
    deviceIsDark(true)
    setColorMode('light')
    expect(getColorMode()).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    deviceIsDark(false)
    setColorMode('dark')
    expect(localStorage.getItem('fv:color-mode')).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    setColorMode('system')
    expect(localStorage.getItem('fv:color-mode')).toBeNull()
  })
})
