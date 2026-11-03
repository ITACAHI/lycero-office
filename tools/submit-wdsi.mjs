#!/usr/bin/env node
/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * Automated Microsoft Security Intelligence (WDSI) & Defender SmartScreen Whitelist Pipeline:
 * - Runs automatically ONCE for every new version (via GitHub Actions `release.yml` and `tools/release-deploy.mjs`).
 * - Tracks submitted SHA-256 digests in `.wdsi-submitted.json` so each version is only submitted once unless `--force` is passed.
 * - Uses a persistent Playwright Edge profile (`.wdsi-profile`) + `.wdsi-auth.json` (synced to GitHub Secret
 *   `WDSI_STORAGE_STATE_JSON`) so after signing in once, the script automatically controls the browser to
 *   fill and submit the Microsoft WDSI form for every new `.exe` release.
 */

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'

const ROOT_DIR = resolve(import.meta.dirname, '..')
const RELEASE_DIR = resolve(ROOT_DIR, 'apps/shell/release')
const AUTH_STATE_PATH = resolve(ROOT_DIR, '.wdsi-auth.json')
const PROFILE_DIR = resolve(ROOT_DIR, '.wdsi-profile')
const SUBMITTED_LEDGER_PATH = resolve(ROOT_DIR, '.wdsi-submitted.json')
const WDSI_PORTAL_URL = 'https://www.microsoft.com/en-us/wdsi/filesubmission?persona=SoftwareDeveloper'

const args = new Set(process.argv.slice(2))
const isCi = args.has('--ci')
const forceResubmit = args.has('--force')
const isHeaded = !isCi || args.has('--headed') || args.has('--login')

function sha256File(filePath) {
  const hash = createHash('sha256')
  hash.update(readFileSync(filePath))
  return hash.digest('hex')
}

function loadSubmittedLedger() {
  if (!existsSync(SUBMITTED_LEDGER_PATH)) return {}
  try {
    return JSON.parse(readFileSync(SUBMITTED_LEDGER_PATH, 'utf8'))
  } catch {
    return {}
  }
}

function saveSubmittedLedger(ledger) {
  writeFileSync(SUBMITTED_LEDGER_PATH, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8')
}

function ensureReleaseExesPresent(version) {
  if (!existsSync(RELEASE_DIR)) {
    mkdirSync(RELEASE_DIR, { recursive: true })
  }
  let exes = readdirSync(RELEASE_DIR).filter((f) => f.toLowerCase().endsWith('.exe'))
  if (exes.length === 0 && !isCi) {
    console.log(
      `[wdsi] No local .exe in apps/shell/release; downloading v${version} .exe assets from GitHub Release...`,
    )
    try {
      execFileSync(
        'gh',
        [
          'release',
          'download',
          `v${version}`,
          '--repo',
          'ITACAHI/lycero-office',
          '--pattern',
          '*.exe',
          '--dir',
          RELEASE_DIR,
          '--clobber',
        ],
        { stdio: 'inherit' },
      )
      exes = readdirSync(RELEASE_DIR).filter((f) => f.toLowerCase().endsWith('.exe'))
    } catch (err) {
      console.warn(
        `[wdsi] Could not download v${version} .exe from GitHub Release: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }
  return exes.sort().map((f) => join(RELEASE_DIR, f))
}

function findMpCmdRun() {
  if (process.platform !== 'win32') return null
  const platformRoot = 'C:\\ProgramData\\Microsoft\\Windows Defender\\Platform'
  if (existsSync(platformRoot)) {
    try {
      const dirs = readdirSync(platformRoot)
        .map((d) => join(platformRoot, d))
        .filter((full) => statSync(full).isDirectory())
        .sort()
        .reverse()
      for (const dir of dirs) {
        const candidate = join(dir, 'MpCmdRun.exe')
        if (existsSync(candidate)) return candidate
      }
    } catch {
      // ignore
    }
  }
  const fallback = 'C:\\Program Files\\Windows Defender\\MpCmdRun.exe'
  return existsSync(fallback) ? fallback : null
}

function scanWithDefender(exePaths) {
  const mpCmdRun = findMpCmdRun()
  const results = []
  if (!mpCmdRun) return results

  for (const exePath of exePaths) {
    const name = basename(exePath)
    try {
      console.log(`[wdsi] Scanning ${name} with Windows Defender...`)
      execFileSync(mpCmdRun, ['-Scan', '-ScanType', '3', '-File', exePath], {
        stdio: 'pipe',
        timeout: 120_000,
      })
      console.log(`[wdsi] Defender scan CLEAN: ${name}`)
      results.push({ file: name, status: 'clean' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      results.push({ file: name, status: 'warning', error: msg })
    }
  }
  return results
}

function generateSha256Sums(exePaths) {
  const lines = []
  const metadata = []
  for (const exePath of exePaths) {
    const name = basename(exePath)
    const digest = sha256File(exePath)
    const sizeBytes = statSync(exePath).size
    lines.push(`${digest}  ${name}`)
    metadata.push({ file: name, sha256: digest, sizeBytes, path: exePath })
  }
  const sumsPath = join(RELEASE_DIR, 'SHA256SUMS.txt')
  writeFileSync(sumsPath, `${lines.join('\n')}\n`, 'utf8')
  return metadata
}

function syncAuthStateToGitHubSecret() {
  if (!existsSync(AUTH_STATE_PATH) || isCi) return
  try {
    console.log('[wdsi] Syncing .wdsi-auth.json to GitHub Secret WDSI_STORAGE_STATE_JSON...')
    const raw = readFileSync(AUTH_STATE_PATH, 'utf8')
    execFileSync('gh', ['secret', 'set', 'WDSI_STORAGE_STATE_JSON', '--repo', 'ITACAHI/lycero-office'], {
      input: raw,
      stdio: ['pipe', 'inherit', 'inherit'],
    })
    console.log('[wdsi] Synced WDSI_STORAGE_STATE_JSON to GitHub Actions secrets.')
  } catch (err) {
    console.warn(
      `[wdsi] Could not auto-sync GitHub Secret (non-fatal): ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

function isAuthOrConsentUrl(url) {
  return /login\.microsoftonline\.com|login\.live\.com|account\.live\.com|account\.microsoft\.com/i.test(
    url,
  )
}

async function handleOAuthAndConsentLoop(page) {
  const deadline = Date.now() + (isCi ? 30_000 : 10 * 60 * 1000)
  let loggedWaiting = false

  while (Date.now() < deadline) {
    const url = page.url()
    if (!isAuthOrConsentUrl(url) && /microsoft\.com\/.*wdsi/i.test(url)) {
      const hasFilePicker = await page.locator('#filePicker').count().catch(() => 0)
      if (hasFilePicker > 0 && (await page.locator('#MsProductListButton').isVisible().catch(() => false))) {
        console.log('[wdsi] Authenticated on WDSI Software Developer submission form!')
        return true
      }

      const devBtn = page.locator('#SelectSoftwareDeveloper').first()
      if (await devBtn.isVisible().catch(() => false)) {
        await devBtn.click({ force: true }).catch(() => {})
        await page.waitForTimeout(500)
        const contBtn = page.locator('#btnTypeSelectedContinue').first()
        if (await contBtn.isVisible().catch(() => false)) {
          await contBtn.click({ force: true }).catch(() => {})
          await page.waitForTimeout(2000)
          continue
        }
      }
    }

    if (/account\.live\.com\/Consent|login\.live\.com|login\.microsoftonline\.com/i.test(url)) {
      const consentBtns = page.locator(
        'button:has-text("Accept"), button:has-text("Yes"), button:has-text("Continue"), input[type="submit"][value="Accept"], input[type="submit"][value="Yes"], #idSIButton9, button[data-testid="appConsentPrimaryButton"]',
      )
      if ((await consentBtns.count().catch(() => 0)) > 0) {
        const firstBtn = consentBtns.first()
        const passwordVisible = await page
          .locator('input[type="password"]:visible')
          .isVisible()
          .catch(() => false)
        const emailVisible = await page
          .locator('input[type="email"]:visible')
          .isVisible()
          .catch(() => false)
        if (!passwordVisible && !emailVisible && (await firstBtn.isVisible().catch(() => false))) {
          console.log(`[wdsi] Auto-clicking Consent / Stay-Signed-In button on ${url.split('?')[0]}...`)
          await firstBtn.click().catch(() => {})
          await page.waitForTimeout(2500)
          continue
        }
      }
    }

    if (!loggedWaiting) {
      console.log(`[wdsi] Waiting for OAuth / Consent completion (current URL: ${url.split('?')[0]})...`)
      loggedWaiting = true
    }
    await page.waitForTimeout(1500)
  }

  return !isAuthOrConsentUrl(page.url()) && /microsoft\.com\/.*wdsi/i.test(page.url())
}

async function waitForUploadComplete(page) {
  console.log('[wdsi] Waiting for file upload to Microsoft WDSI server to complete...')
  const start = Date.now()
  const maxWaitMs = 180_000
  while (Date.now() - start < maxWaitMs) {
    const cancelVisible = await page
      .locator('#uploadProgressCancel')
      .isVisible()
      .catch(() => false)
    const progressText = await page
      .locator('#uploadProgress, .progress-bar, #fileUploadProgress')
      .first()
      .innerText()
      .catch(() => '')
    if (!cancelVisible && Date.now() - start > 3500) {
      console.log(`[wdsi] File upload complete (${Math.round((Date.now() - start) / 1000)}s).`)
      return true
    }
    if (progressText) {
      console.log(`[wdsi] Upload progress: ${progressText.trim()}`)
    }
    await page.waitForTimeout(1500)
  }
  return true
}

async function driveWdsiFormForFile(page, item, version) {
  console.log(`[wdsi] Automating WDSI form for ${item.file} (v${version})...`)
  await page.goto(WDSI_PORTAL_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.waitForTimeout(2500)

  // Dismiss cookie banner if visible so it doesn't intercept clicks
  const rejectCookieBtn = page.locator('button:has-text("Reject"), button:has-text("Accept")').first()
  if (await rejectCookieBtn.isVisible().catch(() => false)) {
    await rejectCookieBtn.click().catch(() => {})
    await page.waitForTimeout(500)
  }

  const ready = await handleOAuthAndConsentLoop(page)
  if (!ready) {
    return {
      file: item.file,
      sha256: item.sha256,
      status: 'requires_auth_or_captcha',
      portalUrl: page.url(),
    }
  }

  await page.waitForTimeout(1500)

  // 1. Select Microsoft security product: #MsProductListButton -> #product34 ("Microsoft Defender Smartscreen")
  console.log('[wdsi] Selecting security product: Microsoft Defender Smartscreen (#product34)...')
  const productBtn = page.locator('#MsProductListButton')
  if (await productBtn.isVisible().catch(() => false)) {
    await productBtn.click({ force: true }).catch(() => {})
    await page.waitForTimeout(600)
    const smartScreenOption = page.locator('#product34, li:has-text("Microsoft Defender Smartscreen")').first()
    if (await smartScreenOption.isVisible().catch(() => false)) {
      await smartScreenOption.click({ force: true }).catch(() => {})
      await page.waitForTimeout(600)
    }
  }

  // 2. Fill Company Name *: #CompanyName
  console.log('[wdsi] Filling Company Name: ITAC AI Heavy Industries')
  await page.locator('#CompanyName').fill('ITAC AI Heavy Industries').catch(() => {})

  // 3. Do you have a Microsoft support case number? -> No (#CaseNumberNoCaption)
  await page.locator('#CaseNumberNoCaption').check({ force: true }).catch(async () => {
    await page.locator('label[for="CaseNumberNoCaption"], #CaseNumberNoCaption').first().click({ force: true }).catch(() => {})
  })

  // 4. Attach installer file to #filePicker
  console.log(`[wdsi] Uploading installer file: ${item.path}`)
  const filePicker = page.locator('#filePicker')
  await filePicker.setInputFiles(item.path)

  // 5. Should this file be removed from our database at a certain date? -> No (#ExpirationDateNo)
  await page.locator('#ExpirationDateNo').check({ force: true }).catch(async () => {
    await page.locator('label[for="ExpirationDateNo"], #ExpirationDateNo').first().click({ force: true }).catch(() => {})
  })

  // 6. What do you believe this file is? * -> Incorrectly detected as malware/malicious (#userOpinionClean)
  console.log('[wdsi] Selecting opinion: Incorrectly detected as malware/malicious (#userOpinionClean)')
  await page.locator('#userOpinionClean').check({ force: true }).catch(async () => {
    await page.locator('label[for="userOpinionClean"], #userOpinionClean').first().click({ force: true }).catch(() => {})
  })
  await page.waitForTimeout(500)

  // 7. Detection name *: #detectionName
  await page.locator('#detectionName').fill('SmartScreen:UnknownPublisher').catch(() => {})

  // 8. Additional information *: #textareaAddComments
  const notes = [
    `Official open-source release of Lycero Office Desktop v${version} (Apache-2.0).`,
    `Installer: ${item.file}`,
    `SHA-256: ${item.sha256}`,
    `Release URL: https://github.com/ITACAHI/lycero-office/releases/tag/v${version}`,
    `Code Signing Policy: https://github.com/ITACAHI/lycero-office/blob/main/CODE_SIGNING_POLICY.md`,
    `Please whitelist for Microsoft Defender SmartScreen & Antivirus.`,
  ].join('\n')
  await page.locator('#textareaAddComments').fill(notes).catch(() => {})

  // Wait for background file upload to complete before clicking Continue
  await waitForUploadComplete(page)

  // 9. Click #btnFormCompletedContinue ("Continue") to move to Review & Submit screen
  console.log('[wdsi] Clicking #btnFormCompletedContinue ("Continue")...')
  await page.locator('#btnFormCompletedContinue').click({ force: true }).catch(() => {})
  await page.waitForTimeout(3000)

  // Check if #btnSubmitForm is visible; if not, wait a bit more for large file upload / validation
  let submitVisible = await page.locator('#btnSubmitForm').isVisible().catch(() => false)
  if (!submitVisible) {
    const errors = await page
      .locator('.c-Alert, .error, [role="alert"], .field-validation-error, .text-danger')
      .allInnerTexts()
      .catch(() => [])
    if (errors.filter((e) => e.trim()).length > 0) {
      console.log(`[wdsi] Form validation notices: ${errors.map((e) => e.trim()).filter(Boolean).join(' | ')}`)
    }
    // Wait up to 45s in case upload was still finalizing
    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(3000)
      await page.locator('#btnFormCompletedContinue').click({ force: true }).catch(() => {})
      await page.waitForTimeout(1500)
      submitVisible = await page.locator('#btnSubmitForm').isVisible().catch(() => false)
      if (submitVisible) break
    }
  }

  if (submitVisible) {
    console.log('[wdsi] Reached Review & Submit screen (#btnSubmitForm visible)!')
    const captchaInput = page.locator('#hipSolutionElementV')
    if (await captchaInput.isVisible().catch(() => false)) {
      const captchaPngPath = join(RELEASE_DIR, 'wdsi-captcha.png')
      const captchaAnswerPath = join(ROOT_DIR, '.wdsi-captcha-answer.txt')
      if (existsSync(captchaAnswerPath)) {
        try {
          writeFileSync(captchaAnswerPath, '', 'utf8')
        } catch {
          // ignore
        }
      }
      await captchaInput.scrollIntoViewIfNeeded().catch(() => {})
      await page.waitForTimeout(800)
      await page.screenshot({ path: captchaPngPath, fullPage: false }).catch(() => {})
      console.log(
        `[wdsi] Saved CAPTCHA screenshot to ${captchaPngPath}. Waiting for answer in .wdsi-captcha-answer.txt or browser input...`,
      )
      await captchaInput.focus().catch(() => {})
      const capDeadline = Date.now() + (isCi ? 15_000 : 180_000)
      while (Date.now() < capDeadline) {
        const bodyText = await page.locator('body').innerText().catch(() => '')
        if (/Submission ID|Thank you for your submission|successfully submitted/i.test(bodyText)) {
          break
        }
        if (existsSync(captchaAnswerPath)) {
          const fileAns = readFileSync(captchaAnswerPath, 'utf8').trim()
          if (fileAns.length >= 3) {
            console.log(`[wdsi] Applying automated CAPTCHA solution: "${fileAns}"`)
            writeFileSync(captchaAnswerPath, '', 'utf8')
            await captchaInput.fill(fileAns).catch(() => {})
            await page.waitForTimeout(400)
            await page.locator('#btnSubmitForm').click({ force: true }).catch(() => {})
            await waitForUploadComplete(page)
            await page.waitForTimeout(4000)
            const afterText = await page.locator('body').innerText().catch(() => '')
            if (/Submission ID|Thank you for your submission|successfully submitted/i.test(afterText)) {
              break
            }
            // If CAPTCHA rejected and refreshed, take a fresh screenshot
            await page.screenshot({ path: captchaPngPath, fullPage: false }).catch(() => {})
            console.log(`[wdsi] Refreshed CAPTCHA screenshot at ${captchaPngPath}`)
          }
        }
        const uploadingModal = await page.locator('#uploadProgressCancel').isVisible().catch(() => false)
        const capVal = await captchaInput.inputValue().catch(() => '')
        if (!uploadingModal && capVal.trim().length >= 5) {
          console.log('[wdsi] CAPTCHA filled in browser, clicking #btnSubmitForm ("Submit")...')
          await page.locator('#btnSubmitForm').click({ force: true }).catch(() => {})
          await waitForUploadComplete(page)
          await page.waitForTimeout(4000)
          const afterText = await page.locator('body').innerText().catch(() => '')
          if (/Submission ID|Thank you for your submission|successfully submitted/i.test(afterText)) {
            break
          }
        }
        await page.waitForTimeout(1000)
      }
    } else {
      console.log(`[wdsi] Clicking #btnSubmitForm ("Submit") for ${item.file}...`)
      await page.locator('#btnSubmitForm').click({ force: true }).catch(() => {})
      await page.waitForTimeout(6000)
    }

    const finalPngPath = join(RELEASE_DIR, `wdsi-result-${item.file}.png`)
    await page.screenshot({ path: finalPngPath, fullPage: false }).catch(() => {})
    const finalText = await page.locator('body').innerText().catch(() => '')
    const matchId = finalText.match(/Submission ID[:\s]*([0-9a-fA-F-]{8,})/i)
    const submissionId = matchId ? matchId[1] : null
    if (submissionId) {
      console.log(`[wdsi] SUCCESS! Microsoft WDSI Submission ID for ${item.file}: ${submissionId}`)
    } else {
      console.log(`[wdsi] Final screen text snippet: ${finalText.slice(0, 600).replace(/\s+/g, ' ')}`)
    }
    return {
      file: item.file,
      sha256: item.sha256,
      status: submissionId || /Thank you for your submission|successfully submitted/i.test(finalText) ? 'submitted' : 'review_reached',
      submissionId,
      portalUrl: page.url(),
    }
  }

  return {
    file: item.file,
    sha256: item.sha256,
    status: 'assisted_session',
    portalUrl: page.url(),
  }
}

async function submitFilesToWdsiPortal(fileMetadata, version) {
  const ledger = loadSubmittedLedger()
  const pendingFiles = fileMetadata.filter((item) => {
    if (forceResubmit) return true
    return !ledger[item.sha256]
  })

  if (pendingFiles.length === 0) {
    console.log(
      `[wdsi] All ${fileMetadata.length} installer(s) for v${version} have already been submitted to WDSI (use --force to re-submit).`,
    )
    return fileMetadata.map((item) => ({
      file: item.file,
      sha256: item.sha256,
      status: 'already_submitted_for_version',
      submittedAt: ledger[item.sha256]?.timestamp,
      submissionId: ledger[item.sha256]?.submissionId || null,
    }))
  }

  const { chromium } = await import('playwright-core')
  const submissions = []
  let context
  let browser

  try {
    if (isHeaded) {
      mkdirSync(PROFILE_DIR, { recursive: true })
      try {
        context = await chromium.launchPersistentContext(PROFILE_DIR, {
          channel: 'msedge',
          headless: false,
          viewport: { width: 1280, height: 860 },
        })
      } catch {
        context = await chromium.launchPersistentContext(PROFILE_DIR, {
          headless: false,
          viewport: { width: 1280, height: 860 },
        })
      }
    } else {
      try {
        browser = await chromium.launch({ channel: 'msedge', headless: true })
      } catch {
        browser = await chromium.launch({ headless: true })
      }
      let storageState
      if (process.env.WDSI_STORAGE_STATE_JSON?.trim()) {
        try {
          storageState = JSON.parse(process.env.WDSI_STORAGE_STATE_JSON)
        } catch {
          // ignore
        }
      } else if (existsSync(AUTH_STATE_PATH)) {
        storageState = AUTH_STATE_PATH
      }
      context = await browser.newContext(storageState ? { storageState } : {})
    }

    const page = context.pages()[0] || (await context.newPage())

    for (const item of pendingFiles) {
      try {
        const result = await driveWdsiFormForFile(page, item, version)
        submissions.push(result)
        if (result.status === 'submitted') {
          ledger[item.sha256] = {
            version,
            file: item.file,
            submissionId: result.submissionId || null,
            timestamp: new Date().toISOString(),
          }
          saveSubmittedLedger(ledger)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        submissions.push({
          file: item.file,
          sha256: item.sha256,
          status: 'portal_error',
          error: msg,
        })
      }
    }

    await context.storageState({ path: AUTH_STATE_PATH }).catch(() => {})
    syncAuthStateToGitHubSecret()
  } finally {
    if (context) await context.close().catch(() => {})
    if (browser) await browser.close().catch(() => {})
  }

  return submissions
}

async function main() {
  const pkgJson = JSON.parse(readFileSync(join(ROOT_DIR, 'package.json'), 'utf8'))
  const version = pkgJson.version

  const exePaths = ensureReleaseExesPresent(version)
  if (exePaths.length === 0) {
    console.log(`[wdsi] No .exe installers found in ${RELEASE_DIR}.`)
    if (!isCi) process.exitCode = 1
    return
  }

  const fileMetadata = generateSha256Sums(exePaths)
  const defenderScan = scanWithDefender(exePaths)
  const wdsiSubmissions = await submitFilesToWdsiPortal(fileMetadata, version)

  const report = {
    version,
    timestamp: new Date().toISOString(),
    portalUrl: WDSI_PORTAL_URL,
    files: fileMetadata.map(({ file, sha256, sizeBytes }) => ({ file, sha256, sizeBytes })),
    defenderScan,
    wdsiSubmissions,
  }

  const reportPath = join(RELEASE_DIR, 'wdsi-submission-report.json')
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(`[wdsi] Wrote submission report to ${reportPath}`)
}

main().catch((err) => {
  console.error('[wdsi] Fatal error:', err)
  if (!isCi) process.exit(1)
})
