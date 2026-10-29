/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 *
 * Barrel: all IPC handler registration functions live under shared/ipc/.
 * index.ts imports and calls these to keep the main entry lean.
 */
export { registerDroppedFilesIpc, type DroppedFilesDeps } from './drop'
export { registerTabsIpc, broadcastChromePressed, type TabsDeps } from './tabs'
export { registerHomeIpc, type HomeDeps } from './home'
export { registerFileIndexIpc, type FileIndexDeps } from './file-index-handler'
export { registerFolderRootsIpc, type FolderRootsDeps } from './folder-roots-handler'
export { registerDefaultAppIpc } from './default-app-handler'
export { registerDetachedWindowIpc, type DetachedDeps } from './detached-handler'
