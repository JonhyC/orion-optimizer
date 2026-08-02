import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import {
  Activity,
  ArrowLeft,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Crown,
  Cpu,
  Eye,
  EyeOff,
  ExternalLink,
  Gauge,
  Gamepad2,
  HardDrive,
  History,
  Laptop,
  LockKeyhole,
  LogOut,
  MemoryStick,
  Minus,
  Moon,
  MonitorCog,
  Network,
  PackageCheck,
  Play,
  RefreshCcw,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Square,
  Sun,
  UserRound,
  Users,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import logo from "./assets/orion.svg";

type View = "catalog" | "active" | "games" | "performance" | "history" | "settings" | "internal";
type Theme = "dark" | "light";
type Density = "comfortable" | "compact";
type LoginSettings = { server: string; username: string; password: string };
type CatalogState = Awaited<ReturnType<OrionApi["catalog"]>>;
type InternalNotification = {
  id: string;
  title: string;
  body: string;
  tone: "info" | "success" | "warning" | "error";
  createdAt: number;
  read: boolean;
};
type DesktopSettings = {
  language: string;
  region: string;
  timeFormat: "12h" | "24h";
  showTips: boolean;
  accentColor: "gold" | "white" | "green";
  glowIntensity: number;
  micaTransparency: number;
  blur: number;
  interfaceScale: number;
  animationSpeed: number;
  cornerRadius: number;
  showShadows: boolean;
  highContrast: boolean;
  compactSidebar: boolean;
  showDescriptions: boolean;
  showTooltips: boolean;
  confirmBeforeApply: boolean;
  confirmBeforeRollback: boolean;
  openHomeOnStart: boolean;
  rememberLastPage: boolean;
  startWithWindows: boolean;
  startMinimized: boolean;
  minimizeToTray: boolean;
  closeToTray: boolean;
  singleInstance: boolean;
  autoUpdates: boolean;
  updateChannel: "stable" | "beta";
  autoRestartAfterUpdate: boolean;
  autoRollback: boolean;
  restorePoint: boolean;
  registryBackup: boolean;
  confirmCritical: boolean;
  silentOptimizations: boolean;
  rollbackOnError: boolean;
  skipIncompatible: boolean;
  integrityCheck: boolean;
  validateFiles: boolean;
  verifyOptimizationSignature: boolean;
  verifyWindowsCompatibility: boolean;
  duplicateExecutionProtection: boolean;
  preventCloseDuringOptimization: boolean;
  notificationsEnabled: boolean;
  notificationSound: boolean;
  systemNotifications: boolean;
  notifyOptimizationDone: boolean;
  notifyUpdateAvailable: boolean;
  notifyErrors: boolean;
  notifyRollbackCreated: boolean;
  saveHistory: boolean;
  maxHistoryEntries: number;
  showDateTime: boolean;
  showOptimizationDuration: boolean;
  logsEnabled: boolean;
  logLevel: "error" | "warn" | "info" | "debug";
  realtimeLogs: boolean;
  cacheAutoClean: boolean;
  windows10Mode: boolean;
  windows11Mode: boolean;
  experimentalCompatibility: boolean;
  ignoreVersionChecks: boolean;
  betaFeatures: boolean;
  notificationsInbox: InternalNotification[];
};
type GameVisualProfile = {
  displayId: string;
  refreshRate: number;
  windowMode: "exclusive" | "borderless" | "windowed";
  autoFocus: boolean;
  disableOverlays: boolean;
  preferHdr: boolean;
  lastSavedAt?: number;
};

const CATEGORY: Record<string, { label: string; icon: typeof Zap }> = {
  ux: { label: "Interface", icon: Sparkles },
  privacy: { label: "Privacidade", icon: ShieldCheck },
  game: { label: "Gaming", icon: Gamepad2 },
  net: { label: "Rede", icon: Network },
  mmcss: { label: "Desempenho", icon: Gauge },
  gpu: { label: "GPU", icon: MonitorCog },
  power: { label: "Energia", icon: Zap },
};

const ROLE_LABEL: Record<string, string> = {
  member: "Membro",
  client: "Cliente",
  staff: "Staff",
  developer: "Developer",
  owner: "Owner",
};

const INTERNAL_ROLES = new Set(["staff", "developer", "owner"]);
const GAME_VISUAL_PROFILE_KEY = "orion-game-visual-profiles";
const DESKTOP_SETTINGS_KEY = "orion-desktop-settings";
const WINDOW_MODE_LABEL: Record<GameVisualProfile["windowMode"], string> = {
  exclusive: "Fullscreen exclusivo",
  borderless: "Sem bordas",
  windowed: "Janela",
};

const DEFAULT_DESKTOP_SETTINGS: DesktopSettings = {
  language: "pt-PT",
  region: "auto",
  timeFormat: "24h",
  showTips: true,
  accentColor: "gold",
  glowIntensity: 55,
  micaTransparency: 18,
  blur: 12,
  interfaceScale: 100,
  animationSpeed: 100,
  cornerRadius: 8,
  showShadows: true,
  highContrast: false,
  compactSidebar: false,
  showDescriptions: true,
  showTooltips: true,
  confirmBeforeApply: true,
  confirmBeforeRollback: true,
  openHomeOnStart: true,
  rememberLastPage: true,
  startWithWindows: false,
  startMinimized: false,
  minimizeToTray: true,
  closeToTray: false,
  singleInstance: true,
  autoUpdates: true,
  updateChannel: "stable",
  autoRestartAfterUpdate: false,
  autoRollback: true,
  restorePoint: true,
  registryBackup: true,
  confirmCritical: true,
  silentOptimizations: false,
  rollbackOnError: true,
  skipIncompatible: true,
  integrityCheck: true,
  validateFiles: true,
  verifyOptimizationSignature: true,
  verifyWindowsCompatibility: true,
  duplicateExecutionProtection: true,
  preventCloseDuringOptimization: true,
  notificationsEnabled: true,
  notificationSound: true,
  systemNotifications: true,
  notifyOptimizationDone: true,
  notifyUpdateAvailable: true,
  notifyErrors: true,
  notifyRollbackCreated: true,
  saveHistory: true,
  maxHistoryEntries: 250,
  showDateTime: true,
  showOptimizationDuration: true,
  logsEnabled: true,
  logLevel: "info",
  realtimeLogs: false,
  cacheAutoClean: true,
  windows10Mode: false,
  windows11Mode: true,
  experimentalCompatibility: false,
  ignoreVersionChecks: false,
  betaFeatures: false,
  notificationsInbox: [],
};

const TIER_ACCESS = [
  { tier: "Basic", count: 6, detail: "Interface, privacidade e Gaming essenciais" },
  { tier: "Pro", count: 8, detail: "Basic + rede e prioridade de jogos" },
  { tier: "Ultimate", count: 10, detail: "Catálogo completo, incluindo GPU e energia" },
  { tier: "Special", count: 10, detail: "Catálogo completo e acesso especial atribuído pelo Owner" },
];

function cleanError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const message = raw.replace(/^Error invoking remote method '[^']+': Error: /, "");
  if (/credenciais invalidas/i.test(message)) {
    return "Utilizador ou password incorretos. Confirma a password mais recente no painel.";
  }
  return message;
}

function categoryOf(tweak: Tweak) {
  return tweak.id.split(".")[0];
}

function formatExpiry(value: number | null) {
  if (value === null) return "Life-time";
  const days = Math.max(0, Math.ceil((value - Date.now() / 1000) / 86400));
  return `${days} ${days === 1 ? "dia" : "dias"}`;
}

function tierLabel(value: string) {
  return value === "orion" || value === "special" ? "SPECIAL" : value.toUpperCase();
}

const ACTIVITY_LABELS: Record<string, string> = {
  catalog_served: "Catálogo consultado",
  optimizer_previewed: "Otimização analisada",
  optimizer_applied: "Otimização executada",
  optimizer_rolled_back: "Otimização revertida",
  login_ok: "Login no Optimizer",
  panel_login_ok: "Login no site",
  login_failed: "Login recusado",
  login_hwid_mismatch: "Computador não autorizado",
  panel_hwid_reset: "Máquina desligada",
  self_hwid_reset: "Máquina reiniciada",
  panel_user_created: "Conta criada",
  panel_user_updated: "Conta atualizada",
  panel_plan_assigned: "Plano atribuído",
  plan_created: "Plano criado",
  catalog_tweak_created: "Otimização criada",
  catalog_tweak_updated: "Otimização atualizada",
  review_approved: "Avaliação aprovada",
};

function relativeTime(timestamp: number | null): string {
  if (!timestamp) return "Sem atividade";
  const seconds = Math.max(0, Math.floor(Date.now() / 1000 - timestamp));
  if (seconds < 60) return "Agora";
  if (seconds < 3600) return `Há ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `Há ${Math.floor(seconds / 3600)} h`;
  return `Há ${Math.floor(seconds / 86400)} d`;
}

function money(cents: number): string {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function formatBytes(bytes: number | null | undefined): string {
  const value = Number(bytes ?? 0);
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatMetric(value: number | null | undefined, suffix = "%"): string {
  return value === null || value === undefined ? "N/D" : `${Math.round(value * 10) / 10}${suffix}`;
}

export default function App() {
  const [settings, setSettings] = useState<LoginSettings | null>(null);
  const [profile, setProfile] = useState<SystemProfile | null>(null);
  const [appVersion, setAppVersion] = useState("");
  const [catalog, setCatalog] = useState<CatalogState | null>(null);
  const [activeOptimizations, setActiveOptimizations] = useState<ActiveOptimization[]>([]);
  const [view, setView] = useState<View>("catalog");
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [toast, setToast] = useState<{ tone: "good" | "bad"; message: string } | null>(null);
  const [theme, setTheme] = useState<Theme>(() => localStorage.getItem("orion-theme") === "light" ? "light" : "dark");
  const [animations, setAnimations] = useState(() => localStorage.getItem("orion-animations") !== "off");
  const [density, setDensity] = useState<Density>(() => localStorage.getItem("orion-density") === "compact" ? "compact" : "comfortable");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.density = density;
    document.documentElement.dataset.motion = animations ? "full" : "reduced";
    localStorage.setItem("orion-theme", theme);
    localStorage.setItem("orion-density", density);
    localStorage.setItem("orion-animations", animations ? "on" : "off");
  }, [animations, density, theme]);

  useEffect(() => {
    Promise.all([window.orion.getSettings(), window.orion.profile(), window.orion.appVersion()])
      .then(([stored, detected, version]) => {
        setSettings(stored);
        setProfile(detected);
        setAppVersion(version);
      })
      .catch((error) => {
        setSettings({ server: "http://localhost:3400", username: "", password: "" });
        setToast({ tone: "bad", message: cleanError(error) });
      });
  }, []);

  async function loadCatalog() {
    setLoadingCatalog(true);
    try {
      const [nextCatalog, active] = await Promise.all([
        window.orion.catalog(),
        window.orion.activeOptimizations(),
      ]);
      setCatalog(nextCatalog);
      setActiveOptimizations(active);
    } catch (error) {
      setToast({ tone: "bad", message: cleanError(error) });
      throw error;
    } finally {
      setLoadingCatalog(false);
    }
  }

  async function handleLogin(credentials: Parameters<OrionApi["login"]>[0]) {
    await window.orion.login(credentials);
    setSettings({
      server: credentials.server,
      username: credentials.remember ? credentials.username : "",
      password: credentials.remember ? credentials.password : "",
    });
    await loadCatalog();
  }

  async function logout() {
    await window.orion.logout();
    setCatalog(null);
    setActiveOptimizations([]);
    setView("catalog");
  }

  async function refreshActiveOptimizations() {
    setActiveOptimizations(await window.orion.activeOptimizations());
  }

  async function elevateApp() {
    try {
      const result = await window.orion.elevate();
      if (result.elevated) setToast({ tone: "good", message: "O Optimizer ja esta em modo administrador." });
    } catch (error) {
      setToast({ tone: "bad", message: cleanError(error) });
    }
  }

  if (!settings) return <MotionConfig reducedMotion={animations ? "user" : "always"}><div className="app-frame"><TitleBar version={appVersion} theme={theme} onToggleTheme={() => setTheme((current) => current === "dark" ? "light" : "dark")} /><BootScreen /></div></MotionConfig>;

  return (
    <MotionConfig reducedMotion={animations ? "user" : "always"}>
    <div className="app-frame">
      <TitleBar version={appVersion} theme={theme} onToggleTheme={() => setTheme((current) => current === "dark" ? "light" : "dark")} />
      <AnimatePresence mode="wait">
        {!catalog ? (
          <LoginScreen key="login" settings={settings} onLogin={handleLogin} profile={profile} />
        ) : (
          <motion.div
            key="shell"
            className="app-shell"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Sidebar view={view} setView={setView} account={catalog.account} appVersion={appVersion} onLogout={logout} />
            <main className="content">
              <AnimatePresence mode="wait">
                {view === "catalog" && (
                  <CatalogView
                    key="catalog"
                    state={catalog}
                    profile={profile}
                    loading={loadingCatalog}
                    onRefresh={loadCatalog}
                    activeOptimizations={activeOptimizations}
                    onActiveChange={setActiveOptimizations}
                    notify={setToast}
                  />
                )}
                {view === "active" && <ActiveOptimizationsView key="active" state={catalog} active={activeOptimizations} notify={setToast} onChange={setActiveOptimizations} onRefresh={refreshActiveOptimizations} setView={setView} />}
                {view === "games" && <GamesView key="games" state={catalog} profile={profile} activeOptimizations={activeOptimizations} notify={setToast} onActiveChange={setActiveOptimizations} />}
                {view === "performance" && <PerformanceView key="performance" profile={profile} notify={setToast} />}
                {view === "history" && <HistoryView key="history" notify={setToast} onActiveChange={setActiveOptimizations} />}
                {view === "settings" && <SettingsView key="settings" account={catalog.account} profile={profile} settings={settings} appVersion={appVersion} theme={theme} setTheme={setTheme} animations={animations} setAnimations={setAnimations} density={density} setDensity={setDensity} onElevate={elevateApp} />}
                {view === "internal" && (
                  <InternalView key="internal" state={catalog} profile={profile} settings={settings} notify={setToast} />
                )}
              </AnimatePresence>
            </main>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      </AnimatePresence>
    </div>
    </MotionConfig>
  );
}

function TitleBar({ version, theme, onToggleTheme }: { version: string; theme: Theme; onToggleTheme: () => void }) {
  return (
    <div className="titlebar">
      <div className="titlebar-brand">
        <img src={logo} alt="" />
        <span>ORION OPTIMIZER 2.0</span>
      </div>
      <div className="titlebar-right">
        {version && <span className="app-version" title={`Orion Optimizer 2.0 ${version}`}>v{version}</span>}
        <button className="titlebar-theme" onClick={onToggleTheme} title={theme === "dark" ? "Usar tema claro" : "Usar tema escuro"} aria-label={theme === "dark" ? "Usar tema claro" : "Usar tema escuro"}>{theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}</button>
        <div className="window-controls">
          <button onClick={() => window.orion.minimize()} aria-label="Minimizar"><Minus size={14} /></button>
          <button onClick={() => window.orion.maximize()} aria-label="Maximizar"><Square size={11} /></button>
          <button className="close" onClick={() => window.orion.close()} aria-label="Fechar"><X size={15} /></button>
        </div>
      </div>
    </div>
  );
}

function BootScreen() {
  return (
    <div className="boot-screen">
      <motion.img src={logo} alt="Orion" initial={{ scale: 0.86, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} />
      <div className="loading-line"><span /></div>
    </div>
  );
}

function LoginScreen({
  settings,
  onLogin,
  profile,
}: {
  settings: LoginSettings;
  onLogin: (credentials: Parameters<OrionApi["login"]>[0]) => Promise<void>;
  profile: SystemProfile | null;
}) {
  const [username, setUsername] = useState(settings.username);
  const [password, setPassword] = useState(settings.password);
  const [showPassword, setShowPassword] = useState(false);
  const [server, setServer] = useState(settings.server);
  const [remember, setRemember] = useState(Boolean(settings.username));
  const [advanced, setAdvanced] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      await onLogin({
        username: username.trim(),
        password: password.trim(),
        server: server.trim().replace(/\/$/, ""),
        remember,
      });
    } catch (caught) {
      const message = cleanError(caught);
      setError(message);
      if (/password|credenciais|incorretos/i.test(message)) {
        setPassword("");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <motion.div className="login-layout" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -10 }}>
      <section className="login-brand-panel">
        <div className="brand-grid" />
        <motion.div
          className="brand-lockup"
          initial={{ x: -24, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.55 }}
        >
          <img src={logo} alt="Orion Optimizer 2.0" />
          <div>
            <strong>ORION</strong>
            <span>OPTIMIZER 2.0</span>
          </div>
        </motion.div>
        <div className="login-system-strip">
          <StatusDot good={Boolean(profile)} />
          <span>{profile ? `${profile.chassis} · ${profile.gpuVendors?.join(" + ") || profile.gpuVendor} · ${profile.ramGB} GB` : "A detetar sistema"}</span>
        </div>
      </section>

      <section className="login-form-panel">
        <motion.form onSubmit={submit} initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.12 }}>
          <div className="login-heading">
            <span className="eyebrow">CLIENTE WINDOWS</span>
            <h1>Iniciar sessão</h1>
            <p>Utiliza as credenciais da tua licença Orion.</p>
          </div>

          {error && <div className="form-error"><CircleAlert size={15} /><span>{error}</span></div>}

          <label className="field">
            <span>Utilizador</span>
            <div><UserRound size={16} /><input autoFocus value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" /></div>
          </label>
          <label className="field">
            <span>Password</span>
            <div>
              <LockKeyhole size={16} />
              <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Esconder password" : "Mostrar password"}
                title={showPassword ? "Esconder password" : "Mostrar password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          <div className="form-row">
            <label className="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /><span>Lembrar utilizador</span></label>
            <button type="button" className="text-button" onClick={() => setAdvanced(!advanced)}>Servidor <ChevronRight size={13} className={advanced ? "rotate" : ""} /></button>
          </div>

          <AnimatePresence initial={false}>
            {advanced && (
              <motion.label className="field advanced-field" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                <span>Endereço do servidor</span>
                <div><Wifi size={16} /><input value={server} onChange={(e) => setServer(e.target.value)} /></div>
              </motion.label>
            )}
          </AnimatePresence>

          <button className="primary login-button" disabled={pending || !username || !password}>
            {pending ? <><Spinner />A validar licença e Discord</> : <>Entrar <ChevronRight size={16} /></>}
          </button>
          <div className="secure-note"><ShieldCheck size={14} /><span>Licença, dispositivo e cargos Discord verificados</span></div>
        </motion.form>
      </section>
    </motion.div>
  );
}

function Sidebar({ view, setView, account, appVersion, onLogout }: { view: View; setView: (view: View) => void; account: CatalogState["account"]; appVersion: string; onLogout: () => void }) {
  const internal = INTERNAL_ROLES.has(account.role);
  return (
    <aside className="sidebar">
      <div className="sidebar-logo"><img src={logo} alt="" /><div><b>ORION 2.0</b><span>OPTIMIZER</span></div></div>
      <nav>
        <SidebarSection label="Jogos e sistema">
          <NavButton active={view === "games"} icon={<Gamepad2 />} label="Jogos" onClick={() => setView("games")} />
          <NavButton active={view === "performance"} icon={<Activity />} label="Desempenho" onClick={() => setView("performance")} />
        </SidebarSection>
        <SidebarSection label="Optimizer">
          <NavButton active={view === "catalog"} icon={<Gauge />} label="Otimizações" onClick={() => setView("catalog")} />
          <NavButton active={view === "active"} icon={<Check />} label="Ativas" onClick={() => setView("active")} />
          <NavButton active={view === "history"} icon={<History />} label="Histórico" onClick={() => setView("history")} />
        </SidebarSection>
        <SidebarSection label="Conta">
          <NavButton active={view === "settings"} icon={<Settings2 />} label="Definições" onClick={() => setView("settings")} />
        </SidebarSection>
        {internal && (
          <SidebarSection label="Equipa interna">
            <NavButton active={view === "internal"} icon={<Crown />} label="Centro da equipa" onClick={() => setView("internal")} />
          </SidebarSection>
        )}
      </nav>
      {internal && <SidebarRoleCard role={account.role} tier={account.tier} />}
      <div className="sidebar-status"><span><StatusDot good /><b>Proteção ativa</b></span><small>Rollback disponível · v{appVersion || "..."}</small></div>
      <div className="sidebar-account">
        <div className="avatar">
          {account.discord_avatar_url ? (
            <img src={account.discord_avatar_url} alt="" referrerPolicy="no-referrer" />
          ) : (
            <UserRound size={17} />
          )}
        </div>
        <div>
          <strong title={account.username}>{account.display_name || account.username}</strong>
          <span title={`Discord verificado · ${formatExpiry(account.expires_at)}`}>
            {account.discord_verified && <ShieldCheck size={11} />}
            {ROLE_LABEL[account.role] ?? account.role}
            {account.tier ? ` · ${tierLabel(account.tier)}` : " · Acesso interno"}
          </span>
        </div>
        <button onClick={onLogout} title="Terminar sessão"><LogOut size={16} /></button>
      </div>
    </aside>
  );
}

function SidebarRoleCard({ role, tier }: { role: string; tier: string | null }) {
  return (
    <div className="sidebar-role-card">
      <span><Crown size={13} />Acesso interno</span>
      <strong>{ROLE_LABEL[role] ?? role}</strong>
      <small>{role === "owner" ? "Todas as ferramentas" : role === "developer" ? "Catálogo e operação" : "Suporte e presença"} · {tier ? tierLabel(tier) : "sem plano"}</small>
    </div>
  );
}

function SidebarSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="sidebar-section">
      <span className="sidebar-nav-label">{label}</span>
      <div className="sidebar-section-items">{children}</div>
    </section>
  );
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return <button className={`nav-button ${active ? "active" : ""}`} onClick={onClick}>{icon}<span>{label}</span>{active && <motion.i layoutId="nav-active" />}</button>;
}

function CatalogView({
  state,
  profile,
  loading,
  onRefresh,
  activeOptimizations,
  onActiveChange,
  notify,
}: {
  state: CatalogState;
  profile: SystemProfile | null;
  loading: boolean;
  onRefresh: () => Promise<void>;
  activeOptimizations: ActiveOptimization[];
  onActiveChange: (items: ActiveOptimization[]) => void;
  notify: (toast: { tone: "good" | "bad"; message: string }) => void;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [onlyCompatible, setOnlyCompatible] = useState(true);
  const [selected, setSelected] = useState<Tweak | null>(null);
  const applied = useMemo(() => new Set(activeOptimizations.map((item) => item.tweakId)), [activeOptimizations]);

  const categories = useMemo(() => Array.from(new Set(state.tweaks.map(categoryOf))), [state.tweaks]);
  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("pt");
    return state.tweaks.filter((tweak) => {
      const matchSearch = !q || `${tweak.name} ${tweak.description}`.toLocaleLowerCase("pt").includes(q);
      const matchCategory = category === "all" || categoryOf(tweak) === category;
      const matchCompatible = !onlyCompatible || state.eligibility[tweak.id]?.eligible;
      return matchSearch && matchCategory && matchCompatible;
    });
  }, [category, onlyCompatible, search, state]);

  return (
    <PageMotion>
      <header className="page-header">
        <div><span className="eyebrow">CATÁLOGO</span><h1>Otimizações</h1><p>{state.tweaks.length} ajustes verificados para Windows</p></div>
        <div className="header-actions">
          {profile && <div className={`mode-badge ${profile.executionMode === "Mock" ? "simulation" : "real"}`}><StatusDot good={profile.executionMode === "Real"} />{profile.executionMode === "Mock" ? "Simulação" : "Modo real"}</div>}
          <button className="icon-button" onClick={() => void onRefresh()} disabled={loading} title="Atualizar catálogo"><RefreshCcw size={16} className={loading ? "spin" : ""} /></button>
        </div>
      </header>

      <section className="system-summary">
        <SummaryItem icon={<Cpu />} label="Dispositivo" value={profile?.chassis === "laptop" ? "Portátil" : "Desktop"} />
        <SummaryItem icon={<MonitorCog />} label="GPU" value={profile?.gpuVendors?.join(" + ") || profile?.gpuVendor || "A detetar"} />
        <SummaryItem icon={<UserRound />} label="Cargo Orion" value={ROLE_LABEL[state.account.role] ?? state.account.role} />
        <SummaryItem icon={<Crown />} label="Plano" value={state.account.tier ? tierLabel(state.account.tier) : "Acesso interno"} />
        <SummaryItem icon={<ShieldCheck />} label="Windows" value={profile?.isAdmin ? "Elevado" : "Sessão normal"} />
      </section>

      <div className="catalog-toolbar">
        <label className="search-box"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar otimizações" /></label>
        <div className="category-tabs">
          <button className={category === "all" ? "active" : ""} onClick={() => setCategory("all")}>Todas</button>
          {categories.map((key) => <button key={key} className={category === key ? "active" : ""} onClick={() => setCategory(key)}>{CATEGORY[key]?.label ?? key}</button>)}
        </div>
        <label className="switch-label"><input type="checkbox" checked={onlyCompatible} onChange={(e) => setOnlyCompatible(e.target.checked)} /><span className="switch" /><b>Compatíveis</b></label>
      </div>

      <div className="result-line"><span>{filtered.length} resultados</span><span><ShieldCheck size={13} /> Alterações reversíveis</span></div>
      <div className="tweak-grid">
        <AnimatePresence mode="popLayout">
          {filtered.map((tweak, index) => (
            <TweakCard key={tweak.id} tweak={tweak} eligible={state.eligibility[tweak.id]} applied={applied.has(tweak.id)} onOpen={() => setSelected(tweak)} index={index} />
          ))}
        </AnimatePresence>
      </div>
      {filtered.length === 0 && <EmptyState icon={<Search />} title="Sem resultados" text="Altera a pesquisa ou os filtros selecionados." />}

      <AnimatePresence>
        {selected && (
          <TweakModal
            tweak={selected}
            onClose={() => setSelected(null)}
            onApplied={async () => {
              onActiveChange(await window.orion.activeOptimizations());
              notify({ tone: "good", message: `${selected.name} aplicada com sucesso.` });
            }}
            notify={notify}
            mode={profile?.executionMode ?? "Mock"}
          />
        )}
      </AnimatePresence>
    </PageMotion>
  );
}

function TweakCard({ tweak, eligible, applied, onOpen, index }: { tweak: Tweak; eligible?: { eligible: boolean; reason: string }; applied: boolean; onOpen: () => void; index: number }) {
  const meta = CATEGORY[categoryOf(tweak)] ?? { label: "Sistema", icon: Settings2 };
  const Icon = meta.icon;
  const available = eligible?.eligible !== false;
  return (
    <motion.article className={`tweak-card ${!available ? "disabled" : ""}`} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ delay: Math.min(index * 0.025, 0.2) }}>
      <div className="tweak-card-top"><div className="tweak-icon"><Icon size={18} /></div><span className="category-label">{meta.label}</span>{tweak.layer === 1 && <span className="admin-tag"><ShieldCheck size={11} />ADMIN</span>}</div>
      <h2>{tweak.name}</h2>
      <p>{tweak.description}</p>
      <div className="tweak-meta"><span className={`impact ${tweak.impact}`}>Impacto {tweak.impact}</span>{tweak.requiresReboot && <span><RefreshCcw size={11} />Reinício</span>}</div>
      {!available && <div className="compatibility-warning"><CircleAlert size={13} />{eligible?.reason}</div>}
      <button className={`apply-button ${applied ? "applied" : ""}`} disabled={!available} onClick={onOpen}>{applied ? <><Check size={15} />Aplicada</> : <><Play size={14} />Executar</>}</button>
    </motion.article>
  );
}

function TweakModal({ tweak, onClose, onApplied, notify, mode }: { tweak: Tweak; onClose: () => void; onApplied: (result: Awaited<ReturnType<OrionApi["apply"]>>) => void | Promise<void>; notify: (toast: { tone: "good" | "bad"; message: string }) => void; mode: "Real" | "Mock" }) {
  const [preview, setPreview] = useState<ChangePreview[] | null>(null);
  const [stage, setStage] = useState<"loading" | "ready" | "applying" | "done">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    window.orion.preview(tweak).then((changes) => { setPreview(changes); setStage("ready"); }).catch((caught) => { setError(cleanError(caught)); setStage("ready"); });
  }, [tweak]);

  async function apply() {
    setStage("applying");
    setError("");
    try {
      const result = await window.orion.apply(tweak);
      setStage("done");
      await onApplied(result);
    } catch (caught) {
      const message = cleanError(caught);
      setError(message);
      setStage("ready");
      notify({ tone: "bad", message });
    }
  }

  return (
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && stage !== "applying" && onClose()}>
      <motion.section className="modal" initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }}>
        <button className="modal-close" onClick={onClose} disabled={stage === "applying"} aria-label="Fechar"><X size={18} /></button>
        {stage === "done" ? (
          <motion.div className="success-state" initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <div className="success-ring"><Check size={30} /></div><span className="eyebrow">CONCLUÍDO</span><h2>Otimização aplicada</h2><p>{tweak.name}</p>{tweak.requiresReboot && <div className="reboot-note"><RefreshCcw size={15} />Reinicia o Windows para concluir.</div>}<button className="primary" onClick={onClose}>Concluir</button>
          </motion.div>
        ) : (
          <>
            <div className="modal-heading"><span className="eyebrow">PRÉ-VISUALIZAÇÃO</span><h2>{tweak.name}</h2><p>{tweak.description}</p></div>
            <div className="safety-row"><span><ShieldCheck size={15} />Journal ativo</span><span><RotateCcw size={15} />Reversível</span><span><Activity size={15} />{mode === "Mock" ? "Simulação" : "Modo real"}</span></div>
            <div className="changes-panel">
              <div className="changes-header"><span>Alterações</span><b>{preview?.length ?? 0}</b></div>
              {stage === "loading" ? <div className="preview-loading"><Spinner />A analisar o estado atual</div> : preview?.map((change, i) => (
                <div className="change-row" key={`${change.Path}-${change.Name}-${i}`}><div><strong>{change.Name}</strong><code>{change.Path}</code></div><div className="value-change"><span>{change.Before}</span><ChevronRight size={13} /><b>{change.After}</b></div></div>
              ))}
            </div>
            {error && <div className="form-error"><CircleAlert size={15} />{error}</div>}
            <div className="modal-actions"><button className="secondary" onClick={onClose} disabled={stage === "applying"}>Cancelar</button><button className="primary" onClick={() => void apply()} disabled={stage !== "ready" || Boolean(error)}>{stage === "applying" ? <><Spinner />A aplicar</> : tweak.layer === 1 && mode === "Real" ? <><ShieldCheck size={15} />Autorizar e aplicar</> : <><Play size={14} />Aplicar agora</>}</button></div>
          </>
        )}
      </motion.section>
    </motion.div>
  );
}

function ActiveOptimizationsView({
  state,
  active,
  notify,
  onChange,
  onRefresh,
  setView,
}: {
  state: CatalogState;
  active: ActiveOptimization[];
  notify: (toast: { tone: "good" | "bad"; message: string }) => void;
  onChange: (items: ActiveOptimization[]) => void;
  onRefresh: () => Promise<void>;
  setView: (view: View) => void;
}) {
  const [clearing, setClearing] = useState<string | null>(null);
  const activeIds = useMemo(() => new Set(active.map((item) => item.tweakId)), [active]);
  const compatibleCount = state.tweaks.filter((tweak) => state.eligibility[tweak.id]?.eligible).length;
  const catalogById = useMemo(() => new Map(state.tweaks.map((tweak) => [tweak.id, tweak])), [state.tweaks]);
  const activeWithCatalog = active.map((item) => ({ ...item, tweak: catalogById.get(item.tweakId) }));

  async function clearItem(tweakId: string) {
    setClearing(tweakId);
    try {
      onChange(await window.orion.clearActiveOptimization(tweakId));
      notify({ tone: "good", message: "Otimizacao removida da lista de ativas." });
    } catch (error) {
      notify({ tone: "bad", message: cleanError(error) });
    } finally {
      setClearing(null);
    }
  }

  return (
    <PageMotion>
      <header className="page-header">
        <div><span className="eyebrow">ESTADO DO PC</span><h1>Otimizacoes ativas</h1><p>Ajustes aplicados neste utilizador e neste computador.</p></div>
        <div className="header-actions">
          <button className="secondary compact" onClick={() => setView("catalog")}><Gauge size={14} />Ver catalogo</button>
          <button className="icon-button" onClick={() => void onRefresh()} title="Atualizar ativas"><RefreshCcw size={16} /></button>
        </div>
      </header>

      <section className="active-summary">
        <SummaryItem icon={<Check />} label="Ativas" value={String(active.length)} />
        <SummaryItem icon={<PackageCheck />} label="Disponiveis" value={String(state.tweaks.length)} />
        <SummaryItem icon={<ShieldCheck />} label="Compativeis" value={String(compatibleCount)} />
        <SummaryItem icon={<Crown />} label="Plano" value={state.account.tier ? tierLabel(state.account.tier) : "Acesso interno"} />
      </section>

      {active.length === 0 ? (
        <EmptyState icon={<Check />} title="Ainda sem otimizacoes ativas" text="Aplica uma otimizacao no catalogo para ela aparecer aqui." />
      ) : (
        <div className="active-layout">
          <section className="active-list">
            {activeWithCatalog.map((item, index) => {
              const meta = CATEGORY[item.category] ?? { label: "Sistema", icon: Zap };
              const Icon = meta.icon;
              const compatible = item.tweak ? state.eligibility[item.tweakId]?.eligible !== false : true;
              return (
                <motion.article className="active-card" key={`${item.tweakId}-${item.sessionId || index}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.035, 0.2) }}>
                  <span className="active-icon"><Icon size={18} /></span>
                  <div className="active-main">
                    <div className="active-title-row">
                      <strong>{item.name}</strong>
                      <span className="active-pill"><StatusDot good />Ativa</span>
                    </div>
                    <p>{item.description || item.tweak?.description || "Otimizacao registada localmente."}</p>
                    <div className="active-meta">
                      <span>{meta.label}</span>
                      <span>{new Date(item.appliedAt * 1000).toLocaleString("pt-PT")}</span>
                      {item.requiresReboot && <span>Reinicio recomendado</span>}
                      {!compatible && <span>Agora bloqueada pelo perfil atual</span>}
                    </div>
                  </div>
                  <button className="secondary compact" onClick={() => void clearItem(item.tweakId)} disabled={clearing === item.tweakId}>
                    {clearing === item.tweakId ? <Spinner /> : <X size={13} />}Remover
                  </button>
                </motion.article>
              );
            })}
          </section>

          <aside className="active-insights">
            <div className="settings-panel-heading"><span className="settings-panel-icon"><Activity size={17} /></span><div><h2>Resumo rapido</h2><p>Informacao util para suporte e cliente</p></div></div>
            <div className="settings-facts">
              <InfoLine label="Utilizador" value={state.account.display_name || state.account.username} />
              <InfoLine label="Cargo" value={ROLE_LABEL[state.account.role] ?? state.account.role} />
              <InfoLine label="Acesso" value={formatExpiry(state.account.expires_at)} />
              <InfoLine label="Rollback" value="Disponivel no Historico" />
            </div>
            <button className="primary active-history-button" onClick={() => setView("history")}><RotateCcw size={14} />Abrir historico</button>
          </aside>
        </div>
      )}
    </PageMotion>
  );
}

function HistoryView({ notify, onActiveChange }: { notify: (toast: { tone: "good" | "bad"; message: string }) => void; onActiveChange: (items: ActiveOptimization[]) => void }) {
  const [sessions, setSessions] = useState<OrionSession[] | null>(null);
  const [rolling, setRolling] = useState<string | null>(null);
  useEffect(() => { window.orion.sessions().then(setSessions).catch((e) => notify({ tone: "bad", message: cleanError(e) })); }, [notify]);

  async function rollback(session: OrionSession) {
    setRolling(session.sessionId);
    try {
      await window.orion.rollback(session);
      setSessions((current) => current?.map((item) => item.sessionId === session.sessionId ? { ...item, status: "rolled_back" } : item) ?? []);
      onActiveChange(await window.orion.activeOptimizations());
      notify({ tone: "good", message: "Alterações revertidas com sucesso." });
    } catch (error) {
      notify({ tone: "bad", message: cleanError(error) });
    } finally { setRolling(null); }
  }

  return (
    <PageMotion>
      <header className="page-header"><div><span className="eyebrow">SEGURANÇA</span><h1>Histórico</h1><p>Sessões registadas neste dispositivo</p></div></header>
      {sessions === null ? <div className="page-loading"><Spinner />A carregar histórico</div> : sessions.length === 0 ? <EmptyState icon={<History />} title="Histórico vazio" text="As otimizações aplicadas aparecerão aqui." /> : <div className="history-list">{sessions.map((session) => {
        const id = session.note.replace(/^desktop:/, "");
        const rolledBack = session.status === "rolled_back";
        return <motion.article className="history-item" key={session.sessionId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><div className="history-icon"><Clock3 size={17} /></div><div className="history-main"><strong>{id || "Sessão Orion"}</strong><span>{new Date(session.startedAt).toLocaleString("pt-PT")}</span></div><div className="history-count">{session.entries.length} {session.entries.length === 1 ? "alteração" : "alterações"}</div><span className={`session-status ${session.status}`}>{rolledBack ? "Revertida" : session.status === "confirmed" ? "Confirmada" : "Pendente"}</span><button className="secondary compact" onClick={() => void rollback(session)} disabled={rolling === session.sessionId || rolledBack}>{rolling === session.sessionId ? <Spinner /> : rolledBack ? <Check size={14} /> : <RotateCcw size={14} />}{rolledBack ? "Revertida" : "Reverter"}</button></motion.article>;
      })}</div>}
    </PageMotion>
  );
}

function readGameVisualProfiles(): Record<string, GameVisualProfile> {
  try {
    const parsed = JSON.parse(localStorage.getItem(GAME_VISUAL_PROFILE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function displayId(display: OrionDisplay) {
  return String(display.deviceName ?? display.id ?? "");
}

function displayName(display: OrionDisplay) {
  return String((display.displayName ?? display.name ?? displayId(display)) || "Ecra");
}

function displayRefresh(display: OrionDisplay) {
  return Number(display.current?.refreshRate ?? display.current?.refreshHz ?? 0);
}

function modeRefresh(mode: OrionDisplay["modes"][number]) {
  return Number(mode.refreshRate ?? mode.refreshHz ?? 0);
}

function defaultGameVisualProfile(displays: OrionDisplay[]): GameVisualProfile {
  const primary = displays.find((display) => display.primary) ?? displays[0];
  return {
    displayId: primary ? displayId(primary) : "",
    refreshRate: primary ? displayRefresh(primary) : 0,
    windowMode: "borderless",
    autoFocus: true,
    disableOverlays: true,
    preferHdr: false,
  };
}

function normalizeGameVisualProfile(profile: GameVisualProfile | undefined, displays: OrionDisplay[]) {
  const fallback = defaultGameVisualProfile(displays);
  const selectedDisplay = displays.find((display) => displayId(display) === (profile?.displayId || fallback.displayId)) ?? displays.find((display) => displayId(display) === fallback.displayId);
  const rates = Array.from(new Set((selectedDisplay?.modes ?? []).map(modeRefresh).filter(Boolean))).sort((left, right) => right - left);
  const currentRate = selectedDisplay ? displayRefresh(selectedDisplay) : fallback.refreshRate;
  const refreshRate = Number(profile?.refreshRate || currentRate || rates[0] || 0);
  return {
    ...(profile ?? fallback),
    displayId: selectedDisplay ? displayId(selectedDisplay) : fallback.displayId,
    refreshRate,
    rates,
    selectedDisplay,
  };
}

function GamesView({
  state,
  profile,
  activeOptimizations,
  notify,
  onActiveChange,
}: {
  state: CatalogState;
  profile: SystemProfile | null;
  activeOptimizations: ActiveOptimization[];
  notify: (toast: { tone: "good" | "bad"; message: string }) => void;
  onActiveChange: (items: ActiveOptimization[]) => void;
}) {
  const [games, setGames] = useState<OrionGame[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [selected, setSelected] = useState<OrionGame | null>(null);
  const [selectedTweak, setSelectedTweak] = useState<Tweak | null>(null);
  const [reverting, setReverting] = useState<string | null>(null);
  const [loadingGames, setLoadingGames] = useState(false);
  const [displays, setDisplays] = useState<OrionDisplay[]>([]);
  const [visualProfiles, setVisualProfiles] = useState<Record<string, GameVisualProfile>>(() => readGameVisualProfiles());
  const gameTweaks = state.tweaks.filter((tweak) => ["game", "gpu", "net", "mmcss", "power"].includes(categoryOf(tweak)));
  const activeByTweak = useMemo(() => new Map(activeOptimizations.map((item) => [item.tweakId, item])), [activeOptimizations]);

  async function rollbackActive(item: ActiveOptimization) {
    if (!item.sessionId) {
      notify({ tone: "bad", message: "Esta otimizacao nao tem sessao de rollback associada." });
      return;
    }
    setReverting(item.tweakId);
    try {
      const sessions = await window.orion.sessions();
      const session = sessions.find((entry) => entry.sessionId === item.sessionId);
      if (!session) throw new Error("Sessao de rollback nao encontrada no historico deste PC.");
      await window.orion.rollback(session);
      onActiveChange(await window.orion.activeOptimizations());
      notify({ tone: "good", message: `${item.name} revertida com sucesso.` });
    } catch (error) {
      notify({ tone: "bad", message: cleanError(error) });
    } finally {
      setReverting(null);
    }
  }

  async function loadGames(force = false) {
    setLoadingGames(true);
    try {
      const result = await window.orion.games({ force });
      const rawItems = (result.items as unknown as { value?: OrionGame[] })?.value ?? result.items;
      const rawWarnings = (result.warnings as unknown as { value?: string[] })?.value ?? result.warnings;
      setGames(Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : []);
      setWarnings(Array.isArray(rawWarnings) ? rawWarnings : rawWarnings ? [String(rawWarnings)] : []);
    } catch (error) {
      notify({ tone: "bad", message: cleanError(error) });
      setGames([]);
    } finally {
      setLoadingGames(false);
    }
  }

  useEffect(() => { void loadGames(); }, []);
  useEffect(() => {
    window.orion.displays().then((result) => {
      const raw = (result.items as unknown as { value?: OrionDisplay[] })?.value ?? result.items;
      setDisplays(Array.isArray(raw) ? raw : raw ? [raw] : []);
    }).catch(() => setDisplays([]));
  }, []);

  function saveVisualProfile(gameId: string, next: GameVisualProfile) {
    const updated = { ...visualProfiles, [gameId]: { ...next, lastSavedAt: Math.floor(Date.now() / 1000) } };
    setVisualProfiles(updated);
    localStorage.setItem(GAME_VISUAL_PROFILE_KEY, JSON.stringify(updated));
  }

  async function launchGame(game: OrionGame) {
    try {
      await window.orion.launchGame(game);
      notify({ tone: "good", message: `${game.name} aberto.` });
    } catch (error) {
      notify({ tone: "bad", message: cleanError(error) });
    }
  }

  const totalSize = (games ?? []).reduce((sum, game) => sum + Number(game.sizeBytes || 0), 0);
  const platforms = Array.from(new Set((games ?? []).map((game) => game.platform)));

  return (
    <PageMotion>
      <header className="page-header">
        <div><span className="eyebrow">BIBLIOTECA</span><h1>Jogos</h1><p>Jogos detetados no PC e perfis de otimizacao recomendados.</p></div>
        <div className="header-actions">
          <div className="mode-badge"><Gamepad2 size={14} />{games ? `${games.length} jogos` : "A procurar"}</div>
          <button className="icon-button" onClick={() => void loadGames(true)} disabled={loadingGames} title="Atualizar jogos"><RefreshCcw size={16} className={loadingGames ? "spin" : ""} /></button>
        </div>
      </header>

      <section className="gaming-hero">
        <motion.div className="gaming-orbit" animate={{ rotate: 360 }} transition={{ duration: 22, repeat: Infinity, ease: "linear" }} />
        <div><span className="eyebrow">PERFIL GAMING</span><h2>{gameTweaks.length} otimizacoes prontas</h2><p>Escolhe um jogo para ver o perfil manual recomendado. Nada e aplicado sem confirmares.</p></div>
        <div className="gaming-stats"><SummaryItem icon={<HardDrive />} label="Tamanho" value={formatBytes(totalSize)} /><SummaryItem icon={<PackageCheck />} label="Lojas" value={platforms.length ? platforms.join(" + ") : "A detetar"} /></div>
      </section>

      {warnings.length > 0 && <div className="operations-error"><CircleAlert size={15} />Algumas lojas responderam com avisos. A lista restante continua valida.</div>}

      {games === null ? (
        <div className="page-loading"><Spinner />A procurar jogos instalados</div>
      ) : games.length === 0 ? (
        <EmptyState icon={<Gamepad2 />} title="Sem jogos detetados" text="Instala Steam, Epic, GOG, Microsoft Store ou Xbox/Game Pass para aparecerem aqui." />
      ) : (
        <div className="games-grid">
          {games.map((game, index) => (
            <motion.button className="game-card" key={game.id} onClick={() => setSelected(game)} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.035, 0.25) }}>
              <span className="game-platform">{game.platform}</span>
              <strong>{game.name}</strong>
              <small>{game.installPath || "Localizacao protegida pelo Windows"}</small>
              <div><span>{formatBytes(game.sizeBytes)}</span><ChevronRight size={15} /></div>
            </motion.button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {selected && <GameModal game={selected} tweaks={gameTweaks} eligibility={state.eligibility} activeByTweak={activeByTweak} reverting={reverting} displays={displays} visualProfile={visualProfiles[selected.id]} onVisualChange={(next) => saveVisualProfile(selected.id, next)} onLaunch={() => void launchGame(selected)} onClose={() => setSelected(null)} onOptimize={setSelectedTweak} onRollback={(item) => void rollbackActive(item)} />}
        {selectedTweak && <TweakModal tweak={selectedTweak} onClose={() => setSelectedTweak(null)} onApplied={async () => {
          onActiveChange(await window.orion.activeOptimizations());
          notify({ tone: "good", message: `${selectedTweak.name} aplicada com sucesso.` });
        }} notify={notify} mode={profile?.executionMode ?? "Mock"} />}
      </AnimatePresence>
    </PageMotion>
  );
}

function GameModal({
  game,
  tweaks,
  eligibility,
  activeByTweak,
  reverting,
  displays,
  visualProfile,
  onVisualChange,
  onLaunch,
  onClose,
  onOptimize,
  onRollback,
}: {
  game: OrionGame;
  tweaks: Tweak[];
  eligibility: CatalogState["eligibility"];
  activeByTweak: Map<string, ActiveOptimization>;
  reverting: string | null;
  displays: OrionDisplay[];
  visualProfile?: GameVisualProfile;
  onVisualChange: (profile: GameVisualProfile) => void;
  onLaunch: () => void;
  onClose: () => void;
  onOptimize: (tweak: Tweak) => void;
  onRollback: (item: ActiveOptimization) => void;
}) {
  const recommended = tweaks.slice(0, 6);
  const visual = normalizeGameVisualProfile(visualProfile, displays);
  const selectedDisplay = visual.selectedDisplay;
  const displayModes = selectedDisplay?.modes ?? [];
  const maxHz = visual.rates[0] || visual.refreshRate || (selectedDisplay ? displayRefresh(selectedDisplay) : 0);
  const currentModeText = selectedDisplay
    ? `${selectedDisplay.current.width}x${selectedDisplay.current.height} @ ${displayRefresh(selectedDisplay)} Hz`
    : "Nenhum ecra detetado";
  const saveVisual = (patch: Partial<GameVisualProfile>) => onVisualChange({
    displayId: visual.displayId,
    refreshRate: visual.refreshRate,
    windowMode: visual.windowMode,
    autoFocus: visual.autoFocus,
    disableOverlays: visual.disableOverlays,
    preferHdr: visual.preferHdr,
    ...patch,
  });
  return (
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <motion.section className="modal game-modal" initial={{ opacity: 0, y: 18, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: .98 }}>
        <button className="modal-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        <div className="modal-heading"><span className="eyebrow">{game.platform}</span><h2>{game.name}</h2><p>{game.installPath || "Jogo protegido pela loja. O Orion usa otimizacoes seguras fora da pasta do jogo."}</p></div>
        <div className="game-modal-grid">
          <ModalStat label="Tamanho" value={formatBytes(game.sizeBytes)} />
          <ModalStat label="Ecra" value={selectedDisplay ? displayName(selectedDisplay) : "A detetar"} />
          <ModalStat label="Modo" value={WINDOW_MODE_LABEL[visual.windowMode]} />
        </div>
        <section className="game-visual-panel">
          <div className="game-visual-heading">
            <span className="settings-panel-icon"><MonitorCog size={17} /></span>
            <div><h3>Arranque visual</h3><p>{currentModeText} · perfil guardado apenas para este jogo</p></div>
          </div>
          <div className="display-pickers">
            {displays.length ? displays.map((display) => {
              const id = displayId(display);
              const active = id === visual.displayId;
              const bestHz = Math.max(...display.modes.map(modeRefresh).filter(Boolean), displayRefresh(display));
              return (
                <button key={id} className={`display-choice ${active ? "active" : ""}`} onClick={() => saveVisual({ displayId: id, refreshRate: displayRefresh(display) || bestHz })}>
                  <span><MonitorCog size={15} /></span>
                  <strong>{displayName(display)}</strong>
                  <small>{display.current.width}x{display.current.height} @ {displayRefresh(display)} Hz</small>
                  <b>{display.primary ? "Principal" : `${bestHz} Hz max`}</b>
                </button>
              );
            }) : <div className="display-empty"><MonitorCog size={16} />Nenhum ecra devolvido pelo Windows.</div>}
          </div>
          <div className="visual-controls">
            <label>
              <span>Hz pretendidos</span>
              <select value={visual.refreshRate || ""} onChange={(event) => saveVisual({ refreshRate: Number(event.target.value) })} disabled={!visual.rates.length}>
                {visual.rates.length ? visual.rates.map((rate) => <option key={rate} value={rate}>{rate} Hz{rate === maxHz ? " - maximo" : ""}</option>) : <option>Sem modos</option>}
              </select>
            </label>
            <label>
              <span>Modo de janela</span>
              <select value={visual.windowMode} onChange={(event) => saveVisual({ windowMode: event.target.value as GameVisualProfile["windowMode"] })}>
                <option value="borderless">Sem bordas</option>
                <option value="exclusive">Fullscreen exclusivo</option>
                <option value="windowed">Janela</option>
              </select>
            </label>
            <label className="visual-toggle"><input type="checkbox" checked={visual.autoFocus} onChange={(event) => saveVisual({ autoFocus: event.target.checked })} />Focar jogo ao abrir</label>
            <label className="visual-toggle"><input type="checkbox" checked={visual.disableOverlays} onChange={(event) => saveVisual({ disableOverlays: event.target.checked })} />Preferir menos overlays</label>
            <label className="visual-toggle"><input type="checkbox" checked={visual.preferHdr} onChange={(event) => saveVisual({ preferHdr: event.target.checked })} />Preferir HDR</label>
          </div>
          <div className="visual-mode-strip">
            {displayModes.slice(0, 8).map((mode, index) => (
              <span key={`${mode.width}-${mode.height}-${modeRefresh(mode)}-${index}`}>{mode.width}x{mode.height} · {modeRefresh(mode)} Hz</span>
            ))}
          </div>
        </section>
        <div className="game-recommendations">
          {recommended.map((tweak) => {
            const active = activeByTweak.get(tweak.id);
            return (
              <div key={tweak.id} className={`game-recommendation ${active ? "optimized" : ""}`}>
                <span className="tweak-icon">{(() => { const Icon = CATEGORY[categoryOf(tweak)]?.icon ?? Zap; return <Icon size={15} />; })()}</span>
                <span>
                  <strong>{tweak.name}</strong>
                  <small>{active ? `Otimizado em ${new Date(active.appliedAt * 1000).toLocaleString("pt-PT")}` : eligibility[tweak.id]?.eligible === false ? eligibility[tweak.id].reason : tweak.description}</small>
                </span>
                {eligibility[tweak.id]?.eligible === false ? (
                  <b className="blocked">Bloqueada</b>
                ) : active ? (
                  <div className="game-optimized-actions">
                    <b className="optimized-label"><Check size={12} />Otimizado</b>
                    <button className="game-tweak-action revert" onClick={() => onRollback(active)} disabled={reverting === tweak.id}>
                      {reverting === tweak.id ? <Spinner /> : <RotateCcw size={13} />}Reverter
                    </button>
                  </div>
                ) : (
                  <button className="game-tweak-action" onClick={() => onOptimize(tweak)}><Play size={13} />Otimizar</button>
                )}
              </div>
            );
          })}
        </div>
        <div className="modal-actions">
          <button className="secondary" onClick={onClose}>Entendido</button>
          <button className="primary" onClick={onLaunch} disabled={!game.launchUri}><Play size={14} />Abrir jogo</button>
        </div>
      </motion.section>
    </motion.div>
  );
}

function PerformanceView({ profile, notify }: { profile: SystemProfile | null; notify: (toast: { tone: "good" | "bad"; message: string }) => void }) {
  const [snapshot, setSnapshot] = useState<OrionPerformance | null>(null);
  const [history, setHistory] = useState<OrionPerformance[]>([]);
  const [displays, setDisplays] = useState<OrionDisplay[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadPerformance(silent = false, force = false) {
    if (!silent) setLoading(true);
    try {
      const next = await window.orion.performance({ force });
      setSnapshot(next);
      setHistory((current) => [...current.slice(-23), next]);
    } catch (error) {
      notify({ tone: "bad", message: cleanError(error) });
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void loadPerformance();
    window.orion.displays().then((result) => {
      const raw = (result.items as unknown as { value?: OrionDisplay[] })?.value ?? result.items;
      setDisplays(Array.isArray(raw) ? raw : raw ? [raw] : []);
    }).catch(() => setDisplays([]));
    const timer = setInterval(() => void loadPerformance(true), 5000);
    return () => clearInterval(timer);
  }, []);

  const gpuNames = snapshot?.gpu.adapters.map((adapter) => adapter.name).filter(Boolean).join(" + ") || profile?.gpuNames?.join(" + ") || "A detetar";
  const networkDown = snapshot?.network.receivedBytesPerSec ? `${formatBytes(snapshot.network.receivedBytesPerSec)}/s` : "N/D";
  const networkUp = snapshot?.network.sentBytesPerSec ? `${formatBytes(snapshot.network.sentBytesPerSec)}/s` : "N/D";

  return (
    <PageMotion>
      <header className="page-header">
        <div><span className="eyebrow">TELEMETRIA</span><h1>Desempenho</h1><p>Leitura visual do PC em tempo real, sem alterar configuracoes.</p></div>
        <div className="header-actions">
          <div className="mode-badge"><Activity size={14} />{snapshot ? new Date(snapshot.timestamp * 1000).toLocaleTimeString("pt-PT") : "A ler"}</div>
          <button className="icon-button" onClick={() => void loadPerformance(false, true)} disabled={loading} title="Atualizar desempenho"><RefreshCcw size={16} className={loading ? "spin" : ""} /></button>
        </div>
      </header>

      {snapshot === null ? (
        <div className="page-loading"><Spinner />A ler desempenho do sistema</div>
      ) : (
        <>
          <section className="performance-grid">
            <PerformanceCard icon={<Cpu />} label="CPU" value={formatMetric(snapshot.cpu.percent)} detail={`${snapshot.cpu.cores}C/${snapshot.cpu.threads}T · ${snapshot.cpu.currentMhz || snapshot.cpu.baseClockMhz} MHz`} samples={history.map((item) => item.cpu.percent ?? 0)} />
            <PerformanceCard icon={<MemoryStick />} label="Memoria" value={formatMetric(snapshot.memory?.percent)} detail={`${formatBytes(snapshot.memory?.usedBytes)} usados de ${formatBytes(snapshot.memory?.totalBytes)}`} samples={history.map((item) => item.memory?.percent ?? 0)} />
            <PerformanceCard icon={<MonitorCog />} label="GPU" value={formatMetric(snapshot.gpu.percent)} detail={gpuNames} samples={history.map((item) => item.gpu.percent ?? 0)} />
            <PerformanceCard icon={<HardDrive />} label="Disco" value={formatMetric(snapshot.disk.activityPercent)} detail={`${snapshot.disk.volumes.length} volumes detetados`} samples={history.map((item) => item.disk.activityPercent ?? 0)} />
          </section>

          <section className="performance-details">
            <div className="perf-panel">
              <div className="settings-panel-heading"><span className="settings-panel-icon"><Network size={17} /></span><div><h2>Rede</h2><p>Trabalho atual das interfaces fisicas</p></div></div>
              <div className="perf-lines"><InfoLine label="Download" value={networkDown} /><InfoLine label="Upload" value={networkUp} /></div>
            </div>
            <div className="perf-panel">
              <div className="settings-panel-heading"><span className="settings-panel-icon"><HardDrive size={17} /></span><div><h2>Armazenamento</h2><p>Volumes com espaco e utilizacao</p></div></div>
              <div className="drive-list">{snapshot.disk.volumes.map((drive) => <div key={drive.drive}><span><strong>{drive.drive}</strong><small>{drive.label || "Sem nome"} · {formatBytes(drive.freeBytes)} livres</small></span><b>{formatMetric(drive.percent)}</b></div>)}</div>
            </div>
            <div className="perf-panel displays-panel">
              <div className="settings-panel-heading"><span className="settings-panel-icon"><MonitorCog size={17} /></span><div><h2>Ecras</h2><p>Detecao segura, sem aplicar modos automaticamente</p></div></div>
              <div className="drive-list">{displays.length ? displays.map((display) => <div key={displayId(display)}><span><strong>{displayName(display)}</strong><small>{display.current.width}x{display.current.height} @ {displayRefresh(display)} Hz · {display.modes.length} modos</small></span><b>{display.primary ? "Principal" : "Extra"}</b></div>) : <div><span><strong>Sem dados</strong><small>O Windows nao devolveu monitores nesta leitura.</small></span><b>N/D</b></div>}</div>
            </div>
          </section>
        </>
      )}
    </PageMotion>
  );
}

function PerformanceCard({ icon, label, value, detail, samples }: { icon: ReactNode; label: string; value: string; detail: string; samples: number[] }) {
  return (
    <motion.article className="performance-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="performance-card-top"><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></div>
      <Sparkline samples={samples} />
      <p>{detail}</p>
    </motion.article>
  );
}

function Sparkline({ samples }: { samples: number[] }) {
  const points = samples.length ? samples : [0];
  const pathData = points.map((value, index) => {
    const x = points.length === 1 ? 100 : (index / (points.length - 1)) * 100;
    const y = 42 - Math.max(0, Math.min(100, value)) * 0.38;
    return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
  return <svg className="sparkline" viewBox="0 0 100 44" preserveAspectRatio="none"><path d={pathData} /></svg>;
}

type InternalTool = {
  kind: "account" | "dashboard" | "users" | "reviews" | "licenses" | "plans" | "catalog" | "orders" | "analytics" | "logs" | "security" | "system" | "website" | "discord" | "lab";
  label: string;
  description: string;
  path: string;
  icon: ReactNode;
  minimumRole: "staff" | "developer" | "owner";
};

const INTERNAL_TOOLS: InternalTool[] = [
  { kind: "dashboard", label: "Dashboard", description: "Métricas e estado da operação Orion", path: "/panel/admin", icon: <Gauge />, minimumRole: "staff" },
  { kind: "users", label: "Contas", description: "Consultar utilizadores e prestar suporte", path: "/panel/admin/users", icon: <Users />, minimumRole: "staff" },
  { kind: "licenses", label: "Licenças", description: "Criar, renovar e revogar acessos", path: "/panel/admin/users", icon: <ShieldCheck />, minimumRole: "staff" },
  { kind: "plans", label: "Planos", description: "Criar e editar planos comerciais", path: "/panel/admin/plans", icon: <Crown />, minimumRole: "owner" },
  { kind: "catalog", label: "Catálogo", description: "Gerir otimizações autorizadas", path: "/panel/admin/catalog", icon: <PackageCheck />, minimumRole: "developer" },
  { kind: "orders", label: "Vendas", description: "Compras, receita e exportações", path: "/panel/admin/orders", icon: <ShoppingBag />, minimumRole: "owner" },
  { kind: "analytics", label: "Analytics", description: "Crescimento, planos e downloads", path: "/panel/admin", icon: <Activity />, minimumRole: "developer" },
  { kind: "logs", label: "Logs", description: "Eventos administrativos e API", path: "/panel/admin", icon: <Search />, minimumRole: "developer" },
  { kind: "security", label: "Segurança", description: "Sessões, tokens e limites", path: "/panel/admin", icon: <LockKeyhole />, minimumRole: "developer" },
  { kind: "system", label: "Sistema", description: "Serviços, cache e backups", path: "/panel/admin", icon: <HardDrive />, minimumRole: "owner" },
  { kind: "website", label: "Website", description: "Banner, homepage e downloads", path: "/panel/admin", icon: <Wifi />, minimumRole: "owner" },
  { kind: "discord", label: "Discord", description: "Membros, cargos e anúncios", path: "/panel/admin/support", icon: <Network />, minimumRole: "staff" },
  { kind: "lab", label: "Laboratório", description: "Builds, flags e ferramentas internas", path: "/panel/admin/versions", icon: <Sparkles />, minimumRole: "owner" },
];

const INTERNAL_ROLE_RANK = { staff: 1, developer: 2, owner: 3 } as const;

const INTERNAL_CAPABILITIES = [
  { label: "Suporte a membros", detail: "Consultar contas e ajudar na gestão de acesso", minimumRole: "staff" },
  { label: "Moderação", detail: "Rever e moderar avaliações da comunidade", minimumRole: "staff" },
  { label: "Gestão do catálogo", detail: "Manter otimizações e compatibilidade técnica", minimumRole: "developer" },
  { label: "Controlo de qualidade", detail: "Validar o catálogo completo em modo real ou simulação", minimumRole: "developer" },
  { label: "Gestão comercial", detail: "Configurar planos, preços e vendas", minimumRole: "owner" },
  { label: "Controlo integral", detail: "Acesso a todas as ferramentas internas Orion", minimumRole: "owner" },
] satisfies Array<{ label: string; detail: string; minimumRole: keyof typeof INTERNAL_ROLE_RANK }>;

function InternalView({ state, profile, settings, notify }: { state: CatalogState; profile: SystemProfile | null; settings: LoginSettings; notify: (toast: { tone: "good" | "bad"; message: string }) => void }) {
  const { account } = state;
  const role = account.role as keyof typeof INTERNAL_ROLE_RANK;
  const tools = INTERNAL_TOOLS.filter((tool) => INTERNAL_ROLE_RANK[role] >= INTERNAL_ROLE_RANK[tool.minimumRole]);
  const capabilities = INTERNAL_CAPABILITIES.filter((capability) => INTERNAL_ROLE_RANK[role] >= INTERNAL_ROLE_RANK[capability.minimumRole]);
  const compatibleTweaks = state.tweaks.filter((tweak) => state.eligibility[tweak.id]?.eligible).length;
  const [overview, setOverview] = useState<InternalOverview | null>(null);
  const [operationsLoading, setOperationsLoading] = useState(true);
  const [operationsError, setOperationsError] = useState("");
  const [peopleSearch, setPeopleSearch] = useState("");
  const [activeAdminPage, setActiveAdminPage] = useState<InternalTool["kind"]>("dashboard");
  const [selectedTool, setSelectedTool] = useState<InternalTool | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<InternalOverview["people"][number] | null>(null);

  async function loadOperations(silent = false) {
    if (!silent) setOperationsLoading(true);
    try {
      setOverview(await window.orion.internalOverview());
      setOperationsError("");
    } catch (error) {
      setOperationsError(cleanError(error));
    } finally {
      if (!silent) setOperationsLoading(false);
    }
  }

  useEffect(() => {
    void loadOperations();
    const timer = setInterval(() => void loadOperations(true), 5_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selectedPerson || !overview) return;
    const fresh = overview.people.find((person) => person.id === selectedPerson.id);
    if (fresh && fresh !== selectedPerson) setSelectedPerson(fresh);
  }, [overview, selectedPerson]);

  const visiblePeople = useMemo(() => {
    const query = peopleSearch.trim().toLocaleLowerCase("pt");
    if (!query) return overview?.people ?? [];
    return (overview?.people ?? []).filter((person) =>
      `${person.displayName} ${person.username} ${person.role} ${person.tier ?? ""}`
        .toLocaleLowerCase("pt")
        .includes(query),
    );
  }, [overview, peopleSearch]);

  async function open(path: string) {
    try {
      await window.orion.openPortal(path);
    } catch (error) {
      notify({ tone: "bad", message: cleanError(error) });
    }
  }

  const activeTool = tools.find((tool) => tool.kind === activeAdminPage) ?? tools[0];

  return (
    <PageMotion>
      <header className="page-header">
        <div><span className="eyebrow">ACESSO INTERNO</span><h1>Área da equipa</h1><p>Ferramentas disponíveis para o cargo {ROLE_LABEL[account.role]}</p></div>
        <div className="role-access-badge"><Crown size={14} />{ROLE_LABEL[account.role]}</div>
      </header>

      <section className="internal-overview">
        <div><ShieldCheck size={18} /><span>Discord</span><strong>{account.discord_verified ? "Verificado" : "Por verificar"}</strong></div>
        <div><Zap size={18} /><span>Catálogo</span><strong>{compatibleTweaks}/{state.tweaks.length} compatíveis</strong></div>
        <div><Clock3 size={18} /><span>Licença</span><strong>{formatExpiry(account.expires_at)}</strong></div>
        <div><ShieldCheck size={18} /><span>Windows</span><strong>{profile?.isAdmin ? "Elevado" : "Sessão normal"}</strong></div>
      </section>

      <div className="admin-page-shell">
        <nav className="admin-page-nav" aria-label="Páginas administrativas">
          {tools.map((tool) => (
            <button key={tool.kind} className={activeTool.kind === tool.kind ? "active" : ""} onClick={() => setActiveAdminPage(tool.kind)}>
              <span className="internal-tool-icon">{tool.icon}</span>
              <span><strong>{tool.label}</strong><small>{tool.description}</small></span>
            </button>
          ))}
        </nav>
        <AdminWorkspace
          tool={activeTool}
          account={account}
          overview={overview}
          state={state}
          profile={profile}
          settings={settings}
          peopleSearch={peopleSearch}
          setPeopleSearch={setPeopleSearch}
          visiblePeople={visiblePeople}
          operationsLoading={operationsLoading}
          operationsError={operationsError}
          onRefresh={() => void loadOperations()}
          onOpenPortal={(path) => void open(path)}
          onSelectPerson={setSelectedPerson}
        />
      </div>

      <div className="legacy-admin-hidden">
      <section className="operations-console">
        <div className="section-heading operations-heading">
          <div><span className="eyebrow">OPERAÇÃO EM TEMPO REAL</span><h2>Estado do site e do Optimizer</h2></div>
          <button className="icon-button" onClick={() => void loadOperations()} disabled={operationsLoading} title="Atualizar operação">
            <RefreshCcw size={15} className={operationsLoading ? "spin" : ""} />
          </button>
        </div>

        {operationsError && <div className="operations-error"><CircleAlert size={15} />{operationsError}</div>}
        {operationsLoading && !overview ? (
          <div className="page-loading"><Spinner />A carregar operação</div>
        ) : overview && (
          <>
            <div className="operations-metrics">
              <OperationMetric label="Online no site" value={String(overview.metrics.onlineSite)} detail="últimos 5 minutos" tone="good" />
              <OperationMetric label="Online no Optimizer" value={String(overview.metrics.onlineOptimizer)} detail="últimos 5 minutos" tone="good" />
              <OperationMetric label="Ações do Optimizer" value={String(overview.metrics.optimizerActions24h)} detail="últimas 24 horas" />
              <OperationMetric label="Pedidos de catálogo" value={String(overview.metrics.catalogRequests24h)} detail="últimas 24 horas" />
              <OperationMetric label="Logins falhados" value={String(overview.metrics.failedLogins24h)} detail="últimas 24 horas" tone={overview.metrics.failedLogins24h > 0 ? "warn" : "default"} />
              {overview.metrics.revenue30Cents !== null && <OperationMetric label="Receita" value={money(overview.metrics.revenue30Cents)} detail="últimos 30 dias" />}
            </div>

            <div className="operations-grid">
              <section className="operations-panel">
                <div className="operations-panel-header">
                  <div><strong>Utilizadores e presença</strong><span>{overview.metrics.activeLicenses}/{overview.metrics.users} licenças ativas</span></div>
                  <label className="operations-search"><Search size={13} /><input value={peopleSearch} onChange={(event) => setPeopleSearch(event.target.value)} placeholder="Pesquisar" /></label>
                </div>
                <div className="presence-list">
                  {visiblePeople.length === 0 ? <span className="operations-empty">Sem utilizadores correspondentes.</span> : visiblePeople.map((person) => {
                    const content = <><span className="presence-avatar">{person.avatarUrl ? <img src={person.avatarUrl} alt="" /> : <UserRound size={15} />}</span><span className="presence-identity"><strong>{person.displayName}</strong><small>{ROLE_LABEL[person.role] ?? person.role} · {person.tier ? tierLabel(person.tier) : "sem plano"}</small><em>Optimizer v{person.clientVersion ?? "sem versão"}</em></span><span className="presence-signals"><span className={person.siteOnline ? "online" : ""}><Wifi size={11} />Site</span><span className={person.optimizerOnline ? "online" : ""}><Zap size={11} />App</span><small>{relativeTime(Math.max(person.siteSeenAt ?? 0, person.optimizerSeenAt ?? 0, person.lastActivityAt ?? 0) || null)}</small></span></>;
                    return <button key={person.id} className="presence-row" onClick={() => setSelectedPerson(person)} title="Ver detalhes na aplicação">{content}<ChevronRight size={13} /></button>;
                  })}
                </div>
              </section>

              <section className="operations-panel">
                <div className="operations-panel-header"><div><strong>Atividade recente</strong><span>Eventos do site e aplicação</span></div><Activity size={15} /></div>
                <div className="activity-feed">
                  {overview.activity.length === 0 ? <span className="operations-empty">Ainda não existe atividade.</span> : overview.activity.slice(0, 12).map((entry) => (
                    <div className="activity-entry" key={entry.id}>
                      <span className="activity-marker" />
                      <span><strong>{ACTIVITY_LABELS[entry.action] ?? entry.action.replaceAll("_", " ")}</strong><small>{entry.username}{entry.detail ? ` · ${entry.detail}` : ""}</small></span>
                      <time>{relativeTime(entry.createdAt)}</time>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="operations-details">
              <div><span className="eyebrow">UTILIZAÇÃO · 24H</span>{overview.usage.length ? overview.usage.map((item) => <span className="usage-item" key={item.action}><b>{ACTIVITY_LABELS[item.action] ?? item.action.replaceAll("_", " ")}</b><strong>{item.count}</strong></span>) : <small>Sem utilização registada.</small>}</div>
              <div><span className="eyebrow">VERSÕES ATIVAS</span>{overview.versions.length ? overview.versions.map((item) => <span className="usage-item" key={item.version}><b>{item.version}</b><strong>{item.count}</strong></span>) : <small>Ainda sem clientes ligados.</small>}</div>
            </div>
          </>
        )}
      </section>

      <div className="section-heading"><div><span className="eyebrow">FERRAMENTAS</span><h2>Atalhos da equipa</h2></div><span>{tools.length} disponíveis</span></div>
      <div className="internal-tools">
        {tools.map((tool) => (
          <button key={tool.path} className="internal-tool" onClick={() => setSelectedTool(tool)}>
            <span className="internal-tool-icon">{tool.icon}</span>
            <span><strong>{tool.label}</strong><small>{tool.description}</small></span>
            <ChevronRight size={15} />
          </button>
        ))}
      </div>

      <section className="role-capabilities">
        <div className="section-heading"><div><span className="eyebrow">PERMISSÕES</span><h2>Capacidades de {ROLE_LABEL[account.role]}</h2></div><span>{settings.server.replace(/^https?:\/\//, "")}</span></div>
        <div className="capability-list">
          {capabilities.map((capability) => (
            <div key={capability.label} className="capability-row">
              <span><Check size={14} /></span>
              <div><strong>{capability.label}</strong><small>{capability.detail}</small></div>
            </div>
          ))}
        </div>
      </section>

      <section className="access-matrix">
        <div className="access-matrix-heading"><div><span className="eyebrow">PLANOS</span><h2>Níveis do Optimizer</h2></div><span>O teu cargo desbloqueia todos</span></div>
        <div className="access-tier-list">
          {TIER_ACCESS.map((item) => <div key={item.tier}><b>{item.tier}</b><strong>{item.count}/10</strong><span>{item.detail}</span></div>)}
        </div>
      </section>

      </div>

      <AnimatePresence>
        {selectedTool && (
          <InternalToolModal
            tool={selectedTool}
            account={account}
            overview={overview}
            state={state}
            profile={profile}
            settings={settings}
            onClose={() => setSelectedTool(null)}
            onOpenPortal={(path) => void open(path)}
            onSelectPerson={(person) => {
              setSelectedTool(null);
              setSelectedPerson(person);
            }}
          />
        )}
        {selectedPerson && (
          <PersonModal
            person={selectedPerson}
            canOpenPortal={role === "owner"}
            onClose={() => setSelectedPerson(null)}
            onOpenPortal={(path) => void open(path)}
          />
        )}
      </AnimatePresence>
    </PageMotion>
  );
}

function AdminWorkspace({
  tool,
  account,
  overview,
  state,
  profile,
  settings,
  peopleSearch,
  setPeopleSearch,
  visiblePeople,
  operationsLoading,
  operationsError,
  onRefresh,
  onOpenPortal,
  onSelectPerson,
}: {
  tool: InternalTool;
  account: OrionAccount;
  overview: InternalOverview | null;
  state: CatalogState;
  profile: SystemProfile | null;
  settings: LoginSettings;
  peopleSearch: string;
  setPeopleSearch: (value: string) => void;
  visiblePeople: InternalOverview["people"];
  operationsLoading: boolean;
  operationsError: string;
  onRefresh: () => void;
  onOpenPortal: (path: string) => void;
  onSelectPerson: (person: InternalOverview["people"][number]) => void;
}) {
  const people = overview?.people ?? [];
  const onlineTotal = overview ? Math.max(overview.metrics.onlineSite, overview.metrics.onlineOptimizer) : 0;
  const staffOnline = people.filter((person) => (person.siteOnline || person.optimizerOnline) && INTERNAL_ROLES.has(person.role)).length;
  const revenue = overview?.metrics.revenue30Cents ?? 0;
  const recentActivity = overview?.activity ?? [];
  const planRows = TIER_ACCESS.map((plan, index) => ({ label: plan.tier, value: Math.max(1, people.filter((person) => (person.tier ?? "").toLowerCase() === plan.tier.toLowerCase()).length || index + 1) }));

  if (tool.kind === "dashboard") {
    return (
      <AdminPage title="Dashboard Admin" subtitle="Visão inicial do Centro da Equipa" tool={tool} onOpenPortal={onOpenPortal}>
        {operationsError && <div className="operations-error"><CircleAlert size={15} />{operationsError}</div>}
        <div className="admin-metric-grid">
          <AdminMetric icon={<Users />} label="Utilizadores Online" value={String(onlineTotal)} detail="site ou optimizer" />
          <AdminMetric icon={<Users />} label="Utilizadores Totais" value={String(overview?.metrics.users ?? 0)} detail="contas registadas" />
          <AdminMetric icon={<ShieldCheck />} label="Licenças Ativas" value={String(overview?.metrics.activeLicenses ?? 0)} detail="acesso válido" />
          <AdminMetric icon={<Clock3 />} label="Novos Registos Hoje" value="API" detail="preparado para integrar" />
          <AdminMetric icon={<ShoppingBag />} label="Receita Total" value={money(revenue)} detail="placeholder até API total" />
          <AdminMetric icon={<ShoppingBag />} label="Receita Mensal" value={money(revenue)} detail="últimos 30 dias" />
          <AdminMetric icon={<Activity />} label="Tickets Pendentes" value="API" detail="suporte preparado" />
          <AdminMetric icon={<Wifi />} label="Estado da API" value={operationsError ? "Erro" : "Online"} detail="tempo real" tone={operationsError ? "warn" : "good"} />
          <AdminMetric icon={<Wifi />} label="Estado do Website" value="Online" detail={settings.server.replace(/^https?:\/\//, "")} tone="good" />
          <AdminMetric icon={<Network />} label="Estado do Discord Bot" value={account.discord_verified ? "Ligado" : "Pendente"} detail="verificação Discord" tone={account.discord_verified ? "good" : "warn"} />
          <AdminMetric icon={<HardDrive />} label="Estado da Base de Dados" value={overview ? "Ligada" : "A carregar"} detail="internal overview" tone={overview ? "good" : "default"} />
          <AdminMetric icon={<RefreshCcw />} label="Última Atualização" value={overview ? relativeTime(overview.generatedAt) : "..."} detail={operationsLoading ? "a atualizar" : "sincronizado"} />
        </div>
        <AdminCharts
          charts={[
            { title: "Utilizadores por dia", points: samplePoints(people.length || 8), value: `${overview?.metrics.users ?? 0} contas` },
            { title: "Vendas", points: samplePoints((overview?.metrics.revenue30Cents ?? 0) / 1000 || 5), value: money(revenue) },
            { title: "Crescimento", points: samplePoints((overview?.metrics.onlineSite ?? 1) + 4), value: `${onlineTotal} online` },
            { title: "Distribuição dos Planos", points: planRows.map((row) => row.value), value: `${planRows.length} planos` },
          ]}
        />
        <AdminRealtime people={visiblePeople} search={peopleSearch} setSearch={setPeopleSearch} activity={recentActivity} onSelectPerson={onSelectPerson} onRefresh={onRefresh} loading={operationsLoading} />
      </AdminPage>
    );
  }

  if (tool.kind === "users") {
    return (
      <AdminPage title="Gestão de Contas" subtitle="Utilizadores, perfis, filtros e ações de acesso" tool={tool} onOpenPortal={onOpenPortal}>
        <AdminToolbar search={peopleSearch} setSearch={setPeopleSearch} filters={["Todos", "Online", "Clientes", "Staff", "Suspensos"]} sort={["Último login", "Registo", "Plano", "Cargo"]} />
        <AdminTable
          columns={["Utilizador", "Discord", "Hardware ID", "Último login", "Estado", "Plano", "Cargo", "Ações"]}
          rows={visiblePeople.map((person) => [
            person.displayName,
            person.username,
            "API",
            relativeTime(Math.max(person.siteSeenAt ?? 0, person.optimizerSeenAt ?? 0, person.lastActivityAt ?? 0) || null),
            person.status,
            person.tier ? tierLabel(person.tier) : "Sem plano",
            ROLE_LABEL[person.role] ?? person.role,
            "Alterar plano · Cargo · Suspender · Banir",
          ])}
          empty="Sem utilizadores para mostrar."
        />
        <AdminActionGrid actions={["Alterar plano", "Alterar cargo", "Suspender", "Banir", "Revogar licença", "Renovar licença", "Dar acesso Beta", "Resetar acesso"]} />
      </AdminPage>
    );
  }

  if (tool.kind === "catalog") {
    return (
      <AdminPage title="Catálogo" subtitle="Otimizações, compatibilidade, categorias e estado" tool={tool} onOpenPortal={onOpenPortal}>
        <AdminActionGrid actions={["Criar otimização", "Editar otimização", "Desativar", "Atualizar compatibilidade"]} />
        <AdminTable columns={["Otimização", "Categoria", "Compatibilidade", "Estado"]} rows={state.tweaks.map((tweak) => [tweak.name, CATEGORY[categoryOf(tweak)]?.label ?? categoryOf(tweak), state.eligibility[tweak.id]?.eligible ? "Compatível" : "Bloqueada", "Ativa"])} />
      </AdminPage>
    );
  }

  if (tool.kind === "plans") {
    return <AdminConfiguredPage title="Gestão de Planos" subtitle="Planos comerciais, preços, banners e benefícios" tool={tool} onOpenPortal={onOpenPortal} actions={["Criar plano", "Editar plano", "Alterar preço", "Alterar banner", "Alterar cor", "Alterar benefícios", "Ativar", "Desativar"]} rows={TIER_ACCESS.map((plan) => [plan.tier, plan.detail, `${plan.count}/10`, "Ativo"])} columns={["Plano", "Benefícios", "Acesso", "Estado"]} />;
  }

  if (tool.kind === "licenses") {
    return <AdminConfiguredPage title="Gestão de Licenças" subtitle="Criação, renovação, revogação e histórico" tool={tool} onOpenPortal={onOpenPortal} actions={["Criar licença", "Renovar", "Revogar", "Ver histórico"]} rows={people.slice(0, 8).map((person) => [person.displayName, person.tier ? tierLabel(person.tier) : "Sem plano", person.status, relativeTime(person.lastActivityAt)])} columns={["Utilizador", "Licença", "Estado", "Data"]} />;
  }

  if (tool.kind === "orders") {
    return <AdminConfiguredPage title="Vendas" subtitle="Compras recentes, receita e métodos de pagamento" tool={tool} onOpenPortal={onOpenPortal} actions={["Exportar CSV", "Ver métodos", "Receita diária", "Receita mensal", "Receita anual"]} rows={[["Cartão", money(revenue), "Mensal", "Preparado"], ["Apple Pay", "API", "Método", "Preparado"], ["PayPal", "API", "Método", "Preparado"]]} columns={["Origem", "Valor", "Tipo", "Estado"]} />;
  }

  if (tool.kind === "analytics") {
    return <AdminPage title="Analytics" subtitle="Utilizadores, planos, receita, downloads e otimizações" tool={tool} onOpenPortal={onOpenPortal}><AdminCharts charts={["Utilizadores", "Crescimento", "Planos", "Receita", "Downloads", "Otimizações aplicadas"].map((title, index) => ({ title, points: samplePoints(index + 4), value: index === 3 ? money(revenue) : "API" }))} /></AdminPage>;
  }

  if (tool.kind === "logs") {
    return <AdminConfiguredPage title="Logs" subtitle="Eventos administrativos, sistema, API e utilizador" tool={tool} onOpenPortal={onOpenPortal} actions={["Data", "Tipo", "Utilizador", "Exportar"]} rows={recentActivity.slice(0, 10).map((entry) => [ACTIVITY_LABELS[entry.action] ?? entry.action, entry.username, entry.detail ?? "Sem detalhe", relativeTime(entry.createdAt)])} columns={["Tipo", "Utilizador", "Detalhe", "Data"]} />;
  }

  if (tool.kind === "security") {
    return <AdminConfiguredPage title="Segurança" subtitle="Sessões, tokens, tentativas, limites e deteção" tool={tool} onOpenPortal={onOpenPortal} actions={["Sessões", "Tokens", "Login Attempts", "Rate Limits", "Banimentos", "VPN Detection", "Proxy Detection"]} rows={[["Sessões", String(onlineTotal), "Ativo"], ["Login Attempts", String(overview?.metrics.failedLogins24h ?? 0), "24h"], ["Rate Limits", "API", "Preparado"]]} columns={["Área", "Valor", "Estado"]} />;
  }

  if (tool.kind === "system") {
    return <AdminConfiguredPage title="Sistema" subtitle="Operações críticas do website, API e base de dados" tool={tool} onOpenPortal={onOpenPortal} actions={["Reiniciar Website", "Reiniciar API", "Reiniciar Discord Bot", "Limpar Cache", "Backup Database", "Restaurar Backup", "Atualizar Website"]} rows={[["Website", "Online", "Operacional"], ["API", operationsError ? "Erro" : "Online", "Tempo real"], ["Base de Dados", overview ? "Ligada" : "A carregar", "Firestore"]]} columns={["Serviço", "Estado", "Detalhe"]} />;
  }

  if (tool.kind === "website") {
    return <AdminConfiguredPage title="Website" subtitle="Banner, homepage, notícias, downloads e estatísticas" tool={tool} onOpenPortal={onOpenPortal} actions={["Editar Banner", "Homepage", "Notícias", "Downloads", "Estado", "Estatísticas"]} rows={[["Homepage", "Publicada", "Ativa"], ["Downloads", "Windows", "Disponível"], ["Banner", "Orion 2.0", "Ativo"]]} columns={["Área", "Conteúdo", "Estado"]} />;
  }

  if (tool.kind === "discord") {
    return <AdminConfiguredPage title="Discord" subtitle="Membros, online, boosts, convites, tickets e cargos" tool={tool} onOpenPortal={onOpenPortal} actions={["Sincronizar cargos", "Enviar anúncio", "Ver tickets", "Convites"]} rows={[["Membros", String(overview?.metrics.users ?? 0), "API"], ["Online", String(staffOnline), "Staff"], ["Tickets", "API", "Preparado"]]} columns={["Métrica", "Valor", "Detalhe"]} />;
  }

  return <AdminConfiguredPage title="Laboratório" subtitle="Funcionalidades Beta, builds experimentais e feature flags" tool={tool} onOpenPortal={onOpenPortal} actions={["Funcionalidades Beta", "Builds experimentais", "Feature Flags", "Ferramentas internas"]} rows={[["Beta", "Preparado", "Owner"], ["Builds", "API", "Experimental"], ["Flags", "API", "Controlo interno"]]} columns={["Área", "Estado", "Acesso"]} />;
}

function AdminPage({ title, subtitle, tool, onOpenPortal, children }: { title: string; subtitle: string; tool: InternalTool; onOpenPortal: (path: string) => void; children: ReactNode }) {
  return <section className="admin-page"><div className="admin-page-heading"><div><span className="eyebrow">ADMIN</span><h2>{title}</h2><p>{subtitle}</p></div><button className="secondary compact" onClick={() => onOpenPortal(tool.path)}><ExternalLink size={13} />Abrir no site</button></div>{children}</section>;
}

function AdminConfiguredPage({ title, subtitle, tool, onOpenPortal, actions, columns, rows }: { title: string; subtitle: string; tool: InternalTool; onOpenPortal: (path: string) => void; actions: string[]; columns: string[]; rows: string[][] }) {
  return <AdminPage title={title} subtitle={subtitle} tool={tool} onOpenPortal={onOpenPortal}><AdminActionGrid actions={actions} /><AdminTable columns={columns} rows={rows} /></AdminPage>;
}

function AdminMetric({ icon, label, value, detail, tone = "default" }: { icon: ReactNode; label: string; value: string; detail: string; tone?: "default" | "good" | "warn" }) {
  return <div className={`admin-metric ${tone}`}><span>{icon}</span><small>{label}</small><strong>{value}</strong><em>{detail}</em></div>;
}

function AdminToolbar({ search, setSearch, filters, sort }: { search: string; setSearch: (value: string) => void; filters: string[]; sort: string[] }) {
  return <div className="admin-toolbar"><label className="operations-search"><Search size={13} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar" /></label><select>{filters.map((item) => <option key={item}>{item}</option>)}</select><select>{sort.map((item) => <option key={item}>{item}</option>)}</select></div>;
}

function AdminActionGrid({ actions }: { actions: string[] }) {
  return <div className="admin-action-grid">{actions.map((action) => <button key={action} className="settings-action">{action}</button>)}</div>;
}

function AdminTable({ columns, rows, empty = "Sem dados disponíveis." }: { columns: string[]; rows: string[][]; empty?: string }) {
  return <div className="admin-table"><div className="admin-table-head">{columns.map((column) => <span key={column}>{column}</span>)}</div>{rows.length ? rows.map((row, index) => <div className="admin-table-row" key={index}>{columns.map((column, columnIndex) => <span key={column}>{row[columnIndex] ?? ""}</span>)}</div>) : <div className="internal-modal-empty">{empty}</div>}</div>;
}

function AdminCharts({ charts }: { charts: Array<{ title: string; points: number[]; value: string }> }) {
  return <div className="admin-chart-grid">{charts.map((chart) => <div className="admin-chart" key={chart.title}><div><strong>{chart.title}</strong><span>{chart.value}</span></div><MiniBars points={chart.points} /></div>)}</div>;
}

function MiniBars({ points }: { points: number[] }) {
  const max = Math.max(1, ...points);
  return <div className="mini-bars">{points.map((point, index) => <i key={index} style={{ height: `${Math.max(14, (point / max) * 100)}%` }} />)}</div>;
}

function samplePoints(seed: number): number[] {
  return Array.from({ length: 10 }, (_, index) => Math.max(1, Math.round(((seed + index * 3) % 17) + index + 3)));
}

function AdminRealtime({ people, search, setSearch, activity, onSelectPerson, onRefresh, loading }: { people: InternalOverview["people"]; search: string; setSearch: (value: string) => void; activity: InternalOverview["activity"]; onSelectPerson: (person: InternalOverview["people"][number]) => void; onRefresh: () => void; loading: boolean }) {
  return <div className="operations-grid admin-realtime"><section className="operations-panel"><div className="operations-panel-header"><div><strong>Utilizadores e presença</strong><span>{people.length} resultados</span></div><label className="operations-search"><Search size={13} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar" /></label></div><div className="presence-list">{people.length ? people.map((person) => <button key={person.id} className="presence-row" onClick={() => onSelectPerson(person)}><span className="presence-avatar">{person.avatarUrl ? <img src={person.avatarUrl} alt="" /> : <UserRound size={15} />}</span><span className="presence-identity"><strong>{person.displayName}</strong><small>{ROLE_LABEL[person.role] ?? person.role} · {person.tier ? tierLabel(person.tier) : "sem plano"}</small><em>Optimizer v{person.clientVersion ?? "sem versão"}</em></span><span className="presence-signals"><span className={person.siteOnline ? "online" : ""}><Wifi size={11} />Site</span><span className={person.optimizerOnline ? "online" : ""}><Zap size={11} />App</span><small>{relativeTime(Math.max(person.siteSeenAt ?? 0, person.optimizerSeenAt ?? 0, person.lastActivityAt ?? 0) || null)}</small></span><ChevronRight size={13} /></button>) : <span className="operations-empty">Sem utilizadores correspondentes.</span>}</div></section><section className="operations-panel"><div className="operations-panel-header"><div><strong>Atividade recente</strong><span>Eventos do site e aplicação</span></div><button className="icon-button" onClick={onRefresh} disabled={loading}><RefreshCcw size={15} className={loading ? "spin" : ""} /></button></div><div className="activity-feed">{activity.length ? activity.slice(0, 12).map((entry) => <div className="activity-entry" key={entry.id}><span className="activity-marker" /><span><strong>{ACTIVITY_LABELS[entry.action] ?? entry.action.replaceAll("_", " ")}</strong><small>{entry.username}{entry.detail ? ` · ${entry.detail}` : ""}</small></span><time>{relativeTime(entry.createdAt)}</time></div>) : <span className="operations-empty">Ainda não existe atividade.</span>}</div></section></div>;
}

function InternalToolModal({ tool, account, overview, state, profile, settings, onClose, onOpenPortal, onSelectPerson }: {
  tool: InternalTool;
  account: OrionAccount;
  overview: InternalOverview | null;
  state: CatalogState;
  profile: SystemProfile | null;
  settings: LoginSettings;
  onClose: () => void;
  onOpenPortal: (path: string) => void;
  onSelectPerson: (person: InternalOverview["people"][number]) => void;
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const recentReviews = overview?.activity.filter((entry) => entry.action.startsWith("review_")) ?? [];
  const recentOrders = overview?.activity.filter((entry) => entry.action.includes("order") || entry.action.includes("refund")) ?? [];

  return (
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <motion.section className="modal internal-tool-modal" initial={{ opacity: 0, y: 18, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: .98 }}>
        <button className="modal-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        <div className="internal-modal-heading">
          <span className="internal-tool-icon">{tool.icon}</span>
          <div><span className="eyebrow">CENTRO INTERNO</span><h2>{tool.label}</h2><p>{tool.description}</p></div>
        </div>

        {tool.kind === "account" && (
          <div className="internal-modal-body">
            <div className="internal-modal-stats">
              <ModalStat label="Cargo" value={ROLE_LABEL[account.role]} />
              <ModalStat label="Plano" value={tierLabel(account.tier ?? "orion")} />
              <ModalStat label="Licença" value={formatExpiry(account.expires_at)} />
              <ModalStat label="Suporte" value={account.support_lifetime ? "Life-time" : formatExpiry(account.support_expires_at)} />
            </div>
            <div className="internal-detail-list">
              <InfoLine label="Discord" value={account.discord_verified ? "Conta verificada" : "Por verificar"} />
              <InfoLine label="Utilizador" value={account.display_name || account.username} />
              <InfoLine label="Computador" value={profile ? `${profile.chassis} · ${profile.ramGB} GB RAM · ${profile.gpuVendor}` : "A detetar"} />
              <InfoLine label="Execução" value={profile?.executionMode === "Real" ? "Modo real" : "Simulação"} />
              <InfoLine label="Servidor" value={settings.server.replace(/^https?:\/\//, "")} />
            </div>
          </div>
        )}

        {tool.kind === "dashboard" && (
          <div className="internal-modal-body">
            <div className="internal-modal-stats">
              <ModalStat label="Online no site" value={String(overview?.metrics.onlineSite ?? 0)} />
              <ModalStat label="Online na app" value={String(overview?.metrics.onlineOptimizer ?? 0)} />
              <ModalStat label="Licenças ativas" value={String(overview?.metrics.activeLicenses ?? 0)} />
              <ModalStat label="Ações · 24h" value={String(overview?.metrics.optimizerActions24h ?? 0)} />
            </div>
            <ModalActivity entries={overview?.activity.slice(0, 8) ?? []} empty="Sem atividade recente." />
          </div>
        )}

        {tool.kind === "users" && (
          <div className="internal-modal-body">
            <div className="internal-modal-stats">
              <ModalStat label="Utilizadores" value={String(overview?.metrics.users ?? 0)} />
              <ModalStat label="Licenças ativas" value={String(overview?.metrics.activeLicenses ?? 0)} />
              <ModalStat label="Online no site" value={String(overview?.metrics.onlineSite ?? 0)} />
              <ModalStat label="Online na app" value={String(overview?.metrics.onlineOptimizer ?? 0)} />
            </div>
            <div className="internal-modal-list">
              {(overview?.people ?? []).map((person) => (
                <button key={person.id} className="internal-modal-person" onClick={() => onSelectPerson(person)}>
                  <span className="presence-avatar">{person.avatarUrl ? <img src={person.avatarUrl} alt="" /> : <UserRound size={15} />}</span>
                  <span><strong>{person.displayName}</strong><small>{ROLE_LABEL[person.role] ?? person.role} · {person.tier ? tierLabel(person.tier) : "sem plano"} · v{person.clientVersion ?? "sem versão"}</small></span>
                  <span className={person.optimizerOnline || person.siteOnline ? "status-online" : ""}>{person.optimizerOnline || person.siteOnline ? "Online" : relativeTime(person.lastActivityAt)}</span>
                  <ChevronRight size={14} />
                </button>
              ))}
              {!overview?.people.length && <div className="internal-modal-empty">Sem utilizadores disponíveis.</div>}
            </div>
          </div>
        )}

        {tool.kind === "reviews" && (
          <div className="internal-modal-body">
            <div className="internal-modal-stats">
              <ModalStat label="Moderações recentes" value={String(recentReviews.length)} />
              <ModalStat label="Staff online" value={String(overview?.people.filter((person) => person.siteOnline && INTERNAL_ROLES.has(person.role)).length ?? 0)} />
            </div>
            <ModalActivity entries={recentReviews} empty="Sem avaliações moderadas na atividade recente." />
          </div>
        )}

        {tool.kind === "catalog" && (
          <div className="internal-modal-body">
            <div className="internal-modal-stats">
              <ModalStat label="Otimizações" value={String(state.tweaks.length)} />
              <ModalStat label="Compatíveis" value={String(state.tweaks.filter((tweak) => state.eligibility[tweak.id]?.eligible).length)} />
              <ModalStat label="Pedidos · 24h" value={String(overview?.metrics.catalogRequests24h ?? 0)} />
            </div>
            <div className="internal-modal-list">
              {state.tweaks.map((tweak) => <div className="catalog-modal-row" key={tweak.id}><span className="internal-tool-icon">{CATEGORY[categoryOf(tweak)] ? (() => { const Icon = CATEGORY[categoryOf(tweak)].icon; return <Icon />; })() : <Zap />}</span><span><strong>{tweak.name}</strong><small>{tweak.id} · camada {tweak.layer}</small></span><b className={state.eligibility[tweak.id]?.eligible ? "status-online" : ""}>{state.eligibility[tweak.id]?.eligible ? "Compatível" : "Bloqueada"}</b></div>)}
            </div>
          </div>
        )}

        {tool.kind === "plans" && (
          <div className="internal-modal-body">
            <div className="plan-modal-list">{TIER_ACCESS.map((plan) => <div key={plan.tier}><span><strong>{plan.tier}</strong><small>{plan.detail}</small></span><b>{plan.count}/10</b></div>)}</div>
          </div>
        )}

        {tool.kind === "orders" && (
          <div className="internal-modal-body">
            <div className="internal-modal-stats">
              <ModalStat label="Receita · 30 dias" value={overview?.metrics.revenue30Cents === null || overview?.metrics.revenue30Cents === undefined ? "Indisponível" : money(overview.metrics.revenue30Cents)} />
              <ModalStat label="Eventos recentes" value={String(recentOrders.length)} />
            </div>
            <ModalActivity entries={recentOrders} empty="Sem movimentos comerciais na atividade recente." />
          </div>
        )}

        <div className="modal-actions internal-modal-actions">
          <button className="secondary" onClick={onClose}>Fechar</button>
          <button className="primary" onClick={() => onOpenPortal(tool.path)}><ExternalLink size={14} />Abrir gestão avançada</button>
        </div>
      </motion.section>
    </motion.div>
  );
}

function PersonModal({ person, canOpenPortal, onClose, onOpenPortal }: {
  person: InternalOverview["people"][number];
  canOpenPortal: boolean;
  onClose: () => void;
  onOpenPortal: (path: string) => void;
}) {
  const [tab, setTab] = useState<"available" | "active">("available");
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <motion.section className="modal person-modal" initial={{ opacity: 0, y: 18, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: .98 }}>
        <button className="modal-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        <div className="person-modal-heading">
          <span className="person-modal-avatar">{person.avatarUrl ? <img src={person.avatarUrl} alt="" /> : <UserRound size={24} />}</span>
          <div><span className="eyebrow">UTILIZADOR</span><h2>{person.displayName}</h2><p>@{person.username}</p></div>
          <span className={`person-live-state ${person.siteOnline || person.optimizerOnline ? "online" : ""}`}>{person.siteOnline || person.optimizerOnline ? "Online" : "Offline"}</span>
        </div>
        <div className="internal-modal-stats person-modal-stats">
          <ModalStat label="Cargo" value={ROLE_LABEL[person.role] ?? person.role} />
          <ModalStat label="Plano" value={person.tier ? tierLabel(person.tier) : "Sem plano"} />
          <ModalStat label="Estado" value={person.status === "active" ? "Ativa" : person.status} />
          <ModalStat label="Versão" value={person.clientVersion ?? "Sem versão"} />
        </div>
        <div className="internal-detail-list">
          <InfoLine label="Versão instalada" value={person.clientVersion ? `Orion Optimizer ${person.clientVersion}` : "Sem versão registada"} />
          <InfoLine label="Site" value={person.siteOnline ? "Online agora" : relativeTime(person.siteSeenAt)} />
          <InfoLine label="Optimizer" value={person.optimizerOnline ? "Online agora" : relativeTime(person.optimizerSeenAt)} />
          <InfoLine label="Última atividade" value={relativeTime(person.lastActivityAt)} />
        </div>
        <PersonOptimizationLists person={person} tab={tab} setTab={setTab} />
        <div className="modal-actions"><button className="secondary" onClick={onClose}>Fechar</button>{canOpenPortal && <button className="primary" onClick={() => onOpenPortal(`/panel/admin/users/${person.id}`)}><ExternalLink size={14} />Gestão completa</button>}</div>
      </motion.section>
    </motion.div>
  );
}

function PersonOptimizationLists({
  person,
  tab,
  setTab,
}: {
  person: InternalOverview["people"][number];
  tab: "available" | "active";
  setTab: (tab: "available" | "active") => void;
}) {
  return (
    <>
      <div className="person-optimization-tabs">
        <button className={tab === "available" ? "active" : ""} onClick={() => setTab("available")}>Otimizações disponíveis <b>{person.availableOptimizations.length}</b></button>
        <button className={tab === "active" ? "active" : ""} onClick={() => setTab("active")}>Otimizações Ativas <b>{person.activeOptimizations.length}</b></button>
      </div>
      <div className="person-optimization-list">
        {tab === "available" ? (
          person.availableOptimizations.length ? person.availableOptimizations.map((tweak) => {
            const meta = CATEGORY[tweak.category] ?? { label: "Sistema", icon: Zap };
            const Icon = meta.icon;
            return <div className="person-optimization-row" key={tweak.id}><span className="internal-tool-icon"><Icon /></span><span><strong>{tweak.name}</strong><small>{tweak.id} · {meta.label} · {tweak.tier}</small></span><b>{tweak.requiresReboot ? "Reinício" : "Pronta"}</b></div>;
          }) : <div className="internal-modal-empty">Este utilizador nao tem otimizacoes disponiveis.</div>
        ) : (
          person.activeOptimizations.length ? person.activeOptimizations.map((item) => {
            const meta = CATEGORY[item.category] ?? { label: "Sistema", icon: Zap };
            const Icon = meta.icon;
            return <div className="person-optimization-row active" key={item.id}><span className="internal-tool-icon"><Icon /></span><span><strong>{item.name}</strong><small>{new Date(item.appliedAt * 1000).toLocaleString("pt-PT")} · {item.machine ?? "PC sem detalhe"}</small></span><b>Ativa</b></div>;
          }) : <div className="internal-modal-empty">Este utilizador ainda nao tem otimizacoes ativas.</div>
        )}
      </div>
    </>
  );
}

function ModalStat({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function ModalActivity({ entries, empty }: { entries: InternalOverview["activity"]; empty: string }) {
  return <div className="internal-modal-activity">{entries.length ? entries.map((entry) => <div key={entry.id}><span className="activity-marker" /><span><strong>{ACTIVITY_LABELS[entry.action] ?? entry.action.replaceAll("_", " ")}</strong><small>{entry.username}{entry.detail ? ` · ${entry.detail}` : ""}</small></span><time>{relativeTime(entry.createdAt)}</time></div>) : <div className="internal-modal-empty">{empty}</div>}</div>;
}

function OperationMetric({ label, value, detail, tone = "default" }: { label: string; value: string; detail: string; tone?: "default" | "good" | "warn" }) {
  return <div className={`operation-metric ${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function SettingsView({ account, profile, settings, appVersion, theme, setTheme, animations, setAnimations, density, setDensity, onElevate }: {
  account: OrionAccount;
  profile: SystemProfile | null;
  settings: LoginSettings;
  appVersion: string;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  animations: boolean;
  setAnimations: (enabled: boolean) => void;
  density: Density;
  setDensity: (density: Density) => void;
  onElevate: () => Promise<void>;
}) {
  const [elevating, setElevating] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [desktopSettings, setDesktopSettings] = useState<DesktopSettings>(() => {
    try {
      return { ...DEFAULT_DESKTOP_SETTINGS, ...JSON.parse(localStorage.getItem(DESKTOP_SETTINGS_KEY) || "{}") };
    } catch {
      return DEFAULT_DESKTOP_SETTINGS;
    }
  });
  const rows = [
    { icon: <Laptop />, label: "Tipo de dispositivo", value: profile?.chassis === "laptop" ? "Portátil" : "Desktop" },
    { icon: <MonitorCog />, label: "Adaptadores gráficos", value: profile?.gpuNames?.join(" · ") || "Não detetado" },
    { icon: <MemoryStick />, label: "Memória instalada", value: `${profile?.ramGB ?? 0} GB RAM` },
    { icon: <ShieldCheck />, label: "Sessão elevada", value: profile?.isAdmin ? "Sim" : "Não", canElevate: !profile?.isAdmin },
    { icon: <Activity />, label: "Motor de execução", value: profile?.executionMode === "Mock" ? "Simulação" : "Real" },
    { icon: <Wifi />, label: "Servidor", value: settings.server },
  ];

  useEffect(() => {
    localStorage.setItem(DESKTOP_SETTINGS_KEY, JSON.stringify(desktopSettings));
    setSavedAt(Date.now());
  }, [desktopSettings]);

  useEffect(() => {
    setSavedAt(Date.now());
  }, [animations, density, theme]);

  function updateDesktopSetting<K extends keyof DesktopSettings>(key: K, value: DesktopSettings[K]) {
    setDesktopSettings((current) => ({ ...current, [key]: value }));
  }

  function restoreDefaults() {
    setDesktopSettings(DEFAULT_DESKTOP_SETTINGS);
    setTheme("dark");
    setDensity("comfortable");
    setAnimations(true);
  }

  const region = Intl.DateTimeFormat().resolvedOptions().locale || "pt-PT";
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Sistema";

  return (
    <PageMotion>
      <header className="page-header"><div><span className="eyebrow">PREFERÊNCIAS</span><h1>Definições</h1><p>Conta, aparência, proteção e comportamento do Optimizer</p></div><span className="settings-version">Orion 2.0 v{appVersion || "..."}</span></header>

      <section className="settings-profile">
        <div className="settings-avatar">{account.discord_avatar_url ? <img src={account.discord_avatar_url} alt="" referrerPolicy="no-referrer" /> : <UserRound size={28} />}</div>
        <div className="settings-identity"><span className="eyebrow">CONTA ORION</span><h2>{account.display_name || account.username}</h2><p>@{account.username}</p></div>
        <div className="settings-badges"><span><ShieldCheck size={13} />{account.discord_verified ? "Discord verificado" : "Discord por verificar"}</span><span><Crown size={13} />{ROLE_LABEL[account.role] ?? account.role}</span><span>{account.tier ? tierLabel(account.tier) : "Acesso interno"}</span></div>
      </section>

      <div className="settings-grid">
        <SettingsPanel icon={<Settings2 size={17} />} title="Geral" subtitle="Preferências base da aplicação">
          <SelectSetting title="Idioma" description="Idioma usado nos textos da aplicação." tooltip="Preparado para localização futura." value={desktopSettings.language} onChange={(value) => updateDesktopSetting("language", value)} options={[["pt-PT", "Português"], ["en-US", "English"]]} />
          <FactSetting title="Região" description="Detetada automaticamente pelo sistema operativo." value={`${region} · ${timezone}`} />
          <SegmentSetting title="Formato de hora" description="Formato usado em histórico, logs e notificações." value={desktopSettings.timeFormat} onChange={(value) => updateDesktopSetting("timeFormat", value as DesktopSettings["timeFormat"])} options={[["12h", "12h"], ["24h", "24h"]]} />
          <SwitchSetting title="Mostrar dicas da aplicação" description="Mostra sugestões pequenas nos fluxos principais." checked={desktopSettings.showTips} onChange={(value) => updateDesktopSetting("showTips", value)} />
          <ActionSetting title="Restaurar definições" description="Volta todas as opções locais aos valores recomendados." action="Restaurar" onClick={restoreDefaults} />
        </SettingsPanel>

        <SettingsPanel icon={<Sparkles size={17} />} title="Aparência" subtitle="Visual premium, brilho e comportamento da interface">
          <SegmentSetting title="Tema" description="Escolhe a aparência principal da aplicação." value={theme} onChange={(value) => setTheme(value as Theme)} options={[["dark", "Escuro"], ["light", "Claro"]]} />
          <SelectSetting title="Cor principal" description="Accent visual usado por controlos preparados para temas futuros." value={desktopSettings.accentColor} onChange={(value) => updateDesktopSetting("accentColor", value as DesktopSettings["accentColor"])} options={[["gold", "Dourado"], ["white", "Branco"], ["green", "Verde"]]} />
          <SliderSetting title="Intensidade do Glow" description="Força do brilho em cartões e estados ativos." value={desktopSettings.glowIntensity} min={0} max={100} suffix="%" onChange={(value) => updateDesktopSetting("glowIntensity", value)} />
          <SliderSetting title="Transparência (Mica)" description="Camadas translúcidas preparadas para janelas nativas." value={desktopSettings.micaTransparency} min={0} max={60} suffix="%" onChange={(value) => updateDesktopSetting("micaTransparency", value)} />
          <SliderSetting title="Blur" description="Intensidade do desfoque em modais e superfícies." value={desktopSettings.blur} min={0} max={24} suffix="px" onChange={(value) => updateDesktopSetting("blur", value)} />
          <SliderSetting title="Escala da interface" description="Base futura para ajustar tamanho geral da UI." value={desktopSettings.interfaceScale} min={85} max={115} suffix="%" onChange={(value) => updateDesktopSetting("interfaceScale", value)} />
          <SegmentSetting title="Densidade" description="Ajusta o espaço entre elementos." value={density} onChange={(value) => setDensity(value as Density)} options={[["comfortable", "Confortável"], ["compact", "Compacta"]]} />
          <SwitchSetting title="Ativar animações" description="Transições e respostas visuais." checked={animations} onChange={setAnimations} />
          <SliderSetting title="Velocidade das animações" description="Multiplicador preparado para animações avançadas." value={desktopSettings.animationSpeed} min={50} max={150} suffix="%" onChange={(value) => updateDesktopSetting("animationSpeed", value)} />
          <SliderSetting title="Cantos arredondados" description="Raio visual dos cartões e controlos." value={desktopSettings.cornerRadius} min={4} max={16} suffix="px" onChange={(value) => updateDesktopSetting("cornerRadius", value)} />
          <SwitchSetting title="Mostrar sombras" description="Mantém profundidade visual em cartões e modais." checked={desktopSettings.showShadows} onChange={(value) => updateDesktopSetting("showShadows", value)} />
          <SwitchSetting title="Alto contraste" description="Preparado para reforçar leitura sem trocar a identidade visual." checked={desktopSettings.highContrast} onChange={(value) => updateDesktopSetting("highContrast", value)} />
        </SettingsPanel>

        <SettingsPanel icon={<MonitorCog size={17} />} title="Interface" subtitle="Navegação, confirmações e preferências de fluxo">
          <SwitchSetting title="Barra lateral compacta" description="Preparado para reduzir a sidebar em ecrãs pequenos." checked={desktopSettings.compactSidebar} onChange={(value) => updateDesktopSetting("compactSidebar", value)} />
          <SwitchSetting title="Mostrar descrições" description="Mostra texto secundário por baixo dos títulos." checked={desktopSettings.showDescriptions} onChange={(value) => updateDesktopSetting("showDescriptions", value)} />
          <SwitchSetting title="Mostrar tooltips" description="Ativa ajudas contextuais em opções avançadas." checked={desktopSettings.showTooltips} onChange={(value) => updateDesktopSetting("showTooltips", value)} />
          <SwitchSetting title="Confirmar antes de aplicar otimizações" description="Pede confirmação antes de mexer no sistema." checked={desktopSettings.confirmBeforeApply} onChange={(value) => updateDesktopSetting("confirmBeforeApply", value)} />
          <SwitchSetting title="Confirmar antes de Rollback" description="Evita reverter alterações por engano." checked={desktopSettings.confirmBeforeRollback} onChange={(value) => updateDesktopSetting("confirmBeforeRollback", value)} />
          <SwitchSetting title="Abrir sempre na página inicial" description="Começa pelo catálogo principal quando a app abre." checked={desktopSettings.openHomeOnStart} onChange={(value) => updateDesktopSetting("openHomeOnStart", value)} />
          <SwitchSetting title="Lembrar última página aberta" description="Preparado para restaurar a última área visitada." checked={desktopSettings.rememberLastPage} onChange={(value) => updateDesktopSetting("rememberLastPage", value)} />
        </SettingsPanel>

        <SettingsPanel icon={<Laptop size={17} />} title="Aplicação" subtitle="Arranque, tray, instância e atualizações">
          <SwitchSetting title="Iniciar com o Windows" description="Preparado para registar arranque automático." checked={desktopSettings.startWithWindows} onChange={(value) => updateDesktopSetting("startWithWindows", value)} />
          <SwitchSetting title="Iniciar minimizado" description="Abre a aplicação sem trazer a janela para primeiro plano." checked={desktopSettings.startMinimized} onChange={(value) => updateDesktopSetting("startMinimized", value)} />
          <SwitchSetting title="Minimizar para a bandeja" description="Mantém o Optimizer disponível em segundo plano." checked={desktopSettings.minimizeToTray} onChange={(value) => updateDesktopSetting("minimizeToTray", value)} />
          <SwitchSetting title="Fechar para a bandeja" description="Preparado para manter sessão ativa ao fechar a janela." checked={desktopSettings.closeToTray} onChange={(value) => updateDesktopSetting("closeToTray", value)} />
          <SwitchSetting title="Permitir apenas uma instância" description="Impede janelas duplicadas da aplicação." checked={desktopSettings.singleInstance} onChange={(value) => updateDesktopSetting("singleInstance", value)} />
          <SwitchSetting title="Procurar atualizações automaticamente" description="Verifica versões novas no site Orion." checked={desktopSettings.autoUpdates} onChange={(value) => updateDesktopSetting("autoUpdates", value)} />
          <SelectSetting title="Canal de atualizações" description="Escolhe o canal preparado para releases futuras." value={desktopSettings.updateChannel} onChange={(value) => updateDesktopSetting("updateChannel", value as DesktopSettings["updateChannel"])} options={[["stable", "Stable"], ["beta", "Beta"]]} />
          <SwitchSetting title="Reiniciar automaticamente após atualização" description="Preparado para finalizar updates sem ação manual." checked={desktopSettings.autoRestartAfterUpdate} onChange={(value) => updateDesktopSetting("autoRestartAfterUpdate", value)} />
        </SettingsPanel>

        <SettingsPanel icon={<Zap size={17} />} title="Otimizações" subtitle="Reversão, backups e execução segura">
          <SwitchSetting title="Criar Rollback automaticamente" description="Guarda alterações antes de aplicar cada tweak." checked={desktopSettings.autoRollback} onChange={(value) => updateDesktopSetting("autoRollback", value)} />
          <SwitchSetting title="Criar ponto de restauro" description="Preparado para integrar restore point do Windows." checked={desktopSettings.restorePoint} onChange={(value) => updateDesktopSetting("restorePoint", value)} />
          <SwitchSetting title="Backup do Registo" description="Guarda valores de registry antes de mexer." checked={desktopSettings.registryBackup} onChange={(value) => updateDesktopSetting("registryBackup", value)} />
          <SwitchSetting title="Confirmar otimizações críticas" description="Pede confirmação extra em alterações sensíveis." checked={desktopSettings.confirmCritical} onChange={(value) => updateDesktopSetting("confirmCritical", value)} />
          <SwitchSetting title="Aplicar otimizações silenciosamente" description="Preparado para executar lotes com menos prompts." checked={desktopSettings.silentOptimizations} onChange={(value) => updateDesktopSetting("silentOptimizations", value)} />
          <SwitchSetting title="Reverter automaticamente em caso de erro" description="Preparado para rollback defensivo em falhas." checked={desktopSettings.rollbackOnError} onChange={(value) => updateDesktopSetting("rollbackOnError", value)} />
          <SwitchSetting title="Ignorar otimizações incompatíveis" description="Salta tweaks que não servem para este PC." checked={desktopSettings.skipIncompatible} onChange={(value) => updateDesktopSetting("skipIncompatible", value)} />
        </SettingsPanel>

        <SettingsPanel icon={<ShieldCheck size={17} />} title="Proteção" subtitle="Validação antes e durante a execução">
          <SwitchSetting title="Verificação de integridade" description="Confirma estado base do motor antes de executar." checked={desktopSettings.integrityCheck} onChange={(value) => updateDesktopSetting("integrityCheck", value)} />
          <SwitchSetting title="Validar ficheiros antes da execução" description="Preparado para verificar recursos locais." checked={desktopSettings.validateFiles} onChange={(value) => updateDesktopSetting("validateFiles", value)} />
          <SwitchSetting title="Verificar assinatura das otimizações" description="Preparado para catálogo assinado." checked={desktopSettings.verifyOptimizationSignature} onChange={(value) => updateDesktopSetting("verifyOptimizationSignature", value)} />
          <SwitchSetting title="Verificar compatibilidade do Windows" description="Bloqueia ações fora da versão suportada." checked={desktopSettings.verifyWindowsCompatibility} onChange={(value) => updateDesktopSetting("verifyWindowsCompatibility", value)} />
          <SwitchSetting title="Proteção contra execução duplicada" description="Evita correr a mesma operação em paralelo." checked={desktopSettings.duplicateExecutionProtection} onChange={(value) => updateDesktopSetting("duplicateExecutionProtection", value)} />
          <SwitchSetting title="Impedir encerramento durante otimizações" description="Preparado para proteger sessões em progresso." checked={desktopSettings.preventCloseDuringOptimization} onChange={(value) => updateDesktopSetting("preventCloseDuringOptimization", value)} />
        </SettingsPanel>

        <SettingsPanel icon={<Activity size={17} />} title="Notificações" subtitle="Sistema interno de alertas e avisos">
          <SwitchSetting title="Ativar notificações" description="Controla todos os avisos da aplicação." checked={desktopSettings.notificationsEnabled} onChange={(value) => updateDesktopSetting("notificationsEnabled", value)} />
          <SwitchSetting title="Som das notificações" description="Preparado para avisos sonoros internos." checked={desktopSettings.notificationSound} onChange={(value) => updateDesktopSetting("notificationSound", value)} />
          <SwitchSetting title="Notificações do sistema" description="Preparado para notificações nativas do Windows." checked={desktopSettings.systemNotifications} onChange={(value) => updateDesktopSetting("systemNotifications", value)} />
          <SwitchSetting title="Avisar quando termina uma otimização" description="Mostra aviso no fim de cada aplicação." checked={desktopSettings.notifyOptimizationDone} onChange={(value) => updateDesktopSetting("notifyOptimizationDone", value)} />
          <SwitchSetting title="Avisar quando existir uma atualização" description="Mostra nova versão disponível." checked={desktopSettings.notifyUpdateAvailable} onChange={(value) => updateDesktopSetting("notifyUpdateAvailable", value)} />
          <SwitchSetting title="Avisar quando existir um erro" description="Destaca falhas de execução e rede." checked={desktopSettings.notifyErrors} onChange={(value) => updateDesktopSetting("notifyErrors", value)} />
          <SwitchSetting title="Avisar quando for criado um Rollback" description="Confirma que a reversão ficou registada." checked={desktopSettings.notifyRollbackCreated} onChange={(value) => updateDesktopSetting("notifyRollbackCreated", value)} />
        </SettingsPanel>

        <SettingsPanel icon={<History size={17} />} title="Histórico" subtitle="Registos locais das ações executadas">
          <SwitchSetting title="Guardar histórico" description="Mantém sessões para auditoria e rollback." checked={desktopSettings.saveHistory} onChange={(value) => updateDesktopSetting("saveHistory", value)} />
          <SliderSetting title="Número máximo de registos" description="Limite preparado para limpeza automática futura." value={desktopSettings.maxHistoryEntries} min={50} max={1000} step={50} onChange={(value) => updateDesktopSetting("maxHistoryEntries", value)} />
          <ActionSetting title="Limpar histórico" description="Preparado para remover sessões antigas." action="Limpar" />
          <ActionSetting title="Exportar histórico" description="Preparado para criar ficheiro de diagnóstico." action="Exportar" />
          <SwitchSetting title="Mostrar data e hora" description="Mostra timestamp completo nos registos." checked={desktopSettings.showDateTime} onChange={(value) => updateDesktopSetting("showDateTime", value)} />
          <SwitchSetting title="Mostrar duração das otimizações" description="Preparado para medir tempo de execução." checked={desktopSettings.showOptimizationDuration} onChange={(value) => updateDesktopSetting("showOptimizationDuration", value)} />
        </SettingsPanel>

        <SettingsPanel icon={<Search size={17} />} title="Logs" subtitle="Diagnóstico técnico e registos em tempo real">
          <SwitchSetting title="Ativar Logs" description="Guarda eventos internos para suporte." checked={desktopSettings.logsEnabled} onChange={(value) => updateDesktopSetting("logsEnabled", value)} />
          <SelectSetting title="Nível dos Logs" description="Controla detalhe dos registos técnicos." value={desktopSettings.logLevel} onChange={(value) => updateDesktopSetting("logLevel", value as DesktopSettings["logLevel"])} options={[["error", "Erro"], ["warn", "Aviso"], ["info", "Info"], ["debug", "Debug"]]} />
          <ActionSetting title="Exportar Logs" description="Preparado para enviar logs ao suporte." action="Exportar" />
          <ActionSetting title="Limpar Logs" description="Preparado para remover logs locais." action="Limpar" />
          <SwitchSetting title="Mostrar Logs em tempo real" description="Preparado para consola ao vivo dentro da app." checked={desktopSettings.realtimeLogs} onChange={(value) => updateDesktopSetting("realtimeLogs", value)} />
        </SettingsPanel>

        <SettingsPanel icon={<HardDrive size={17} />} title="Cache" subtitle="Dados temporários e cache de leitura rápida">
          <ActionSetting title="Limpar Cache" description="Preparado para apagar cache interna." action="Limpar" />
          <ActionSetting title="Limpar ficheiros temporários" description="Preparado para remover temporários do motor." action="Limpar" />
          <ActionSetting title="Recriar Cache" description="Preparado para reconstruir cache de catálogo e sistema." action="Recriar" />
          <FactSetting title="Mostrar tamanho da Cache" description="Estimativa local preparada para leitura futura." value="A calcular" />
          <SwitchSetting title="Limpeza automática" description="Remove dados temporários periodicamente." checked={desktopSettings.cacheAutoClean} onChange={(value) => updateDesktopSetting("cacheAutoClean", value)} />
        </SettingsPanel>
      </div>

      <section className="settings-panel device-panel">
        <div className="settings-panel-heading"><span className="settings-panel-icon"><MonitorCog size={17} /></span><div><h2>Sistema</h2><p>Hardware detetado e motor de execução</p></div></div>
        <div className="settings-actions-row">
          <ActionPill label="Atualizar informações do hardware" />
          <ActionPill label="Reanalisar computador" />
          <ActionPill label="Recarregar serviços" />
          <ActionPill label="Recarregar drivers" />
          <ActionPill label="Atualizar estado do sistema" />
        </div>
        <div className="settings-device-grid">{rows.map((row) => <div className="system-row" key={row.label}><div className="system-row-icon">{row.icon}</div><div><span>{row.label}</span><strong>{row.value}</strong></div>{row.canElevate ? <button className="elevate-button" disabled={elevating} onClick={async () => { setElevating(true); await onElevate(); setElevating(false); }}><ShieldCheck size={13} />{elevating ? "A pedir..." : "Ativar administrador"}</button> : <Check size={16} className="system-check" />}</div>)}</div>
      </section>

      <div className="settings-grid">
        <SettingsPanel icon={<Cpu size={17} />} title="Diagnóstico" subtitle="Testes rápidos preparados para suporte técnico">
          {["Teste de permissões", "Teste da Internet", "Teste do Disco", "Teste da Memória", "Teste do Motor Orion", "Verificar dependências", "Reparar instalação"].map((label) => <ActionSetting key={label} title={label} description="Preparado para execução assistida." action="Executar" />)}
        </SettingsPanel>

        <SettingsPanel icon={<Network size={17} />} title="Rede" subtitle="Estado da ligação e validações externas">
          {["Testar Latência", "Verificar DNS", "Atualizar estado da rede", "Mostrar IP Público", "Mostrar IP Local", "Mostrar velocidade da ligação"].map((label) => <ActionSetting key={label} title={label} description="Preparado para diagnóstico de conectividade." action={label.startsWith("Mostrar") ? "Ver" : "Testar"} />)}
        </SettingsPanel>

        <SettingsPanel icon={<PackageCheck size={17} />} title="Compatibilidade" subtitle="Modos e verificações preparadas para versões futuras">
          <SwitchSetting title="Modo Windows 10" description="Força regras conservadoras para Windows 10." checked={desktopSettings.windows10Mode} onChange={(value) => updateDesktopSetting("windows10Mode", value)} />
          <SwitchSetting title="Modo Windows 11" description="Usa regras modernas para Windows 11." checked={desktopSettings.windows11Mode} onChange={(value) => updateDesktopSetting("windows11Mode", value)} />
          <SwitchSetting title="Compatibilidade Experimental" description="Ativa checks ainda em validação." checked={desktopSettings.experimentalCompatibility} onChange={(value) => updateDesktopSetting("experimentalCompatibility", value)} />
          <SwitchSetting title="Ignorar verificações de versão" description="Opção avançada preparada para suporte." checked={desktopSettings.ignoreVersionChecks} onChange={(value) => updateDesktopSetting("ignoreVersionChecks", value)} />
          <SwitchSetting title="Ativar funcionalidades Beta" description="Mostra funcionalidades ainda em teste." checked={desktopSettings.betaFeatures} onChange={(value) => updateDesktopSetting("betaFeatures", value)} />
        </SettingsPanel>

        <SettingsPanel icon={<UserRound size={17} />} title="Licença e acesso" subtitle="Estado atual da tua conta">
          <div className="settings-facts"><InfoLine label="Licença" value={formatExpiry(account.expires_at)} /><InfoLine label="Suporte" value={account.support_lifetime ? "Life-time" : formatExpiry(account.support_expires_at)} /><InfoLine label="Plano" value={account.tier ? tierLabel(account.tier) : "Acesso interno"} /><InfoLine label="Cargo" value={ROLE_LABEL[account.role] ?? account.role} /></div>
        </SettingsPanel>

        <SettingsPanel icon={<ShieldCheck size={17} />} title="Requisitos" subtitle="Condições necessárias para usar o Optimizer">
          <FactSetting title="Conta Orion" description="Sessão autenticada e perfil sincronizado." value={account.username ? "Pronto" : "Pendente"} />
          <FactSetting title="Licença ativa" description="Plano ou acesso interno associado à conta." value={account.tier || ["staff", "developer", "owner"].includes(account.role) ? "Pronto" : "Sem plano"} />
          <FactSetting title="Permissões Windows" description="Modo administrador recomendado para otimizações críticas." value={profile?.isAdmin ? "Administrador" : "Normal"} />
          <FactSetting title="Motor Orion" description="Modo de execução detetado pela aplicação." value={profile?.executionMode === "Mock" ? "Simulação" : "Real"} />
          <FactSetting title="Dispositivo" description="Hardware lido para compatibilidade e diagnóstico." value={profile ? "Detetado" : "A aguardar"} />
          <FactSetting title="Servidor" description="Endpoint usado para licença, catálogo e suporte." value={settings.server.replace(/^https?:\/\//, "")} />
        </SettingsPanel>
      </div>

      <div className="settings-save-state">{savedAt ? `Guardado automaticamente às ${new Date(savedAt).toLocaleTimeString("pt-PT")}` : "Pronto para guardar automaticamente"}</div>
      <section className="safety-band"><ShieldCheck size={22} /><div><strong>Proteção de reversão ativa</strong><span>O estado original é guardado antes de cada alteração.</span></div></section>
    </PageMotion>
  );
}

function SettingsPanel({ icon, title, subtitle, children }: { icon: ReactNode; title: string; subtitle: string; children: ReactNode }) {
  return <section className="settings-panel"><div className="settings-panel-heading"><span className="settings-panel-icon">{icon}</span><div><h2>{title}</h2><p>{subtitle}</p></div></div><div className="settings-control-list">{children}</div></section>;
}

function SettingTitle({ title, description, tooltip }: { title: string; description: string; tooltip?: string }) {
  return <div><strong>{title}</strong><span title={tooltip}>{description}</span></div>;
}

function SwitchSetting({ title, description, checked, onChange, tooltip }: { title: string; description: string; checked: boolean; onChange: (checked: boolean) => void; tooltip?: string }) {
  return <div className="setting-control"><SettingTitle title={title} description={description} tooltip={tooltip} /><label className="switch-label settings-switch" title={tooltip}><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span className="switch" /><b>{checked ? "Ativo" : "Off"}</b></label></div>;
}

function SelectSetting({ title, description, value, options, onChange, tooltip }: { title: string; description: string; value: string; options: Array<[string, string]>; onChange: (value: string) => void; tooltip?: string }) {
  return <div className="setting-control"><SettingTitle title={title} description={description} tooltip={tooltip} /><select className="settings-select" value={value} onChange={(event) => onChange(event.target.value)} title={tooltip}>{options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></div>;
}

function SegmentSetting({ title, description, value, options, onChange, tooltip }: { title: string; description: string; value: string; options: Array<[string, string]>; onChange: (value: string) => void; tooltip?: string }) {
  return <div className="setting-control"><SettingTitle title={title} description={description} tooltip={tooltip} /><div className="density-options" role="group" title={tooltip}>{options.map(([v, label]) => <button key={v} className={value === v ? "active" : ""} onClick={() => onChange(v)}>{label}</button>)}</div></div>;
}

function SliderSetting({ title, description, value, min, max, onChange, step = 1, suffix = "", tooltip }: { title: string; description: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (value: number) => void; tooltip?: string }) {
  return <div className="setting-control"><SettingTitle title={title} description={description} tooltip={tooltip} /><div className="settings-slider"><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} title={tooltip} /><b>{value}{suffix}</b></div></div>;
}

function FactSetting({ title, description, value }: { title: string; description: string; value: string }) {
  return <div className="setting-control"><SettingTitle title={title} description={description} /><span className="settings-fact-value">{value}</span></div>;
}

function ActionSetting({ title, description, action, onClick }: { title: string; description: string; action: string; onClick?: () => void }) {
  return <div className="setting-control"><SettingTitle title={title} description={description} /><button className="settings-action" onClick={onClick}>{action}</button></div>;
}

function ActionPill({ label }: { label: string }) {
  return <button className="settings-action pill">{label}</button>;
}

function SummaryItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <div className="summary-item"><span>{icon}</span><div><small>{label}</small><strong title={value}>{value}</strong></div></div>; }
function StatusDot({ good }: { good: boolean }) { return <span className={`status-dot ${good ? "good" : "waiting"}`} />; }
function Spinner() { return <span className="spinner" />; }
function PageMotion({ children }: { children: ReactNode }) { return <motion.div className="page" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.2 }}>{children}</motion.div>; }
function EmptyState({ icon, title, text }: { icon: ReactNode; title: string; text: string }) { return <div className="empty-state"><div>{icon}</div><strong>{title}</strong><span>{text}</span></div>; }
function Toast({ tone, message, onClose }: { tone: "good" | "bad"; message: string; onClose: () => void }) { useEffect(() => { const timer = setTimeout(onClose, 4500); return () => clearTimeout(timer); }, [onClose]); return <motion.div className={`toast ${tone}`} initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0 }}>{tone === "good" ? <Check size={16} /> : <CircleAlert size={16} />}<span>{message}</span><button onClick={onClose}><X size={14} /></button></motion.div>; }
