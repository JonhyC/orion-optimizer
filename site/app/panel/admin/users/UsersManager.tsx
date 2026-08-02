"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Ban,
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Columns3,
  Copy,
  Download,
  Filter,
  HardDrive,
  History,
  KeyRound,
  Mail,
  MessageSquare,
  Monitor,
  MoreHorizontal,
  Receipt,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  Users,
  X,
} from "lucide-react";
import CreateUser from "./CreateUser";
import { resetHwidAction, setUserStatusAction } from "../../actions";
import { StatusBadge } from "@/components/panel/Pieces";
import type { UserProfile } from "@/lib/repo/types";

type UserRowData = UserProfile & { discord_avatar_url: string | null };
type PlanOption = { code: string; name: string };

type FilterKey =
  | "all"
  | "active"
  | "suspended"
  | "banned"
  | "no_license"
  | "lifetime"
  | "basic"
  | "pro"
  | "ultimate"
  | "special"
  | "owner"
  | "developer"
  | "staff"
  | "discord"
  | "machine"
  | "recent"
  | "region"
  | "windows";

type Filters = {
  quick: FilterKey;
  plan: string;
  role: string;
  status: string;
  license: string;
  lastLogin: string;
  windows: string;
  region: string;
  discord: string;
  sort: string;
};

const initialFilters: Filters = {
  quick: "all",
  plan: "all",
  role: "all",
  status: "all",
  license: "all",
  lastLogin: "all",
  windows: "all",
  region: "all",
  discord: "all",
  sort: "recent",
};

const quickFilters: Array<{ key: FilterKey; label: string; icon: ReactNode }> = [
  { key: "all", label: "Todos", icon: <Users size={15} /> },
  { key: "active", label: "Ativos", icon: <CheckCircle2 size={15} /> },
  { key: "suspended", label: "Suspensos", icon: <Ban size={15} /> },
  { key: "banned", label: "Banidos", icon: <Shield size={15} /> },
  { key: "no_license", label: "Sem licenca", icon: <KeyRound size={15} /> },
  { key: "lifetime", label: "Life-time", icon: <Sparkles size={15} /> },
  { key: "basic", label: "Basic", icon: <ShieldCheck size={15} /> },
  { key: "pro", label: "Pro", icon: <ShieldCheck size={15} /> },
  { key: "ultimate", label: "Ultimate", icon: <ShieldCheck size={15} /> },
  { key: "special", label: "Special", icon: <Sparkles size={15} /> },
  { key: "owner", label: "Owner", icon: <Shield size={15} /> },
  { key: "developer", label: "Admin", icon: <Shield size={15} /> },
  { key: "staff", label: "Staff", icon: <Shield size={15} /> },
  { key: "discord", label: "Discord verificado", icon: <MessageSquare size={15} /> },
  { key: "machine", label: "Computador associado", icon: <Monitor size={15} /> },
  { key: "recent", label: "Ultimo login", icon: <Clock3 size={15} /> },
  { key: "region", label: "Regiao", icon: <Filter size={15} /> },
  { key: "windows", label: "Windows", icon: <Monitor size={15} /> },
];

const columns = ["Avatar", "Discord", "Plano", "Cargo", "Hardware", "Windows", "Pais", "Licenca", "Ultimo Login", "Compras"];

export default function UsersManager({
  users,
  plans,
  now,
  canSuspend,
  canManage,
  actorId,
}: {
  users: UserRowData[];
  plans: PlanOption[];
  now: number;
  canSuspend: boolean;
  canManage: boolean;
  actorId: number;
}) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [selectedId, setSelectedId] = useState(users[0]?.id ?? 0);
  const [checked, setChecked] = useState<number[]>([]);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(columns);

  const counts = useMemo(() => buildCounts(users, now), [now, users]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("pt");
    const result = users.filter((user) => {
      const haystack = [
        user.username,
        user.email,
        user.discord_username,
        user.discord_id,
        user.hwid,
        user.tier,
        user.role,
        user.status,
        user.client_version,
        licenseText(user, now),
        "token preparado",
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("pt");

      return (
        (!needle || haystack.includes(needle)) &&
        matchesQuick(user, filters.quick, now) &&
        (filters.plan === "all" || (user.tier ?? "none") === filters.plan) &&
        (filters.role === "all" || user.role === filters.role) &&
        (filters.status === "all" || user.status === filters.status) &&
        (filters.license === "all" || licenseKind(user, now) === filters.license) &&
        (filters.discord === "all" || (filters.discord === "linked" ? !!user.discord_id : !user.discord_id)) &&
        (filters.lastLogin === "all" || matchesLastLogin(user, filters.lastLogin, now)) &&
        filters.windows === "all" &&
        filters.region === "all"
      );
    });
    return sortUsers(result, filters.sort);
  }, [filters, now, query, users]);

  const selected = filtered.find((user) => user.id === selectedId) ?? filtered[0] ?? null;

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function toggleChecked(id: number) {
    setChecked((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function exportCsv() {
    const header = ["id", "username", "discord", "email", "role", "plan", "status", "license", "hwid", "client_version"];
    const lines = filtered.map((user) =>
      [
        user.id,
        user.username,
        user.discord_username ?? "",
        user.email ?? "",
        user.role,
        user.tier ?? "",
        user.status,
        licenseText(user, now),
        user.hwid ?? "",
        user.client_version ?? "",
      ]
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "orion-contas.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <UsersHeader
        total={users.length}
        canManage={canManage}
        plans={plans}
        onExport={exportCsv}
      />
      <UsersStats users={users} now={now} />

      <section className="mt-6 grid gap-4 xl:grid-cols-[230px_minmax(0,1fr)_380px]">
        <UsersFilters
          filters={filters}
          counts={counts}
          plans={plans}
          onFilter={updateFilter}
        />

        <div className="min-w-0 rounded-2xl border border-white/[0.07] bg-[var(--panel-surface)]">
          <UsersToolbar
            query={query}
            onQuery={setQuery}
            filters={filters}
            selectedCount={checked.length}
            columnsOpen={columnsOpen}
            visibleColumns={visibleColumns}
            onColumnsOpen={setColumnsOpen}
            onVisibleColumns={setVisibleColumns}
            onFilter={updateFilter}
            onReset={() => {
              setQuery("");
              setFilters(initialFilters);
            }}
          />

          <BulkActions selected={checked} onClear={() => setChecked([])} onExport={exportCsv} />

          <UsersList
            users={filtered}
            now={now}
            selectedId={selected?.id}
            checked={checked}
            canManage={canManage}
            canSuspend={canSuspend}
            actorId={actorId}
            visibleColumns={visibleColumns}
            onSelect={setSelectedId}
            onCheck={toggleChecked}
          />
        </div>

        <UserSidePanel
          user={selected}
          plans={plans}
          now={now}
          canManage={canManage}
          canSuspend={canSuspend}
          actorId={actorId}
        />
      </section>
    </>
  );
}

function UsersHeader({
  total,
  canManage,
  plans,
  onExport,
}: {
  total: number;
  canManage: boolean;
  plans: PlanOption[];
  onExport: () => void;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--warning)]">
          Customer management
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">Contas</h1>
        <p className="mt-1.5 text-[14px] text-white/40">
          {total} contas carregadas. Gestao rapida sem abrir varias paginas.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onExport}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 px-4 text-[13px] font-semibold text-white/60 transition hover:border-[var(--chart-1)] hover:text-white"
        >
          <Download size={15} />
          Exportar
        </button>
        <button
          onClick={() => location.reload()}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 px-4 text-[13px] font-semibold text-white/60 transition hover:border-[var(--chart-1)] hover:text-white"
        >
          <RefreshCw size={15} />
          Atualizar
        </button>
        {canManage && <CreateUser plans={plans} />}
      </div>
    </header>
  );
}

function UsersStats({ users, now }: { users: UserRowData[]; now: number }) {
  const stats = [
    ["Total de contas", users.length, "perfis"],
    ["Contas ativas", users.filter((u) => u.status === "active").length, "estado ativo"],
    ["Suspensas", users.filter((u) => u.status === "suspended").length, "bloqueadas"],
    ["Owners", users.filter((u) => u.role === "owner").length, "acesso maximo"],
    ["Admins", users.filter((u) => u.role === "developer").length, "developer"],
    ["Special", users.filter((u) => u.tier === "special").length, "plano premium"],
    ["Ultimate", users.filter((u) => u.tier === "ultimate").length, "plano"],
    ["Life-time", users.filter((u) => hasLicense(u) && u.expires_at === null).length, "sem expirar"],
    ["Online agora", users.filter((u) => (u.client_seen_at ?? 0) >= now - 300).length, "5 min"],
    ["Ultimos registos", users.filter((u) => u.created_at >= now - 86400).length, "24 horas"],
  ];

  return (
    <div className="mt-6 grid overflow-hidden rounded-2xl border border-white/[0.07] bg-[var(--panel-surface)] sm:grid-cols-2 lg:grid-cols-5">
      {stats.map(([label, value, caption]) => (
        <div key={label} className="border-b border-r border-white/[0.06] p-4 last:border-r-0 lg:[&:nth-child(n+6)]:border-b-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">{label}</div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-white">{value}</div>
          <div className="mt-1 text-[11px] text-white/28">{caption}</div>
        </div>
      ))}
    </div>
  );
}

function UsersFilters({
  filters,
  counts,
  plans,
  onFilter,
}: {
  filters: Filters;
  counts: Record<FilterKey, number>;
  plans: PlanOption[];
  onFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
}) {
  return (
    <aside className="rounded-2xl border border-white/[0.07] bg-[var(--panel-surface)] p-3 xl:sticky xl:top-24 xl:h-[calc(100vh-8rem)] xl:overflow-y-auto">
      <div className="px-2 pb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--warning)]">
        Filtros rapidos
      </div>
      <div className="space-y-1">
        {quickFilters.map((item) => (
          <button
            key={item.key}
            onClick={() => onFilter("quick", item.key)}
            className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-[13px] transition ${
              filters.quick === item.key
                ? "border-[var(--chart-1)]/40 bg-[var(--chart-1)]/10 text-white"
                : "border-transparent text-white/45 hover:border-white/[0.06] hover:bg-white/[0.03] hover:text-white/75"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <span className={filters.quick === item.key ? "text-[var(--chart-1)]" : "text-white/30"}>
                {item.icon}
              </span>
              {item.label}
            </span>
            <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[11px] text-white/35">
              {counts[item.key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-2 border-t border-white/[0.06] pt-4">
        <SmallSelect value={filters.plan} onChange={(v) => onFilter("plan", v)}>
          <option value="all">Plano: todos</option>
          <option value="none">Sem plano</option>
          {plans.map((plan) => (
            <option key={plan.code} value={plan.code}>{plan.name}</option>
          ))}
        </SmallSelect>
        <SmallSelect value={filters.role} onChange={(v) => onFilter("role", v)}>
          <option value="all">Cargo: todos</option>
          {["member", "client", "staff", "developer", "owner"].map((role) => (
            <option key={role} value={role}>{role}</option>
          ))}
        </SmallSelect>
        <SmallSelect value={filters.status} onChange={(v) => onFilter("status", v)}>
          <option value="all">Estado: todos</option>
          <option value="active">Ativo</option>
          <option value="suspended">Suspenso</option>
        </SmallSelect>
      </div>
    </aside>
  );
}

function UsersToolbar({
  query,
  onQuery,
  filters,
  selectedCount,
  columnsOpen,
  visibleColumns,
  onColumnsOpen,
  onVisibleColumns,
  onFilter,
  onReset,
}: {
  query: string;
  onQuery: (value: string) => void;
  filters: Filters;
  selectedCount: number;
  columnsOpen: boolean;
  visibleColumns: string[];
  onColumnsOpen: (open: boolean) => void;
  onVisibleColumns: (columns: string[]) => void;
  onFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  onReset: () => void;
}) {
  function toggleColumn(column: string) {
    onVisibleColumns(
      visibleColumns.includes(column)
        ? visibleColumns.filter((item) => item !== column)
        : [...visibleColumns, column],
    );
  }

  return (
    <div className="sticky top-16 z-10 border-b border-white/[0.07] bg-[var(--panel-surface)]/95 p-4 backdrop-blur">
      <UsersSearch query={query} onQuery={onQuery} />
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <SmallSelect value={filters.license} onChange={(v) => onFilter("license", v)}>
          <option value="all">Licenca: todas</option>
          <option value="active">Ativa</option>
          <option value="expired">Expirada</option>
          <option value="lifetime">Life-time</option>
          <option value="none">Sem licenca</option>
        </SmallSelect>
        <SmallSelect value={filters.lastLogin} onChange={(v) => onFilter("lastLogin", v)}>
          <option value="all">Ultimo login: todos</option>
          <option value="online">Online agora</option>
          <option value="24h">Ultimas 24h</option>
          <option value="7d">Ultimos 7 dias</option>
          <option value="never">Nunca</option>
        </SmallSelect>
        <SmallSelect value={filters.discord} onChange={(v) => onFilter("discord", v)}>
          <option value="all">Discord: todos</option>
          <option value="linked">Ligado</option>
          <option value="missing">Por ligar</option>
        </SmallSelect>
        <SmallSelect value={filters.sort} onChange={(v) => onFilter("sort", v)}>
          <option value="recent">Mais recente</option>
          <option value="old">Mais antigo</option>
          <option value="name">Nome</option>
          <option value="login">Ultimo login</option>
          <option value="plan">Plano</option>
          <option value="created">Data criacao</option>
        </SmallSelect>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/30">
        <span>{selectedCount > 0 ? `${selectedCount} selecionado(s)` : "Seleciona linhas para acoes em massa."}</span>
        <div className="relative flex items-center gap-2">
          <button
            onClick={() => onColumnsOpen(!columnsOpen)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-white/45 transition hover:border-[var(--chart-1)] hover:text-white"
          >
            <Columns3 size={12} />
            Colunas
          </button>
          {columnsOpen && (
            <div className="absolute right-16 top-8 z-30 w-56 rounded-xl border border-white/[0.08] bg-[#080808] p-2 shadow-2xl">
              {columns.map((column) => (
                <label key={column} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] text-white/55 hover:bg-white/[0.04]">
                  <input
                    type="checkbox"
                    checked={visibleColumns.includes(column)}
                    onChange={() => toggleColumn(column)}
                    className="h-3.5 w-3.5 accent-[var(--chart-1)]"
                  />
                  {column}
                </label>
              ))}
            </div>
          )}
          <button
            onClick={onReset}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-white/45 transition hover:border-[var(--chart-1)] hover:text-white"
          >
            <RefreshCw size={12} />
            Limpar
          </button>
        </div>
      </div>
    </div>
  );
}

function UsersSearch({ query, onQuery }: { query: string; onQuery: (value: string) => void }) {
  return (
    <label className="relative block">
      <span className="sr-only">Pesquisar contas</span>
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
      <input
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder="Pesquisar por nome, Discord, ID, hardware, plano, licenca, token ou email"
        className="h-11 w-full rounded-xl border border-white/[0.08] bg-[var(--panel-surface-2)] pl-9 pr-3 text-[13px] text-white outline-none transition placeholder:text-white/25 focus:border-[var(--chart-1)]"
      />
    </label>
  );
}

function BulkActions({
  selected,
  onClear,
  onExport,
}: {
  selected: number[];
  onClear: () => void;
  onExport: () => void;
}) {
  if (!selected.length) return null;

  return (
    <div className="border-b border-white/[0.07] bg-[var(--chart-1)]/[0.06] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[12px] font-semibold text-[var(--chart-1)]">
          {selected.length} conta(s) selecionada(s)
        </div>
        <div className="flex flex-wrap gap-2">
          {["Alterar plano", "Alterar licenca", "Suspender", "Banir", "Notificacao", "Email", "Revogar licenca"].map((action) => (
            <button key={action} className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-[11px] font-semibold text-white/55 transition hover:border-[var(--chart-1)] hover:text-white">
              {action}
            </button>
          ))}
          <button onClick={onExport} className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-[11px] font-semibold text-white/55 transition hover:border-[var(--chart-1)] hover:text-white">
            Exportar
          </button>
          <button onClick={onClear} className="rounded-lg px-3 py-1.5 text-[11px] text-white/35 hover:text-white">
            Limpar
          </button>
        </div>
      </div>
    </div>
  );
}

function UsersList({
  users,
  now,
  selectedId,
  checked,
  canManage,
  canSuspend,
  actorId,
  visibleColumns,
  onSelect,
  onCheck,
}: {
  users: UserRowData[];
  now: number;
  selectedId?: number;
  checked: number[];
  canManage: boolean;
  canSuspend: boolean;
  actorId: number;
  visibleColumns: string[];
  onSelect: (id: number) => void;
  onCheck: (id: number) => void;
}) {
  if (!users.length) {
    return (
      <div className="grid min-h-[420px] place-items-center p-8 text-center">
        <div>
          <Users size={26} className="mx-auto text-white/25" />
          <h2 className="mt-3 text-[15px] font-semibold text-white">Nenhuma conta encontrada.</h2>
          <p className="mt-1 text-[12.5px] text-white/35">Ajusta a pesquisa ou cria uma nova conta.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-h-[calc(100vh-19rem)] overflow-y-auto p-2">
      <div className="grid grid-cols-[34px_minmax(250px,1.5fr)_100px_100px_112px_120px_44px] gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.13em] text-white/28">
        <span />
        <span>Utilizador</span>
        <span>Plano</span>
        <span>Cargo</span>
        <span>Estado</span>
        <span>Licenca</span>
        <span />
      </div>
      <div className="space-y-1.5">
        {users.map((user) => (
          <UserRow
            key={user.id}
            user={user}
            now={now}
            selected={selectedId === user.id}
            checked={checked.includes(user.id)}
            canManage={canManage}
            canSuspend={canSuspend}
            actorId={actorId}
            visibleColumns={visibleColumns}
            onSelect={() => onSelect(user.id)}
            onCheck={() => onCheck(user.id)}
          />
        ))}
      </div>
    </div>
  );
}

function UserRow({
  user,
  now,
  selected,
  checked,
  canManage,
  canSuspend,
  actorId,
  visibleColumns,
  onSelect,
  onCheck,
}: {
  user: UserRowData;
  now: number;
  selected: boolean;
  checked: boolean;
  canManage: boolean;
  canSuspend: boolean;
  actorId: number;
  visibleColumns: string[];
  onSelect: () => void;
  onCheck: () => void;
}) {
  const canEdit = user.id !== actorId && (user.role !== "owner" || canManage);

  return (
    <article
      onClick={onSelect}
      className={`group grid cursor-pointer grid-cols-[34px_minmax(250px,1.5fr)_100px_100px_112px_120px_44px] items-center gap-2 rounded-xl border px-3 py-3 transition ${
        selected
          ? "border-[var(--chart-1)]/45 bg-[var(--chart-1)]/[0.08]"
          : "border-white/[0.06] bg-white/[0.018] hover:border-white/[0.12] hover:bg-white/[0.035]"
      }`}
    >
      <div onClick={(event) => event.stopPropagation()}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onCheck}
          className="h-4 w-4 rounded accent-[var(--chart-1)]"
          aria-label={`Selecionar ${user.username}`}
        />
      </div>
      <div className="flex min-w-0 items-center gap-3">
        {visibleColumns.includes("Avatar") && <Avatar user={user} size="sm" />}
        <div className="min-w-0">
          <h3 className="truncate text-[13px] font-semibold text-white">{user.discord_username ?? user.username}</h3>
          <div className="mt-0.5 flex min-w-0 items-center gap-2">
            <span className="truncate text-[11px] text-white/35">@{user.username}</span>
            {visibleColumns.includes("Discord") && user.discord_id && (
              <span className="text-[11px] text-[var(--good)]">Discord</span>
            )}
            {visibleColumns.includes("Hardware") && user.hwid && (
              <code className="font-mono text-[10.5px] text-white/24">{user.hwid.slice(0, 8)}</code>
            )}
            {visibleColumns.includes("Windows") && (
              <span className="text-[11px] text-white/22">{user.client_version ?? "sem versao"}</span>
            )}
          </div>
        </div>
      </div>
      <Badge label={user.tier ?? "Sem plano"} tone={tierTone(user.tier)} />
      <Badge label={roleLabel(user.role)} tone={roleTone(user.role)} />
      <StatusBadge status={user.status} />
      <span className="text-[12px] tabular-nums text-white/45">{licenseText(user, now)}</span>
      <UserQuickActions user={user} canEdit={canEdit} canSuspend={canSuspend} />
    </article>
  );
}

function UserQuickActions({
  user,
  canEdit,
  canSuspend,
}: {
  user: UserRowData;
  canEdit: boolean;
  canSuspend: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex justify-end" onClick={(event) => event.stopPropagation()}>
      <button
        onClick={() => setOpen(!open)}
        className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.08] text-white/45 transition hover:border-[var(--chart-1)] hover:text-white"
        title="Acoes rapidas"
        aria-label="Acoes rapidas"
      >
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-30 w-48 rounded-xl border border-white/[0.08] bg-[#080808] p-1.5 shadow-2xl">
          {user.hwid && (
            <form action={resetHwidAction}>
              <input type="hidden" name="userId" value={user.id} />
              <MenuButton icon={<Monitor size={13} />} label="Reset hardware" />
            </form>
          )}
          {canEdit && canSuspend && (
            <form action={setUserStatusAction}>
              <input type="hidden" name="userId" value={user.id} />
              <input type="hidden" name="status" value={user.status === "active" ? "suspended" : "active"} />
              <MenuButton icon={<Ban size={13} />} label={user.status === "active" ? "Suspender" : "Reativar"} danger={user.status === "active"} />
            </form>
          )}
          <MenuButton icon={<MessageSquare size={13} />} label="Mensagem" />
        </div>
      )}
    </div>
  );
}

function UserSidePanel({
  user,
  plans,
  now,
  canManage,
  canSuspend,
  actorId,
}: {
  user: UserRowData | null;
  plans: PlanOption[];
  now: number;
  canManage: boolean;
  canSuspend: boolean;
  actorId: number;
}) {
  if (!user) {
    return (
      <aside className="rounded-2xl border border-dashed border-white/[0.08] bg-[var(--panel-surface)] p-6 xl:sticky xl:top-24 xl:h-[calc(100vh-8rem)]">
        <div className="grid h-full place-items-center text-center">
          <div>
            <UserRound size={26} className="mx-auto text-white/25" />
            <p className="mt-3 text-[13px] font-semibold text-white/60">Seleciona uma conta</p>
            <p className="mt-1 text-[12px] text-white/32">O perfil rapido aparece aqui.</p>
          </div>
        </div>
      </aside>
    );
  }

  const canEdit = user.id !== actorId && (user.role !== "owner" || canManage);

  return (
    <aside className="rounded-2xl border border-white/[0.07] bg-[var(--panel-surface)] xl:sticky xl:top-24 xl:h-[calc(100vh-8rem)]">
      <div className="flex h-full flex-col">
        <div className="border-b border-white/[0.07] p-5">
          <div className="flex items-start gap-3">
            <Avatar user={user} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <h2 className="truncate text-[18px] font-bold text-white">{user.discord_username ?? user.username}</h2>
                <Badge label={roleLabel(user.role)} tone={roleTone(user.role)} />
              </div>
              <p className="mt-1 text-[12px] text-white/35">@{user.username}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge label={user.tier ?? "Sem plano"} tone={tierTone(user.tier)} />
                <StatusBadge status={user.status} />
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <QuickButton icon={<SlidersHorizontal size={13} />} label="Editar" />
            <QuickButton icon={<KeyRound size={13} />} label="Plano" />
            <QuickButton icon={<Receipt size={13} />} label="Licenca" />
            {canEdit && canSuspend ? (
              <form action={setUserStatusAction}>
                <input type="hidden" name="userId" value={user.id} />
                <input type="hidden" name="status" value={user.status === "active" ? "suspended" : "active"} />
                <QuickButton icon={<Ban size={13} />} label={user.status === "active" ? "Suspender" : "Reativar"} danger={user.status === "active"} />
              </form>
            ) : (
              <QuickButton icon={<Ban size={13} />} label="Suspender" disabled />
            )}
            <QuickButton icon={<Shield size={13} />} label="Banir" disabled />
            <QuickButton icon={<MessageSquare size={13} />} label="Mensagem" />
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <UserSummary user={user} now={now} />
          <UserLicense user={user} plans={plans} now={now} canManage={canManage} />
          <UserDevices user={user} />
          <UserSecurity user={user} />
          <UserPurchases />
          <UserTimeline user={user} />
          <UserNotes userId={user.id} />
          <Permissions user={user} />
        </div>
      </div>
    </aside>
  );
}

function UserSummary({ user, now }: { user: UserRowData; now: number }) {
  const days = Math.max(0, Math.ceil((now - user.created_at) / 86400));
  const rows = [
    ["Dias ativo", `${days}`],
    ["Compras", "0"],
    ["Tickets", "API futura"],
    ["Dispositivos", user.hwid ? "1" : "0"],
    ["Sessoes", user.client_seen_at ? "1" : "0"],
    ["Ultimo login", user.client_seen_at ? formatDate(user.client_seen_at) : "sem registo"],
  ];
  return <MiniGrid title="Resumo" icon={<Users size={14} />} rows={rows} />;
}

function UserLicense({
  user,
  plans,
  now,
  canManage,
}: {
  user: UserRowData;
  plans: PlanOption[];
  now: number;
  canManage: boolean;
}) {
  return (
    <PanelSection title="Licenca" icon={<KeyRound size={14} />}>
      <InfoRows
        rows={[
          ["Plano", user.tier ?? "Sem plano"],
          ["Tipo", hasLicense(user) && user.expires_at === null ? "Life-time" : "Por dias"],
          ["Estado", licenseText(user, now)],
          ["Expiracao", !hasLicense(user) ? "sem licenca" : user.expires_at === null ? "life-time" : formatDate(user.expires_at)],
          ["Data criacao", formatDate(user.created_at)],
          ["Quem atribuiu", user.tier_source === "manual" ? "Administracao" : "Discord"],
          ["Ultima alteracao", "Preparado para API"],
        ]}
      />
      <div className="mt-3 grid grid-cols-3 gap-2">
        <QuickButton icon={<SlidersHorizontal size={13} />} label="Editar" disabled={!canManage || !plans.length} />
        <QuickButton icon={<RefreshCw size={13} />} label="Renovar" disabled={!canManage} />
        <QuickButton icon={<X size={13} />} label="Revogar" danger disabled={!canManage} />
      </div>
    </PanelSection>
  );
}

function UserDevices({ user }: { user: UserRowData }) {
  return (
    <PanelSection title="Dispositivos" icon={<HardDrive size={14} />}>
      {user.hwid ? (
        <div className="rounded-xl border border-white/[0.06] bg-black/15 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-[12.5px] font-semibold text-white">PC associado</h3>
              <code className="mt-1 block truncate font-mono text-[10.5px] text-white/35">{user.hwid}</code>
            </div>
            <Badge label={user.client_seen_at ? "Ativo" : "Pendente"} tone={user.client_seen_at ? "safe" : "neutral"} />
          </div>
          <InfoRows
            compact
            rows={[
              ["Windows", "Preparado para API"],
              ["Versao Orion", user.client_version ?? "sem versao"],
              ["Ultima ligacao", user.client_seen_at ? formatDate(user.client_seen_at) : "sem registo"],
              ["Estado", user.client_seen_at ? "Ligado" : "Sem heartbeat"],
            ]}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <QuickButton icon={<Monitor size={13} />} label="Ver" />
            <form action={resetHwidAction}>
              <input type="hidden" name="userId" value={user.id} />
              <QuickButton icon={<RefreshCw size={13} />} label="Reset Hardware" />
            </form>
            <QuickButton icon={<X size={13} />} label="Remover" danger />
          </div>
        </div>
      ) : (
        <EmptyLine text="Nenhum computador associado." />
      )}
    </PanelSection>
  );
}

function UserSecurity({ user }: { user: UserRowData }) {
  return (
    <PanelSection title="Seguranca" icon={<Shield size={14} />}>
      <InfoRows
        rows={[
          ["Discord", user.discord_id ? user.discord_id : "nao ligado"],
          ["Password Windows", "guardada em colecao privada"],
          ["Tokens", "ativos via API futura"],
          ["Sessoes", user.client_seen_at ? "Optimizer recente" : "sem sessao recente"],
          ["Ultimo IP", "Preparado para API"],
          ["Ultimo navegador", "Preparado para API"],
          ["Ultimo dispositivo", user.hwid ?? "nenhum"],
        ]}
      />
      <div className="mt-3 grid grid-cols-3 gap-2">
        <QuickButton icon={<X size={13} />} label="Terminar" />
        <QuickButton icon={<KeyRound size={13} />} label="Reset Pass" />
        <QuickButton icon={<RefreshCw size={13} />} label="Reset Token" />
      </div>
    </PanelSection>
  );
}

function UserPurchases() {
  return (
    <PanelSection title="Compras" icon={<Receipt size={14} />}>
      <EmptyLine text="Historico preparado para plano, preco, metodo, estado, data e fatura." />
    </PanelSection>
  );
}

function UserTimeline({ user }: { user: UserRowData }) {
  const events = [
    ["Hoje", user.client_seen_at ? "Optimizer ligado" : "Sem atividade recente"],
    ["Criacao", `Conta criada em ${formatDate(user.created_at)}`],
    ["Discord", user.discord_id ? "Discord ligado" : "Discord por ligar"],
  ];
  return (
    <PanelSection title="Atividade" icon={<History size={14} />}>
      <div className="space-y-3">
        {events.map(([time, text]) => (
          <div key={`${time}-${text}`} className="relative pl-4">
            <span className="absolute left-0 top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--chart-1)]" />
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/28">{time}</div>
            <div className="mt-0.5 text-[12px] text-white/55">{text}</div>
          </div>
        ))}
      </div>
    </PanelSection>
  );
}

function UserNotes({ userId }: { userId: number }) {
  const key = `orion-users-note-${userId}`;
  const [value, setValue] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(key) ?? "";
  });
  return (
    <PanelSection title="Notas internas" icon={<MessageSquare size={14} />}>
      <textarea
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          localStorage.setItem(key, event.target.value);
        }}
        placeholder="Cliente VIP, acesso Beta, suporte especial..."
        className="min-h-24 w-full resize-none rounded-xl border border-white/[0.08] bg-[var(--panel-surface-2)] p-3 text-[12.5px] text-white outline-none placeholder:text-white/25 focus:border-[var(--chart-1)]"
      />
    </PanelSection>
  );
}

function Permissions({ user }: { user: UserRowData }) {
  const permissions = [
    ["Owner", user.role === "owner"],
    ["Admin", user.role === "developer" || user.role === "owner"],
    ["Staff", ["staff", "developer", "owner"].includes(user.role)],
    ["Support", ["staff", "developer", "owner"].includes(user.role)],
    ["Beta", false],
    ["Special", user.tier === "special"],
    ["Website", true],
    ["API", user.status === "active"],
  ];
  return (
    <PanelSection title="Permissoes" icon={<ShieldCheck size={14} />}>
      <div className="flex flex-wrap gap-1.5">
        {permissions.map(([label, active]) => (
          <Badge key={String(label)} label={String(label)} tone={active ? "safe" : "neutral"} />
        ))}
      </div>
    </PanelSection>
  );
}

function MiniGrid({ title, icon, rows }: { title: string; icon: ReactNode; rows: string[][] }) {
  return (
    <PanelSection title={title} icon={icon}>
      <div className="grid grid-cols-2 gap-2">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/[0.06] bg-black/15 p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/28">{label}</div>
            <div className="mt-1 text-[13px] font-semibold text-white">{value}</div>
          </div>
        ))}
      </div>
    </PanelSection>
  );
}

function PanelSection({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-white/[0.06] bg-white/[0.018] p-4">
      <h3 className="mb-3 flex items-center gap-2 text-[12px] font-semibold text-white">
        <span className="text-[var(--chart-1)]">{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function InfoRows({ rows, compact }: { rows: string[][]; compact?: boolean }) {
  return (
    <div className={compact ? "mt-3 space-y-2" : "space-y-2"}>
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-start justify-between gap-3 border-b border-white/[0.05] pb-2 text-[12px] last:border-b-0 last:pb-0">
          <span className="text-white/30">{label}</span>
          <span className="max-w-[58%] break-words text-right text-white/58">{value}</span>
        </div>
      ))}
    </div>
  );
}

function Avatar({ user, size }: { user: UserRowData; size: "sm" | "lg" }) {
  const cls = size === "lg" ? "h-14 w-14 rounded-2xl" : "h-9 w-9 rounded-lg";
  return (
    <div className={`grid shrink-0 place-items-center overflow-hidden border border-white/[0.08] bg-white/[0.04] text-white/40 ${cls}`}>
      {user.discord_avatar_url ? (
        <img src={user.discord_avatar_url} alt="" className="h-full w-full object-cover" />
      ) : (
        <UserRound size={size === "lg" ? 24 : 16} />
      )}
    </div>
  );
}

function QuickButton({
  icon,
  label,
  danger,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      className={`inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border px-2 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-35 ${
        danger
          ? "border-[var(--critical)]/25 text-[var(--critical)] hover:bg-[var(--critical)]/10"
          : "border-white/[0.08] text-white/55 hover:border-[var(--chart-1)] hover:text-white"
      }`}
      title={label}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

function MenuButton({ icon, label, danger }: { icon: ReactNode; label: string; danger?: boolean }) {
  return (
    <button className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] transition ${
      danger ? "text-[var(--critical)] hover:bg-[var(--critical)]/10" : "text-white/58 hover:bg-white/[0.05] hover:text-white"
    }`}>
      {icon}
      {label}
    </button>
  );
}

function SmallSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="relative">
      <span className="sr-only">Filtro</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full appearance-none rounded-lg border border-white/[0.08] bg-[var(--panel-surface-2)] px-3 text-[12px] text-white outline-none transition focus:border-[var(--chart-1)]"
      >
        {children}
      </select>
    </label>
  );
}

function Badge({ label, tone = "neutral" }: { label: string; tone?: string }) {
  const styles: Record<string, string> = {
    basic: "border-[var(--good)]/25 bg-[var(--good)]/10 text-[var(--good)]",
    pro: "border-sky-400/25 bg-sky-400/10 text-sky-200",
    ultimate: "border-[var(--chart-1)]/30 bg-[var(--chart-1)]/12 text-[var(--chart-1)]",
    special: "border-[var(--warning)]/35 bg-[var(--warning)]/12 text-[var(--warning)]",
    owner: "border-[var(--warning)]/35 bg-[var(--warning)]/12 text-[var(--warning)]",
    developer: "border-sky-400/25 bg-sky-400/10 text-sky-200",
    staff: "border-white/[0.12] bg-white/[0.06] text-white/62",
    safe: "border-[var(--good)]/25 bg-[var(--good)]/10 text-[var(--good)]",
    neutral: "border-white/[0.08] bg-white/[0.045] text-white/48",
  };
  return (
    <span className={`inline-flex h-6 max-w-full items-center truncate rounded-full border px-2.5 text-[10.5px] font-semibold ${styles[tone] ?? styles.neutral}`}>
      {label}
    </span>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-white/[0.08] px-3 py-5 text-center text-[12px] text-white/32">{text}</p>;
}

function buildCounts(users: UserRowData[], now: number): Record<FilterKey, number> {
  return {
    all: users.length,
    active: users.filter((u) => u.status === "active").length,
    suspended: users.filter((u) => u.status === "suspended").length,
    banned: users.filter((u) => u.status === "banned").length,
    no_license: users.filter((u) => !hasLicense(u)).length,
    lifetime: users.filter((u) => hasLicense(u) && u.expires_at === null).length,
    basic: users.filter((u) => u.tier === "basic").length,
    pro: users.filter((u) => u.tier === "pro").length,
    ultimate: users.filter((u) => u.tier === "ultimate").length,
    special: users.filter((u) => u.tier === "special").length,
    owner: users.filter((u) => u.role === "owner").length,
    developer: users.filter((u) => u.role === "developer").length,
    staff: users.filter((u) => u.role === "staff").length,
    discord: users.filter((u) => u.discord_id).length,
    machine: users.filter((u) => u.hwid).length,
    recent: users.filter((u) => (u.client_seen_at ?? 0) >= now - 86400 * 7).length,
    region: 0,
    windows: users.filter((u) => u.client_version).length,
  };
}

function matchesQuick(user: UserRowData, quick: FilterKey, now: number) {
  if (quick === "all") return true;
  if (quick === "active") return user.status === "active";
  if (quick === "suspended") return user.status === "suspended";
  if (quick === "banned") return user.status === "banned";
  if (quick === "no_license") return !hasLicense(user);
  if (quick === "lifetime") return hasLicense(user) && user.expires_at === null;
  if (["basic", "pro", "ultimate", "special"].includes(quick)) return user.tier === quick;
  if (quick === "owner") return user.role === "owner";
  if (quick === "developer") return user.role === "developer";
  if (quick === "staff") return user.role === "staff";
  if (quick === "discord") return !!user.discord_id;
  if (quick === "machine") return !!user.hwid;
  if (quick === "recent") return (user.client_seen_at ?? 0) >= now - 86400 * 7;
  if (quick === "windows") return !!user.client_version;
  if (quick === "region") return false;
  return true;
}

function matchesLastLogin(user: UserRowData, value: string, now: number) {
  const seen = user.client_seen_at ?? 0;
  if (value === "online") return seen >= now - 300;
  if (value === "24h") return seen >= now - 86400;
  if (value === "7d") return seen >= now - 86400 * 7;
  if (value === "never") return !seen;
  return true;
}

function sortUsers(users: UserRowData[], sort: string) {
  const copy = [...users];
  if (sort === "name") return copy.sort((a, b) => a.username.localeCompare(b.username, "pt"));
  if (sort === "old") return copy.sort((a, b) => a.created_at - b.created_at);
  if (sort === "login") return copy.sort((a, b) => (b.client_seen_at ?? 0) - (a.client_seen_at ?? 0));
  if (sort === "plan") return copy.sort((a, b) => (a.tier ?? "zz").localeCompare(b.tier ?? "zz", "pt"));
  return copy.sort((a, b) => b.created_at - a.created_at);
}

function hasLicense(user: UserRowData) {
  return user.tier !== null || user.expires_at !== null;
}

function licenseKind(user: UserRowData, now: number) {
  if (!hasLicense(user)) return "none";
  if (user.expires_at === null) return "lifetime";
  if (user.expires_at > now) return "active";
  return "expired";
}

function licenseText(user: UserRowData, now: number) {
  const kind = licenseKind(user, now);
  if (kind === "none") return "sem licenca";
  if (kind === "lifetime") return "life-time";
  if (kind === "active" && user.expires_at) return `${Math.ceil((user.expires_at - now) / 86400)} dias`;
  return "expirada";
}

function tierTone(tier: string | null) {
  if (tier === "basic" || tier === "pro" || tier === "ultimate" || tier === "special") return tier;
  return "neutral";
}

function roleTone(role: string) {
  if (role === "owner" || role === "developer" || role === "staff") return role;
  return "neutral";
}

function roleLabel(role: string) {
  if (role === "developer") return "Admin";
  return role;
}

function formatDate(seconds: number) {
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(seconds * 1000));
}
