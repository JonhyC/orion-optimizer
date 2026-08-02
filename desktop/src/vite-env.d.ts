/// <reference types="vite/client" />

type RegistryAction = {
  hive: "HKCU" | "HKLM";
  key: string;
  name: string;
  kind: string;
  value: string | number;
};

type Tweak = {
  id: string;
  name: string;
  description: string;
  layer: 0 | 1;
  impact: string;
  risk: string;
  requiresReboot: boolean;
  conditions?: Record<string, string[]>;
  actions: RegistryAction[];
};

type OrionAccount = {
  username: string;
  display_name: string;
  discord_avatar_url: string | null;
  role: "member" | "client" | "staff" | "developer" | "owner";
  tier: string | null;
  discord_verified: boolean;
  expires_at: number | null;
  support_expires_at: number | null;
  support_lifetime: boolean;
};

type SystemProfile = {
  isAdmin: boolean;
  chassis: string;
  gpuVendor: string;
  gpuVendors: string[];
  gpuTypes: string[];
  gpuNames: string[];
  ramGB: number;
  hwid: string;
  executionMode: "Real" | "Mock";
};

type ChangePreview = {
  TweakId: string;
  Path: string;
  Name: string;
  Before: string;
  After: string;
  Changed: boolean;
};

type OrionSession = {
  sessionId: string;
  startedAt: string;
  note: string;
  status: string;
  entries: Array<{
    tweakId: string;
    hive: string;
    key: string;
    name: string;
    existed: boolean;
    originalValue: unknown;
    originalKind: string;
  }>;
};

type InternalOverview = {
  generatedAt: number;
  onlineWindowSeconds: number;
  metrics: {
    users: number;
    activeLicenses: number;
    onlineSite: number;
    onlineOptimizer: number;
    failedLogins24h: number;
    optimizerActions24h: number;
    catalogRequests24h: number;
    revenue30Cents: number | null;
  };
  people: Array<{
    id: number;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    role: string;
    tier: string | null;
    status: string;
    clientVersion: string | null;
    clientSeenAt: number | null;
    siteSeenAt: number | null;
    optimizerSeenAt: number | null;
    siteOnline: boolean;
    optimizerOnline: boolean;
    lastActivityAt: number | null;
  }>;
  activity: Array<{
    id: number;
    action: string;
    detail: string | null;
    createdAt: number;
    userId: number | null;
    username: string;
  }>;
  usage: Array<{ action: string; count: number }>;
  versions: Array<{ version: string; count: number }>;
};

type OrionGame = {
  id: string;
  name: string;
  platform: string;
  installPath: string | null;
  sizeBytes: number;
  launchUri: string | null;
};

type OrionGamesResult = {
  items: OrionGame[];
  warnings: string[];
};

type OrionPerformance = {
  timestamp: number;
  cpu: {
    name: string;
    cores: number;
    threads: number;
    baseClockMhz: number;
    currentMhz: number;
    percent: number | null;
  };
  memory: {
    installedBytes: number;
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    percent: number;
    hardwareReservedBytes: number;
  } | null;
  gpu: {
    adapters: Array<{ name: string; driverVersion: string | null; memoryBytes: number | null }>;
    percent: number | null;
  };
  disk: {
    volumes: Array<{ drive: string; label: string | null; totalBytes: number; freeBytes: number; usedBytes: number; percent: number }>;
    activityPercent: number | null;
  };
  network: {
    sentBytesPerSec: number | null;
    receivedBytesPerSec: number | null;
  };
};

type OrionDisplay = {
  deviceName: string;
  displayName: string;
  primary: boolean;
  attached: boolean;
  current: { width: number; height: number; refreshRate: number; bitsPerPel: number };
  modes: Array<{ width: number; height: number; refreshRate: number; bitsPerPel: number }>;
};

type OrionApi = {
  appVersion(): Promise<string>;
  getSettings(): Promise<{ server: string; username: string }>;
  saveSettings(settings: { server: string; username: string }): Promise<void>;
  login(credentials: {
    username: string;
    password: string;
    server: string;
    remember: boolean;
  }): Promise<{ user: Record<string, unknown>; server: string }>;
  logout(): Promise<boolean>;
  catalog(): Promise<{
    tweaks: Tweak[];
    eligibility: Record<string, { eligible: boolean; reason: string }>;
    account: OrionAccount;
  }>;
  profile(): Promise<SystemProfile>;
  preview(tweak: Tweak): Promise<ChangePreview[]>;
  apply(tweak: Tweak): Promise<{ sessionId: string; changes: ChangePreview[] }>;
  sessions(): Promise<OrionSession[]>;
  rollback(session: OrionSession): Promise<unknown[]>;
  games(): Promise<OrionGamesResult>;
  performance(): Promise<OrionPerformance>;
  displays(): Promise<{ items: OrionDisplay[] }>;
  internalOverview(): Promise<InternalOverview>;
  openPortal(pathname: string): Promise<boolean>;
  minimize(): void;
  maximize(): void;
  close(): void;
};

interface Window {
  orion: OrionApi;
}
