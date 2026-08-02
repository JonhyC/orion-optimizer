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

type View = "catalog" | "games" | "performance" | "history" | "settings" | "internal";
type Theme = "dark" | "light";
type Density = "comfortable" | "compact";
type LoginSettings = { server: string; username: string };
type CatalogState = Awaited<ReturnType<OrionApi["catalog"]>>;

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
        setSettings({ server: "http://localhost:3400", username: "" });
        setToast({ tone: "bad", message: cleanError(error) });
      });
  }, []);

  async function loadCatalog() {
    setLoadingCatalog(true);
    try {
      setCatalog(await window.orion.catalog());
    } catch (error) {
      setToast({ tone: "bad", message: cleanError(error) });
      throw error;
    } finally {
      setLoadingCatalog(false);
    }
  }

  async function handleLogin(credentials: Parameters<OrionApi["login"]>[0]) {
    await window.orion.login(credentials);
    setSettings({ server: credentials.server, username: credentials.remember ? credentials.username : "" });
    await loadCatalog();
  }

  async function logout() {
    await window.orion.logout();
    setCatalog(null);
    setView("catalog");
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
            <Sidebar view={view} setView={setView} account={catalog.account} onLogout={logout} />
            <main className="content">
              <AnimatePresence mode="wait">
                {view === "catalog" && (
                  <CatalogView
                    key="catalog"
                    state={catalog}
                    profile={profile}
                    loading={loadingCatalog}
                    onRefresh={loadCatalog}
                    notify={setToast}
                  />
                )}
                {view === "games" && <GamesView key="games" state={catalog} notify={setToast} />}
                {view === "performance" && <PerformanceView key="performance" profile={profile} notify={setToast} />}
                {view === "history" && <HistoryView key="history" notify={setToast} />}
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
        <span>ORION OPTIMIZER</span>
      </div>
      <div className="titlebar-right">
        {version && <span className="app-version" title={`Orion Optimizer ${version}`}>v{version}</span>}
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
  const [password, setPassword] = useState("");
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
      setError(cleanError(caught));
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
          <img src={logo} alt="Orion Optimizer" />
          <div>
            <strong>ORION</strong>
            <span>OPTIMIZER</span>
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

function Sidebar({ view, setView, account, onLogout }: { view: View; setView: (view: View) => void; account: CatalogState["account"]; onLogout: () => void }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo"><img src={logo} alt="" /><div><b>ORION</b><span>OPTIMIZER</span></div></div>
      <span className="sidebar-nav-label">PRINCIPAL</span>
      <nav>
        <NavButton active={view === "games"} icon={<Gamepad2 />} label="Jogos" onClick={() => setView("games")} />
        <NavButton active={view === "performance"} icon={<Activity />} label="Desempenho" onClick={() => setView("performance")} />
        <NavButton active={view === "catalog"} icon={<Gauge />} label="Otimizações" onClick={() => setView("catalog")} />
        <NavButton active={view === "history"} icon={<History />} label="Histórico" onClick={() => setView("history")} />
        <NavButton active={view === "settings"} icon={<Settings2 />} label="Definições" onClick={() => setView("settings")} />
        {INTERNAL_ROLES.has(account.role) && (
          <NavButton active={view === "internal"} icon={<Crown />} label="Equipa" onClick={() => setView("internal")} />
        )}
      </nav>
      <div className="sidebar-status"><span><StatusDot good /><b>Proteção ativa</b></span><small>Alterações reversíveis</small></div>
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

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return <button className={`nav-button ${active ? "active" : ""}`} onClick={onClick}>{icon}<span>{label}</span>{active && <motion.i layoutId="nav-active" />}</button>;
}

function CatalogView({ state, profile, loading, onRefresh, notify }: { state: CatalogState; profile: SystemProfile | null; loading: boolean; onRefresh: () => Promise<void>; notify: (toast: { tone: "good" | "bad"; message: string }) => void }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [onlyCompatible, setOnlyCompatible] = useState(true);
  const [selected, setSelected] = useState<Tweak | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());

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
            onApplied={() => {
              setApplied((current) => new Set(current).add(selected.id));
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

function TweakModal({ tweak, onClose, onApplied, notify, mode }: { tweak: Tweak; onClose: () => void; onApplied: () => void; notify: (toast: { tone: "good" | "bad"; message: string }) => void; mode: "Real" | "Mock" }) {
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
      await window.orion.apply(tweak);
      setStage("done");
      onApplied();
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

function HistoryView({ notify }: { notify: (toast: { tone: "good" | "bad"; message: string }) => void }) {
  const [sessions, setSessions] = useState<OrionSession[] | null>(null);
  const [rolling, setRolling] = useState<string | null>(null);
  useEffect(() => { window.orion.sessions().then(setSessions).catch((e) => notify({ tone: "bad", message: cleanError(e) })); }, [notify]);

  async function rollback(session: OrionSession) {
    setRolling(session.sessionId);
    try {
      await window.orion.rollback(session);
      setSessions((current) => current?.map((item) => item.sessionId === session.sessionId ? { ...item, status: "rolled_back" } : item) ?? []);
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

function GamesView({ state, notify }: { state: CatalogState; notify: (toast: { tone: "good" | "bad"; message: string }) => void }) {
  const [games, setGames] = useState<OrionGame[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [selected, setSelected] = useState<OrionGame | null>(null);
  const gameTweaks = state.tweaks.filter((tweak) => ["game", "gpu", "net", "mmcss", "power"].includes(categoryOf(tweak)));

  async function loadGames() {
    try {
      const result = await window.orion.games();
      const rawItems = (result.items as unknown as { value?: OrionGame[] })?.value ?? result.items;
      const rawWarnings = (result.warnings as unknown as { value?: string[] })?.value ?? result.warnings;
      setGames(Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : []);
      setWarnings(Array.isArray(rawWarnings) ? rawWarnings : rawWarnings ? [String(rawWarnings)] : []);
    } catch (error) {
      notify({ tone: "bad", message: cleanError(error) });
      setGames([]);
    }
  }

  useEffect(() => { void loadGames(); }, []);

  const totalSize = (games ?? []).reduce((sum, game) => sum + Number(game.sizeBytes || 0), 0);
  const platforms = Array.from(new Set((games ?? []).map((game) => game.platform)));

  return (
    <PageMotion>
      <header className="page-header">
        <div><span className="eyebrow">BIBLIOTECA</span><h1>Jogos</h1><p>Jogos detetados no PC e perfis de otimizacao recomendados.</p></div>
        <div className="header-actions">
          <div className="mode-badge"><Gamepad2 size={14} />{games ? `${games.length} jogos` : "A procurar"}</div>
          <button className="icon-button" onClick={() => void loadGames()} title="Atualizar jogos"><RefreshCcw size={16} className={games === null ? "spin" : ""} /></button>
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
        {selected && <GameModal game={selected} tweaks={gameTweaks} eligibility={state.eligibility} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </PageMotion>
  );
}

function GameModal({ game, tweaks, eligibility, onClose }: { game: OrionGame; tweaks: Tweak[]; eligibility: CatalogState["eligibility"]; onClose: () => void }) {
  const recommended = tweaks.slice(0, 6);
  return (
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <motion.section className="modal game-modal" initial={{ opacity: 0, y: 18, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: .98 }}>
        <button className="modal-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        <div className="modal-heading"><span className="eyebrow">{game.platform}</span><h2>{game.name}</h2><p>{game.installPath || "Jogo protegido pela loja. O Orion usa otimizacoes seguras fora da pasta do jogo."}</p></div>
        <div className="game-modal-grid">
          <ModalStat label="Tamanho" value={formatBytes(game.sizeBytes)} />
          <ModalStat label="Perfil" value="Gaming manual" />
          <ModalStat label="Acoes" value={String(recommended.length)} />
        </div>
        <div className="game-recommendations">
          {recommended.map((tweak) => (
            <div key={tweak.id} className="game-recommendation">
              <span className="tweak-icon">{(() => { const Icon = CATEGORY[categoryOf(tweak)]?.icon ?? Zap; return <Icon size={15} />; })()}</span>
              <span><strong>{tweak.name}</strong><small>{eligibility[tweak.id]?.eligible === false ? eligibility[tweak.id].reason : tweak.description}</small></span>
              <b className={eligibility[tweak.id]?.eligible === false ? "blocked" : ""}>{eligibility[tweak.id]?.eligible === false ? "Bloqueada" : "Pronta"}</b>
            </div>
          ))}
        </div>
        <div className="modal-actions"><button className="primary" onClick={onClose}>Entendido</button></div>
      </motion.section>
    </motion.div>
  );
}

function PerformanceView({ profile, notify }: { profile: SystemProfile | null; notify: (toast: { tone: "good" | "bad"; message: string }) => void }) {
  const [snapshot, setSnapshot] = useState<OrionPerformance | null>(null);
  const [history, setHistory] = useState<OrionPerformance[]>([]);
  const [displays, setDisplays] = useState<OrionDisplay[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadPerformance(silent = false) {
    if (!silent) setLoading(true);
    try {
      const next = await window.orion.performance();
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
    const timer = setInterval(() => void loadPerformance(true), 3500);
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
          <button className="icon-button" onClick={() => void loadPerformance()} disabled={loading} title="Atualizar desempenho"><RefreshCcw size={16} className={loading ? "spin" : ""} /></button>
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
              <div className="drive-list">{displays.length ? displays.map((display) => <div key={display.deviceName}><span><strong>{display.displayName || display.deviceName}</strong><small>{display.current.width}x{display.current.height} @ {display.current.refreshRate} Hz · {display.modes.length} modos</small></span><b>{display.primary ? "Principal" : "Extra"}</b></div>) : <div><span><strong>Sem dados</strong><small>O Windows nao devolveu monitores nesta leitura.</small></span><b>N/D</b></div>}</div>
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
  kind: "account" | "dashboard" | "users" | "reviews" | "catalog" | "plans" | "orders";
  label: string;
  description: string;
  path: string;
  icon: ReactNode;
  minimumRole: "staff" | "developer" | "owner";
};

const INTERNAL_TOOLS: InternalTool[] = [
  { kind: "account", label: "Área pessoal", description: "Consultar licença, suporte e dispositivo", path: "/panel", icon: <UserRound />, minimumRole: "staff" },
  { kind: "dashboard", label: "Painel", description: "Métricas e estado da operação Orion", path: "/panel/admin", icon: <Gauge />, minimumRole: "staff" },
  { kind: "users", label: "Contas", description: "Consultar utilizadores e prestar suporte", path: "/panel/admin/users", icon: <Users />, minimumRole: "staff" },
  { kind: "reviews", label: "Avaliações", description: "Moderar avaliações submetidas", path: "/panel/admin/reviews", icon: <ShieldCheck />, minimumRole: "staff" },
  { kind: "catalog", label: "Catálogo", description: "Gerir otimizações autorizadas", path: "/panel/admin/catalog", icon: <PackageCheck />, minimumRole: "developer" },
  { kind: "plans", label: "Planos", description: "Criar e editar planos comerciais", path: "/panel/admin/plans", icon: <Crown />, minimumRole: "owner" },
  { kind: "orders", label: "Vendas", description: "Consultar compras e faturação", path: "/panel/admin/orders", icon: <ShoppingBag />, minimumRole: "owner" },
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
    const timer = setInterval(() => void loadOperations(true), 30_000);
    return () => clearInterval(timer);
  }, []);

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
                    const content = <><span className="presence-avatar">{person.avatarUrl ? <img src={person.avatarUrl} alt="" /> : <UserRound size={15} />}</span><span className="presence-identity"><strong>{person.displayName}</strong><small>{ROLE_LABEL[person.role] ?? person.role} · {person.tier ? tierLabel(person.tier) : "sem plano"} · {person.clientVersion ?? "sem versão"}</small></span><span className="presence-signals"><span className={person.siteOnline ? "online" : ""}><Wifi size={11} />Site</span><span className={person.optimizerOnline ? "online" : ""}><Zap size={11} />App</span><small>{relativeTime(Math.max(person.siteSeenAt ?? 0, person.optimizerSeenAt ?? 0, person.lastActivityAt ?? 0) || null)}</small></span></>;
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
                  <span><strong>{person.displayName}</strong><small>{ROLE_LABEL[person.role] ?? person.role} · {person.tier ? tierLabel(person.tier) : "sem plano"}</small></span>
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
          <InfoLine label="Site" value={person.siteOnline ? "Online agora" : relativeTime(person.siteSeenAt)} />
          <InfoLine label="Optimizer" value={person.optimizerOnline ? "Online agora" : relativeTime(person.optimizerSeenAt)} />
          <InfoLine label="Última atividade" value={relativeTime(person.lastActivityAt)} />
        </div>
        <div className="modal-actions"><button className="secondary" onClick={onClose}>Fechar</button>{canOpenPortal && <button className="primary" onClick={() => onOpenPortal(`/panel/admin/users/${person.id}`)}><ExternalLink size={14} />Gestão completa</button>}</div>
      </motion.section>
    </motion.div>
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
  const rows = [
    { icon: <Laptop />, label: "Tipo de dispositivo", value: profile?.chassis === "laptop" ? "Portátil" : "Desktop" },
    { icon: <MonitorCog />, label: "Adaptadores gráficos", value: profile?.gpuNames?.join(" · ") || "Não detetado" },
    { icon: <MemoryStick />, label: "Memória instalada", value: `${profile?.ramGB ?? 0} GB RAM` },
    { icon: <ShieldCheck />, label: "Sessão elevada", value: profile?.isAdmin ? "Sim" : "Não", canElevate: !profile?.isAdmin },
    { icon: <Activity />, label: "Motor de execução", value: profile?.executionMode === "Mock" ? "Simulação" : "Real" },
    { icon: <Wifi />, label: "Servidor", value: settings.server },
  ];
  return (
    <PageMotion>
      <header className="page-header"><div><span className="eyebrow">PREFERÊNCIAS</span><h1>Definições</h1><p>Conta, aparência e ambiente do Optimizer</p></div><span className="settings-version">Orion v{appVersion || "..."}</span></header>

      <section className="settings-profile">
        <div className="settings-avatar">{account.discord_avatar_url ? <img src={account.discord_avatar_url} alt="" referrerPolicy="no-referrer" /> : <UserRound size={28} />}</div>
        <div className="settings-identity"><span className="eyebrow">CONTA ORION</span><h2>{account.display_name || account.username}</h2><p>@{account.username}</p></div>
        <div className="settings-badges"><span><ShieldCheck size={13} />{account.discord_verified ? "Discord verificado" : "Discord por verificar"}</span><span><Crown size={13} />{ROLE_LABEL[account.role] ?? account.role}</span><span>{account.tier ? tierLabel(account.tier) : "Acesso interno"}</span></div>
      </section>

      <div className="settings-grid">
        <section className="settings-panel appearance-panel">
          <div className="settings-panel-heading"><span className="settings-panel-icon"><Sparkles size={17} /></span><div><h2>Aparência</h2><p>Personaliza o ambiente da aplicação</p></div></div>
          <div className="setting-control">
            <div><strong>Tema</strong><span>Escolhe a aparência que preferes</span></div>
            <div className="theme-options" role="group" aria-label="Tema da aplicação">
              <button className={theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")}><Moon size={15} />Escuro</button>
              <button className={theme === "light" ? "active" : ""} onClick={() => setTheme("light")}><Sun size={15} />Claro</button>
            </div>
          </div>
          <div className="setting-control">
            <div><strong>Animações</strong><span>Transições e respostas visuais</span></div>
            <label className="switch-label settings-switch"><input type="checkbox" checked={animations} onChange={(event) => setAnimations(event.target.checked)} /><span className="switch" /><b>{animations ? "Ativas" : "Reduzidas"}</b></label>
          </div>
          <div className="setting-control">
            <div><strong>Densidade</strong><span>Ajusta o espaço entre elementos</span></div>
            <div className="density-options" role="group" aria-label="Densidade da interface"><button className={density === "comfortable" ? "active" : ""} onClick={() => setDensity("comfortable")}>Confortável</button><button className={density === "compact" ? "active" : ""} onClick={() => setDensity("compact")}>Compacta</button></div>
          </div>
        </section>

        <section className="settings-panel account-panel">
          <div className="settings-panel-heading"><span className="settings-panel-icon"><UserRound size={17} /></span><div><h2>Licença e acesso</h2><p>Estado atual da tua conta</p></div></div>
          <div className="settings-facts"><InfoLine label="Licença" value={formatExpiry(account.expires_at)} /><InfoLine label="Suporte" value={account.support_lifetime ? "Life-time" : formatExpiry(account.support_expires_at)} /><InfoLine label="Plano" value={account.tier ? tierLabel(account.tier) : "Acesso interno"} /><InfoLine label="Cargo" value={ROLE_LABEL[account.role] ?? account.role} /></div>
        </section>
      </div>

      <section className="settings-panel device-panel">
        <div className="settings-panel-heading"><span className="settings-panel-icon"><MonitorCog size={17} /></span><div><h2>Dispositivo e ligação</h2><p>Hardware detetado e motor de execução</p></div></div>
        <div className="settings-device-grid">{rows.map((row) => <div className="system-row" key={row.label}><div className="system-row-icon">{row.icon}</div><div><span>{row.label}</span><strong>{row.value}</strong></div>{row.canElevate ? <button className="elevate-button" disabled={elevating} onClick={async () => { setElevating(true); await onElevate(); setElevating(false); }}><ShieldCheck size={13} />{elevating ? "A pedir..." : "Ativar administrador"}</button> : <Check size={16} className="system-check" />}</div>)}</div>
      </section>

      <section className="safety-band"><ShieldCheck size={22} /><div><strong>Proteção de reversão ativa</strong><span>O estado original é guardado antes de cada alteração.</span></div></section>
    </PageMotion>
  );
}

function SummaryItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <div className="summary-item"><span>{icon}</span><div><small>{label}</small><strong title={value}>{value}</strong></div></div>; }
function StatusDot({ good }: { good: boolean }) { return <span className={`status-dot ${good ? "good" : "waiting"}`} />; }
function Spinner() { return <span className="spinner" />; }
function PageMotion({ children }: { children: ReactNode }) { return <motion.div className="page" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.2 }}>{children}</motion.div>; }
function EmptyState({ icon, title, text }: { icon: ReactNode; title: string; text: string }) { return <div className="empty-state"><div>{icon}</div><strong>{title}</strong><span>{text}</span></div>; }
function Toast({ tone, message, onClose }: { tone: "good" | "bad"; message: string; onClose: () => void }) { useEffect(() => { const timer = setTimeout(onClose, 4500); return () => clearTimeout(timer); }, [onClose]); return <motion.div className={`toast ${tone}`} initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0 }}>{tone === "good" ? <Check size={16} /> : <CircleAlert size={16} />}<span>{message}</span><button onClick={onClose}><X size={14} /></button></motion.div>; }
