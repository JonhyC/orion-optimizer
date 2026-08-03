"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import Cropper, { type Area } from "react-easy-crop";
import {
  AlertTriangle,
  Archive,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  Crop as CropIcon,
  RotateCcw,
  RotateCw,
  Download,
  Eye,
  FileClock,
  Filter,
  Globe2,
  GripVertical,
  Headphones,
  Image as ImageIcon,
  Infinity as InfinityIcon,
  Layers3,
  LockKeyhole,
  Megaphone,
  MoreHorizontal,
  PackagePlus,
  Pencil,
  Percent,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Tag,
  Trash2,
  Upload,
  X,
  ZoomIn,
} from "lucide-react";
import PlanCardDisplay, { type PlanCardData } from "@/components/plans/PlanCardDisplay";
import {
  createPlanAction,
  deletePlanAction,
  reorderPlansAction,
  updatePlanAction,
  type ResultadoPlano,
} from "../../actions";

export type AdminPlan = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  days: number;
  active: number;
  sort_order: number;
  cover_url: string | null;
  support_days: number | null;
  discord_role_id: string | null;
  badge_text: string | null;
  badge_active: number;
  compare_at_cents: number | null;
  discount_active: number;
  promo_text: string | null;
  features_json: string | null;
  cta_text: string | null;
};

export type PlanMetric = {
  planId: number;
  clients: number;
  revenueCents: number;
  sales: number;
  salesThisMonth: number;
  lastSaleAt: number | null;
};

type DiscordRoleOption = {
  id: string;
  name: string;
  color: number;
  position: number;
  assignable: boolean;
};

type FilterKey =
  | "all"
  | "public"
  | "private"
  | "draft"
  | "promo"
  | "no_promo"
  | "lifetime"
  | "monthly"
  | "annual";

type SortKey = "manual" | "name" | "price" | "sales" | "recent" | "old";
type EditorSection =
  | "info"
  | "pricing"
  | "visual"
  | "benefits"
  | "discord"
  | "promotion"
  | "publishing"
  | "preview";

const editorSections: Array<{ key: EditorSection; label: string; icon: ReactNode }> = [
  { key: "info", label: "Informacao", icon: <PackagePlus size={15} /> },
  { key: "pricing", label: "Preco", icon: <Percent size={15} /> },
  { key: "visual", label: "Visual", icon: <ImageIcon size={15} /> },
  { key: "benefits", label: "Beneficios", icon: <CheckCircle2 size={15} /> },
  { key: "discord", label: "Discord", icon: <Headphones size={15} /> },
  { key: "promotion", label: "Promocoes", icon: <Megaphone size={15} /> },
  { key: "publishing", label: "Publicacao", icon: <Globe2 size={15} /> },
  { key: "preview", label: "Preview", icon: <Eye size={15} /> },
];

export default function PlanManager({
  plans,
  discordRoles,
  discordError,
  metrics = [],
}: {
  plans: AdminPlan[];
  discordRoles: DiscordRoleOption[];
  discordError: string | null;
  metrics?: PlanMetric[];
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminPlan | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("manual");
  const [localOrder, setLocalOrder] = useState(plans.map((plan) => plan.id));
  const [dragging, setDragging] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const roleNames = new Map(discordRoles.map((role) => [role.id, role.name]));
  const roleUsage = Object.fromEntries(
    plans.flatMap((plan) => (plan.discord_role_id ? [[plan.discord_role_id, plan.name]] : [])),
  );
  const metricMap = new Map(metrics.map((metric) => [metric.planId, metric]));

  useEffect(() => setLocalOrder(plans.map((plan) => plan.id)), [plans]);

  const ordered = useMemo(() => {
    const byId = new Map(plans.map((plan) => [plan.id, plan]));
    const manual = localOrder.map((id) => byId.get(id)).filter(Boolean) as AdminPlan[];
    const missing = plans.filter((plan) => !localOrder.includes(plan.id));
    return [...manual, ...missing];
  }, [localOrder, plans]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("pt");
    const rows = ordered.filter((plan) => {
      const metric = metricMap.get(plan.id);
      const haystack = [
        plan.name,
        plan.code,
        plan.description,
        plan.discord_role_id ? roleNames.get(plan.discord_role_id) : "",
        money(plan.price_cents, plan.currency),
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("pt");
      return (!needle || haystack.includes(needle)) && matchesFilter(plan, filter);
    });
    return sortPlans(rows, sort, metricMap);
  }, [filter, metricMap, ordered, query, roleNames, sort]);

  function persistOrder(ids: number[]) {
    const data = new FormData();
    data.set("order", ids.join(","));
    startTransition(() => {
      void reorderPlansAction(data);
    });
  }

  function movePlan(targetId: number) {
    if (dragging === null || dragging === targetId) return;
    const current = [...localOrder];
    const from = current.indexOf(dragging);
    const to = current.indexOf(targetId);
    if (from < 0 || to < 0) return;
    current.splice(to, 0, current.splice(from, 1)[0]);
    setLocalOrder(current);
    persistOrder(current);
  }

  return (
    <>
      <PlansHeader
        plans={plans}
        metrics={metrics}
        isSavingOrder={isPending}
        onCreate={() => setCreating(true)}
        onDuplicate={() => plans[0] && setEditing(plans[0])}
      />

      <PlansStats plans={plans} metrics={metrics} />

      <PlansToolbar
        query={query}
        filter={filter}
        sort={sort}
        onQuery={setQuery}
        onFilter={setFilter}
        onSort={setSort}
      />

      {plans.length === 0 ? (
        <PlansEmpty onCreate={() => setCreating(true)} />
      ) : (
        <section className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              metric={metricMap.get(plan.id)}
              roleName={plan.discord_role_id ? roleNames.get(plan.discord_role_id) : null}
              dragging={dragging === plan.id}
              onDragStart={() => setDragging(plan.id)}
              onDragOver={(event) => {
                event.preventDefault();
                movePlan(plan.id);
              }}
              onDragEnd={() => setDragging(null)}
              onEdit={() => setEditing(plan)}
            />
          ))}
        </section>
      )}

      {filtered.length === 0 && plans.length > 0 && (
        <div className="mt-5 rounded-2xl border border-dashed border-white/[0.08] bg-[var(--panel-surface)] px-6 py-12 text-center">
          <Filter size={24} className="mx-auto text-white/22" />
          <p className="mt-3 text-[14px] font-semibold text-white/60">Nenhum plano encontrado.</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setFilter("all");
              setSort("manual");
            }}
            className="mt-3 text-[12.5px] font-semibold text-[var(--chart-1)] hover:underline"
          >
            Limpar filtros
          </button>
        </div>
      )}

      {creating && (
        <PlanModal title="Criar plano" onClose={() => setCreating(false)}>
          <PlanEditor
            mode="create"
            nextOrder={plans.length + 1}
            discordRoles={discordRoles}
            discordError={discordError}
            roleUsage={roleUsage}
            onSubmitted={() => setCreating(false)}
          />
        </PlanModal>
      )}

      {editing && (
        <PlanModal title={`Editar ${editing.name}`} onClose={() => setEditing(null)}>
          <PlanEditor
            plan={editing}
            mode="edit"
            discordRoles={discordRoles}
            discordError={discordError}
            roleUsage={roleUsage}
            onSubmitted={() => setEditing(null)}
          />
        </PlanModal>
      )}
    </>
  );
}

function PlansHeader({
  plans,
  metrics,
  isSavingOrder,
  onCreate,
  onDuplicate,
}: {
  plans: AdminPlan[];
  metrics: PlanMetric[];
  isSavingOrder: boolean;
  onCreate: () => void;
  onDuplicate: () => void;
}) {
  const revenue = metrics.reduce((sum, metric) => sum + metric.revenueCents, 0);
  const clients = metrics.reduce((sum, metric) => sum + metric.clients, 0);

  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--warning)]">
          Product management
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">Planos</h1>
        <p className="mt-1.5 text-[14px] text-white/40">
          Produtos, precos, beneficios, Discord, campanhas e publicacao num fluxo guiado.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-[11.5px]">
          <Pill label={`${plans.length} total`} />
          <Pill label={`${plans.filter((p) => p.active === 1).length} publicos`} tone="good" />
          <Pill label={`${plans.filter((p) => p.active !== 1).length} privados`} />
          <Pill label={`${money(revenue, "EUR")} receita`} tone="gold" />
          <Pill label={`${clients} clientes ativos`} />
          {isSavingOrder && <Pill label="A guardar ordem..." tone="gold" />}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <HeaderButton onClick={onCreate} icon={<Plus size={15} />} label="Novo Plano" primary />
        <HeaderButton onClick={onDuplicate} icon={<Copy size={15} />} label="Duplicar Plano" />

        <HeaderButton icon={<Download size={15} />} label="Exportar" />
        <HeaderButton onClick={() => location.reload()} icon={<RefreshCw size={15} />} label="Atualizar" />
      </div>
    </header>
  );
}

function PlansStats({ plans, metrics }: { plans: AdminPlan[]; metrics: PlanMetric[] }) {
  const revenue = metrics.reduce((sum, metric) => sum + metric.revenueCents, 0);
  const clients = metrics.reduce((sum, metric) => sum + metric.clients, 0);
  const cards = [
    ["Total de planos", plans.length, "catalogo comercial"],
    ["Publicos", plans.filter((plan) => plan.active === 1).length, "visiveis no site"],
    ["Privados", plans.filter((plan) => plan.active !== 1).length, "ocultos do site"],
    ["Incompletos", plans.filter((plan) => !plan.cover_url || !parsePlanFeatures(plan.features_json).length).length, "incompletos"],
    ["Receita total", money(revenue, "EUR"), "por planos"],
    ["Clientes ativos", clients, "com plano"],
  ];
  return (
    <div className="mt-6 grid overflow-hidden rounded-2xl border border-white/[0.07] bg-[var(--panel-surface)] sm:grid-cols-2 xl:grid-cols-6">
      {cards.map(([label, value, caption]) => (
        <div key={String(label)} className="border-b border-r border-white/[0.06] p-4 last:border-r-0 xl:border-b-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">{label}</div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-white">{value}</div>
          <div className="mt-1 text-[11px] text-white/28">{caption}</div>
        </div>
      ))}
    </div>
  );
}

function PlansToolbar({
  query,
  filter,
  sort,
  onQuery,
  onFilter,
  onSort,
}: {
  query: string;
  filter: FilterKey;
  sort: SortKey;
  onQuery: (value: string) => void;
  onFilter: (value: FilterKey) => void;
  onSort: (value: SortKey) => void;
}) {
  return (
    <section className="mt-5 rounded-2xl border border-white/[0.07] bg-[var(--panel-surface)] p-4">
      <label className="relative block">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Pesquisar por nome, codigo, descricao, cargo Discord ou preco"
          className="h-11 w-full rounded-xl border border-white/[0.08] bg-[var(--panel-surface-2)] pl-9 pr-3 text-[13px] text-white outline-none placeholder:text-white/25 focus:border-[var(--chart-1)]"
        />
      </label>
      <div className="mt-3 grid gap-2 md:grid-cols-[1fr_220px]">
        <div className="flex flex-wrap gap-2">
          {[
            ["all", "Todos"],
            ["public", "Publicos"],
            ["private", "Privados"],
            ["draft", "Incompletos"],
            ["promo", "Promocao ativa"],
            ["no_promo", "Sem promocao"],
            ["lifetime", "Life-time"],
            ["monthly", "Mensal"],
            ["annual", "Anual"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => onFilter(key as FilterKey)}
              className={`rounded-full border px-3 py-1.5 text-[11.5px] font-semibold transition ${
                filter === key
                  ? "border-[var(--chart-1)]/40 bg-[var(--chart-1)]/10 text-[var(--chart-1)]"
                  : "border-white/[0.08] text-white/42 hover:border-white/20 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={(event) => onSort(event.target.value as SortKey)}
          className="h-10 rounded-xl border border-white/[0.08] bg-[var(--panel-surface-2)] px-3 text-[12.5px] text-white outline-none focus:border-[var(--chart-1)]"
        >
          <option value="manual">Ordenacao manual</option>
          <option value="name">Nome</option>
          <option value="price">Preco</option>
          <option value="sales">Mais vendido</option>
          <option value="recent">Mais recente</option>
          <option value="old">Mais antigo</option>
        </select>
      </div>
    </section>
  );
}

function PlanCard({
  plan,
  metric,
  roleName,
  dragging,
  onDragStart,
  onDragOver,
  onDragEnd,
  onEdit,
}: {
  plan: AdminPlan;
  metric?: PlanMetric;
  roleName: string | null | undefined;
  dragging: boolean;
  onDragStart: () => void;
  onDragOver: (event: React.DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onEdit: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const features = parsePlanFeatures(plan.features_json);
  const draft = !plan.cover_url || features.length === 0;
  const state = plan.active === 1 ? "Publicado" : draft ? "Rascunho" : "Privado";

  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      className={`group overflow-hidden rounded-2xl border border-white/[0.07] bg-[var(--panel-surface)] transition duration-200 hover:-translate-y-1 hover:border-[var(--chart-1)]/30 ${
        dragging ? "scale-[0.98] opacity-55" : ""
      }`}
    >
      <div className="relative aspect-[16/9] overflow-hidden border-b border-white/[0.06] bg-[var(--panel-surface-2)]">
        {plan.cover_url ? (
          <img src={plan.cover_url} alt={`Capa do plano ${plan.name}`} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.035]" />
        ) : (
          <div className="grid h-full place-items-center">
            <ImageIcon size={30} className="text-white/15" />
          </div>
        )}
        <button
          className="absolute left-3 top-3 grid h-9 w-9 cursor-grab place-items-center rounded-lg border border-white/10 bg-black/55 text-white/48 backdrop-blur-md active:cursor-grabbing"
          title="Arrastar para reordenar"
          aria-label="Arrastar plano"
        >
          <GripVertical size={16} />
        </button>
        {plan.badge_active === 1 && plan.badge_text && (
          <span className="absolute left-1/2 top-3 z-10 inline-flex max-w-[68%] -translate-x-1/2 items-center gap-1.5 truncate rounded-full bg-[var(--chart-1)] px-3 py-1 text-[9.5px] font-bold uppercase text-[#16082c] shadow-lg shadow-[var(--chart-1)]/20">
            <Tag size={10} />
            {plan.badge_text}
          </span>
        )}
        <span className={`absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold backdrop-blur-md ${
          plan.active === 1 ? "bg-[var(--good)]/15 text-[var(--good)]" : "bg-black/55 text-white/65"
        }`}>
          {plan.active === 1 ? <Globe2 size={12} /> : <LockKeyhole size={12} />}
          {state}
        </span>
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-[16px] font-semibold text-white">{plan.name}</h2>
            <p className="mt-1 font-mono text-[11px] text-white/30">{plan.code}</p>
          </div>
          <div className="shrink-0 text-right tabular-nums">
            {plan.discount_active === 1 && plan.compare_at_cents !== null && (
              <div className="text-[11px] text-white/30 line-through">{money(plan.compare_at_cents, plan.currency)}</div>
            )}
            <div className={`text-[17px] font-bold ${plan.discount_active === 1 ? "text-[var(--chart-1)]" : "text-white"}`}>
              {money(plan.price_cents, plan.currency)}
            </div>
          </div>
        </div>

        <p className="mt-4 line-clamp-2 min-h-10 text-[13px] leading-5 text-white/40">
          {plan.description ?? "Sem descricao."}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <MiniStat label="Clientes" value={metric?.clients ?? 0} />
          <MiniStat label="Receita" value={money(metric?.revenueCents ?? 0, plan.currency)} />
          <MiniStat label="Este mes" value={`+${metric?.salesThisMonth ?? 0}`} />
          <MiniStat label="Ultima venda" value={metric?.lastSaleAt ? dateShort(metric.lastSaleAt) : "sem vendas"} />
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          <Pill label={plan.days === 0 ? "Life-time" : `${plan.days} dias`} />
          <Pill label={plan.support_days === null ? "Sem suporte" : plan.support_days === 0 ? "Suporte life-time" : `${plan.support_days} suporte`} />
          <Pill label={roleName ? `@${roleName}` : "Sem Discord"} />
          <Pill label={`Posicao ${plan.sort_order}`} />
        </div>

        <div className="relative mt-5 flex items-center justify-end gap-2 border-t border-white/[0.06] pt-4">
          <button onClick={onEdit} className="inline-flex h-9 items-center gap-2 rounded-md border border-white/10 px-3 text-[12px] font-medium text-white/60 transition-colors hover:border-[var(--chart-1)] hover:text-white">
            <Pencil size={14} />
            Editar
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="grid h-9 w-9 place-items-center rounded-md border border-white/10 text-white/45 transition-colors hover:border-[var(--chart-1)] hover:text-white"
            aria-label="Menu do plano"
          >
            <MoreHorizontal size={15} />
          </button>
          {menuOpen && <PlanContextMenu plan={plan} onEdit={onEdit} />}
        </div>
      </div>
    </article>
  );
}

function PlanContextMenu({ plan, onEdit }: { plan: AdminPlan; onEdit: () => void }) {
  return (
    <div className="absolute right-0 top-14 z-30 w-48 rounded-xl border border-white/[0.08] bg-[#080808] p-1.5 shadow-2xl">
      <MenuButton type="button" onClick={onEdit} icon={<Pencil size={13} />} label="Editar" />
      <MenuButton type="button" icon={<Copy size={13} />} label="Duplicar" />
      <MenuButton type="button" icon={<Eye size={13} />} label="Pre-visualizar" />
      <MenuButton type="button" icon={<Archive size={13} />} label="Arquivar" />
      <MenuButton type="button" icon={<LockKeyhole size={13} />} label="Ocultar" />
      <form
        action={deletePlanAction}
        onSubmit={(event) => {
          if (!window.confirm(`Apagar o plano ${plan.name}?`)) event.preventDefault();
        }}
      >
        <input type="hidden" name="planId" value={plan.id} />
        <MenuButton icon={<Trash2 size={13} />} label="Eliminar" danger />
      </form>
    </div>
  );
}

function PlanModal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center overflow-hidden bg-black/80 p-2 backdrop-blur-sm sm:p-4">
      <div className="flex max-h-[calc(100dvh-1rem)] min-h-0 w-full max-w-[1320px] flex-col overflow-hidden rounded-2xl border border-[var(--chart-1)]/20 bg-[var(--panel-surface)] shadow-2xl shadow-black/60 sm:max-h-[calc(100dvh-2rem)]">
        <header className="flex shrink-0 items-center justify-between border-b border-white/[0.07] bg-black/20 px-5 py-4 sm:px-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--chart-1)]">Plano Orion</p>
            <h2 className="mt-1 text-[16px] font-semibold text-white">{title}</h2>
          </div>
          <button type="button" onClick={onClose} title="Fechar" aria-label="Fechar" className="grid h-8 w-8 place-items-center rounded-md text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white">
            <X size={17} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

function PlanEditor({
  mode,
  plan,
  nextOrder = 1,
  discordRoles,
  discordError,
  roleUsage,
  onSubmitted,
}: {
  mode: "create" | "edit";
  plan?: AdminPlan;
  nextOrder?: number;
  discordRoles: DiscordRoleOption[];
  discordError: string | null;
  roleUsage: Record<string, string>;
  onSubmitted: () => void;
}) {
  const [estado, action, aGuardar] = useActionState(
    mode === "create" ? createPlanAction : updatePlanAction,
    null as ResultadoPlano | null,
  );
  const [section, setSection] = useState<EditorSection>("info");
  const [durationType, setDurationType] = useState(plan?.days === 0 ? "lifetime" : "days");
  const [days, setDays] = useState(plan && plan.days > 0 ? String(plan.days) : "30");
  const [supportType, setSupportType] = useState(
    plan?.support_days === null || plan?.support_days === undefined
      ? "none"
      : plan.support_days === 0
        ? "lifetime"
        : "days",
  );
  const [badgeActive, setBadgeActive] = useState(plan?.badge_active === 1);
  const [badgeText, setBadgeText] = useState(plan?.badge_text ?? "");
  const [discountActive, setDiscountActive] = useState(plan?.discount_active === 1);
  const [coverPreview, setCoverPreview] = useState<string | null>(plan?.cover_url ?? null);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [features, setFeatures] = useState(() => parsePlanFeatures(plan?.features_json ?? null));
  const [previewTab, setPreviewTab] = useState<"website" | "discord" | "checkout" | "client">("website");
  const [preview, setPreview] = useState<PlanCardData>(() => planToPreview(plan, coverPreview, features));
  /**
   * Ha alteracoes por guardar.
   *
   * Substitui um indicador que dizia "A guardar..." e depois "Guardado
   * local" - vindos de um setTimeout que nao guardava absolutamente nada,
   * nem no servidor nem no browser. Quem fechasse o editor a confiar
   * nessa mensagem perdia o trabalho todo.
   */
  const [porGuardar, setPorGuardar] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    setPreview(buildPlanPreview(new FormData(form), coverPreview, features));
  }, [badgeActive, badgeText, coverPreview, discountActive, durationType, features, supportType, section]);

  // So fecha quando o servidor confirma. Antes fechava no `onSubmit`, ou
  // seja antes de saber o resultado: um erro de validacao fazia o editor
  // desaparecer com o plano por gravar e nada no ecra a explicar.
  useEffect(() => {
    if (estado?.ok) onSubmitted();
  }, [estado, onSubmitted]);

  function updateLocalPreview() {
    const form = formRef.current;
    if (!form) return;
    setPreview(buildPlanPreview(new FormData(form), coverPreview, features));
    setPorGuardar(true);
  }

  function addFeature() {
    setFeatures((current) => [...current, "Novo beneficio"]);
  }

  function moveFeature(index: number, direction: -1 | 1) {
    setFeatures((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return next;
      next.splice(target, 0, next.splice(index, 1)[0]);
      return next;
    });
  }

  return (
    <form
      ref={formRef}
      action={action}
      onInput={updateLocalPreview}
      onChange={updateLocalPreview}
      /* Sem onSubmit a fechar o editor: quem fecha e o efeito acima,
         depois de o servidor responder ok. A validacao do desconto vive
         no servidor, que a devolve como mensagem em vez de um alert(). */
      className="grid min-h-0 flex-1 grid-cols-[220px_minmax(0,1fr)_390px] overflow-hidden max-xl:grid-cols-[190px_minmax(0,1fr)] max-lg:grid-cols-1"
    >
      {plan && <input type="hidden" name="planId" value={plan.id} />}
      <input type="hidden" name="features" value={features.join("\n")} />

      <PlanSidebar active={section} setActive={setSection} preview={preview} />

      <main className="min-h-0 overflow-y-auto overscroll-contain p-5 [scrollbar-color:rgba(214,167,91,.55)_rgba(255,255,255,.04)]">
        <PlanEditorTop
          mode={mode}
          aGuardar={aGuardar}
          porGuardar={porGuardar}
          erro={estado?.error ?? null}
          onCancel={onSubmitted}
          onPreview={() => setSection("preview")}
        />

        {/*
          TODAS as seccoes ficam montadas; so se esconde a que nao esta
          activa.

          Antes era `{section === "pricing" && <PlanPricing/>}`: os campos
          da seccao inactiva nao existiam no DOM e, por isso, nao eram
          submetidos. Guardar a partir do separador "Informacao" enviava
          um formulario sem preco, sem duracao e sem o estado de
          publicacao - a validacao rejeitava-o e, como o erro era um
          `return` mudo, o editor fechava-se sem gravar nada e sem dizer
          porque. Era impossivel publicar sem estar por acaso no separador
          certo.

          Esconder com CSS resolve porque um campo escondido continua a
          ser submetido - so `disabled` o excluiria.
        */}
        <div className="mt-5">
          <Seccao activa={section === "info"}>
            <PlanInformation plan={plan} />
          </Seccao>
          <Seccao activa={section === "pricing"}>
            <PlanPricing
              plan={plan}
              nextOrder={nextOrder}
              durationType={durationType}
              setDurationType={setDurationType}
              days={days}
              setDays={setDays}
              discountActive={discountActive}
              setDiscountActive={setDiscountActive}
            />
          </Seccao>
          <Seccao activa={section === "visual"}>
            <PlanVisual
              plan={plan}
              coverPreview={coverPreview}
              fileInputRef={fileInputRef}
              badgeActive={badgeActive}
              setBadgeActive={setBadgeActive}
              badgeText={badgeText}
              setBadgeText={setBadgeText}
              setCropSource={setCropSource}
              setCoverPreview={setCoverPreview}
            />
          </Seccao>
          <Seccao activa={section === "benefits"}>
            <PlanBenefits
              features={features}
              setFeatures={setFeatures}
              addFeature={addFeature}
              moveFeature={moveFeature}
            />
          </Seccao>
          <Seccao activa={section === "discord"}>
            <PlanDiscord
              plan={plan}
              discordRoles={discordRoles}
              discordError={discordError}
              roleUsage={roleUsage}
              supportType={supportType}
              setSupportType={setSupportType}
            />
          </Seccao>
          <Seccao activa={section === "promotion"}>
            <PlanPromotion plan={plan} discountActive={discountActive} setDiscountActive={setDiscountActive} />
          </Seccao>
          <Seccao activa={section === "publishing"}>
            <PlanPublishing plan={plan} />
          </Seccao>
          {/* A validacao nao tem campos, portanto pode continuar a montar
              e desmontar - assim recalcula sempre que se abre. */}
          {section === "preview" && <PlanValidation preview={preview} plan={plan} />}
        </div>
      </main>

      <PlanPreview
        plan={preview}
        tab={previewTab}
        setTab={setPreviewTab}
      />

      {cropSource && (
        <CropEditor
          source={cropSource}
          onCancel={() => setCropSource(null)}
          onApply={(file) => {
            const transfer = new DataTransfer();
            transfer.items.add(file);
            if (fileInputRef.current) fileInputRef.current.files = transfer.files;
            setCoverPreview(URL.createObjectURL(file));
            setCropSource(null);
          }}
        />
      )}
    </form>
  );
}

function PlanSidebar({
  active,
  setActive,
  preview,
}: {
  active: EditorSection;
  setActive: (section: EditorSection) => void;
  preview: PlanCardData;
}) {
  const valid = validationRows(preview);
  return (
    <aside className="min-h-0 overflow-y-auto border-r border-white/[0.07] bg-black/15 p-4 max-lg:border-b max-lg:border-r-0">
      <div className="mb-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--chart-1)]">Progresso</p>
        <div className="mt-2 text-[12px] text-white/35">{valid.filter((row) => row.ok).length}/{valid.length} pronto</div>
      </div>
      <nav className="space-y-1">
        {editorSections.map((item) => {
          const index = editorSections.findIndex((section) => section.key === item.key);
          const done = valid[Math.min(index, valid.length - 1)]?.ok;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setActive(item.key)}
              className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-[12.5px] transition ${
                active === item.key
                  ? "border-[var(--chart-1)]/40 bg-[var(--chart-1)]/10 text-white"
                  : "border-transparent text-white/45 hover:border-white/[0.06] hover:bg-white/[0.03] hover:text-white"
              }`}
            >
              <span className="flex items-center gap-2.5">
                <span className={active === item.key ? "text-[var(--chart-1)]" : "text-white/30"}>{item.icon}</span>
                {item.label}
              </span>
              <span className={done ? "text-[var(--good)]" : "text-white/25"}>{done ? "✓" : "○"}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function PlanEditorTop({
  mode,
  aGuardar,
  porGuardar,
  erro,
  onCancel,
  onPreview,
}: {
  mode: "create" | "edit";
  aGuardar: boolean;
  porGuardar: boolean;
  erro: string | null;
  onCancel: () => void;
  onPreview: () => void;
}) {
  return (
    <div className="sticky top-0 z-20 -mx-5 -mt-5 border-b border-white/[0.07] bg-[var(--panel-surface)]/95 px-5 py-4 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold text-white/35">
            {aGuardar
              ? "A guardar…"
              : porGuardar
                ? "Alterações por guardar"
                : mode === "edit"
                  ? "Sem alterações"
                  : "Novo plano"}
          </div>
          <h3 className="mt-1 text-[15px] font-semibold text-white">
            {mode === "create" ? "Novo produto premium" : "Editar produto premium"}
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={aGuardar}
            className="rounded-lg bg-[var(--chart-1)] px-4 py-2.5 text-[12.5px] font-bold text-[#16082c] transition-opacity hover:opacity-90 disabled:opacity-45"
          >
            {aGuardar ? "A guardar…" : "Guardar"}
          </button>
          {/* `publishNow` e nao `active`: com os dois campos a chamarem-se
              `active`, o formData ficava com dois valores e qual deles
              vencia dependia da ordem no DOM. */}
          <button
            type="submit"
            name="publishNow"
            value="1"
            disabled={aGuardar}
            className="rounded-lg border border-neon/35 px-4 py-2.5 text-[12.5px] font-bold text-[var(--chart-1)] transition-colors hover:bg-neon/10 disabled:opacity-45"
          >
            Guardar e publicar
          </button>
          <button type="button" onClick={onPreview} className="rounded-lg border border-white/10 px-4 py-2.5 text-[12.5px] font-bold text-white/55 transition-colors hover:border-[var(--chart-1)] hover:text-white">
            Pré-visualizar
          </button>
          <button type="button" onClick={onCancel} className="rounded-lg px-3 py-2.5 text-[12.5px] font-bold text-white/35 transition-colors hover:text-white">
            Cancelar
          </button>
        </div>
      </div>

      {/* O erro aparece ao lado dos botoes, que e onde se esta a olhar
          quando se carrega em Guardar. Antes nao aparecia em lado nenhum:
          o servidor fazia `return` mudo e o editor fechava-se. */}
      {erro && (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-lg border border-critical/30 bg-critical/[0.08] px-3 py-2.5 text-[12.5px] text-[var(--critical)]"
        >
          <AlertTriangle size={14} className="mt-px shrink-0" />
          {erro}
        </p>
      )}
    </div>
  );
}

function PlanInformation({ plan }: { plan?: AdminPlan }) {
  return (
    <EditorCard title="Informacao" description="Nome, codigo, descricao, slug e estado base do plano.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome">
          <input name="name" required defaultValue={plan?.name ?? ""} autoFocus placeholder="Premium" className={inputClass} />
        </Field>
        <Field label="Codigo">
          <input name="code" required defaultValue={plan?.code ?? ""} placeholder="premium" pattern="[a-zA-Z0-9._-]{2,32}" className={inputClass} />
        </Field>
      </div>
      <div className="mt-4">
        <Field label="Descricao">
          <textarea name="description" defaultValue={plan?.description ?? ""} rows={4} placeholder="Resumo curto do que este plano inclui" className={`${inputClass} resize-none`} />
        </Field>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
      </div>
      <div className="mt-4">
        <Field label="Texto do botao">
          <input name="ctaText" required maxLength={32} defaultValue={plan?.cta_text ?? (plan ? `Get ${plan.name}` : "Get plan")} placeholder="Get Pro" className={inputClass} />
        </Field>
      </div>
    </EditorCard>
  );
}

function PlanPricing({
  plan,
  nextOrder,
  durationType,
  setDurationType,
  days,
  setDays,
  discountActive,
  setDiscountActive,
}: {
  plan?: AdminPlan;
  nextOrder: number;
  durationType: string;
  setDurationType: (value: string) => void;
  discountActive: boolean;
  setDiscountActive: (value: boolean) => void;
  days: string;
  setDays: (value: string) => void;
}) {
  return (
    <EditorCard title="Preco" description="Valor, duração e posição na página de preços.">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Preco EUR">
          <input name="price" required defaultValue={plan ? (plan.price_cents / 100).toFixed(2) : "0.00"} inputMode="decimal" className={inputClass} />
        </Field>
        <Field label="Preco anterior">
          <input name="compareAtPrice" type="number" defaultValue={plan?.compare_at_cents != null ? (plan.compare_at_cents / 100).toFixed(2) : ""} required={discountActive} min="0" step="0.01" inputMode="decimal" placeholder="39.99" className={inputClass} />
        </Field>
        {/* A moeda e sempre EUR - o createPlan grava-a fixa. Era um select
            de uma opcao so, que parecia escolha e nao era.

            Saiu daqui um select "IVA" com Incluido / Nao incluido: o plano
            nao tem campo nenhum de IVA, portanto a escolha nao ia a lado
            nenhum. */}
        <Field label="Moeda">
          <div className={`${inputClass} cursor-default text-white/45`}>EUR</div>
        </Field>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-black/15 p-4">
        <div>
          <div className="flex items-center gap-2 text-[13px] font-semibold text-white/75">
            <Percent size={15} className="text-[var(--chart-1)]" />
            Desconto
          </div>
          <p className="mt-1 text-[11.5px] text-white/30">O preco anterior aparece riscado no site.</p>
        </div>
        <label className="flex items-center gap-2.5 text-[12px] font-medium text-white/55">
          <input type="checkbox" name="discountActive" value="1" checked={discountActive} onChange={(event) => setDiscountActive(event.target.checked)} className="h-4 w-4 accent-[var(--chart-1)]" />
          Desconto ativo
        </label>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Tipo">
          <select name="durationType" value={durationType} onChange={(event) => setDurationType(event.target.value)} className={inputClass}>
            <option value="days">Por dias</option>
            <option value="lifetime">Life-time</option>
          </select>
        </Field>
        {/* Atalho de duracao.
            Tinha `value` sem `onChange` e sem `name`: era um campo so de
            leitura que nao gravava nada e que o React avisava na consola.
            Agora escreve mesmo no campo dos dias. */}
        <Field label="Duração">
          <select
            value={
              durationType === "lifetime"
                ? "lifetime"
                : days === "30"
                  ? "monthly"
                  : days === "90"
                    ? "quarterly"
                    : days === "365"
                      ? "annual"
                      : "custom"
            }
            onChange={(event) => {
              const escolha = event.target.value;
              if (escolha === "lifetime") {
                setDurationType("lifetime");
                return;
              }
              setDurationType("days");
              if (escolha === "monthly") setDays("30");
              if (escolha === "quarterly") setDays("90");
              if (escolha === "annual") setDays("365");
            }}
            className={inputClass}
          >
            <option value="monthly">Mensal (30 dias)</option>
            <option value="quarterly">Trimestral (90 dias)</option>
            <option value="annual">Anual (365 dias)</option>
            <option value="lifetime">Life-time</option>
            <option value="custom">Personalizado</option>
          </select>
        </Field>
        <Field label="Dias">
          <input
            name="days"
            type="number"
            min="1"
            required={durationType === "days"}
            disabled={durationType === "lifetime"}
            value={days}
            onChange={(event) => setDays(event.target.value)}
            className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-35`}
          />
        </Field>
        <Field label="Posicao">
          <input name="sortOrder" type="number" defaultValue={plan?.sort_order ?? nextOrder} className={inputClass} />
        </Field>
      </div>
    </EditorCard>
  );
}

function PlanVisual({
  plan,
  coverPreview,
  fileInputRef,
  badgeActive,
  setBadgeActive,
  badgeText,
  setBadgeText,
  setCropSource,
  setCoverPreview,
}: {
  plan?: AdminPlan;
  coverPreview: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  badgeActive: boolean;
  setBadgeActive: (value: boolean) => void;
  badgeText: string;
  setBadgeText: (value: string) => void;
  setCropSource: (value: string | null) => void;
  setCoverPreview: (value: string | null) => void;
}) {
  return (
    <EditorCard title="Visual" description="Banner, icone, badge, cor e texto promocional.">
      <div className="grid gap-5 xl:grid-cols-[1fr_270px]">
        <div>
          <div className="aspect-[16/9] overflow-hidden rounded-xl border border-white/[0.08] bg-[var(--panel-surface-2)]">
            {coverPreview ? (
              <img src={coverPreview} alt="Pre-visualizacao da capa" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center"><ImageIcon size={26} className="text-white/15" /></div>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-[12px] font-medium text-white/65 transition-colors hover:border-[var(--chart-1)] hover:text-white">
              <Upload size={14} />
              Escolher banner
              <input
                ref={fileInputRef}
                type="file"
                name="cover"
                accept="image/png,image/jpeg,image/webp,image/avif"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  if (file.size > 5 * 1024 * 1024) {
                    window.alert("A imagem nao pode ultrapassar 5 MB.");
                    event.target.value = "";
                    return;
                  }
                  setCropSource(URL.createObjectURL(file));
                }}
              />
            </label>
            {coverPreview && (
              <button type="button" onClick={() => setCropSource(coverPreview)} className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-[12px] font-medium text-[var(--chart-1)] hover:border-[var(--chart-1)]">
                <CropIcon size={13} />
                Ajustar corte
              </button>
            )}
            {coverPreview && (
              <button type="button" onClick={() => setCoverPreview(null)} className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-[12px] font-medium text-white/45 hover:text-white">
                <X size={13} />
                Limpar preview
              </button>
            )}
          </div>
          {plan?.cover_url && (
            <label className="mt-3 flex items-center gap-2 text-[11.5px] text-white/40">
              <input type="checkbox" name="removeCover" value="1" className="h-4 w-4 accent-[var(--chart-1)]" />
              Remover capa atual
            </label>
          )}
        </div>
        <div className="space-y-4">
          {/* Saiu um select "Icone" com OR branco / Coroa / Performance:
              o plano nao guarda icone nenhum e o cartao usa sempre a capa.
              Escolher ali nao mudava nada em lado nenhum. */}
          <Field label="Cor">
            <input type="color" defaultValue="#d6a75b" className="mt-1.5 h-10 w-full rounded-md border border-white/[0.08] bg-[var(--panel-surface-2)] p-1" />
          </Field>
          <label className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-black/15 p-3 text-[12px] font-medium text-white/55">
            <input type="checkbox" name="badgeActive" value="1" checked={badgeActive} onChange={(event) => setBadgeActive(event.target.checked)} className="h-4 w-4 accent-[var(--chart-1)]" />
            Mostrar badge
          </label>
          <Field label="Badge">
            <input name="badgeText" value={badgeText} onChange={(event) => setBadgeText(event.target.value)} required={badgeActive} maxLength={40} placeholder="Most Popular" className={inputClass} />
          </Field>
          <Field label="Texto promocional">
            <input name="promoText" defaultValue={plan?.promo_text ?? ""} maxLength={80} placeholder="Promocao de lancamento" className={inputClass} />
          </Field>
        </div>
      </div>
    </EditorCard>
  );
}

function PlanBenefits({
  features,
  setFeatures,
  addFeature,
  moveFeature,
}: {
  features: string[];
  setFeatures: (value: string[]) => void;
  addFeature: () => void;
  moveFeature: (index: number, direction: -1 | 1) => void;
}) {
  return (
    <EditorCard title="Beneficios" description="Lista visual, reordenavel, sem textarea gigante.">
      <div className="mb-4 flex justify-end">
        <button type="button" onClick={addFeature} className="inline-flex items-center gap-2 rounded-lg bg-[var(--chart-1)] px-3 py-2 text-[12px] font-bold text-[#16082c]">
          <Plus size={14} />
          Adicionar beneficio
        </button>
      </div>
      <div className="space-y-2">
        {features.map((feature, index) => (
          /* A chave e SO o indice.
             Era `${index}-${feature}`, ou seja incluia o texto: cada tecla
             escrita mudava a chave, o React deitava fora o input e criava
             outro, e o cursor saltava fora ao fim de uma letra. Como o
             valor destes campos vem todo do estado, o indice e uma chave
             correcta - reordenar continua a mostrar o texto certo em cada
             linha. */
          <div key={index} className="grid grid-cols-[32px_1fr_auto] items-center gap-2 rounded-xl border border-white/[0.07] bg-black/15 p-3">
            <GripVertical size={15} className="text-white/25" />
            <input
              value={feature}
              onChange={(event) => setFeatures(features.map((item, i) => (i === index ? event.target.value : item)))}
              className="w-full rounded-lg border border-white/[0.08] bg-[var(--panel-surface-2)] px-3 py-2 text-[13px] text-white outline-none focus:border-[var(--chart-1)]"
            />
            <div className="flex gap-1">
              <button type="button" onClick={() => moveFeature(index, -1)} className={iconButton} title="Mover para cima">↑</button>
              <button type="button" onClick={() => moveFeature(index, 1)} className={iconButton} title="Mover para baixo">↓</button>
              <button type="button" onClick={() => setFeatures(features.filter((_, i) => i !== index))} className={`${iconButton} text-[var(--critical)]`} title="Eliminar"><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
      </div>
      {!features.length && <p className="rounded-xl border border-dashed border-white/[0.08] py-8 text-center text-[12px] text-white/32">Adiciona pelo menos um beneficio.</p>}
    </EditorCard>
  );
}

function PlanDiscord({
  plan,
  discordRoles,
  discordError,
  roleUsage,
  supportType,
  setSupportType,
}: {
  plan?: AdminPlan;
  discordRoles: DiscordRoleOption[];
  discordError: string | null;
  roleUsage: Record<string, string>;
  supportType: string;
  setSupportType: (value: string) => void;
}) {
  return (
    <EditorCard title="Discord" description="Cargo atribuído no servidor e duração do suporte incluído.">
      {discordError ? (
        <>
          <input type="hidden" name="discordRoleId" value={plan?.discord_role_id ?? ""} />
          <div className="rounded-xl border border-[var(--critical)]/20 bg-[var(--critical)]/[0.06] px-3 py-2.5 text-[12px] text-[var(--critical)]">
            Nao foi possivel carregar os cargos: {discordError}
          </div>
        </>
      ) : (
        <Field label="Cargo ligado">
          <select name="discordRoleId" defaultValue={plan?.discord_role_id ?? ""} className={inputClass}>
            <option value="">Sem cargo associado</option>
            {discordRoles.map((role) => {
              const usedBy = roleUsage[role.id];
              const isCurrent = role.id === plan?.discord_role_id;
              const disabled = (!role.assignable || Boolean(usedBy)) && !isCurrent;
              const suffix = usedBy && !isCurrent ? ` - usado por ${usedBy}` : !role.assignable ? " - acima do bot" : "";
              return <option key={role.id} value={role.id} disabled={disabled}>@{role.name}{suffix}</option>;
            })}
          </select>
        </Field>
      )}
      {/*
        Saiu daqui um select "Permissoes" com "Licenca + catalogo",
        "Licenca + suporte" e "Tudo incluido". Nao tinha `name` nenhum,
        portanto nao gravava nada - mas prometia que escolher "Tudo
        incluido" incluia suporte. Quem o escolhia ficava a olhar para os
        "Dias de suporte" bloqueados sem perceber porque: o suporte vem
        do campo abaixo, e so dele.

        Saiu tambem um select "Remocao automatica". A remocao do cargo
        quando o plano expira acontece sempre - esta no plan-expiry, com
        remove_role_id - e nao ha nada para configurar. O select dava a
        entender que se podia desligar.
      */}
      <p className="mt-4 flex items-start gap-2 rounded-xl border border-white/[0.06] bg-black/15 px-3 py-2.5 text-[12px] text-white/40">
        <Check size={14} className="mt-px shrink-0 text-[var(--good)]" />
        Quando a licença termina, o cargo é retirado automaticamente no Discord.
      </p>

      {/*
        Botoes em vez de um <select>.
        O campo dos dias estava sempre visivel e desactivado quando o
        suporte era "Sem suporte" - um campo cinzento que nao aceita
        cliques le-se como avariado, nao como "escolhe outra opcao
        primeiro". Agora a escolha e explicita e o campo dos dias so
        aparece quando ha dias para escrever.
      */}
      <input type="hidden" name="supportType" value={supportType} />

      <div className="mt-4">
        <span className="block text-[12px] font-medium text-white/50">Suporte incluído</span>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {([
            ["none", "Sem suporte", "O plano não inclui suporte"],
            ["days", "Por dias", "Termina ao fim de N dias"],
            ["lifetime", "Life-time", "Enquanto a licença durar"],
          ] as const).map(([valor, titulo, texto]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setSupportType(valor)}
              aria-pressed={supportType === valor}
              className={`rounded-xl border p-3 text-left transition-colors ${
                supportType === valor
                  ? "border-neon/45 bg-neon/10"
                  : "border-white/[0.07] bg-black/15 hover:border-white/20"
              }`}
            >
              <span className="block text-[12.5px] font-semibold text-white">{titulo}</span>
              <span className="mt-0.5 block text-[11px] text-white/32">{texto}</span>
            </button>
          ))}
        </div>
      </div>

      {supportType === "days" && (
        <div className="mt-4 max-w-[220px]">
          <Field label="Dias de suporte">
            <input
              name="supportDays"
              type="number"
              min="1"
              required
              autoFocus
              defaultValue={plan?.support_days && plan.support_days > 0 ? plan.support_days : 30}
              className={inputClass}
            />
          </Field>
        </div>
      )}
    </EditorCard>
  );
}

function PlanPromotion({
  plan,
  discountActive,
  setDiscountActive,
}: {
  plan?: AdminPlan;
  discountActive: boolean;
  setDiscountActive: (value: boolean) => void;
}) {
  return (
    <EditorCard title="Promocoes" description="Cupoes, campanhas, textos e datas de campanha.">
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Saiu um select "Cupoes" com Aceitar / Nao permitir: os cupoes
            sao geridos globalmente em /panel/admin/coupons e o plano nao
            tem campo que os limite. A escolha nao era gravada. */}
        <Field label="Texto superior">
          <input name="promoText" defaultValue={plan?.promo_text ?? ""} maxLength={80} placeholder="Promocao limitada" className={inputClass} />
        </Field>
        <Field label="Preco anterior">
          <input name="compareAtPrice" type="number" defaultValue={plan?.compare_at_cents != null ? (plan.compare_at_cents / 100).toFixed(2) : ""} required={discountActive} min="0" step="0.01" inputMode="decimal" placeholder="39.99" className={inputClass} />
        </Field>
        <label className="mt-6 flex items-center gap-2.5 text-[12px] font-medium text-white/55">
          <input type="checkbox" name="discountActive" value="1" checked={discountActive} onChange={(event) => setDiscountActive(event.target.checked)} className="h-4 w-4 accent-[var(--chart-1)]" />
          Promocao ativa
        </label>
      </div>
    </EditorCard>
  );
}

/**
 * Estado de publicacao.
 *
 * Havia aqui cinco estados - Rascunho, Publicado, Privado, Oculto e
 * Arquivado - mas o plano so tem um campo `active`, que e sim ou nao.
 * Quatro dos cinco gravavam exactamente a mesma coisa, e ao reabrir o
 * editor o estado escolhido aparecia sempre como "Privado". Escolher
 * "Rascunho" ou "Arquivado" nao tinha efeito nenhum e nada o dizia.
 *
 * Ficam os dois que existem mesmo.
 */
function PlanPublishing({ plan }: { plan?: AdminPlan }) {
  const [publicado, setPublicado] = useState(plan?.active === 1);

  const opcoes: Array<[boolean, string, string]> = [
    [true, "Publicado", "Aparece no site e pode ser comprado"],
    [false, "Não publicado", "Fica só no painel, ninguém o vê nem o compra"],
  ];

  return (
    <EditorCard title="Publicação" description="Se o plano aparece no site e pode ser comprado.">
      <input type="hidden" name="active" value={publicado ? "1" : "0"} />
      <div className="grid gap-3 sm:grid-cols-2">
        {opcoes.map(([valor, label, texto]) => (
          <button
            key={label}
            type="button"
            onClick={() => setPublicado(valor)}
            aria-pressed={publicado === valor}
            className={`rounded-xl border p-4 text-left transition ${
              publicado === valor
                ? "border-neon/45 bg-neon/10"
                : "border-white/[0.07] bg-black/15 hover:border-white/15"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  publicado === valor
                    ? valor
                      ? "bg-[var(--good)]"
                      : "bg-white/40"
                    : "bg-white/15"
                }`}
              />
              <span className="text-[13px] font-semibold text-white">{label}</span>
            </div>
            <div className="mt-1 text-[11.5px] text-white/32">{texto}</div>
          </button>
        ))}
      </div>
      <p className="mt-3 text-[12px] text-white/30">
        O botão “Guardar e publicar”, lá em cima, publica de imediato seja qual for a opção escolhida aqui.
      </p>
    </EditorCard>
  );
}

function PlanValidation({ preview, plan }: { preview: PlanCardData; plan?: AdminPlan }) {
  return (
    <EditorCard title="Validacao e historico" description="Checklist antes de publicar e timeline do plano.">
      <div>
        <div>
          <h3 className="mb-3 text-[13px] font-semibold text-white">Validacao</h3>
          <div className="space-y-2">
            {validationRows(preview).map((row) => (
              <div key={row.label} className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-black/15 p-3 text-[12.5px]">
                <span className={row.ok ? "text-[var(--good)]" : "text-[var(--warning)]"}>{row.ok ? "✓" : "!"}</span>
                <span className="text-white/58">{row.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </EditorCard>
  );
}


function PlanPreview({
  plan,
  tab,
  setTab,
}: {
  plan: PlanCardData;
  tab: "website" | "discord" | "checkout" | "client";
  setTab: (tab: "website" | "discord" | "checkout" | "client") => void;
}) {
  return (
    <aside className="min-h-0 overflow-y-auto border-l border-white/[0.07] bg-black/15 p-5 max-xl:hidden">
      <div className="sticky top-0">
        <div className="mb-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--chart-1)]">Preview fixa</p>
          <h3 className="mt-1 text-[15px] font-semibold text-white">Atualiza automaticamente</h3>
        </div>
        <div className="mb-4 grid grid-cols-4 gap-1 rounded-xl border border-white/[0.07] bg-black/20 p-1">
          {[
            ["website", "Website"],
            ["discord", "Discord"],
            ["checkout", "Checkout"],
            ["client", "Area Cliente"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key as never)}
              className={`rounded-lg px-2 py-2 text-[10.5px] font-semibold transition ${
                tab === key ? "bg-[var(--chart-1)] text-[#16082c]" : "text-white/38 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "website" ? (
          <div className="max-w-[340px]">
            <PlanCardDisplay plan={plan} preview />
          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.07] bg-[var(--panel-surface)] p-5">
            <h4 className="text-[15px] font-bold text-white">{plan.name}</h4>
            <p className="mt-2 text-[12.5px] leading-relaxed text-white/42">{plan.description ?? "Orion Optimizer 2.0 access."}</p>
            <div className="mt-4 text-2xl font-bold text-[var(--chart-1)]">{money(plan.price_cents, plan.currency)}</div>
            <div className="mt-4 space-y-2">
              {plan.features.slice(0, 5).map((feature) => (
                <div key={feature} className="flex items-center gap-2 text-[12px] text-white/55">
                  <Check size={13} className="text-[var(--chart-1)]" />
                  {feature}
                </div>
              ))}
            </div>
            <button type="button" className="mt-5 w-full rounded-xl bg-[var(--chart-1)] py-2.5 text-[12.5px] font-bold text-[#16082c]">
              {tab === "discord" ? "Cargo configurado" : plan.cta_text}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

function EditorCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-black/20 p-5 shadow-lg shadow-black/10">
      <div className="mb-5">
        <h3 className="text-[16px] font-semibold text-white">{title}</h3>
        <p className="mt-1 text-[12.5px] text-white/35">{description}</p>
      </div>
      {children}
    </section>
  );
}

/**
 * Formatos de recorte.
 *
 * O 16:9 e o do cartao do plano - qualquer outro fica com barras ou e
 * cortado pelo `object-cover` na apresentacao, e por isso esta assinalado
 * como recomendado. "Livre" e o unico sem proporcao fixa.
 */
const FORMATOS: Array<{ id: string; label: string; valor: number | undefined }> = [
  { id: "16:9", label: "16:9", valor: 16 / 9 },
  { id: "3:2", label: "3:2", valor: 3 / 2 },
  { id: "4:3", label: "4:3", valor: 4 / 3 },
  { id: "1:1", label: "1:1", valor: 1 },
  { id: "9:16", label: "9:16", valor: 9 / 16 },
  { id: "livre", label: "Livre", valor: undefined },
];

function CropEditor({ source, onCancel, onApply }: { source: string; onCancel: () => void; onApply: (file: File) => void }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropHeight, setCropHeight] = useState(82);
  const [formato, setFormato] = useState("16:9");
  const [rotacao, setRotacao] = useState(0);
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const [area, setArea] = useState<Area | null>(null);
  const [working, setWorking] = useState(false);

  const proporcao = FORMATOS.find((f) => f.id === formato)?.valor;

  const cropSize = useMemo(() => {
    // Sem proporcao fixa deixa-se o react-easy-crop mandar: e o que
    // permite arrastar os cantos livremente.
    if (proporcao === undefined) return undefined;
    if (!frame.width || !frame.height) return undefined;
    const maxWidth = frame.width * 0.92;
    const maxHeight = frame.height * 0.92;
    const wantedHeight = maxHeight * (cropHeight / 100);
    const height = Math.min(wantedHeight, maxWidth / proporcao);
    return { width: Math.round(height * proporcao), height: Math.round(height) };
  }, [cropHeight, frame.height, frame.width, proporcao]);

  useEffect(() => {
    const element = frameRef.current;
    if (!element) return;
    const update = () => setFrame({ width: element.clientWidth, height: element.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/85 px-4 py-8 backdrop-blur-md">
      <div className="mx-auto max-w-3xl overflow-hidden rounded-lg border border-white/10 bg-[var(--panel-surface)] shadow-2xl">
        <header className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
          <div>
            <h3 className="text-[15px] font-semibold text-white">Recortar capa</h3>
            <p className="mt-1 text-[11.5px] text-white/35">
              Escolhe o formato, roda, amplia e arrasta. O cartão do plano é 16:9.
            </p>
          </div>
          <button type="button" onClick={onCancel} title="Cancelar recorte" aria-label="Cancelar recorte" className="grid h-8 w-8 place-items-center rounded-md text-white/45 hover:bg-white/[0.06] hover:text-white">
            <X size={17} />
          </button>
        </header>
        <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.07] px-5 py-3">
          {FORMATOS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFormato(f.id)}
              aria-pressed={formato === f.id}
              className={`rounded-lg border px-2.5 py-1.5 text-[11.5px] font-semibold transition-colors ${
                formato === f.id
                  ? "border-neon/45 bg-neon/10 text-[var(--chart-1)]"
                  : "border-white/[0.08] text-white/45 hover:border-white/20 hover:text-white/75"
              }`}
              title={f.id === "16:9" ? "Formato do cartão do plano" : undefined}
            >
              {f.label}
              {f.id === "16:9" && <span className="ml-1 text-[9px] uppercase tracking-wide opacity-70">rec.</span>}
            </button>
          ))}

          <span className="mx-1 h-5 w-px bg-white/10" />

          <button
            type="button"
            onClick={() => setRotacao((r) => (r + 270) % 360)}
            className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.08] text-white/50 transition-colors hover:border-white/20 hover:text-white"
            title="Rodar para a esquerda"
            aria-label="Rodar para a esquerda"
          >
            <RotateCcw size={14} />
          </button>
          <button
            type="button"
            onClick={() => setRotacao((r) => (r + 90) % 360)}
            className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.08] text-white/50 transition-colors hover:border-white/20 hover:text-white"
            title="Rodar para a direita"
            aria-label="Rodar para a direita"
          >
            <RotateCw size={14} />
          </button>
          {rotacao !== 0 && <span className="text-[11px] tabular-nums text-white/35">{rotacao}°</span>}
        </div>

        <div ref={frameRef} className="relative h-[min(52vh,430px)] min-h-72 bg-black">
          <Cropper
            image={source}
            crop={crop}
            zoom={zoom}
            rotation={rotacao}
            aspect={proporcao ?? 16 / 9}
            cropSize={cropSize}
            objectFit="contain"
            showGrid
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotacao}
            onCropComplete={(_, pixels) => setArea(pixels)}
          />
        </div>
        <div className="grid gap-4 px-5 py-4 md:grid-cols-[1fr_auto] md:items-end">
          <div className="grid gap-3">
            <Slider label="Zoom" value={zoom} min={1} max={3} step={0.01} onChange={setZoom} icon={<ZoomIn size={15} />} />
            {/* Sem proporcao fixa os limites arrastam-se a mao, portanto o
                cursor da altura nao teria efeito nenhum. */}
            {proporcao !== undefined && (
              <Slider label="Altura dos limites do corte" value={cropHeight} min={45} max={100} step={1} onChange={setCropHeight} suffix="%" />
            )}
          </div>
          <button type="button" disabled={!area || working} onClick={async () => {
            if (!area) return;
            setWorking(true);
            try {
              onApply(await createCroppedCover(source, area, rotacao));
            } catch {
              window.alert("Nao foi possivel recortar esta imagem.");
              setWorking(false);
            }
          }} className="inline-flex items-center justify-center gap-2 rounded-md bg-[var(--chart-1)] px-4 py-2.5 text-[12.5px] font-semibold text-[#16082c] disabled:opacity-40">
            <Check size={15} />
            {working ? "A preparar..." : "Aplicar recorte"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, icon, suffix }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void; icon?: ReactNode; suffix?: string }) {
  return (
    <label className="grid gap-2">
      <span className="flex items-center justify-between gap-3 text-[11.5px] font-medium text-white/45">
        <span className="flex items-center gap-2">{icon}{label}</span>
        <span className="font-mono text-[var(--chart-1)]">{value}{suffix}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-1.5 w-full accent-[var(--chart-1)]" />
    </label>
  );
}

/** Largura maxima da capa gravada. Ver o comentario em createCroppedCover. */
const LARGURA_MAXIMA_CAPA = 1400;

/**
 * Produz a capa final a partir do recorte.
 *
 * Duas coisas alem do recorte:
 *
 * - Aplica a rotacao escolhida. O react-easy-crop devolve a area em
 *   coordenadas da imagem JA rodada, portanto e preciso desenhar a imagem
 *   rodada primeiro e so depois cortar - fazer o contrario cortava o
 *   sitio errado.
 *
 * - Limita a largura a LARGURA_MAXIMA_CAPA. A capa e mostrada num cartao
 *   de algumas centenas de pixeis, e o destino e um documento do
 *   Firestore, que nao passa de 1 MiB. Sem tecto, uma foto de telemovel
 *   recortada podia passar o limite e a gravacao era recusada.
 */
async function createCroppedCover(source: string, area: Area, rotacao = 0): Promise<File> {
  const image = await loadImage(source);

  // Tela intermedia com a imagem rodada. Nas rotacoes de 90 e 270 graus a
  // largura e a altura trocam.
  const radianos = (rotacao * Math.PI) / 180;
  const trocaLados = rotacao === 90 || rotacao === 270;
  const larguraRodada = trocaLados ? image.height : image.width;
  const alturaRodada = trocaLados ? image.width : image.height;

  const rodada = document.createElement("canvas");
  rodada.width = larguraRodada;
  rodada.height = alturaRodada;
  const ctxRodada = rodada.getContext("2d");
  if (!ctxRodada) throw new Error("Canvas indisponivel");
  ctxRodada.translate(larguraRodada / 2, alturaRodada / 2);
  ctxRodada.rotate(radianos);
  ctxRodada.drawImage(image, -image.width / 2, -image.height / 2);

  const escala = Math.min(1, LARGURA_MAXIMA_CAPA / Math.max(1, area.width));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(area.width * escala));
  canvas.height = Math.max(1, Math.round(area.height * escala));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas indisponivel");
  context.imageSmoothingQuality = "high";
  context.drawImage(rodada, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Falha ao gerar a capa")), "image/webp", 0.9);
  });
  return new File([blob], "orion-plan-cover.webp", { type: "image/webp" });
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-[12px] font-medium text-white/50">
      {label}
      {children}
    </label>
  );
}

function HeaderButton({ icon, label, primary, onClick }: { icon: ReactNode; label: string; primary?: boolean; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-[13px] font-semibold transition hover:-translate-y-0.5 ${
      primary ? "bg-[var(--chart-1)] text-[#16082c]" : "border border-white/10 text-white/60 hover:border-[var(--chart-1)] hover:text-white"
    }`}>
      {icon}
      {label}
    </button>
  );
}

function MenuButton({ icon, label, danger, ...props }: { icon: ReactNode; label: string; danger?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props} className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] transition ${
      danger ? "text-[var(--critical)] hover:bg-[var(--critical)]/10" : "text-white/58 hover:bg-white/[0.05] hover:text-white"
    }`}>
      {icon}
      {label}
    </button>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/15 p-2">
      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/25">{label}</div>
      <div className="mt-1 truncate text-[12.5px] font-semibold text-white/68">{value}</div>
    </div>
  );
}

function Pill({ label, tone }: { label: string; tone?: "good" | "gold" }) {
  const cls =
    tone === "good"
      ? "border-[var(--good)]/25 bg-[var(--good)]/10 text-[var(--good)]"
      : tone === "gold"
        ? "border-[var(--chart-1)]/35 bg-[var(--chart-1)]/10 text-[var(--chart-1)]"
        : "border-white/[0.08] bg-white/[0.035] text-white/45";
  return <span className={`rounded-full border px-2.5 py-1 font-semibold ${cls}`}>{label}</span>;
}

function PlansEmpty({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mt-8 flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[var(--panel-surface)] px-6 text-center">
      <ImageIcon size={30} className="text-white/20" />
      <p className="mt-4 text-[14px] font-medium text-white/65">Ainda nao existem planos.</p>
      <button type="button" onClick={onCreate} className="mt-4 rounded-lg bg-[var(--chart-1)] px-4 py-2 text-[12.5px] font-bold text-[#16082c]">
        Criar o primeiro plano
      </button>
    </div>
  );
}

function matchesFilter(plan: AdminPlan, filter: FilterKey) {
  if (filter === "all") return true;
  if (filter === "public") return plan.active === 1;
  if (filter === "private") return plan.active !== 1;
  if (filter === "draft") return !plan.cover_url || parsePlanFeatures(plan.features_json).length === 0;
  if (filter === "promo") return plan.discount_active === 1 || plan.badge_active === 1;
  if (filter === "no_promo") return plan.discount_active !== 1 && plan.badge_active !== 1;
  if (filter === "lifetime") return plan.days === 0;
  if (filter === "monthly") return plan.days > 0 && plan.days <= 31;
  if (filter === "annual") return plan.days >= 365;
  return true;
}

function sortPlans(plans: AdminPlan[], sort: SortKey, metrics: Map<number, PlanMetric>) {
  const rows = [...plans];
  if (sort === "name") return rows.sort((a, b) => a.name.localeCompare(b.name, "pt"));
  if (sort === "price") return rows.sort((a, b) => a.price_cents - b.price_cents);
  if (sort === "sales") return rows.sort((a, b) => (metrics.get(b.id)?.sales ?? 0) - (metrics.get(a.id)?.sales ?? 0));
  if (sort === "recent") return rows.sort((a, b) => b.id - a.id);
  if (sort === "old") return rows.sort((a, b) => a.id - b.id);
  return rows.sort((a, b) => a.sort_order - b.sort_order);
}

function planToPreview(plan: AdminPlan | undefined, coverUrl: string | null, features: string[]): PlanCardData {
  if (!plan) {
    return {
      code: "preview",
      name: "Novo plano",
      description: "Orion Optimizer 2.0 access.",
      price_cents: 0,
      currency: "EUR",
      days: 30,
      support_days: null,
      cover_url: coverUrl,
      badge_text: null,
      badge_active: 0,
      compare_at_cents: null,
      discount_active: 0,
      promo_text: null,
      features,
      cta_text: "Get plan",
    };
  }
  return {
    code: plan.code,
    name: plan.name,
    description: plan.description,
    price_cents: plan.price_cents,
    currency: plan.currency,
    days: plan.days,
    support_days: plan.support_days,
    cover_url: coverUrl,
    badge_text: plan.badge_text,
    badge_active: plan.badge_active,
    compare_at_cents: plan.compare_at_cents,
    discount_active: plan.discount_active,
    promo_text: plan.promo_text,
    features,
    cta_text: plan.cta_text ?? `Get ${plan.name}`,
  };
}

function buildPlanPreview(formData: FormData, coverUrl: string | null, features: string[]): PlanCardData {
  const price = euroValue(formData.get("price"));
  const compareAt = euroValue(formData.get("compareAtPrice"));
  const durationType = String(formData.get("durationType") ?? "days");
  const supportType = String(formData.get("supportType") ?? "none");
  const name = String(formData.get("name") ?? "").trim() || "Novo plano";

  return {
    code: String(formData.get("code") ?? "").trim() || "preview",
    name,
    description: String(formData.get("description") ?? "").trim() || null,
    price_cents: Math.max(0, Math.round(price * 100)),
    currency: "EUR",
    days: durationType === "lifetime" ? 0 : Math.max(1, Number(formData.get("days")) || 30),
    support_days: supportType === "none" ? null : supportType === "lifetime" ? 0 : Math.max(1, Number(formData.get("supportDays")) || 30),
    cover_url: coverUrl,
    badge_text: String(formData.get("badgeText") ?? "").trim() || null,
    badge_active: formData.get("badgeActive") === "1" ? 1 : 0,
    compare_at_cents: compareAt > 0 ? Math.round(compareAt * 100) : null,
    discount_active: formData.get("discountActive") === "1" ? 1 : 0,
    promo_text: String(formData.get("promoText") ?? "").trim() || null,
    features: features.map((feature) => feature.trim()).filter(Boolean).slice(0, 12),
    cta_text: String(formData.get("ctaText") ?? "").trim() || `Get ${name}`,
  };
}

function validationRows(preview: PlanCardData) {
  return [
    { label: "Nome", ok: Boolean(preview.name.trim()) },
    { label: "Banner", ok: Boolean(preview.cover_url) },
    { label: "Preco", ok: preview.price_cents >= 0 },
    { label: "Cargo Discord", ok: true },
    { label: "Beneficios", ok: preview.features.length > 0 },
    { label: "Estado", ok: true },
  ];
}

function euroValue(value: FormDataEntryValue | null): number {
  const parsed = Number(String(value ?? "0").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parsePlanFeatures(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
      : [];
  } catch {
    return [];
  }
}

function money(cents: number, currency: string): string {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function dateShort(seconds: number): string {
  return new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "2-digit" }).format(new Date(seconds * 1000));
}

const inputClass =
  "mt-1.5 w-full rounded-md border border-white/[0.08] bg-[var(--panel-surface-2)] px-3 py-2.5 text-[13.5px] text-white outline-none transition-colors placeholder:text-white/20 focus:border-[var(--chart-1)]";

const iconButton =
  "grid h-8 w-8 place-items-center rounded-lg border border-white/[0.08] text-white/45 transition hover:border-[var(--chart-1)] hover:text-white";

/**
 * Uma seccao do editor.
 *
 * Fica sempre montada e apenas escondida quando nao esta activa: os
 * campos de todas as seccoes tem de ir no mesmo submit. O `hidden` do
 * HTML basta - controlos escondidos continuam a ser submetidos.
 */
function Seccao({ activa, children }: { activa: boolean; children: ReactNode }) {
  return <div hidden={!activa}>{children}</div>;
}
