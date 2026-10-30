/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */

import { app, safeStorage, screen } from 'electron'
import { execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import { join } from 'node:path'

const LYCERO_ORIGIN = process.env.LYCERO_ORIGIN || 'https://lycero.com'
const HEARTBEAT_INTERVAL_MS = 60_000

export type NormalizedOsPlatform = 'win32' | 'darwin' | 'linux'
export type TelemetryOsPlatformLabel = 'Windows' | 'macOS' | 'Linux'
export type NormalizedArchitecture =
  | 'x64 (64-bit)'
  | 'ia32 (32-bit)'
  | 'arm64 (Apple Silicon / ARM)'
  | string

export interface DeviceHardwareIdentity {
  deviceId: string
  deviceName: string
  deviceModel: string
  osPlatform: NormalizedOsPlatform
  osVersion: string
  architecture: NormalizedArchitecture
  appVersion: string
  machineId: string
  cpuId: string
  macAddress: string
  motherboardId?: string
  diskSerial?: string
  screenResolution: string
  language: string
  timezone: string
  country: string
}

export type DeviceVerificationStatusCode =
  | 'verified'
  | 'unverified'
  | 'suspended'
  | 'revoked'
  | 'limit_exceeded'

export interface VerifiedDeviceLocation {
  ipAddress?: string
  country: string
  regionOrCity?: string
  timezone: string
}

export interface DeviceVerificationState {
  verified: boolean
  status: DeviceVerificationStatusCode
  code?: 'DEVICE_SUSPENDED' | 'DEVICE_REVOKED' | 'DEVICE_LIMIT_EXCEEDED' | string
  error?: string
  deviceId: string
  deviceRecordId?: string
  deviceName: string
  deviceModel: string
  osPlatform: NormalizedOsPlatform
  osVersion: string
  architecture: NormalizedArchitecture
  appVersion: string
  cpuId: string
  macAddress: string
  machineId: string
  motherboardId?: string
  diskSerial?: string
  screenResolution: string
  language: string
  location: VerifiedDeviceLocation
  maxDevices?: number
  currentDeviceCount?: number
  lastVerifiedAt?: string
  userSnapshot?: {
    id?: string
    email?: string
    fullName?: string
    role?: string
    tier?: string
  }
}

export interface DeviceRegisterResponse {
  success?: boolean
  verified?: boolean
  code?: string
  error?: string
  message?: string
  user?: {
    id?: string
    email?: string
    fullName?: string
    name?: string
    role?: string
    tier?: string
    plan?: string
  }
  device?: {
    id?: string
    deviceId?: string
    deviceName?: string
    status?: string
    [key: string]: unknown
  }
  location?: {
    ipAddress?: string
    ip?: string
    country?: string
    regionOrCity?: string
    city?: string
    region?: string
    timezone?: string
  }
  maxDevices?: number
  currentDeviceCount?: number
  currentCount?: number
}

interface PersistedDeviceCache {
  deviceId: string
  machineId: string
  deviceModel?: string
  osVersion?: string
  motherboardId?: string
  diskSerial?: string
  createdAt: number
}

let cachedIdentity: DeviceHardwareIdentity | null = null
let cachedVerificationState: DeviceVerificationState | null = null
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let registerInFlight: Promise<DeviceVerificationState> | null = null
let syncingProjectsProvider: (() => number) | null = null
let stateChangeListener: ((state: DeviceVerificationState) => void) | null = null

function getLyceroDir(): string {
  const dir = join(app.getPath('userData'), 'lycero')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

function getDeviceCachePath(): string {
  return join(getLyceroDir(), 'device-identity.json')
}

function getVerificationStatePath(): string {
  return join(getLyceroDir(), 'device-verification.json')
}

function safeExec(file: string, args: string[], timeoutMs = 1500): string {
  try {
    return execFileSync(file, args, {
      encoding: 'utf-8',
      timeout: timeoutMs,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return ''
  }
}

function normalizePlatform(): NormalizedOsPlatform {
  if (process.platform === 'darwin') return 'darwin'
  if (process.platform === 'linux') return 'linux'
  return 'win32'
}

export function formatTelemetryOsPlatform(platform: NormalizedOsPlatform): TelemetryOsPlatformLabel {
  if (platform === 'darwin') return 'macOS'
  if (platform === 'linux') return 'Linux'
  return 'Windows'
}

export function normalizeArchitectureLabel(arch: string = process.arch): NormalizedArchitecture {
  if (arch === 'x64') return 'x64 (64-bit)'
  if (arch === 'ia32') return 'ia32 (32-bit)'
  if (arch === 'arm64') return 'arm64 (Apple Silicon / ARM)'
  return arch
}

function readWindowsRegistryValue(keyPath: string, valueName: string): string {
  // Query with /reg:64 first so 32-bit (ia32) builds on 64-bit Windows still read the native 64-bit hive
  const attempts: string[][] = [
    ['query', keyPath, '/v', valueName, '/reg:64'],
    ['query', keyPath, '/v', valueName],
  ]
  for (const args of attempts) {
    const out = safeExec('reg', args)
    if (!out) continue
    const lines = out.split(/\r?\n/)
    for (const line of lines) {
      if (line.toLowerCase().includes(valueName.toLowerCase())) {
        const parts = line.trim().split(/\s+REG_[A-Z0-9_]+\s+/i)
        if (parts.length >= 2 && parts[1]?.trim()) {
          return parts[1].trim()
        }
      }
    }
  }
  return ''
}

function readHardwareMachineId(): string {
  if (process.platform === 'win32') {
    const regGuid = readWindowsRegistryValue(
      'HKLM\\SOFTWARE\\Microsoft\\Cryptography',
      'MachineGuid',
    )
    if (regGuid) return regGuid

    const wmicOut = safeExec('wmic', ['csproduct', 'get', 'uuid'])
    if (wmicOut) {
      const lines = wmicOut
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !/^uuid$/i.test(l))
      if (lines[0]) return lines[0]
    }
  } else if (process.platform === 'darwin') {
    const ioregOut = safeExec('ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice'])
    const match = /"IOPlatformUUID"\s*=\s*"([^"]+)"/i.exec(ioregOut)
    if (match?.[1]?.trim()) return match[1].trim()
  } else if (process.platform === 'linux') {
    for (const candidate of ['/etc/machine-id', '/var/lib/dbus/machine-id']) {
      try {
        if (existsSync(candidate)) {
          const val = readFileSync(candidate, 'utf-8').trim()
          if (val) return val
        }
      } catch {
        // continue
      }
    }
  }

  // Deterministic fallback based on hostname + CPU + arch if OS commands are restricted
  const fallbackSeed = `${os.hostname()}-${os.cpus()[0]?.model ?? ''}-${process.platform}-${process.arch}`
  return createHash('sha256').update(fallbackSeed).digest('hex').slice(0, 32)
}

function readDeviceModel(): string {
  const genericNames = new Set([
    'system product name',
    'to be filled by o.e.m.',
    'default string',
    'none',
    'unknown',
  ])

  if (process.platform === 'win32') {
    const product = readWindowsRegistryValue(
      'HKLM\\HARDWARE\\DESCRIPTION\\System\\BIOS',
      'SystemProductName',
    )
    const manufacturer = readWindowsRegistryValue(
      'HKLM\\HARDWARE\\DESCRIPTION\\System\\BIOS',
      'SystemManufacturer',
    )
    const cleanProduct =
      product && !genericNames.has(product.toLowerCase()) ? product : ''
    const cleanMfg =
      manufacturer && !genericNames.has(manufacturer.toLowerCase()) ? manufacturer : ''

    if (cleanMfg && cleanProduct) {
      return cleanProduct.toLowerCase().startsWith(cleanMfg.toLowerCase())
        ? cleanProduct
        : `${cleanMfg} ${cleanProduct}`
    }
    if (cleanProduct) return cleanProduct

    const wmicModel = safeExec('wmic', ['computersystem', 'get', 'model'])
    if (wmicModel) {
      const lines = wmicModel
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !/^model$/i.test(l) && !genericNames.has(l.toLowerCase()))
      if (lines[0]) return lines[0]
    }
    if (cleanMfg) return `${cleanMfg} PC`
    return 'Windows PC'
  }

  if (process.platform === 'darwin') {
    const model = safeExec('sysctl', ['-n', 'hw.model'])
    if (model) return model
    return 'Apple Mac'
  }

  if (process.platform === 'linux') {
    for (const p of [
      '/sys/devices/virtual/dmi/id/product_name',
      '/sys/devices/virtual/dmi/id/board_name',
    ]) {
      try {
        if (existsSync(p)) {
          const val = readFileSync(p, 'utf-8').trim()
          if (val && !genericNames.has(val.toLowerCase())) return val
        }
      } catch {
        // ignore
      }
    }
    return os.type()
  }

  return os.type()
}

function readDetailedOsVersion(): string {
  if (process.platform === 'win32') {
    const currentVerKey = 'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion'
    let productName =
      readWindowsRegistryValue(currentVerKey, 'ProductName') || 'Windows'
    const buildStr =
      readWindowsRegistryValue(currentVerKey, 'CurrentBuildNumber') ||
      readWindowsRegistryValue(currentVerKey, 'CurrentBuild') ||
      ''
    const buildNum = parseInt(buildStr, 10)
    // Windows 11 reports "Windows 10 ..." in ProductName registry value when build >= 22000
    if (!Number.isNaN(buildNum) && buildNum >= 22000 && /Windows 10/i.test(productName)) {
      productName = productName.replace(/Windows 10/i, 'Windows 11')
    }
    const release = os.release() || (buildStr ? `10.0.${buildStr}` : '')
    return release ? `${productName} ${release}`.trim() : productName.trim()
  }

  if (process.platform === 'darwin') {
    const ver = safeExec('sw_vers', ['-productVersion'])
    if (ver) return `macOS ${ver}`
    return `macOS ${os.release()}`
  }

  if (process.platform === 'linux') {
    try {
      if (existsSync('/etc/os-release')) {
        const content = readFileSync('/etc/os-release', 'utf-8')
        const match = /^PRETTY_NAME="?([^"\r\n]+)"?/m.exec(content)
        if (match?.[1]?.trim()) return match[1].trim()
      }
    } catch {
      // fallback
    }
    return `Linux ${os.release()}`
  }

  return `${os.type()} ${os.release()}`
}

function readOptionalHardwareSerials(): { motherboardId?: string; diskSerial?: string } {
  const result: { motherboardId?: string; diskSerial?: string } = {}
  if (process.platform === 'win32') {
    const boardProduct = readWindowsRegistryValue(
      'HKLM\\HARDWARE\\DESCRIPTION\\System\\BIOS',
      'BaseBoardProduct',
    )
    if (boardProduct && !/to be filled|default string/i.test(boardProduct)) {
      result.motherboardId = boardProduct
    }
    const diskOut = safeExec('wmic', ['diskdrive', 'get', 'serialnumber'], 1000)
    if (diskOut) {
      const lines = diskOut
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !/^serialnumber$/i.test(l))
      if (lines[0]) result.diskSerial = lines[0]
    }
  }
  return result
}

function readPrimaryMacAddress(): string {
  try {
    const nets = os.networkInterfaces()
    for (const entries of Object.values(nets)) {
      if (!entries) continue
      for (const net of entries) {
        if (
          !net.internal &&
          net.mac &&
          net.mac !== '00:00:00:00:00:00' &&
          net.mac !== 'ff:ff:ff:ff:ff:ff'
        ) {
          return net.mac.toLowerCase()
        }
      }
    }
  } catch {
    // ignore
  }
  return '00:00:00:00:00:00'
}

function readScreenResolution(): string {
  try {
    if (app.isReady()) {
      const primary = screen.getPrimaryDisplay()
      if (primary?.size?.width && primary?.size?.height) {
        return `${primary.size.width}x${primary.size.height}`
      }
    }
  } catch {
    // ignore before app ready
  }
  return '1920x1080'
}

function readSystemLanguage(): string {
  try {
    if (app.isReady()) {
      const loc = app.getLocale()
      if (loc) return loc
    }
  } catch {
    // ignore
  }
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions().locale
    if (resolved) return resolved
  } catch {
    // ignore
  }
  return 'vi-VN'
}

function readSystemTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz) return tz
  } catch {
    // ignore
  }
  return 'Asia/Ho_Chi_Minh'
}

function resolveDefaultCountry(timezone: string, language: string): string {
  const tz = (timezone || '').toLowerCase()
  if (
    tz === 'asia/ho_chi_minh' ||
    tz === 'asia/saigon' ||
    tz === 'asia/hanoi' ||
    language.toLowerCase().endsWith('-vn')
  ) {
    return 'Việt Nam (VN)'
  }
  const regionMatch = /-([A-Z]{2})$/i.exec(language)
  if (regionMatch?.[1]) {
    return regionMatch[1].toUpperCase()
  }
  return 'Việt Nam (VN)'
}

function loadOrCreatePersistedCache(): PersistedDeviceCache {
  const filePath = getDeviceCachePath()
  try {
    if (existsSync(filePath)) {
      const raw = JSON.parse(readFileSync(filePath, 'utf-8')) as Partial<PersistedDeviceCache>
      if (
        typeof raw?.deviceId === 'string' &&
        raw.deviceId.startsWith('hw-') &&
        typeof raw?.machineId === 'string' &&
        raw.machineId.length > 0
      ) {
        return {
          deviceId: raw.deviceId,
          machineId: raw.machineId,
          deviceModel: raw.deviceModel,
          osVersion: raw.osVersion,
          motherboardId: raw.motherboardId,
          diskSerial: raw.diskSerial,
          createdAt: raw.createdAt || Date.now(),
        }
      }
    }
  } catch {
    // recreate below
  }

  const osPlatform = normalizePlatform()
  const machineId = readHardwareMachineId() || randomUUID()
  const hash12 = createHash('sha256')
    .update(`${osPlatform}:${process.arch}:${machineId}`)
    .digest('hex')
    .slice(0, 12)
  const deviceId = `hw-${osPlatform}-${process.arch}-${hash12}`
  const deviceModel = readDeviceModel()
  const osVersion = readDetailedOsVersion()
  const serials = readOptionalHardwareSerials()

  const cache: PersistedDeviceCache = {
    deviceId,
    machineId,
    deviceModel,
    osVersion,
    ...(serials.motherboardId ? { motherboardId: serials.motherboardId } : {}),
    ...(serials.diskSerial ? { diskSerial: serials.diskSerial } : {}),
    createdAt: Date.now(),
  }

  try {
    writeFileSync(filePath, JSON.stringify(cache, null, 2), 'utf-8')
  } catch {
    // ignore write failure
  }

  return cache
}

export function getDeviceIdentity(): DeviceHardwareIdentity {
  if (cachedIdentity) {
    // Refresh screenResolution once app is ready if it was previously resolved before ready
    if (app.isReady()) {
      cachedIdentity.screenResolution = readScreenResolution()
      cachedIdentity.language = readSystemLanguage()
    }
    return cachedIdentity
  }

  const persisted = loadOrCreatePersistedCache()
  const osPlatform = normalizePlatform()
  const timezone = readSystemTimezone()
  const language = readSystemLanguage()
  const country = resolveDefaultCountry(timezone, language)
  let appVersion = '2.0.15'
  try {
    appVersion = app.getVersion() || appVersion
  } catch {
    // ignore
  }

  cachedIdentity = {
    deviceId: persisted.deviceId,
    deviceName: os.hostname() || 'Lycero-Workstation',
    deviceModel: persisted.deviceModel || readDeviceModel(),
    osPlatform,
    osVersion: persisted.osVersion || readDetailedOsVersion(),
    architecture: normalizeArchitectureLabel(process.arch),
    appVersion,
    machineId: persisted.machineId,
    cpuId: os.cpus()[0]?.model?.trim() || 'Unknown CPU',
    macAddress: readPrimaryMacAddress(),
    ...(persisted.motherboardId ? { motherboardId: persisted.motherboardId } : {}),
    ...(persisted.diskSerial ? { diskSerial: persisted.diskSerial } : {}),
    screenResolution: readScreenResolution(),
    language,
    timezone,
    country,
  }

  return cachedIdentity
}

export function getDeviceId(): string {
  return getDeviceIdentity().deviceId
}

export function getStandardLyceroHeaders(accessToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Device-Id': getDeviceId(),
    'X-Lycero-Client': 'electron-desktop',
  }
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  }
  return headers
}

function saveVerificationState(state: DeviceVerificationState): void {
  cachedVerificationState = state
  try {
    const filePath = getVerificationStatePath()
    const jsonStr = JSON.stringify(state)
    if (safeStorage.isEncryptionAvailable()) {
      writeFileSync(filePath, safeStorage.encryptString(jsonStr))
    } else {
      writeFileSync(filePath, jsonStr, 'utf-8')
    }
  } catch (err) {
    console.warn('[DeviceIdentity] Failed to persist verification state:', err)
  }
  stateChangeListener?.(state)
}

export function getDeviceVerificationState(): DeviceVerificationState {
  if (cachedVerificationState) {
    const hw = getDeviceIdentity()
    cachedVerificationState.screenResolution = hw.screenResolution
    cachedVerificationState.appVersion = hw.appVersion
    return cachedVerificationState
  }

  const hw = getDeviceIdentity()
  try {
    const filePath = getVerificationStatePath()
    if (existsSync(filePath)) {
      const rawBuf = readFileSync(filePath)
      const jsonStr = safeStorage.isEncryptionAvailable()
        ? safeStorage.decryptString(rawBuf)
        : rawBuf.toString('utf-8')
      const parsed = JSON.parse(jsonStr) as DeviceVerificationState
      if (parsed && typeof parsed === 'object' && parsed.deviceId === hw.deviceId) {
        cachedVerificationState = {
          ...parsed,
          deviceName: hw.deviceName,
          deviceModel: hw.deviceModel,
          osPlatform: hw.osPlatform,
          osVersion: hw.osVersion,
          architecture: hw.architecture,
          appVersion: hw.appVersion,
          cpuId: hw.cpuId,
          macAddress: hw.macAddress,
          machineId: hw.machineId,
          screenResolution: hw.screenResolution,
          language: hw.language,
          location: {
            ...parsed.location,
            country: parsed.location?.country || hw.country,
            timezone: parsed.location?.timezone || hw.timezone,
          },
        }
        return cachedVerificationState
      }
    }
  } catch {
    // ignore corrupt state
  }

  cachedVerificationState = {
    verified: false,
    status: 'unverified',
    deviceId: hw.deviceId,
    deviceName: hw.deviceName,
    deviceModel: hw.deviceModel,
    osPlatform: hw.osPlatform,
    osVersion: hw.osVersion,
    architecture: hw.architecture,
    appVersion: hw.appVersion,
    cpuId: hw.cpuId,
    macAddress: hw.macAddress,
    machineId: hw.machineId,
    ...(hw.motherboardId ? { motherboardId: hw.motherboardId } : {}),
    ...(hw.diskSerial ? { diskSerial: hw.diskSerial } : {}),
    screenResolution: hw.screenResolution,
    language: hw.language,
    location: {
      country: hw.country,
      timezone: hw.timezone,
    },
  }
  return cachedVerificationState
}

export function clearDeviceVerificationState(): void {
  const hw = getDeviceIdentity()
  const resetState: DeviceVerificationState = {
    verified: false,
    status: 'unverified',
    deviceId: hw.deviceId,
    deviceName: hw.deviceName,
    deviceModel: hw.deviceModel,
    osPlatform: hw.osPlatform,
    osVersion: hw.osVersion,
    architecture: hw.architecture,
    appVersion: hw.appVersion,
    cpuId: hw.cpuId,
    macAddress: hw.macAddress,
    machineId: hw.machineId,
    ...(hw.motherboardId ? { motherboardId: hw.motherboardId } : {}),
    ...(hw.diskSerial ? { diskSerial: hw.diskSerial } : {}),
    screenResolution: hw.screenResolution,
    language: hw.language,
    location: {
      country: hw.country,
      timezone: hw.timezone,
    },
  }
  saveVerificationState(resetState)
}

/**
 * Returns a human-readable error message when the current device is blocked by the server
 * (`DEVICE_SUSPENDED`, `DEVICE_REVOKED`, or `DEVICE_LIMIT_EXCEEDED`), or null if allowed.
 */
export function getDeviceBlockError(): string | null {
  const state = getDeviceVerificationState()
  if (state.status === 'suspended' || state.status === 'revoked') {
    return (
      state.error ||
      'Thiết bị này đã bị đình chỉ hoặc thu hồi quyền truy cập Cloud/AI. Vui lòng liên hệ Quản trị viên.'
    )
  }
  if (state.status === 'limit_exceeded') {
    const countText =
      state.currentDeviceCount !== undefined && state.maxDevices !== undefined
        ? ` (${state.currentDeviceCount}/${state.maxDevices} thiết bị)`
        : ''
    return (
      state.error ||
      `Tài khoản đã vượt quá giới hạn thiết bị của gói cước hiện tại${countText}. Vui lòng truy cập https://account.lycero.com để gỡ bớt thiết bị cũ hoặc nâng cấp gói.`
    )
  }
  return null
}

export function onDeviceVerificationStateChanged(
  listener: (state: DeviceVerificationState) => void,
): void {
  stateChangeListener = listener
}

export function setSyncingProjectsCountProvider(provider: () => number): void {
  syncingProjectsProvider = provider
}

// ── Step B: App Event & Telemetry Reporting (`POST https://lycero.com/api/v1/office/telemetry`) ──

export async function sendOfficeTelemetry(
  eventName: 'app_launch' | 'user_login' | 'device_register' | string,
  options?: {
    accessToken?: string
    user?: {
      id?: string
      email?: string
      fullName?: string
      tier?: string
    } | null
  },
): Promise<void> {
  try {
    const hw = getDeviceIdentity()
    const currentState = getDeviceVerificationState()
    const userObj = options?.user ?? currentState.userSnapshot
    const payload = {
      appId: 'lycero-office-desktop',
      productCode: 'office',
      eventName,
      user: userObj
        ? {
            id: userObj.id || '',
            email: userObj.email || '',
            fullName: userObj.fullName || '',
            tier: userObj.tier || 'free',
          }
        : undefined,
      device: {
        deviceId: hw.deviceId,
        deviceName: hw.deviceName,
        deviceModel: hw.deviceModel,
        osPlatform: formatTelemetryOsPlatform(hw.osPlatform),
        osVersion: hw.osVersion,
        architecture: hw.architecture,
        appVersion: hw.appVersion,
        browserOrRuntime: 'Lycero Office Desktop',
        screenResolution: hw.screenResolution,
        language: hw.language,
        cpuId: hw.cpuId,
        machineId: hw.machineId,
      },
      location: {
        timezone: hw.timezone,
      },
    }

    await fetch(`${LYCERO_ORIGIN}/api/v1/office/telemetry`, {
      method: 'POST',
      headers: getStandardLyceroHeaders(options?.accessToken),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    // Non-blocking telemetry: never interrupt user flow
  }
}

// ── Step A: Device Verification & Profile Binding (`POST https://lycero.com/api/v1/office/hub/devices/register`) ──

export async function registerAndVerifyDevice(options: {
  accessToken: string
  userFallback?: {
    id?: string
    email?: string
    fullName?: string
    role?: string
    tier?: string
  }
}): Promise<DeviceVerificationState> {
  if (!options.accessToken) {
    return getDeviceVerificationState()
  }
  if (registerInFlight) {
    return registerInFlight
  }

  registerInFlight = (async (): Promise<DeviceVerificationState> => {
    const hw = getDeviceIdentity()
    const prev = getDeviceVerificationState()

    try {
      const requestBody = {
        deviceId: hw.deviceId,
        deviceName: hw.deviceName,
        deviceModel: hw.deviceModel,
        osPlatform: hw.osPlatform,
        osVersion: hw.osVersion,
        architecture: hw.architecture,
        appVersion: hw.appVersion,
        productCode: 'office',
        cpuId: hw.cpuId,
        macAddress: hw.macAddress,
        machineId: hw.machineId,
        ...(hw.motherboardId ? { motherboardId: hw.motherboardId } : {}),
        ...(hw.diskSerial ? { diskSerial: hw.diskSerial } : {}),
        screenResolution: hw.screenResolution,
        language: hw.language,
        timezone: hw.timezone,
        country: hw.country,
      }

      const response = await fetch(`${LYCERO_ORIGIN}/api/v1/office/hub/devices/register`, {
        method: 'POST',
        headers: getStandardLyceroHeaders(options.accessToken),
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(10_000),
      })

      let body: DeviceRegisterResponse = {}
      try {
        body = (await response.json()) as DeviceRegisterResponse
      } catch {
        // non-JSON response
      }

      if (response.status === 200 || response.status === 201) {
        const userSnapshot = {
          id: body.user?.id || options.userFallback?.id || prev.userSnapshot?.id,
          email: body.user?.email || options.userFallback?.email || prev.userSnapshot?.email,
          fullName:
            body.user?.fullName ||
            body.user?.name ||
            options.userFallback?.fullName ||
            prev.userSnapshot?.fullName,
          role: body.user?.role || options.userFallback?.role || prev.userSnapshot?.role,
          tier:
            body.user?.tier ||
            body.user?.plan ||
            options.userFallback?.tier ||
            prev.userSnapshot?.tier,
        }

        const regionOrCity =
          body.location?.regionOrCity ||
          [body.location?.city, body.location?.region].filter(Boolean).join(', ') ||
          prev.location?.regionOrCity

        const nextState: DeviceVerificationState = {
          verified: body.verified !== false,
          status: 'verified',
          code: undefined,
          error: undefined,
          deviceId: hw.deviceId,
          deviceRecordId: body.device?.id || prev.deviceRecordId,
          deviceName: body.device?.deviceName || hw.deviceName,
          deviceModel: hw.deviceModel,
          osPlatform: hw.osPlatform,
          osVersion: hw.osVersion,
          architecture: hw.architecture,
          appVersion: hw.appVersion,
          cpuId: hw.cpuId,
          macAddress: hw.macAddress,
          machineId: hw.machineId,
          ...(hw.motherboardId ? { motherboardId: hw.motherboardId } : {}),
          ...(hw.diskSerial ? { diskSerial: hw.diskSerial } : {}),
          screenResolution: hw.screenResolution,
          language: hw.language,
          location: {
            ipAddress: body.location?.ipAddress || body.location?.ip || prev.location?.ipAddress,
            country: body.location?.country || hw.country,
            ...(regionOrCity ? { regionOrCity } : {}),
            timezone: body.location?.timezone || hw.timezone,
          },
          maxDevices:
            typeof body.maxDevices === 'number' ? body.maxDevices : prev.maxDevices,
          currentDeviceCount:
            typeof body.currentDeviceCount === 'number'
              ? body.currentDeviceCount
              : typeof body.currentCount === 'number'
                ? body.currentCount
                : prev.currentDeviceCount ?? 1,
          lastVerifiedAt: new Date().toISOString(),
          userSnapshot,
        }

        saveVerificationState(nextState)

        // Fire non-blocking Step B telemetry for successful device registration
        void sendOfficeTelemetry('device_register', {
          accessToken: options.accessToken,
          user: userSnapshot,
        })

        return nextState
      }

      if (response.status === 403) {
        const code = String(body.code || '').toUpperCase()
        const serverError =
          body.error ||
          body.message ||
          (code === 'DEVICE_LIMIT_EXCEEDED'
            ? 'Tài khoản đã đạt giới hạn thiết bị tối đa của gói hiện tại.'
            : 'Thiết bị này đã bị khóa hoặc thu hồi quyền truy cập. Vui lòng liên hệ Quản trị viên.')

        const status: DeviceVerificationStatusCode =
          code === 'DEVICE_LIMIT_EXCEEDED'
            ? 'limit_exceeded'
            : code === 'DEVICE_REVOKED'
              ? 'revoked'
              : 'suspended'

        const nextState: DeviceVerificationState = {
          ...prev,
          verified: false,
          status,
          code: code || 'DEVICE_SUSPENDED',
          error: serverError,
          deviceId: hw.deviceId,
          deviceName: hw.deviceName,
          deviceModel: hw.deviceModel,
          osPlatform: hw.osPlatform,
          osVersion: hw.osVersion,
          architecture: hw.architecture,
          appVersion: hw.appVersion,
          maxDevices:
            typeof body.maxDevices === 'number' ? body.maxDevices : prev.maxDevices,
          currentDeviceCount:
            typeof body.currentCount === 'number'
              ? body.currentCount
              : typeof body.currentDeviceCount === 'number'
                ? body.currentDeviceCount
                : prev.currentDeviceCount,
          lastVerifiedAt: new Date().toISOString(),
        }

        saveVerificationState(nextState)
        return nextState
      }

      return prev
    } catch (err) {
      console.warn('[DeviceIdentity] registerAndVerifyDevice network/error:', err)
      return prev
    } finally {
      registerInFlight = null
    }
  })()

  return registerInFlight
}

// ── Step C: Online Heartbeat (`POST https://lycero.com/api/v1/office/hub/devices/heartbeat` every 60s) ──

export async function sendDeviceHeartbeatOnce(
  getAccessToken: () => string | null | undefined,
): Promise<void> {
  const token = getAccessToken()
  if (!token) return

  const hw = getDeviceIdentity()
  const syncingProjects = syncingProjectsProvider ? syncingProjectsProvider() : 0

  try {
    const response = await fetch(`${LYCERO_ORIGIN}/api/v1/office/hub/devices/heartbeat`, {
      method: 'POST',
      headers: getStandardLyceroHeaders(token),
      body: JSON.stringify({
        deviceId: hw.deviceId,
        appVersion: hw.appVersion,
        syncingProjects,
      }),
      signal: AbortSignal.timeout(8000),
    })

    if (response.status === 404) {
      // Device not registered on server -> automatically re-run Step A
      await registerAndVerifyDevice({ accessToken: token })
      return
    }

    if (response.status === 403) {
      let body: DeviceRegisterResponse = {}
      try {
        body = (await response.json()) as DeviceRegisterResponse
      } catch {
        // ignore
      }
      const code = String(body.code || '').toUpperCase()
      if (
        code === 'DEVICE_SUSPENDED' ||
        code === 'DEVICE_REVOKED' ||
        code === 'DEVICE_LIMIT_EXCEEDED'
      ) {
        await registerAndVerifyDevice({ accessToken: token })
      }
    }
  } catch {
    // Silent when offline
  }
}

export function startDeviceHeartbeat(getAccessToken: () => string | null | undefined): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
  heartbeatTimer = setInterval(() => {
    void sendDeviceHeartbeatOnce(getAccessToken)
  }, HEARTBEAT_INTERVAL_MS)
}

export function stopDeviceHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
}
