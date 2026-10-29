/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import { createRoot } from 'react-dom/client'
import { htmlDir, htmlLang, type Lang } from '@lycero/i18n'
import App from './App'
import { LocaleProvider } from './i18n/locale'
import type { UiTheme } from '../shared/ipc'
import '@lycero/ui/tokens.css'
import '@lycero/ui/screentip.css'
import '@lycero/ui/ai-model-picker.css'
import '@lycero/ui/ai-queue-strip.css'
import '@lycero/ui/ai-usage.css'
import '@lycero/ui/ai-skills.css'
import '@lycero/ui/color-picker.css'
import '@lycero/ui/dropdown.css'
import '@lycero/ui/ribbon-collapse.css'
import '@lycero/ui/markdown.css'
import '@lycero/ui/ai-panel-prefs.css'
import '@lycero/ui/ai-scope-quote.css'
import './styles.css'
import { applyAiPanelPrefs, installScreenTips } from '@lycero/ui'

installScreenTips()

function applyTheme(theme: UiTheme): void {
  if (theme === 'system') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', theme)
}

void (async () => {
  const [lang, theme] = await Promise.all([
    window.pdfApi.getLanguage().catch(() => 'vi' as const),
    window.pdfApi.getTheme().catch(() => 'system' as const),
  ])
  document.documentElement.lang = htmlLang(lang as Lang)
  document.documentElement.dir = htmlDir(lang)
  applyTheme(theme)
  window.pdfApi.onThemeChanged(applyTheme)
  await window.pdfApi
    ?.getAiPanelPrefs?.()
    .then(applyAiPanelPrefs)
    .catch(() => {})
  window.pdfApi?.onAiPanelPrefsChanged?.(applyAiPanelPrefs)
  createRoot(document.getElementById('root')!).render(
    <LocaleProvider initial={lang}>
      <App />
    </LocaleProvider>,
  )
})()
