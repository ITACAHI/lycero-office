/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */

/**
 * Cloud Sync Types
 */

export type CloudProjectKind = 'doc' | 'sheet' | 'slide' | 'pdf' | 'markdown' | 'html';

export interface CloudProject {
  id: string;
  name: string;
  kind: CloudProjectKind;
  cloudPath: string;
  localPath?: string;
  lastSyncedAt?: number;
  version?: number;
}

export interface SyncChange {
  projectId: string;
  localModified: number;
  cloudModified: number;
  localHash: string;
  cloudHash: string;
}

export interface SyncResult {
  success: boolean;
  synced: number;
  conflicts: number;
  errors: string[];
}

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'conflict';

export interface HeartbeatResponse {
  ok: boolean;
  serverTime: number;
  activeDevices: number;
}

export interface DeviceRegistration {
  deviceId: string;
  deviceName: string;
  platform: string;
  lastSeen: number;
}

export interface CloudSyncConfig {
  apiUrl: string;
  token: string;
  deviceId: string;
  syncInterval: number;
  enabled: boolean;
}

export type ConflictResolution = 'local-wins' | 'cloud-wins' | 'keep-both' | 'manual';
