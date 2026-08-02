"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  BadgeCheck,
  Blocks,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  Cpu,
  Database,
  FileClock,
  Filter,
  Gauge,
  HardDrive,
  History,
  Monitor,
  MoreHorizontal,
  Network,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Star,
  Trash2,
  Undo2,
  X,
  Zap,
} from "lucide-react";
import TweakEditor from "./TweakEditor";
import { cloneTweakAction, deleteTweakAction, toggleTweakAction } from "../../catalog-actions";
import {
  TIER_LABELS,
  isTweakEnabled,
  minimumTierForTweak,
  type OptimizerTier,
} from "@/lib/optimizer-access";
import type { Tweak } from "@/lib/catalog";

type CategoryKey =
  | "all"
  | "system"
  | "network"
  | "cpu"
  | "gpu"
  | "ram"
  | "ssd"
  | "power"
  | "game"
  | "privacy"
  | "windows"
  | "drivers"
  | "favorites"
  | "recent";

type FilterState = {
  category: CategoryKey;
  tier: "all" | OptimizerTier;
  layer: "all" | "0" | "1";
  gpu: "all" | "NVIDIA" | "AMD" | "Intel" | "integrated" | "dedicated";
  windows: "all" | "win10" | "win11";
  status: "all" | "enabled" | "disabled";
  impact: "all" | string;
  risk: "all" | string;
  rollback: "all" | "yes" | "no";
  sort: "name" | "recent" | "old" | "used" | "popular" | "changed";
};

const CATEGORY_META: Array<{
  key: CategoryKey;
  label: string;
  icon: ReactNode;
  aliases?: string[];
}> = [
  { key: "all", label: "Todos", icon: <Blocks size={15} /> },
  { key: "system", label: "Sistema", icon: <Monitor size={15} />, aliases: ["system", "mmcss"] },
  { key: "network", label: "Rede", icon: <Network size={15} />, aliases: ["network", "net", "dns"] },
  { key: "cpu", label: "CPU", icon: <Cpu size={15} />, aliases: ["cpu", "processor"] },
  { key: "gpu", label: "GPU", icon: <Gauge size={15} />, aliases: ["gpu", "nvidia", "amd", "intel"] },
  { key: "ram", label: "RAM", icon: <Activity size={15} />, aliases: ["ram", "memory"] },
  { key: "ssd", label: "SSD", icon: <HardDrive size={15} />, aliases: ["ssd", "disk", "storage"] },
  { key: "power", label: "Energia", icon: <Zap size={15} />, aliases: ["power", "energy"] },
  { key: "game", label: "Jogos", icon: <Sparkles size={15} />, aliases: ["game", "games", "fortnite"] },
  { key: "privacy", label: "Privacidade", icon: <Shield size={15} />, aliases: ["privacy"] },
  { key: "windows", label: "Windows", icon: <Monitor size={15} />, aliases: ["windows", "win"] },
  { key: "drivers", label: "Drivers", icon: <Database size={15} />, aliases: ["drivers", "driver"] },
  { key: "favorites", label: "Favoritos", icon: <Star size={15} /> },
  { key: "recent", label: "Recentes", icon: <Clock3 size={15} /> },
];

const initialFilters: FilterState = {
  category: "all",
  tier: "all",
  layer: "all",
  gpu: "all",
  windows: "all",
  status: "all",
  impact: "all",
  risk: "all",
  rollback: "all",
  sort: "name",
};

export default function CatalogManager({
  tweaks,
  rules,
}: {
  tweaks: Tweak[];
  rules: Array<{ pattern: string; reason: string }>;
}) {
  const [editing, setEditing] = useState<Tweak | "new" | null>(null);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [selectedId, setSelectedId] = useState(tweaks[0]?.id ?? "");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);

  const categoryCounts = useMemo(() => buildCategoryCounts(tweaks), [tweaks]);
  const impacts = useMemo(() => uniqueValues(tweaks.map((t) => t.impact)), [tweaks]);
  const risks = useMemo(() => uniqueValues(tweaks.map((t) => t.risk)), [tweaks]);

  const filteredTweaks = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt");

    const result = tweaks.filter((tweak) => {
      const tier = minimumTierForTweak(tweak);
      const live = isTweakEnabled(tweak);
      const category = categoryForTweak(tweak);
      const hasRollback = tweak.actions.length > 0;
      const haystack = [
        tweak.name,
        tweak.id,
        tweak.description,
        category,
        tier,
        tweak.impact,
        tweak.risk,
        ...tweak.actions.map((a) => `${a.hive}\\${a.key}\\${a.name} ${a.kind} ${a.value}`),
      ]
        .join(" ")
        .toLocaleLowerCase("pt");

      const matchesCategory =
        filters.category === "all" ||
        filters.category === "favorites" ||
        filters.category === "recent" ||
        category === filters.category;
      const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
      const matchesTier = filters.tier === "all" || tier === filters.tier;
      const matchesLayer = filters.layer === "all" || String(tweak.layer) === filters.layer;
      const matchesGpu =
        filters.gpu === "all" ||
        tweak.conditions?.gpuVendor?.includes(filters.gpu as never) ||
        tweak.conditions?.gpuType?.includes(filters.gpu as never) ||
        (!tweak.conditions?.gpuVendor?.length && !tweak.conditions?.gpuType?.length);
      const matchesStatus =
        filters.status === "all" ||
        (filters.status === "enabled" ? live : !live);
      const matchesImpact = filters.impact === "all" || tweak.impact === filters.impact;
      const matchesRisk = filters.risk === "all" || tweak.risk === filters.risk;
      const matchesRollback =
        filters.rollback === "all" || (filters.rollback === "yes" ? hasRollback : !hasRollback);

      return (
        matchesCategory &&
        matchesQuery &&
        matchesTier &&
        matchesLayer &&
        matchesGpu &&
        matchesStatus &&
        matchesImpact &&
        matchesRisk &&
        matchesRollback
      );
    });

    return sortTweaks(result, filters.sort);
  }, [filters, query, tweaks]);

  const selected = filteredTweaks.find((t) => t.id === selectedId) ?? filteredTweaks[0] ?? null;
  const disabledCount = tweaks.filter((t) => !isTweakEnabled(t)).length;
  const compatibleCount = tweaks.filter((t) => !t.conditions?.gpuType?.length).length;
  const layer0Count = tweaks.filter((t) => t.layer === 0).length;
  const layer1Count = tweaks.filter((t) => t.layer >= 1).length;

  function updateFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <>
      <CatalogHeader onCreate={() => setEditing("new")} />

      <CatalogStats
        total={tweaks.length}
        layer0={layer0Count}
        layer1={layer1Count}
        compatible={compatibleCount}
        disabled={disabledCount}
      />

      <section className="mt-6 grid gap-4 xl:grid-cols-[230px_minmax(0,1fr)_360px]">
        <CategorySidebar
          active={filters.category}
          counts={categoryCounts}
          onChange={(category) => updateFilter("category", category)}
        />

        <div className="min-w-0 rounded-2xl border border-white/[0.07] bg-[var(--panel-surface)]">
          <CatalogToolbar
            query={query}
            onQuery={setQuery}
            filters={filters}
            impacts={impacts}
            risks={risks}
            onFilter={updateFilter}
            onReset={() => {
              setQuery("");
              setFilters(initialFilters);
            }}
          />

          <CatalogList
            tweaks={filteredTweaks}
            selectedId={selected?.id}
            confirming={confirming}
            openMenu={menu}
            onSelect={setSelectedId}
            onEdit={setEditing}
            onConfirm={setConfirming}
            onMenu={setMenu}
          />
        </div>

        <CatalogDetails tweak={selected} rules={rules} onEdit={setEditing} />
      </section>

      {editing && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[88vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-[var(--chart-1)]/20 bg-[var(--panel-bg)] shadow-2xl">
            <TweakEditor
              tweak={editing === "new" ? undefined : editing}
              onClose={() => setEditing(null)}
            />
          </div>
        </div>
      )}
    </>
  );
}

function CatalogHeader({ onCreate }: { onCreate: () => void }) {
  return (
    <header className="mt-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--warning)]">
          Asset manager
        </div>
        <h2 className="mt-2 text-[21px] font-bold tracking-tight text-white">
          Catalogo de Otimizacoes
        </h2>
        <p className="mt-1 text-[13px] text-white/40">
          Pesquisa, filtros, estados e registry num painel preparado para dados reais.
        </p>
      </div>
      <button
        onClick={onCreate}
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--chart-1)] px-4 text-[13px] font-semibold text-[#16082c] transition hover:-translate-y-0.5 hover:opacity-95"
      >
        <Plus size={15} />
        Novo Tweak
      </button>
    </header>
  );
}

function CatalogStats({
  total,
  layer0,
  layer1,
  compatible,
  disabled,
}: {
  total: number;
  layer0: number;
  layer1: number;
  compatible: number;
  disabled: number;
}) {
  const stats = [
    ["Total tweaks", total, "catalogo completo"],
    ["Layer 0", layer0, "sem elevacao"],
    ["Layer 1", layer1, "requer admin"],
    ["Compativeis", compatible, "sem filtro de GPU"],
    ["Ultima atualizacao", "Sessao", disabled ? `${disabled} suspensos` : "sem suspensos"],
  ];

  return (
    <div className="mt-5 grid overflow-hidden rounded-2xl border border-white/[0.07] bg-[var(--panel-surface)] sm:grid-cols-2 xl:grid-cols-5">
      {stats.map(([label, value, caption]) => (
        <div key={label} className="border-b border-r border-white/[0.06] p-4 last:border-r-0 xl:border-b-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
            {label}
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-white">{value}</div>
          <div className="mt-1 text-[11px] text-white/28">{caption}</div>
        </div>
      ))}
    </div>
  );
}

function CategorySidebar({
  active,
  counts,
  onChange,
}: {
  active: CategoryKey;
  counts: Record<CategoryKey, number>;
  onChange: (category: CategoryKey) => void;
}) {
  return (
    <aside className="rounded-2xl border border-white/[0.07] bg-[var(--panel-surface)] p-3 xl:sticky xl:top-24 xl:h-[calc(100vh-8rem)] xl:overflow-y-auto">
      <div className="px-2 pb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--warning)]">
        Categorias
      </div>
      <div className="space-y-1">
        {CATEGORY_META.map((item) => (
          <button
            key={item.key}
            onClick={() => onChange(item.key)}
            className={`group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[13px] transition ${
              active === item.key
                ? "border border-[var(--chart-1)]/40 bg-[var(--chart-1)]/10 text-white shadow-[0_0_24px_rgba(225,178,89,0.08)]"
                : "border border-transparent text-white/45 hover:border-white/[0.06] hover:bg-white/[0.03] hover:text-white/75"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <span className={active === item.key ? "text-[var(--chart-1)]" : "text-white/30"}>
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
    </aside>
  );
}

function CatalogToolbar({
  query,
  onQuery,
  filters,
  impacts,
  risks,
  onFilter,
  onReset,
}: {
  query: string;
  onQuery: (value: string) => void;
  filters: FilterState;
  impacts: string[];
  risks: string[];
  onFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  onReset: () => void;
}) {
  return (
    <div className="sticky top-16 z-10 border-b border-white/[0.07] bg-[var(--panel-surface)]/95 p-4 backdrop-blur">
      <CatalogSearch query={query} onQuery={onQuery} />
      <CatalogFilters filters={filters} impacts={impacts} risks={risks} onFilter={onFilter} />
      <div className="mt-3 flex items-center justify-between text-[11px] text-white/30">
        <span>Pesquisa instantanea em nome, descricao, categoria, registry e autor.</span>
        <button
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-white/45 transition hover:border-[var(--chart-1)] hover:text-white"
        >
          <RefreshCw size={12} />
          Limpar
        </button>
      </div>
    </div>
  );
}

function CatalogSearch({ query, onQuery }: { query: string; onQuery: (value: string) => void }) {
  return (
    <label className="relative block">
      <span className="sr-only">Pesquisar otimizacao</span>
      <Search
        size={15}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
      />
      <input
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder="Pesquisar por nome, descricao, registry, categoria ou autor"
        className="h-11 w-full rounded-xl border border-white/[0.08] bg-[var(--panel-surface-2)] pl-9 pr-3 text-[13px] text-white outline-none transition placeholder:text-white/25 focus:border-[var(--chart-1)]"
      />
    </label>
  );
}

function CatalogFilters({
  filters,
  impacts,
  risks,
  onFilter,
}: {
  filters: FilterState;
  impacts: string[];
  risks: string[];
  onFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
}) {
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2 2xl:grid-cols-4">
      <Select value={filters.tier} onChange={(v) => onFilter("tier", v as FilterState["tier"])}>
        <option value="all">Todos os planos</option>
        <option value="basic">Basic</option>
        <option value="pro">Pro</option>
        <option value="ultimate">Ultimate</option>
        <option value="special">Special</option>
      </Select>
      <Select value={filters.layer} onChange={(v) => onFilter("layer", v as FilterState["layer"])}>
        <option value="all">Todas as layers</option>
        <option value="0">Layer 0</option>
        <option value="1">Layer 1</option>
      </Select>
      <Select value={filters.gpu} onChange={(v) => onFilter("gpu", v as FilterState["gpu"])}>
        <option value="all">Todas as GPUs</option>
        <option value="NVIDIA">NVIDIA</option>
        <option value="AMD">AMD</option>
        <option value="Intel">Intel</option>
        <option value="integrated">Integrada</option>
        <option value="dedicated">Dedicada</option>
      </Select>
      <Select
        value={filters.windows}
        onChange={(v) => onFilter("windows", v as FilterState["windows"])}
      >
        <option value="all">Windows todos</option>
        <option value="win10">Windows 10</option>
        <option value="win11">Windows 11</option>
      </Select>
      <Select
        value={filters.status}
        onChange={(v) => onFilter("status", v as FilterState["status"])}
      >
        <option value="all">Todos os estados</option>
        <option value="enabled">Ativos</option>
        <option value="disabled">Desativados</option>
      </Select>
      <Select
        value={filters.impact}
        onChange={(v) => onFilter("impact", v as FilterState["impact"])}
      >
        <option value="all">Impacto todos</option>
        {impacts.map((impact) => (
          <option key={impact} value={impact}>
            Impacto {impact}
          </option>
        ))}
      </Select>
      <Select value={filters.risk} onChange={(v) => onFilter("risk", v as FilterState["risk"])}>
        <option value="all">Risco todos</option>
        {risks.map((risk) => (
          <option key={risk} value={risk}>
            Risco {risk}
          </option>
        ))}
      </Select>
      <Select value={filters.sort} onChange={(v) => onFilter("sort", v as FilterState["sort"])}>
        <option value="name">Ordenar por nome</option>
        <option value="recent">Mais recentes</option>
        <option value="old">Mais antigos</option>
        <option value="used">Mais usados</option>
        <option value="popular">Populares</option>
        <option value="changed">Ultima alteracao</option>
      </Select>
    </div>
  );
}

function CatalogList({
  tweaks,
  selectedId,
  confirming,
  openMenu,
  onSelect,
  onEdit,
  onConfirm,
  onMenu,
}: {
  tweaks: Tweak[];
  selectedId?: string;
  confirming: string | null;
  openMenu: string | null;
  onSelect: (id: string) => void;
  onEdit: (tweak: Tweak) => void;
  onConfirm: (id: string | null) => void;
  onMenu: (id: string | null) => void;
}) {
  if (!tweaks.length) return <CatalogEmpty />;

  return (
    <div className="max-h-[calc(100vh-18rem)] overflow-y-auto p-2">
      <div className="grid grid-cols-[minmax(260px,1.8fr)_98px_80px_105px_92px_102px_88px] gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.13em] text-white/28">
        <span>Otimizacao</span>
        <span>Plano</span>
        <span>Layer</span>
        <span>Impacto</span>
        <span>Risco</span>
        <span>Estado</span>
        <span className="text-right">Acoes</span>
      </div>
      <div className="space-y-1.5">
        {tweaks.map((tweak) => (
          <CatalogRow
            key={tweak.id}
            tweak={tweak}
            selected={selectedId === tweak.id}
            confirming={confirming === tweak.id}
            menuOpen={openMenu === tweak.id}
            onSelect={() => onSelect(tweak.id)}
            onEdit={() => onEdit(tweak)}
            onConfirm={() => onConfirm(tweak.id)}
            onCancel={() => onConfirm(null)}
            onMenu={() => onMenu(openMenu === tweak.id ? null : tweak.id)}
          />
        ))}
      </div>
    </div>
  );
}

function CatalogRow({
  tweak,
  selected,
  confirming,
  menuOpen,
  onSelect,
  onEdit,
  onConfirm,
  onCancel,
  onMenu,
}: {
  tweak: Tweak;
  selected: boolean;
  confirming: boolean;
  menuOpen: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  onMenu: () => void;
}) {
  const live = isTweakEnabled(tweak);
  const tier = minimumTierForTweak(tweak);
  const category = categoryForTweak(tweak);

  return (
    <article
      onClick={onSelect}
      className={`group relative grid cursor-pointer grid-cols-[minmax(260px,1.8fr)_98px_80px_105px_92px_102px_88px] items-center gap-2 rounded-xl border px-3 py-3 transition ${
        selected
          ? "border-[var(--chart-1)]/45 bg-[var(--chart-1)]/[0.08]"
          : live
            ? "border-white/[0.06] bg-white/[0.018] hover:border-white/[0.12] hover:bg-white/[0.035]"
            : "border-dashed border-[var(--warning)]/24 bg-white/[0.012] opacity-60 hover:opacity-80"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-[var(--panel-surface-2)] text-[var(--chart-1)]">
          {iconForCategory(category)}
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-[13px] font-semibold text-white">{tweak.name}</h3>
          <div className="mt-0.5 flex min-w-0 items-center gap-2">
            <code className="truncate font-mono text-[11px] text-white/30">{tweak.id}</code>
            <span className="text-[11px] text-white/22">{categoryLabel(category)}</span>
          </div>
        </div>
      </div>

      <Badge label={TIER_LABELS[tier]} tone={tier} />
      <Badge label={`Layer ${tweak.layer}`} tone={tweak.layer === 0 ? "safe" : "warning"} />
      <Badge label={impactLabel(tweak.impact)} tone={impactTone(tweak.impact)} />
      <Badge label={riskLabel(tweak.risk)} tone={riskTone(tweak.risk)} />
      <Badge label={live ? "Ativo" : "Desativado"} tone={live ? "safe" : "warning"} />

      <div className="relative flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onEdit}
          className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.08] text-white/45 transition hover:border-[var(--chart-1)] hover:text-white"
          title="Editar tweak"
          aria-label="Editar tweak"
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={onMenu}
          className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.08] text-white/45 transition hover:border-[var(--chart-1)] hover:text-white"
          title="Mais acoes"
          aria-label="Mais acoes"
        >
          <MoreHorizontal size={14} />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-9 z-20 w-44 rounded-xl border border-white/[0.08] bg-[#080808] p-1.5 shadow-2xl">
            <ActionForm id={tweak.id} action={cloneTweakAction} icon={<Copy size={13} />} label="Duplicar" />
            <ActionForm
              id={tweak.id}
              action={toggleTweakAction}
              icon={<Power size={13} />}
              label={live ? "Desativar" : "Ativar"}
            />
            {confirming ? (
              <div className="flex items-center gap-1 p-1">
                <ActionForm
                  id={tweak.id}
                  action={deleteTweakAction}
                  icon={<Trash2 size={13} />}
                  label="Confirmar"
                  danger
                />
                <button
                  type="button"
                  onClick={onCancel}
                  className="rounded-md px-2 py-1 text-[11px] text-white/40 hover:text-white"
                >
                  cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onConfirm}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] text-[var(--critical)] transition hover:bg-[var(--critical)]/10"
              >
                <Trash2 size={13} />
                Apagar
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function CatalogDetails({
  tweak,
  rules,
  onEdit,
}: {
  tweak: Tweak | null;
  rules: Array<{ pattern: string; reason: string }>;
  onEdit: (tweak: Tweak) => void;
}) {
  if (!tweak) {
    return (
      <aside className="rounded-2xl border border-dashed border-white/[0.08] bg-[var(--panel-surface)] p-6 xl:sticky xl:top-24 xl:h-[calc(100vh-8rem)]">
        <CatalogEmpty compact />
      </aside>
    );
  }

  const live = isTweakEnabled(tweak);
  const tier = minimumTierForTweak(tweak);
  const category = categoryForTweak(tweak);

  return (
    <aside className="rounded-2xl border border-white/[0.07] bg-[var(--panel-surface)] xl:sticky xl:top-24 xl:h-[calc(100vh-8rem)]">
      <div className="flex h-full flex-col">
        <div className="border-b border-white/[0.07] p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--warning)]">
                Detalhe
              </div>
              <h2 className="mt-2 text-[18px] font-bold leading-tight text-white">{tweak.name}</h2>
              <code className="mt-1 block truncate font-mono text-[11px] text-white/30">
                {tweak.id}
              </code>
            </div>
            <button
              onClick={() => onEdit(tweak)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/[0.08] text-white/45 transition hover:border-[var(--chart-1)] hover:text-white"
              title="Editar"
              aria-label="Editar"
            >
              <Pencil size={14} />
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            <Badge label={TIER_LABELS[tier]} tone={tier} />
            <Badge label={`Layer ${tweak.layer}`} tone={tweak.layer === 0 ? "safe" : "warning"} />
            <Badge label={live ? "Ativo" : "Desativado"} tone={live ? "safe" : "warning"} />
            {tweak.requiresReboot && <Badge label="Reinicio" tone="warning" />}
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <DetailSection title="Descricao" icon={<FileClock size={14} />}>
            <p className="text-[12.5px] leading-relaxed text-white/48">{tweak.description}</p>
          </DetailSection>

          <CompatibilityCard tweak={tweak} category={category} />
          <RegistryViewer actions={tweak.actions} />
          <RollbackCard tweak={tweak} />
          <DependenciesCard tweak={tweak} />

          <DetailSection title="Historico" icon={<History size={14} />}>
            <div className="space-y-2 text-[12px] text-white/38">
              <MetaRow label="Ultima atualizacao" value="Catalogo atual" />
              <MetaRow label="Criador" value="Admin Orion" />
              <MetaRow label="Alteracoes" value={`${tweak.actions.length}`} />
            </div>
          </DetailSection>

          <DetailSection title="Caminhos bloqueados" icon={<Shield size={14} />}>
            <div className="space-y-2">
              {rules.map((rule) => (
                <div key={rule.pattern} className="rounded-lg bg-white/[0.03] p-2">
                  <code className="block truncate font-mono text-[10.5px] text-[var(--warning)]">
                    {rule.pattern}
                  </code>
                  <p className="mt-1 text-[11px] leading-relaxed text-white/32">{rule.reason}</p>
                </div>
              ))}
            </div>
          </DetailSection>
        </div>
      </div>
    </aside>
  );
}

function RegistryViewer({ actions }: { actions: Tweak["actions"] }) {
  return (
    <DetailSection title="Alteracoes registry" icon={<Database size={14} />}>
      <div className="space-y-2">
        {actions.map((action, index) => (
          <div key={`${action.hive}-${action.key}-${action.name}-${index}`} className="rounded-lg border border-white/[0.06] bg-black/20 p-3">
            <div className="font-mono text-[10.5px] leading-relaxed text-white/42">
              <span className="text-[var(--warning)]">{action.hive}</span>\{action.key}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge label={action.kind} />
              <Badge label={action.name} tone="neutral" />
              <Badge label={String(action.value)} tone="safe" />
            </div>
          </div>
        ))}
      </div>
    </DetailSection>
  );
}

function RollbackCard({ tweak }: { tweak: Tweak }) {
  return (
    <DetailSection title="Rollback" icon={<Undo2 size={14} />}>
      <div className="rounded-xl border border-[var(--good)]/20 bg-[var(--good)]/[0.05] p-3">
        <div className="flex items-center gap-2 text-[12px] font-semibold text-[var(--good)]">
          <CheckCircle2 size={14} />
          Preparado
        </div>
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-white/36">
          O cliente guarda o estado anterior das {tweak.actions.length} alteracoes antes de aplicar.
        </p>
      </div>
    </DetailSection>
  );
}

function CompatibilityCard({ tweak, category }: { tweak: Tweak; category: CategoryKey }) {
  const vendors = tweak.conditions?.gpuVendor?.join(", ") || "Todas";
  const gpuTypes =
    tweak.conditions?.gpuType
      ?.map((type) => (type === "integrated" ? "Integrada" : "Dedicada"))
      .join(", ") || "Todas";
  const chassis = tweak.conditions?.chassis?.join(", ") || "Desktop e laptop";

  return (
    <DetailSection title="Compatibilidade" icon={<BadgeCheck size={14} />}>
      <div className="space-y-2 text-[12px] text-white/38">
        <MetaRow label="Categoria" value={categoryLabel(category)} />
        <MetaRow label="Windows" value="Windows 10 / 11" />
        <MetaRow label="Build" value="Todas as builds suportadas" />
        <MetaRow label="GPU" value={`${vendors} / ${gpuTypes}`} />
        <MetaRow label="Dispositivo" value={chassis} />
        <MetaRow label="Admin" value={tweak.layer === 1 ? "Necessario" : "Nao necessario"} />
      </div>
    </DetailSection>
  );
}

function DependenciesCard({ tweak }: { tweak: Tweak }) {
  return (
    <DetailSection title="Dependencias" icon={<ChevronRight size={14} />}>
      <div className="space-y-2 text-[12px] text-white/38">
        <MetaRow label="Permissoes" value={tweak.layer === 1 ? "Sessao elevada" : "Utilizador"} />
        <MetaRow label="Reinicio" value={tweak.requiresReboot ? "Recomendado" : "Nao requerido"} />
        <MetaRow label="Motor" value="Orion Optimizer 2.0" />
      </div>
    </DetailSection>
  );
}

function DetailSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
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

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/[0.05] pb-2 last:border-b-0 last:pb-0">
      <span className="text-white/30">{label}</span>
      <span className="max-w-[58%] text-right text-white/58">{value}</span>
    </div>
  );
}

function CatalogEmpty({ compact }: { compact?: boolean }) {
  return (
    <div className={compact ? "grid h-full place-items-center text-center" : "px-5 py-16 text-center"}>
      <div>
        <Filter size={20} className="mx-auto text-white/25" />
        <p className="mt-3 text-[13px] font-semibold text-white/60">
          Nenhuma otimizacao encontrada
        </p>
        <p className="mt-1 text-[12px] text-white/32">
          Ajusta a pesquisa ou limpa os filtros para voltar a ver o catalogo.
        </p>
      </div>
    </div>
  );
}

function Select({
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
      <Filter
        size={13}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/26"
      />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full appearance-none rounded-lg border border-white/[0.08] bg-[var(--panel-surface-2)] pl-8 pr-3 text-[12px] text-white outline-none transition focus:border-[var(--chart-1)]"
      >
        {children}
      </select>
    </label>
  );
}

function ActionForm({
  id,
  action,
  icon,
  label,
  danger,
}: {
  id: string;
  action: (formData: FormData) => void | Promise<void>;
  icon: ReactNode;
  label: string;
  danger?: boolean;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button
        className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] transition ${
          danger
            ? "text-[var(--critical)] hover:bg-[var(--critical)]/10"
            : "text-white/58 hover:bg-white/[0.05] hover:text-white"
        }`}
      >
        {icon}
        {label}
      </button>
    </form>
  );
}

function Badge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: OptimizerTier | "safe" | "warning" | "danger" | "neutral";
}) {
  const styles: Record<string, string> = {
    basic: "border-[var(--good)]/25 bg-[var(--good)]/10 text-[var(--good)]",
    pro: "border-sky-400/25 bg-sky-400/10 text-sky-200",
    ultimate: "border-[var(--chart-1)]/30 bg-[var(--chart-1)]/12 text-[var(--chart-1)]",
    special: "border-[var(--warning)]/35 bg-[var(--warning)]/12 text-[var(--warning)]",
    safe: "border-[var(--good)]/25 bg-[var(--good)]/10 text-[var(--good)]",
    warning: "border-[var(--warning)]/30 bg-[var(--warning)]/10 text-[var(--warning)]",
    danger: "border-[var(--critical)]/30 bg-[var(--critical)]/10 text-[var(--critical)]",
    neutral: "border-white/[0.08] bg-white/[0.045] text-white/48",
  };
  return (
    <span className={`inline-flex h-6 items-center rounded-full border px-2.5 text-[10.5px] font-semibold ${styles[tone]}`}>
      {label}
    </span>
  );
}

function buildCategoryCounts(tweaks: Tweak[]): Record<CategoryKey, number> {
  const counts = Object.fromEntries(CATEGORY_META.map((c) => [c.key, 0])) as Record<
    CategoryKey,
    number
  >;
  counts.all = tweaks.length;
  counts.recent = Math.min(8, tweaks.length);
  counts.favorites = tweaks.filter((t) => minimumTierForTweak(t) === "special").length;

  for (const tweak of tweaks) {
    const category = categoryForTweak(tweak);
    counts[category] = (counts[category] ?? 0) + 1;
  }

  return counts;
}

function categoryForTweak(tweak: Tweak): CategoryKey {
  const prefix = tweak.id.split(".")[0]?.toLocaleLowerCase("pt") ?? "system";
  const found = CATEGORY_META.find((category) => category.aliases?.includes(prefix));
  return found?.key ?? "system";
}

function categoryLabel(category: CategoryKey) {
  return CATEGORY_META.find((item) => item.key === category)?.label ?? "Sistema";
}

function iconForCategory(category: CategoryKey) {
  return CATEGORY_META.find((item) => item.key === category)?.icon ?? <Blocks size={15} />;
}

function sortTweaks(tweaks: Tweak[], sort: FilterState["sort"]) {
  const copy = [...tweaks];
  if (sort === "old") return copy.reverse();
  if (sort === "recent" || sort === "changed") return copy.reverse();
  if (sort === "popular") {
    return copy.sort((a, b) => tierWeight(minimumTierForTweak(a)) - tierWeight(minimumTierForTweak(b)));
  }
  if (sort === "used") return copy.sort((a, b) => b.actions.length - a.actions.length);
  return copy.sort((a, b) => a.name.localeCompare(b.name, "pt"));
}

function tierWeight(tier: OptimizerTier) {
  return { basic: 0, pro: 1, ultimate: 2, special: 3 }[tier];
}

function uniqueValues(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt"));
}

function impactLabel(value: string) {
  return value ? `Impacto ${value}` : "Impacto";
}

function riskLabel(value: string) {
  return value ? `Risco ${value}` : "Risco";
}

function impactTone(value: string): "safe" | "warning" | "danger" | "neutral" {
  const normalized = value.toLocaleLowerCase("pt");
  if (normalized.includes("alto")) return "danger";
  if (normalized.includes("medio") || normalized.includes("variavel")) return "warning";
  if (normalized.includes("baixo") || normalized.includes("nenhum")) return "safe";
  return "neutral";
}

function riskTone(value: string): "safe" | "warning" | "danger" | "neutral" {
  const normalized = value.toLocaleLowerCase("pt");
  if (normalized.includes("alto")) return "danger";
  if (normalized.includes("medio")) return "warning";
  if (normalized.includes("baixo") || normalized.includes("nenhum")) return "safe";
  return "neutral";
}
