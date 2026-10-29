/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 *
 * Windows Authenticode Code Signing Pipeline (`scripts/win-sign.cjs`)
 *
 * Modes:
 *   - "test"       : Signs with CI/env Authenticode PFX (`LYCERO_WIN_PFX_PATH`
 *                    + `LYCERO_WIN_PFX_PASSWORD`) + RFC3161 Timestamp Server.
 *   - "production" : Signs with Azure Trusted Signing, DigiCert KeyLocker (`smctl`),
 *                    SignPath CI, or Production PFX (`LYCERO_WIN_PROD_PFX_PATH` / `CSC_LINK`).
 *
 * Usage:
 *   node scripts/win-sign.cjs <test|production> <path-to-exe-or-dll>
 */

const { execFileSync } = require('node:child_process')
const { existsSync } = require('node:fs')
const { resolve } = require('node:path')

const mode = process.argv[2] || 'test'
const targetPath = process.argv[3]

if (!targetPath) {
  console.error('Usage: node scripts/win-sign.cjs <test|production> <file-path>')
  process.exit(1)
}

const absTarget = resolve(targetPath)
if (!existsSync(absTarget)) {
  console.error(`[win-sign] Target file does not exist: ${absTarget}`)
  process.exit(1)
}

const TIMESTAMP_URL = process.env.LYCERO_TIMESTAMP_URL || 'http://timestamp.digicert.com'

function signWithPowerShellPfx(pfxPath, pfxPassword, filePath) {
  const psScript = `
$ErrorActionPreference = 'Stop'
$pfxPath = $env:SIGN_PFX_PATH
$pfxPass = ConvertTo-SecureString -String $env:SIGN_PFX_PASS -Force -AsPlainText
$cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($pfxPath, $pfxPass)
$target = $env:SIGN_TARGET_PATH
$tsUrl = $env:SIGN_TIMESTAMP_URL

$maxAttempts = 6
$res = $null
for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
  try {
    $res = Set-AuthenticodeSignature -FilePath $target -Certificate $cert -HashAlgorithm SHA256 -TimestampServer $tsUrl
    if ($res.Status -eq 'NotSigned') {
      # Fallback without timestamp server if build machine is temporarily offline
      $res = Set-AuthenticodeSignature -FilePath $target -Certificate $cert -HashAlgorithm SHA256
    }
    if ($res.Status -ne 'NotSigned') {
      break
    }
  } catch {
    if ($attempt -eq $maxAttempts) {
      throw $_
    }
  }
  Start-Sleep -Milliseconds 1500
}

if ($null -eq $res -or $res.Status -eq 'NotSigned') {
  throw "Set-AuthenticodeSignature failed with status $($res.Status): $($res.StatusMessage)"
}
Write-Host "[win-sign] Signed: $target ($($cert.Subject) | Status: $($res.Status))"
`
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psScript], {
    stdio: 'inherit',
    env: {
      ...process.env,
      SIGN_PFX_PATH: pfxPath,
      SIGN_PFX_PASS: pfxPassword,
      SIGN_TARGET_PATH: filePath,
      SIGN_TIMESTAMP_URL: TIMESTAMP_URL,
    },
  })
}

function main() {
  if (mode === 'production') {
    // 1. Microsoft Azure Trusted Signing (if AZURE_TRUSTED_SIGNING_METADATA is configured)
    if (process.env.AZURE_TRUSTED_SIGNING_METADATA && process.env.AZURE_TRUSTED_SIGNING_DLIB) {
      const signtool = process.env.SIGNTOOL_PATH || 'signtool.exe'
      execFileSync(
        signtool,
        [
          'sign',
          '/v',
          '/fd',
          'SHA256',
          '/tr',
          'http://timestamp.acs.microsoft.com',
          '/td',
          'SHA256',
          '/dlib',
          process.env.AZURE_TRUSTED_SIGNING_DLIB,
          '/dmdf',
          process.env.AZURE_TRUSTED_SIGNING_METADATA,
          absTarget,
        ],
        { stdio: 'inherit' },
      )
      return
    }

    // 2. DigiCert KeyLocker (smctl) if SM_KEYPAIR_ALIAS is configured
    if (process.env.SM_KEYPAIR_ALIAS) {
      execFileSync(
        'smctl',
        [
          'sign',
          '--keypair-alias',
          process.env.SM_KEYPAIR_ALIAS,
          '--digest',
          'alg=SHA256',
          '--input',
          absTarget,
        ],
        { stdio: 'inherit' },
      )
      return
    }

    // 3. Production PFX (SignPath / Certum / OV PFX)
    const prodPfx = process.env.LYCERO_WIN_PROD_PFX_PATH || process.env.CSC_LINK
    const prodPass = process.env.LYCERO_WIN_PROD_PFX_PASSWORD || process.env.CSC_KEY_PASSWORD

    if (!prodPfx || !existsSync(prodPfx)) {
      throw new Error(
        '[win-sign] Production PFX not configured or not found (set LYCERO_WIN_PROD_PFX_PATH or CSC_LINK)',
      )
    }
    if (!prodPass) {
      throw new Error(
        '[win-sign] Production PFX password not set (set LYCERO_WIN_PROD_PFX_PASSWORD or CSC_KEY_PASSWORD)',
      )
    }
    signWithPowerShellPfx(prodPfx, prodPass, absTarget)
    return
  }

  // "test" / CI test-cert Authenticode PFX mode (injected via env by CI/server)
  const pfxPath = process.env.LYCERO_WIN_PFX_PATH
  const pfxPassword = process.env.LYCERO_WIN_PFX_PASSWORD

  if (!pfxPath || !existsSync(pfxPath)) {
    throw new Error(
      '[win-sign] Code signing PFX not configured or not found (set LYCERO_WIN_PFX_PATH in environment).',
    )
  }
  if (!pfxPassword) {
    throw new Error(
      '[win-sign] Test PFX password not set (set LYCERO_WIN_PFX_PASSWORD in environment).',
    )
  }

  signWithPowerShellPfx(pfxPath, pfxPassword, absTarget)
}

main()
