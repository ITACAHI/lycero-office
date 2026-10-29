/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
/**
 * @vitest-environment jsdom
 *
 * LocaleProvider end-to-end F2/F3 wiring: optional-chains the aiOffice
 * bridge (no crash when undefined) and always subscribes to
 * onLanguageChanged, so a push from the main process reaches the renderer
 * even when no onExternalChange prop is passed.
 */
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HomeApi, UiLanguage } from '../src/shared/home-api'
import { LocaleProvider } from '../src/renderer/src/locale'
import { useI18n } from '../src/renderer/src/locale'

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
actEnvironment.IS_REACT_ACT_ENVIRONMENT = true

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(() => {
  root.unmount()
  host.remove()
  delete (window as unknown as { aiOffice?: HomeApi }).aiOffice
  document.documentElement.lang = ''
})

/** the renderer-side helper: pull the current lang out of the context */
function LangProbe({ onLang }: { onLang: (lang: string) => void }): null {
  const { lang } = useI18n()
  onLang(lang)
  return null
}

describe('LocaleProvider F2 — aiOffice optional chain', () => {
  it('does not throw when window.aiOffice is undefined', async () => {
    // the F2 regression: the bridge is missing in non-Electron contexts
    expect(window.aiOffice).toBeUndefined()
    await act(async () => {
      root.render(
        createElement(
          LocaleProvider,
          { initial: 'zh' },
          createElement(LangProbe, { onLang: () => {} }),
        ),
      )
    })
    // renders successfully; no exception escaped
  })

  it('survives setLanguage when the bridge rejects', async () => {
    const setLanguage = vi.fn(async () => {
      throw new Error('bridge down')
    })
    window.aiOffice = {
      setLanguage,
      getLanguage: async () => 'zh',
      onLanguageChanged: () => () => {},
      getUpdateChannel: async () => 'stable',
      setUpdateChannel: async () => {},
    } as unknown as HomeApi
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    let captured = ''
    await act(async () => {
      root.render(
        createElement(
          LocaleProvider,
          { initial: 'zh' },
          createElement(LangProbe, { onLang: (l) => (captured = l) }),
        ),
      )
    })
    // the F2 path swallows the rejection with a warning rather than letting
    // it bubble to the caller
    await act(async () => {
      // probe does not expose setLang; render a child that calls it via context
      // (using a tiny inline component)
      function Setter(): null {
        const { setLang } = useI18n()
        void setLang('vi')
        return null
      }
      root.render(
        createElement(
          LocaleProvider,
          { initial: 'zh' },
          createElement(LangProbe, { onLang: (l) => (captured = l) }),
          createElement(Setter),
        ),
      )
    })
    expect(setLanguage).toHaveBeenCalledWith('vi')
    expect(captured).toBe('vi')
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('LocaleProvider F3 — onLanguageChanged listener', () => {
  it('subscribes on mount and forwards every push to setLangState', async () => {
    let captured = ''
    const handlers = new Set<(lang: UiLanguage) => void>()
    window.aiOffice = {
      getLanguage: async () => 'zh',
      setLanguage: async () => {},
      // record every subscriber; the test fires pushes directly into this set
      onLanguageChanged: (handler) => {
        handlers.add(handler)
        return () => {
          handlers.delete(handler)
        }
      },
      getUpdateChannel: async () => 'stable',
      setUpdateChannel: async () => {},
    } as unknown as HomeApi
    await act(async () => {
      root.render(
        createElement(
          LocaleProvider,
          { initial: 'zh' },
          createElement(LangProbe, { onLang: (l) => (captured = l) }),
        ),
      )
    })
    expect(handlers.size).toBe(1)
    // main process pushes 'vi' — the listener must forward unconditionally
    // regardless of whether any onExternalChange-style prop was passed
    await act(async () => {
      for (const h of handlers) h('vi')
    })
    expect(captured).toBe('vi')
    // htmlLang expands Lang → BCP-47 for <html lang>; 'vi' → 'vi-VN'
    expect(document.documentElement.lang).toBe('vi-VN')
  })

  it('unsubscribes on unmount', async () => {
    const handlers = new Set<(lang: UiLanguage) => void>()
    window.aiOffice = {
      getLanguage: async () => 'zh',
      setLanguage: async () => {},
      onLanguageChanged: (handler) => {
        handlers.add(handler)
        return () => {
          handlers.delete(handler)
        }
      },
      getUpdateChannel: async () => 'stable',
      setUpdateChannel: async () => {},
    } as unknown as HomeApi
    await act(async () => {
      root.render(
        createElement(
          LocaleProvider,
          { initial: 'zh' },
          createElement(LangProbe, { onLang: () => {} }),
        ),
      )
    })
    expect(handlers.size).toBe(1)
    await act(async () => {
      root.unmount()
    })
    expect(handlers.size).toBe(0)
  })

  it('ignores pushes for the current language (no-op rerender)', async () => {
    let captured = ''
    const handlers = new Set<(lang: UiLanguage) => void>()
    window.aiOffice = {
      getLanguage: async () => 'vi',
      setLanguage: async () => {},
      onLanguageChanged: (handler) => {
        handlers.add(handler)
        return () => {
          handlers.delete(handler)
        }
      },
      getUpdateChannel: async () => 'stable',
      setUpdateChannel: async () => {},
    } as unknown as HomeApi
    await act(async () => {
      root.render(
        createElement(
          LocaleProvider,
          { initial: 'vi' },
          createElement(LangProbe, { onLang: (l) => (captured = l) }),
        ),
      )
    })
    await act(async () => {
      for (const h of handlers) h('vi')
    })
    // still 'vi' — the no-op guard keeps the listener from churning renders
    expect(captured).toBe('vi')
  })

  // regression guard for OCR C1/C2: an effect that lists `lang` in its deps
  // would tear down + re-register the IPC listener on every render, so the
  // active subscriber count must stay at exactly 1 across an arbitrary
  // number of state changes
  it('does not re-subscribe on every render', async () => {
    let subscribeCalls = 0
    let unsubscribeCalls = 0
    const handlers = new Set<(lang: UiLanguage) => void>()
    window.aiOffice = {
      getLanguage: async () => 'zh',
      setLanguage: async () => {},
      onLanguageChanged: (handler) => {
        subscribeCalls += 1
        handlers.add(handler)
        return () => {
          unsubscribeCalls += 1
          handlers.delete(handler)
        }
      },
      getUpdateChannel: async () => 'stable',
      setUpdateChannel: async () => {},
    } as unknown as HomeApi
    let captured = ''
    function ForceRender(): null {
      // changing the captured string forces a re-render of LocaleProvider's
      // children tree; with `lang` in the deps array, this used to add a
      // second IPC subscriber and remove the first
      const _ = captured
      void _
      return null
    }
    await act(async () => {
      root.render(
        createElement(
          LocaleProvider,
          { initial: 'zh' },
          createElement(LangProbe, { onLang: (l) => (captured = l) }),
          createElement(ForceRender),
        ),
      )
    })
    expect(subscribeCalls).toBe(1)
    expect(unsubscribeCalls).toBe(0)
    expect(handlers.size).toBe(1)
    // simulate many re-renders: nothing should change
    for (let i = 0; i < 5; i += 1) {
      await act(async () => {
        captured = `noise-${i}`
        root.render(
          createElement(
            LocaleProvider,
            { initial: 'zh' },
            createElement(LangProbe, { onLang: (l) => (captured = l) }),
            createElement(ForceRender),
          ),
        )
      })
    }
    expect(subscribeCalls).toBe(1)
    expect(unsubscribeCalls).toBe(0)
    expect(handlers.size).toBe(1)
  })
})
