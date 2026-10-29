/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
export { runCli, defaultRegistry, VERSION } from './cli'
export { CommandRegistry, commandHelp } from './registry'
export type { CommandDef, CommandContext, OptionDef } from './registry'
export { CliError, EXIT } from './result'
export type { CommandResult, ExitCode, JsonOk, JsonError } from './result'
export { parseArgs } from './args'
export type { ParsedArgs } from './args'
