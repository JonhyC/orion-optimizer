/// <reference types="vite/client" />

type BlocoPlugin =
  | { kind: "texto"; title?: string; body: string }
  | { kind: "ligacao"; label: string; url: string; note?: string }
  | { kind: "jogos-instalados"; title?: string; note?: string }
  | { kind: "loja"; title?: string; note?: string; items: Array<{ name: string; price: string; url: string; store?: string; match?: string }> };

interface PluginManifesto {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  roles: string[];
  active: number;
  sort_order: number;
  blocks: BlocoPlugin[];
  updated_at: number;
}

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

type ActiveOptimization = {
  tweakId: string;
  name: string;
  description: string;
  category: string;
  impact: string;
  requiresReboot: boolean;
  sessionId: string;
  appliedAt: number;
  mode: "Real" | "Mock";
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
    availableOptimizations: Array<{
      id: string;
      name: string;
      category: string;
      tier: string;
      requiresReboot: boolean;
    }>;
    activeOptimizations: Array<{
      id: string;
      tweakId: string;
      name: string;
      category: string;
      appliedAt: number;
      machine: string | null;
      clientVersion: string | null;
    }>;
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
  id?: string;
  name?: string;
  deviceName?: string;
  displayName?: string;
  primary: boolean;
  attached: boolean;
  current: { width: number; height: number; refreshRate?: number; refreshHz?: number; bitsPerPel?: number };
  modes: Array<{ width: number; height: number; refreshRate?: number; refreshHz?: number; bitsPerPel?: number }>;
};

type OrionApi = {
  appVersion(): Promise<string>;
  elevate(): Promise<{ relaunching: boolean; elevated: boolean }>;
  getSettings(): Promise<{ server: string; username: string; password: string }>;
  saveSettings(settings: { server: string; username: string; password?: string; remember?: boolean }): Promise<void>;
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
  activeOptimizations(): Promise<ActiveOptimization[]>;
  clearActiveOptimization(tweakId?: string | null): Promise<ActiveOptimization[]>;
  sessions(): Promise<OrionSession[]>;
  rollback(session: OrionSession): Promise<unknown[]>;
  games(options?: { force?: boolean }): Promise<OrionGamesResult>;
  launchGame(game: OrionGame): Promise<boolean>;
  performance(options?: { force?: boolean }): Promise<OrionPerformance>;
  displays(options?: { force?: boolean }): Promise<{ items: OrionDisplay[] }>;
  internalOverview(): Promise<InternalOverview>;
  openExternal(url: string): Promise<boolean>;
  dealsLookup(payload: { titles: string[]; country?: string }): Promise<{ deals: Array<{ titulo: string; loja: string; preco: number; moeda: string; desconto: number; url: string; minimoHistorico: number | null }>; source: string; sourceUrl: string }>;
  pluginsList(): Promise<{ plugins: PluginManifesto[]; all: PluginManifesto[]; canEdit: boolean; roles: string[] }>;
  pluginsSave(manifesto: Partial<PluginManifesto> & { id: string }): Promise<{ id: string }>;
  pluginsDelete(id: string): Promise<{ id: string }>;
  internalUsers(): Promise<{
    users: Array<{ id: number; username: string; discord_username: string | null; role: string; tier: string | null; status: string; hwid: string | null; expires_at: number | null; client_seen_at: number | null; client_version: string | null }>;
    plans: Array<{ code: string; name: string }>;
    roles: string[];
    allowed: string[];
  }>;
  internalUserAction(payload: { action: string; userId: number; value?: string | number }): Promise<Record<string, unknown>>;
  openPortal(pathname: string): Promise<boolean>;
  minimize(): void;
  maximize(): void;
  close(): void;
};

interface Window {
  orion: OrionApi;
}
