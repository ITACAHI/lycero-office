/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
/**
 * How an MCP client starts `lycero-office mcp`. Shared by the app's Settings snippet
 * and `lycero-office mcp install` so the two cannot drift. Clients spawn without a
 * shell, so on Windows neither lycero-office.cmd nor `cmd /c` is safe (a path with
 * a space splits); the entry does what lycero-office.cmd does instead: the app
 * binary as Node on the bundled CLI. Pure string code: the renderer imports it.
 */
export interface McpLaunch {
  command: string
  args: string[]
  env?: Record<string, string>
}

const isWindowsPath = (p: string) => p.includes('\\')

/** The app's snippet: the bare name once lycero-office is on the PATH, else the launcher itself. */
export function mcpLaunch(cli: {
  status: string
  launcherDir: string
  pathHint?: string
}): McpLaunch {
  const dir = cli.launcherDir
  if (isWindowsPath(dir)) return windowsAppLaunch(dir)
  const onPath = cli.status === 'present' && !cli.pathHint
  return { command: onPath ? 'lycero-office' : `${dir}/lycero-office`, args: ['mcp'] }
}

function windowsAppLaunch(dir: string): McpLaunch {
  return {
    command: `${dir}\\..\\..\\Lycero Office.exe`,
    args: [`${dir}\\lycero-office.cjs`, 'mcp'],
    env: { ELECTRON_RUN_AS_NODE: '1' },
  }
}

export interface LauncherLaunchOptions {
  platform?: string
  /** test seam for the packaged-app probe */
  exists?: (path: string) => boolean
}

/**
 * `mcp install`: always the absolute launcher, never the bare name. On Windows
 * the packaged app is run as Node (same entry as the app's snippet); a checkout
 * has no Lycero Office.exe beside it and runs the bundle on the system node, as the
 * bin/lycero-office script does.
 */
export function mcpLaunchFromLauncher(
  launcher: string,
  opts: LauncherLaunchOptions = {},
): McpLaunch {
  const win = isWindowsPath(launcher) || opts.platform === 'win32'
  if (!win) return { command: launcher, args: ['mcp'] }
  const sep = isWindowsPath(launcher) ? '\\' : '/'
  const dir = launcher.slice(0, Math.max(launcher.lastIndexOf('\\'), launcher.lastIndexOf('/')))
  const exists = opts.exists ?? (() => false)
  if (exists(`${dir}${sep}..${sep}..${sep}Lycero Office.exe`)) return windowsAppLaunch(dir)
  const bundle = exists(`${dir}${sep}lycero-office.cjs`)
    ? `${dir}${sep}lycero-office.cjs`
    : `${dir}${sep}..${sep}dist${sep}lycero-office.cjs`
  return { command: 'node', args: [bundle, 'mcp'] }
}
