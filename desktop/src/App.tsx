import { AnimatePresence, motion } from "framer-motion";
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
  History,
  Laptop,
  LockKeyhole,
  LogOut,
  MemoryStick,
  Minus,
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
  UserRound,
  Users,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import logo from "./assets/orion.svg";

type View = "catalog" | "history" | "system" | "internal";
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

export default function App() {
  const [settings, setSettings] = useState<LoginSettings | null>(null);
  const [profile, setProfile] = useState<SystemProfile | null>(null);
  const [catalog, setCatalog] = useState<CatalogState | null>(null);
  const [view, setView] = useState<View>("catalog");
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [toast, setToast] = useState<{ tone: "good" | "bad"; message: string } | null>(null);

  useEffect(() => {
    Promise.all([window.orion.getSettings(), window.orion.profile()])
      .then(([stored, detected]) => {
        setSettings(stored);
        setProfile(detected);
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

  if (!settings) return <BootScreen />;

  return (
    <div className="app-frame">
      <TitleBar />
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
                {view === "history" && <HistoryView key="history" notify={setToast} />}
                {view === "system" && <SystemView key="system" profile={profile} settings={settings} />}
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
  );
}

function TitleBar() {
  return (
    <div className="titlebar">
      <div className="titlebar-brand">
        <img src={logo} alt="" />
        <span>ORION OPTIMIZER</span>
      </div>
      <div className="window-controls">
        <button onClick={() => window.orion.minimize()} aria-label="Minimizar"><Minus size={14} /></button>
        <button onClick={() => window.orion.maximize()} aria-label="Maximizar"><Square size={11} /></button>
        <button className="close" onClick={() => window.orion.close()} aria-label="Fechar"><X size={15} /></button>
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
      <nav>
        <NavButton active={view === "catalog"} icon={<Gauge />} label="Otimizações" onClick={() => setView("catalog")} />
        <NavButton active={view === "history"} icon={<History />} label="Histórico" onClick={() => setView("history")} />
        <NavButton active={view === "system"} icon={<Settings2 />} label="Sistema" onClick={() => setView("system")} />
        {INTERNAL_ROLES.has(account.role) && (
          <NavButton active={view === "internal"} icon={<Crown />} label="Equipa" onClick={() => setView("internal")} />
        )}
      </nav>
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

type InternalTool = {
  label: string;
  description: string;
  path: string;
  icon: ReactNode;
  minimumRole: "staff" | "developer" | "owner";
};

const INTERNAL_TOOLS: InternalTool[] = [
  { label: "Área pessoal", description: "Consultar licença, suporte e dispositivo", path: "/panel", icon: <UserRound />, minimumRole: "staff" },
  { label: "Painel", description: "Métricas e estado da operação Orion", path: "/panel/admin", icon: <Gauge />, minimumRole: "staff" },
  { label: "Contas", description: "Consultar utilizadores e prestar suporte", path: "/panel/admin/users", icon: <Users />, minimumRole: "staff" },
  { label: "Avaliações", description: "Moderar avaliações submetidas", path: "/panel/admin/reviews", icon: <ShieldCheck />, minimumRole: "staff" },
  { label: "Catálogo", description: "Gerir otimizações autorizadas", path: "/panel/admin/catalog", icon: <PackageCheck />, minimumRole: "developer" },
  { label: "Planos", description: "Criar e editar planos comerciais", path: "/panel/admin/plans", icon: <Crown />, minimumRole: "owner" },
  { label: "Vendas", description: "Consultar compras e faturação", path: "/panel/admin/orders", icon: <ShoppingBag />, minimumRole: "owner" },
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

      <div className="section-heading"><div><span className="eyebrow">FERRAMENTAS</span><h2>Atalhos da equipa</h2></div><span>{tools.length} disponíveis</span></div>
      <div className="internal-tools">
        {tools.map((tool) => (
          <button key={tool.path} className="internal-tool" onClick={() => void open(tool.path)}>
            <span className="internal-tool-icon">{tool.icon}</span>
            <span><strong>{tool.label}</strong><small>{tool.description}</small></span>
            <ExternalLink size={15} />
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
    </PageMotion>
  );
}

function SystemView({ profile, settings }: { profile: SystemProfile | null; settings: LoginSettings }) {
  const rows = [
    { icon: <Laptop />, label: "Tipo de dispositivo", value: profile?.chassis === "laptop" ? "Portátil" : "Desktop" },
    { icon: <MonitorCog />, label: "Adaptadores gráficos", value: profile?.gpuNames?.join(" · ") || "Não detetado" },
    { icon: <MemoryStick />, label: "Memória instalada", value: `${profile?.ramGB ?? 0} GB RAM` },
    { icon: <ShieldCheck />, label: "Sessão elevada", value: profile?.isAdmin ? "Sim" : "Não" },
    { icon: <Activity />, label: "Motor de execução", value: profile?.executionMode === "Mock" ? "Simulação" : "Real" },
    { icon: <Wifi />, label: "Servidor", value: settings.server },
  ];
  return <PageMotion><header className="page-header"><div><span className="eyebrow">DISPOSITIVO</span><h1>Sistema</h1><p>Hardware e estado do motor Orion</p></div></header><div className="system-list">{rows.map((row) => <div className="system-row" key={row.label}><div className="system-row-icon">{row.icon}</div><div><span>{row.label}</span><strong>{row.value}</strong></div><Check size={16} className="system-check" /></div>)}</div><section className="safety-band"><ShieldCheck size={22} /><div><strong>Proteção de reversão ativa</strong><span>O estado original é guardado antes de cada alteração.</span></div></section></PageMotion>;
}

function SummaryItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <div className="summary-item"><span>{icon}</span><div><small>{label}</small><strong title={value}>{value}</strong></div></div>; }
function StatusDot({ good }: { good: boolean }) { return <span className={`status-dot ${good ? "good" : "waiting"}`} />; }
function Spinner() { return <span className="spinner" />; }
function PageMotion({ children }: { children: ReactNode }) { return <motion.div className="page" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.2 }}>{children}</motion.div>; }
function EmptyState({ icon, title, text }: { icon: ReactNode; title: string; text: string }) { return <div className="empty-state"><div>{icon}</div><strong>{title}</strong><span>{text}</span></div>; }
function Toast({ tone, message, onClose }: { tone: "good" | "bad"; message: string; onClose: () => void }) { useEffect(() => { const timer = setTimeout(onClose, 4500); return () => clearTimeout(timer); }, [onClose]); return <motion.div className={`toast ${tone}`} initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0 }}>{tone === "good" ? <Check size={16} /> : <CircleAlert size={16} />}<span>{message}</span><button onClick={onClose}><X size={14} /></button></motion.div>; }
