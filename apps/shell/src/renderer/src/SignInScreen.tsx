/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useI18n } from './locale'
import './AuthScreen.css'

type LoginError = 'timeout' | 'launch' | 'network' | 'expired' | 'failed'

const LOGIN_POLL_MS = 2500
const LOGIN_DEFAULT_DEADLINE_MS = 300_000

interface SignInScreenProps {
  /** Called when the user completes sign-in (success) or dismisses (X). */
  onDone: (success: boolean) => void
  /** Optional AI quota remaining for the month. Rendered as a micro-hint below the CTA. */
  userQuota?: number
  /** Immediately start the OAuth browser login flow when the screen mounts. */
  autoStart?: boolean
}

export function SignInScreen({ onDone, userQuota, autoStart = false }: SignInScreenProps) {
  const { t } = useI18n()
  const [waiting, setWaiting] = useState(false)
  const [loginError, setLoginError] = useState<LoginError | null>(null)
  const [authUrl, setAuthUrl] = useState<string | null>(null)
  const [urlCopied, setUrlCopied] = useState(false)
  const loginDeadline = useRef(0)
  const statusSeq = useRef(0)
  const loginNonce = useRef(0)
  const autoStarted = useRef(false)

  // Login progress pushed from main (Lycero device code or deep link)
  useEffect(() => {
    const off = window.aiOffice.onAccountLogin?.((ev) => {
      if (ev.phase === 'url') {
        if (ev.url) setAuthUrl(ev.url)
        if (ev.expiresInSec) loginDeadline.current = Date.now() + ev.expiresInSec * 1000
      } else if (ev.phase === 'success') {
        statusSeq.current++
        setWaiting(false)
        setAuthUrl(null)
        setLoginError(null)
        onDone(true)
      } else if (ev.phase === 'error') {
        setWaiting(false)
        setAuthUrl(null)
        setLoginError(
          ev.error === 'network' ? 'network' : ev.error === 'expired' ? 'expired' : 'failed',
        )
      }
    })
    return off
  }, [onDone])

  // Config-file / status polling as fallback success path
  useEffect(() => {
    if (!waiting) return
    const timer = setInterval(() => {
      void window.aiOffice.accountStatus().then((s) => {
        if (s.loggedIn) {
          statusSeq.current++
          setWaiting(false)
          setAuthUrl(null)
          setLoginError(null)
          onDone(true)
        } else if (loginDeadline.current > 0 && Date.now() > loginDeadline.current) {
          setWaiting(false)
          setAuthUrl(null)
          setLoginError('timeout')
        }
      })
    }, LOGIN_POLL_MS)
    return () => clearInterval(timer)
  }, [waiting, loginNonce, onDone])

  // OAuth Auth Code Flow with PKCE — opens browser, waits for deep-link callback
  const startLogin = useCallback(() => {
    loginDeadline.current = Date.now() + LOGIN_DEFAULT_DEADLINE_MS
    setWaiting(true)
    setLoginError(null)
    setAuthUrl(null)
    setUrlCopied(false)
    loginNonce.current++
    void window.aiOffice.accountLogin?.().then((ok) => {
      if (!ok) {
        setWaiting(false)
        setLoginError('launch')
      }
    })
  }, [])

  useEffect(() => {
    if (autoStart && !autoStarted.current) {
      autoStarted.current = true
      startLogin()
    }
  }, [autoStart, startLogin])

  const retryLogin = useCallback(() => {
    setLoginError(null)
    startLogin()
  }, [startLogin])

  const openLoginUrl = useCallback(() => {
    if (window.aiOffice.openLoginUrl) {
      void window.aiOffice.openLoginUrl()
    } else if (authUrl) {
      window.open(authUrl, '_blank', 'noopener')
    }
  }, [authUrl])

  const copyLoginUrl = useCallback(() => {
    if (!authUrl) return
    void navigator.clipboard.writeText(authUrl).then(() => {
      setUrlCopied(true)
      setTimeout(() => setUrlCopied(false), 2000)
    })
  }, [authUrl])

  const handleDismiss = useCallback(() => {
    onDone(false)
  }, [onDone])

  const errorText = loginError
    ? {
        timeout: t('loginTimeout'),
        launch: t('loginLaunchFailed'),
        network: t('loginNetworkError'),
        expired: t('loginExpired'),
        failed: t('loginFailed'),
      }[loginError]
    : null

  const hasQuota = userQuota != null && userQuota > 0

  return (
    <div
      className="auth-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-headline"
    >
      {/* Close button */}
      <button
        className="auth-close"
        onClick={handleDismiss}
        aria-label={t('closeTab') ?? 'Close'}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M4 4l8 8M12 4l-8 8"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {/* Lycero mark — decorative */}
      <div className="auth-mark" aria-hidden="true">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="32" height="32" rx="8" fill="var(--auth-brand)" />
          <path d="M8 24V8l8 10 8-10v16" stroke="var(--auth-btn-on-brand)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div className="auth-grid">
        {/* Eyebrow */}
        <p className="auth-eyebrow">{t('authEyebrow')}</p>

        {/* Headline */}
        <h1 id="auth-headline" className="auth-headline">
          {t('authHeadlineA')}
          <br />
          {t('authHeadlineB')}
        </h1>

        {/* Sub */}
        <p className="auth-sub">{t('authSub')}</p>

        {/* CTA wrap */}
        <div className="auth-cta-wrap">
          <button
            type="button"
            className={`auth-cta${waiting ? ' is-waiting' : ''}`}
            onClick={waiting ? handleDismiss : retryLogin}
            disabled={false}
          >
            {waiting ? (
              <>
                <span className="auth-cta-dot" aria-hidden="true" />
                {t('authCtaWaiting')}
              </>
            ) : (
              <>
                {t('authCtaIdle')}
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </>
            )}
          </button>

          {/* Micro quota hint */}
          {hasQuota && (
            <p className="auth-quota">
              {t('authMicroQuota', { n: userQuota!.toLocaleString('vi-VN') })}
            </p>
          )}

          {/* Inline error */}
          {loginError && errorText && (
            <p className="auth-inline-error" role="alert">
              {t('authInlineError')}
            </p>
          )}

          {/* Waiting — URL fallback actions */}
          {waiting && authUrl && (
            <div className="auth-url-actions" role="status">
              <button className="auth-url-btn" onClick={openLoginUrl}>
                {t('authOpenLink')}
              </button>
              <button
                className={`auth-url-btn${urlCopied ? ' copied' : ''}`}
                onClick={copyLoginUrl}
              >
                {urlCopied ? t('authCopied') : t('authCopyLink')}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="auth-footer-text">
          {t('authFooterText')}
        </p>
      </div>
    </div>
  )
}
