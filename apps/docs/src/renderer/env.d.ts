/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
/// <reference types="vite/client" />

import type { DesktopApi } from '../shared/ipc'
import type { ProjectApi } from '@lycero/project-store'
import type { BundleApi } from '../../shell/src/shared/bundle-api'

declare global {
  interface Window {
    desktop: DesktopApi
    projectApi: ProjectApi
    aiOffice: {
      bundles: BundleApi
    }
  }
}

export {}
