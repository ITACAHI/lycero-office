/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import './core-ops'
import './text-ops'
import './element-ops'
import './insert-ops'
import './table-ops'
import './slide-ops'
import './arrange-ops'
import './animation-ops'
import './equation-ops'
export { listSlideAnimations, type AnimationEntry } from './animation-ops'
export { equationRun } from './equation-ops'
export { runTxn, type TxnRequest, type TxnResult, type OpFailure } from './executor'
export { normalizeLengthUnits, parseLength } from './units'
export {
  elementDurableId,
  GuidedError,
  opNames,
  register,
  resolveGroupChildId,
  slideDurableId,
  type Op,
  type OpRecord,
  type OpTarget,
} from './registry'
