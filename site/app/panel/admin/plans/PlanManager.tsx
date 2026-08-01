"use client";

import { useRef, useState, type ReactNode } from "react";
import Cropper, { type Area } from "react-easy-crop";
import {
  Check,
  Clock3,
  Crop as CropIcon,
  Eye,
  Globe2,
  Headphones,
  Image as ImageIcon,
  Infinity as InfinityIcon,
  LockKeyhole,
  ListChecks,
  MessageCircle,
  Megaphone,
  Pencil,
  Percent,
  Plus,
  Tag,
  Trash2,
  Upload,
  X,
  ZoomIn,
} from "lucide-react";
import PlanCardDisplay, { type PlanCardData } from "@/components/plans/PlanCardDisplay";
import { createPlanAction, deletePlanAction, updatePlanAction } from "../../actions";

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

type DiscordRoleOption = {
  id: string;
  name: string;
  color: number;
  position: number;
  assignable: boolean;
};

export default function PlanManager({
  plans,
  discordRoles,
  discordError,
}: {
  plans: AdminPlan[];
  discordRoles: DiscordRoleOption[];
  discordError: string | null;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminPlan | null>(null);
  const publicCount = plans.filter((plan) => plan.active === 1).length;
  const roleNames = new Map(discordRoles.map((role) => [role.id, role.name]));
  const roleUsage = Object.fromEntries(
    plans.flatMap((plan) => plan.discord_role_id ? [[plan.discord_role_id, plan.name]] : []),
  );

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Planos</h1>
          <p className="mt-1.5 text-[14px] text-white/40">
            Gere capas, precos, faixas, descontos, duracao e visibilidade dos teus planos.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--chart-1)] px-4 py-2.5 text-[13px] font-semibold text-[#16082c] transition-opacity hover:opacity-90"
        >
          <Plus size={16} />
          Novo plano
        </button>
      </div>

      <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 border-y border-white/[0.06] py-3 text-[12.5px] text-white/40">
        <span><strong className="text-white/75">{plans.length}</strong> no total</span>
        <span><strong className="text-[var(--good)]">{publicCount}</strong> publicos</span>
        <span><strong className="text-white/65">{plans.length - publicCount}</strong> privados</span>
      </div>

      {plans.length === 0 ? (
        <div className="mt-8 flex min-h-64 flex-col items-center justify-center border border-dashed border-white/10 bg-[var(--panel-surface)] px-6 text-center">
          <ImageIcon size={30} className="text-white/20" />
          <p className="mt-4 text-[14px] font-medium text-white/65">Ainda nao existem planos.</p>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-4 text-[13px] font-semibold text-[var(--chart-1)] hover:underline"
          >
            Criar o primeiro plano
          </button>
        </div>
      ) : (
        <div className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.id}
              className="overflow-hidden rounded-lg border border-white/[0.07] bg-[var(--panel-surface)]"
            >
              <div className="relative aspect-[16/9] overflow-hidden border-b border-white/[0.06] bg-[var(--panel-surface-2)]">
                {plan.cover_url ? (
                  <img
                    src={plan.cover_url}
                    alt={`Capa do plano ${plan.name}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full place-items-center">
                    <ImageIcon size={30} className="text-white/15" />
                  </div>
                )}
                {plan.badge_active === 1 && plan.badge_text && (
                  <span className="absolute left-1/2 top-3 z-10 inline-flex max-w-[70%] -translate-x-1/2 items-center gap-1.5 truncate rounded-full bg-[var(--chart-1)] px-3 py-1 text-[9.5px] font-bold uppercase text-[#16082c] shadow-lg shadow-[var(--chart-1)]/20">
                    <Tag size={10} />
                    {plan.badge_text}
                  </span>
                )}
                <span className={`absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold backdrop-blur-md ${
                  plan.active === 1
                    ? "bg-[var(--good)]/15 text-[var(--good)]"
                    : "bg-black/55 text-white/65"
                }`}>
                  {plan.active === 1 ? <Globe2 size={12} /> : <LockKeyhole size={12} />}
                  {plan.active === 1 ? "No site" : "Privado"}
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
                      <div className="text-[11px] text-white/30 line-through">
                        {money(plan.compare_at_cents, plan.currency)}
                      </div>
                    )}
                    <div className={`text-[17px] font-bold ${plan.discount_active === 1 ? "text-[var(--chart-1)]" : "text-white"}`}>
                      {money(plan.price_cents, plan.currency)}
                    </div>
                  </div>
                </div>

                <p className="mt-4 line-clamp-2 min-h-10 text-[13px] leading-5 text-white/40">
                  {plan.description ?? "Sem descricao."}
                </p>

                <div className="mt-3 flex items-center gap-2 text-[11.5px] text-white/35">
                  <ListChecks size={13} />
                  {parsePlanFeatures(plan.features_json).length} informacoes publicas
                </div>

                {plan.discount_active === 1 && plan.promo_text && (
                  <div className="mt-3 flex items-center gap-2 text-[11.5px] font-medium text-[var(--chart-1)]">
                    <Megaphone size={13} />
                    <span className="truncate">{plan.promo_text}</span>
                  </div>
                )}

                <div className="mt-4 grid gap-2 text-[12px] text-white/45">
                  <div className="flex items-center gap-2">
                    {plan.days === 0 ? <InfinityIcon size={15} /> : <Clock3 size={14} />}
                    Licenca: {plan.days === 0 ? "Life-time" : `${plan.days} dias`}
                    <span className="ml-auto">Ordem {plan.sort_order}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Headphones size={14} />
                    Suporte: {plan.support_days === null
                      ? "nao incluido"
                      : plan.support_days === 0
                        ? "Life-time"
                        : `${plan.support_days} dias`}
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageCircle size={14} />
                    Discord: {plan.discord_role_id
                      ? `@${roleNames.get(plan.discord_role_id) ?? "cargo configurado"}`
                      : "sem cargo"}
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-end gap-2 border-t border-white/[0.06] pt-4">
                  <button
                    type="button"
                    onClick={() => setEditing(plan)}
                    title="Editar plano"
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-white/10 px-3 text-[12px] font-medium text-white/60 transition-colors hover:border-[var(--chart-1)] hover:text-white"
                  >
                    <Pencil size={14} />
                    Editar
                  </button>
                  <form
                    action={deletePlanAction}
                    onSubmit={(event) => {
                      if (!window.confirm(`Apagar o plano ${plan.name}?`)) event.preventDefault();
                    }}
                  >
                    <input type="hidden" name="planId" value={plan.id} />
                    <button
                      title="Apagar plano"
                      aria-label={`Apagar ${plan.name}`}
                      className="grid h-9 w-9 place-items-center rounded-md border border-[var(--critical)]/25 text-[var(--critical)] transition-colors hover:bg-[var(--critical)]/10"
                    >
                      <Trash2 size={14} />
                    </button>
                  </form>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {creating && (
        <PlanModal title="Criar plano" onClose={() => setCreating(false)}>
          <PlanForm
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
          <PlanForm
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

function PlanModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[80] overflow-hidden bg-black/75 p-2 backdrop-blur-sm sm:p-4">
      <div className="mx-auto flex max-h-[calc(100vh-1rem)] max-w-3xl flex-col overflow-hidden rounded-lg border border-white/10 bg-[var(--panel-surface)] shadow-2xl sm:max-h-[calc(100vh-2rem)]">
        <header className="flex shrink-0 items-center justify-between border-b border-white/[0.07] px-5 py-4 sm:px-6">
          <h2 className="text-[16px] font-semibold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            title="Fechar"
            aria-label="Fechar"
            className="grid h-8 w-8 place-items-center rounded-md text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <X size={17} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

function PlanForm({
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
  const [durationType, setDurationType] = useState(plan?.days === 0 ? "lifetime" : "days");
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
  const [preview, setPreview] = useState<PlanCardData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const action = mode === "create" ? createPlanAction : updatePlanAction;

  return (
    <form
      action={action}
      onSubmit={(event) => {
        const data = new FormData(event.currentTarget);
        if (data.get("discountActive") === "1") {
          const finalPrice = Number(String(data.get("price") ?? "").replace(",", "."));
          const previousPrice = Number(String(data.get("compareAtPrice") ?? "").replace(",", "."));
          if (!Number.isFinite(previousPrice) || previousPrice <= finalPrice) {
            event.preventDefault();
            window.alert("O preco anterior tem de ser superior ao preco final.");
            return;
          }
        }
        onSubmitted();
      }}
      className="space-y-5 overflow-y-auto overscroll-contain px-4 pb-6 sm:px-6"
    >
      {plan && <input type="hidden" name="planId" value={plan.id} />}

      <nav className="sticky top-0 z-40 -mx-4 flex gap-1 overflow-x-auto border-b border-white/[0.07] bg-[var(--panel-surface)]/95 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        {[
          ["plan-content", "Conteudo"],
          ["plan-access", "Preco e acesso"],
          ["plan-marketing", "Campanha"],
          ["plan-automation", "Automacao"],
        ].map(([target, label], index) => (
          <button
            key={target}
            type="button"
            onClick={(event) => {
              event.currentTarget.form
                ?.querySelector(`#${target}`)
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="inline-flex h-8 shrink-0 items-center gap-2 rounded-md px-3 text-[11.5px] font-medium text-white/45 transition-colors hover:bg-white/[0.05] hover:text-white"
          >
            <span className="text-[10px] font-bold text-[var(--chart-1)]">{index + 1}</span>
            {label}
          </button>
        ))}
      </nav>

      <FormSectionHeading
        id="plan-content"
        number="1"
        title="Conteudo publico"
        description="Tudo o que o cliente le no cartao do plano na pagina principal."
      />

      <div>
        <label className="text-[12px] font-medium text-white/50">Capa do plano</label>
        <div className="mt-2 grid gap-3 sm:grid-cols-[190px_1fr]">
          <div className="aspect-[16/9] overflow-hidden rounded-md border border-white/[0.08] bg-[var(--panel-surface-2)]">
            {coverPreview ? (
              <img src={coverPreview} alt="Pre-visualizacao da capa" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center"><ImageIcon size={24} className="text-white/15" /></div>
            )}
          </div>
          <div className="flex flex-col justify-center gap-2">
            <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-[12px] font-medium text-white/65 transition-colors hover:border-[var(--chart-1)] hover:text-white">
              <Upload size={14} />
              Escolher imagem
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
              <button
                type="button"
                onClick={() => setCropSource(coverPreview)}
                className="inline-flex w-fit items-center gap-2 text-[11.5px] font-medium text-[var(--chart-1)] hover:underline"
              >
                <CropIcon size={13} />
                Ajustar recorte
              </button>
            )}
            <p className="text-[11px] leading-4 text-white/25">PNG, JPEG, WebP ou AVIF. Maximo 5 MB.</p>
            {plan?.cover_url && (
              <label className="flex items-center gap-2 text-[11.5px] text-white/40">
                <input type="checkbox" name="removeCover" value="1" className="h-4 w-4 accent-[var(--chart-1)]" />
                Remover capa atual
              </label>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome">
          <input name="name" required defaultValue={plan?.name ?? ""} placeholder="Premium" className={inputClass} />
        </Field>
        <Field label="Codigo">
          <input name="code" required defaultValue={plan?.code ?? ""} placeholder="premium" pattern="[a-zA-Z0-9._-]{2,32}" className={inputClass} />
        </Field>
      </div>

      <Field label="Descricao">
        <textarea
          name="description"
          defaultValue={plan?.description ?? ""}
          rows={3}
          placeholder="Resumo curto do que este plano inclui"
          className={`${inputClass} resize-none`}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
        <Field label="Informacoes incluidas">
          <textarea
            name="features"
            required
            rows={7}
            maxLength={1200}
            defaultValue={parsePlanFeatures(plan?.features_json ?? null).join("\n")}
            placeholder={"Uma informacao por linha\nOtimizacao de CPU\nConfiguracao de GPU\nRollback incluido"}
            className={`${inputClass} resize-y leading-6`}
          />
          <span className="mt-1.5 block text-[10.5px] font-normal leading-4 text-white/25">
            Uma linha cria um ponto com visto. Maximo de 12 linhas.
          </span>
        </Field>
        <Field label="Texto do botao">
          <input
            name="ctaText"
            required
            maxLength={32}
            defaultValue={plan?.cta_text ?? (plan ? `Get ${plan.name}` : "Get plan")}
            placeholder="Get Pro"
            className={inputClass}
          />
          <span className="mt-1.5 block text-[10.5px] font-normal leading-4 text-white/25">
            Comando apresentado no fundo do cartao.
          </span>
        </Field>
      </div>

      <FormSectionHeading
        id="plan-access"
        number="2"
        title="Preco e acesso"
        description="Valor final, duracao da licenca e posicao no catalogo."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Preco EUR">
          <input name="price" required defaultValue={plan ? (plan.price_cents / 100).toFixed(2) : "0.00"} inputMode="decimal" className={inputClass} />
        </Field>
        <Field label="Duracao">
          <select
            name="durationType"
            value={durationType}
            onChange={(event) => setDurationType(event.target.value)}
            className={inputClass}
          >
            <option value="days">Por dias</option>
            <option value="lifetime">Life-time</option>
          </select>
        </Field>
        <Field label="Numero de dias">
          <input
            name="days"
            type="number"
            min="1"
            required={durationType === "days"}
            disabled={durationType === "lifetime"}
            defaultValue={plan && plan.days > 0 ? plan.days : 30}
            className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-35`}
          />
        </Field>
        <Field label="Ordem">
          <input name="sortOrder" type="number" defaultValue={plan?.sort_order ?? nextOrder} className={inputClass} />
        </Field>
      </div>

      <div className="border-t border-white/[0.07] pt-5">
        <FormSectionHeading
          id="plan-marketing"
          number="3"
          title="Destaques e campanha"
          description="Faixa superior, desconto e mensagem promocional."
          compact
        />
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[13px] font-semibold text-white/75">
              <Tag size={15} className="text-[var(--chart-1)]" />
              Faixa superior
            </div>
            <p className="mt-1 text-[11.5px] text-white/30">
              Texto roxo apresentado por cima do cartao deste plano.
            </p>
          </div>
          <label className="flex items-center gap-2.5 text-[12px] font-medium text-white/55">
            <input
              type="checkbox"
              name="badgeActive"
              value="1"
              checked={badgeActive}
              onChange={(event) => setBadgeActive(event.target.checked)}
              className="h-4 w-4 accent-[var(--chart-1)]"
            />
            Mostrar faixa
          </label>
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label="Texto da faixa">
            <input
              name="badgeText"
              value={badgeText}
              onChange={(event) => setBadgeText(event.target.value)}
              required={badgeActive}
              maxLength={40}
              placeholder="Most Popular"
              className={inputClass}
            />
          </Field>
          <div className="flex min-h-10 items-center justify-center px-2 pb-0.5">
            {badgeActive ? (
              <span className="inline-flex max-w-52 items-center gap-1.5 truncate rounded-full bg-[var(--chart-1)] px-4 py-1.5 text-[10px] font-bold uppercase text-[#16082c] shadow-lg shadow-[var(--chart-1)]/20">
                <Tag size={11} /> {badgeText || "Pré-visualização"}
              </span>
            ) : (
              <span className="text-[11px] text-white/25">Faixa escondida</span>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-white/[0.07] pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[13px] font-semibold text-white/75">
              <Percent size={15} className="text-[var(--chart-1)]" />
              Desconto manual
            </div>
            <p className="mt-1 text-[11.5px] text-white/30">
              O Preco EUR acima e o valor final. O preco anterior aparece riscado no site.
            </p>
          </div>
          <label className="flex items-center gap-2.5 text-[12px] font-medium text-white/55">
            <input
              type="checkbox"
              name="discountActive"
              value="1"
              checked={discountActive}
              onChange={(event) => setDiscountActive(event.target.checked)}
              className="h-4 w-4 accent-[var(--chart-1)]"
            />
            Desconto ativo
          </label>
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-[170px_1fr]">
          <Field label="Preco anterior EUR">
            <input
              name="compareAtPrice"
              type="number"
              defaultValue={plan?.compare_at_cents !== null && plan?.compare_at_cents !== undefined
                ? (plan.compare_at_cents / 100).toFixed(2)
                : ""}
              required={discountActive}
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="39.99"
              className={inputClass}
            />
          </Field>
          <Field label="Anuncio personalizado">
            <div className="relative">
              <Megaphone size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
              <input
                name="promoText"
                defaultValue={plan?.promo_text ?? ""}
                maxLength={80}
                placeholder="Promocao de lancamento - termina domingo"
                className={`${inputClass} pl-9`}
              />
            </div>
          </Field>
        </div>
        {discountActive && (
          <p className="mt-2 text-[11px] text-[var(--warning)]">
            O preco anterior tem de ser superior ao preco final.
          </p>
        )}
      </div>

      <div className="border-t border-white/[0.07] pt-5">
        <FormSectionHeading
          id="plan-automation"
          number="4"
          title="Automacao e publicacao"
          description="Cargo Discord, suporte e visibilidade do plano."
          compact
        />
        <div className="mt-5 flex items-center gap-2 text-[13px] font-semibold text-white/75">
          <MessageCircle size={15} className="text-[var(--chart-1)]" />
          Cargo Discord do plano
        </div>
        <p className="mt-1 text-[11.5px] text-white/30">
          O bot atribui este cargo quando o plano e ativado e remove-o quando termina.
        </p>
        <div className="mt-3">
          {discordError ? (
            <>
              <input type="hidden" name="discordRoleId" value={plan?.discord_role_id ?? ""} />
              <div className="rounded-md border border-[var(--critical)]/20 bg-[var(--critical)]/[0.06] px-3 py-2.5 text-[11.5px] text-[var(--critical)]">
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
                  const suffix = usedBy && !isCurrent
                    ? ` - usado por ${usedBy}`
                    : !role.assignable
                      ? " - acima do bot"
                      : "";
                  return <option key={role.id} value={role.id} disabled={disabled}>@{role.name}{suffix}</option>;
                })}
              </select>
            </Field>
          )}
        </div>
      </div>

      <div className="border-t border-white/[0.07] pt-5">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-white/75">
          <Headphones size={15} className="text-[var(--chart-1)]" />
          Support Plan
        </div>
        <p className="mt-1 text-[11.5px] text-white/30">
          A contagem comeca quando este plano e atribuido ao utilizador.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Duracao do suporte">
            <select
              name="supportType"
              value={supportType}
              onChange={(event) => setSupportType(event.target.value)}
              className={inputClass}
            >
              <option value="none">Sem suporte</option>
              <option value="days">Por dias</option>
              <option value="lifetime">Life-time</option>
            </select>
          </Field>
          <Field label="Dias de suporte">
            <input
              name="supportDays"
              type="number"
              min="1"
              required={supportType === "days"}
              disabled={supportType !== "days"}
              defaultValue={plan?.support_days && plan.support_days > 0 ? plan.support_days : 30}
              className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-35`}
            />
          </Field>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.07] pt-5">
        <label className="flex items-center gap-2.5 text-[12.5px] text-white/55">
          <input
            type="checkbox"
            name="active"
            value="1"
            defaultChecked={plan ? plan.active === 1 : true}
            className="h-4 w-4 accent-[var(--chart-1)]"
          />
          Visivel no site
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(event) => {
              const form = event.currentTarget.form;
              if (form) setPreview(buildPlanPreview(new FormData(form), coverPreview));
            }}
            className="inline-flex items-center gap-2 rounded-md border border-white/12 px-4 py-2.5 text-[13px] font-semibold text-white/70 transition-colors hover:border-[var(--chart-1)] hover:text-white"
          >
            <Eye size={15} />
            Visualizar
          </button>
          <button className="rounded-md bg-[var(--chart-1)] px-5 py-2.5 text-[13px] font-semibold text-[#16082c] transition-opacity hover:opacity-90">
            {mode === "create" ? "Criar plano" : "Guardar alteracoes"}
          </button>
        </div>
      </div>

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

      {preview && <PlanPreviewModal plan={preview} onClose={() => setPreview(null)} />}
    </form>
  );
}

function FormSectionHeading({
  id,
  number,
  title,
  description,
  compact = false,
}: {
  id: string;
  number: string;
  title: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <div id={id} className={`scroll-mt-16 ${compact ? "" : "border-t border-white/[0.07] pt-5 first:border-0 first:pt-0"}`}>
      <div className="flex items-start gap-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[var(--chart-1)]/12 text-[11px] font-bold text-[var(--chart-1)]">
          {number}
        </span>
        <div>
          <h3 className="text-[13px] font-semibold text-white/80">{title}</h3>
          <p className="mt-0.5 text-[11.5px] leading-5 text-white/30">{description}</p>
        </div>
      </div>
    </div>
  );
}

function PlanPreviewModal({ plan, onClose }: { plan: PlanCardData; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pre-visualizacao do plano"
      className="fixed inset-0 z-[110] overflow-y-auto bg-black/90 px-4 py-8 backdrop-blur-md"
      onClick={onClose}
    >
      <div className="mx-auto max-w-md" onClick={(event) => event.stopPropagation()}>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase text-[var(--chart-1)]">Pre-visualizacao</p>
            <h3 className="mt-1 text-[18px] font-semibold text-white">Aspeto no site principal</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Fechar pre-visualizacao"
            aria-label="Fechar pre-visualizacao"
            className="grid h-9 w-9 place-items-center rounded-md border border-white/10 text-white/55 hover:text-white"
          >
            <X size={17} />
          </button>
        </div>
        <PlanCardDisplay plan={plan} preview />
        <p className="mt-4 text-center text-[11px] text-white/30">
          Esta vista ainda nao publica nem guarda alteracoes.
        </p>
      </div>
    </div>
  );
}

function buildPlanPreview(formData: FormData, coverUrl: string | null): PlanCardData {
  const price = euroValue(formData.get("price"));
  const compareAt = euroValue(formData.get("compareAtPrice"));
  const durationType = String(formData.get("durationType") ?? "days");
  const supportType = String(formData.get("supportType") ?? "none");
  const name = String(formData.get("name") ?? "").trim() || "Novo plano";

  return {
    name,
    description: String(formData.get("description") ?? "").trim() || null,
    price_cents: Math.max(0, Math.round(price * 100)),
    currency: "EUR",
    days: durationType === "lifetime" ? 0 : Math.max(1, Number(formData.get("days")) || 30),
    support_days: supportType === "none"
      ? null
      : supportType === "lifetime"
        ? 0
        : Math.max(1, Number(formData.get("supportDays")) || 30),
    cover_url: coverUrl,
    badge_text: String(formData.get("badgeText") ?? "").trim() || null,
    badge_active: formData.get("badgeActive") === "1" ? 1 : 0,
    compare_at_cents: compareAt > 0 ? Math.round(compareAt * 100) : null,
    discount_active: formData.get("discountActive") === "1" ? 1 : 0,
    promo_text: String(formData.get("promoText") ?? "").trim() || null,
    features: String(formData.get("features") ?? "")
      .split(/\r?\n/)
      .map((feature) => feature.trim())
      .filter(Boolean)
      .slice(0, 12),
    cta_text: String(formData.get("ctaText") ?? "").trim() || `Get ${name}`,
  };
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

function CropEditor({
  source,
  onCancel,
  onApply,
}: {
  source: string;
  onCancel: () => void;
  onApply: (file: File) => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [working, setWorking] = useState(false);

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/85 px-4 py-8 backdrop-blur-md">
      <div className="mx-auto max-w-3xl overflow-hidden rounded-lg border border-white/10 bg-[var(--panel-surface)] shadow-2xl">
        <header className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
          <div>
            <h3 className="text-[15px] font-semibold text-white">Recortar capa</h3>
            <p className="mt-1 text-[11.5px] text-white/35">Arrasta a imagem dentro da area 16:9.</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            title="Cancelar recorte"
            aria-label="Cancelar recorte"
            className="grid h-8 w-8 place-items-center rounded-md text-white/45 hover:bg-white/[0.06] hover:text-white"
          >
            <X size={17} />
          </button>
        </header>

        <div className="relative h-[min(52vh,430px)] min-h-72 bg-black">
          <Cropper
            image={source}
            crop={crop}
            zoom={zoom}
            aspect={16 / 9}
            objectFit="contain"
            showGrid
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, pixels) => setArea(pixels)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-4 px-5 py-4">
          <ZoomIn size={16} className="text-white/40" />
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            aria-label="Zoom da capa"
            className="h-1.5 min-w-44 flex-1 accent-[var(--chart-1)]"
          />
          <button
            type="button"
            disabled={!area || working}
            onClick={async () => {
              if (!area) return;
              setWorking(true);
              try {
                onApply(await createCroppedCover(source, area));
              } catch {
                window.alert("Nao foi possivel recortar esta imagem.");
                setWorking(false);
              }
            }}
            className="inline-flex items-center gap-2 rounded-md bg-[var(--chart-1)] px-4 py-2.5 text-[12.5px] font-semibold text-[#16082c] disabled:opacity-40"
          >
            <Check size={15} />
            {working ? "A preparar..." : "Aplicar recorte"}
          </button>
        </div>
      </div>
    </div>
  );
}

async function createCroppedCover(source: string, area: Area): Promise<File> {
  const image = await loadImage(source);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(area.width));
  canvas.height = Math.max(1, Math.round(area.height));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas indisponivel");

  context.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => result ? resolve(result) : reject(new Error("Falha ao gerar a capa")),
      "image/webp",
      0.9,
    );
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

const inputClass =
  "mt-1.5 w-full rounded-md border border-white/[0.08] bg-[var(--panel-surface-2)] px-3 py-2.5 text-[13.5px] text-white outline-none transition-colors placeholder:text-white/20 focus:border-[var(--chart-1)]";

function money(cents: number, currency: string): string {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}
