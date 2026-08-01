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

type OrionApi = {
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
  openPortal(pathname: string): Promise<boolean>;
  minimize(): void;
  maximize(): void;
  close(): void;
};

interface Window {
  orion: OrionApi;
}
