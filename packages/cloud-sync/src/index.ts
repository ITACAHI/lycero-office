/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */

export {
  LyceroCloudSync,
  createCloudSync,
  resolveConflict,
} from './sync-manager';
export type {
  CloudProject,
  CloudProjectKind,
  SyncChange,
  SyncResult,
  SyncStatus,
  HeartbeatResponse,
  DeviceRegistration,
  CloudSyncConfig,
  ConflictResolution,
} from './types';
