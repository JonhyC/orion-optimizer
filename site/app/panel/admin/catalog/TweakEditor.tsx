"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Trash2, X } from "lucide-react";
import { saveTweakAction } from "../../catalog-actions";
import type { Tweak } from "@/lib/catalog";

type Row = { hive: string; key: string; valueName: string; kind: string; value: string };

const EMPTY: Row = { hive: "HKCU", key: "", valueName: "", kind: "DWord", value: "0" };

export default function TweakEditor({
  tweak,
  onClose,
}: {
  tweak?: Tweak;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState(
    saveTweakAction,
    null as { error?: string; ok?: boolean } | null,
  );

  const [rows, setRows] = useState<Row[]>(
    tweak?.actions.length
      ? tweak.actions.map((a) => ({
          hive: a.hive,
          key: a.key,
          valueName: a.name,
          kind: a.kind,
          value: String(a.value),
        }))
      : [{ ...EMPTY }],
  );

  if (state?.ok) {
    // A pagina revalida sozinha; fechamos para o utilizador ver a lista nova.
    queueMicrotask(onClose);
  }

  return (
    <div className="rounded-2xl border border-[var(--chart-1)]/25 bg-[var(--panel-surface)] p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-white">
          {tweak ? `Editar: ${tweak.name}` : "Novo tweak"}
        </h2>
        <button
          onClick={onClose}
          className="grid h-7 w-7 place-items-center rounded-lg text-white/40 hover:text-white"
          aria-label="Fechar"
        >
          <X size={15} />
        </button>
      </div>

      <form action={formAction} className="space-y-5">
        <input type="hidden" name="originalId" value={tweak?.id ?? ""} />

        {state?.error && (
          <div className="rounded-xl border border-[var(--critical)]/35 bg-[var(--critical)]/10 px-4 py-3 text-[13px] leading-relaxed text-[#ff9a9a]">
            {state.error}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          <Field label="id" hint="categoria.nome-do-tweak">
            <input
              name="id"
              defaultValue={tweak?.id}
              placeholder="game.dvr-background"
              className={input}
            />
          </Field>
          <Field label="Nome">
            <input name="name" defaultValue={tweak?.name} className={input} />
          </Field>
        </div>

        <Field label="Descricao" hint="O que faz e porque vale a pena">
          <textarea
            name="description"
            defaultValue={tweak?.description}
            rows={2}
            className={input}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Camada" hint="0 = sem admin">
            <select name="layer" defaultValue={String(tweak?.layer ?? 0)} className={input}>
              <option value="0">0 — sem admin</option>
              <option value="1">1 — requer admin</option>
            </select>
          </Field>
          <Field label="Impacto">
            <select name="impact" defaultValue={tweak?.impact ?? "medio"} className={input}>
              {["nenhum", "baixo", "medio", "alto", "variavel"].map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="Risco">
            <select name="risk" defaultValue={tweak?.risk ?? "baixo"} className={input}>
              {["nenhum", "baixo", "medio"].map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="Reinicio">
            <label className="mt-2 flex items-center gap-2 text-[13px] text-white/60">
              <input
                type="checkbox"
                name="requiresReboot"
                value="1"
                defaultChecked={tweak?.requiresReboot}
                className="h-4 w-4 accent-[var(--chart-1)]"
              />
              Requer
            </label>
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12px] font-medium text-white/50">
              Alteracoes ao registry
            </span>
            <button
              type="button"
              onClick={() => setRows([...rows, { ...EMPTY }])}
              className="inline-flex items-center gap-1.5 text-[12px] text-[var(--chart-1)] hover:underline"
            >
              <Plus size={13} />
              Linha
            </button>
          </div>

          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[86px_1fr_150px_110px_100px_32px] gap-2">
                <select
                  name="hive"
                  defaultValue={r.hive}
                  className={`${input} !px-2 !text-[12.5px]`}
                >
                  <option>HKCU</option>
                  <option>HKLM</option>
                </select>
                <input
                  name="key"
                  defaultValue={r.key}
                  placeholder="Software\Microsoft\..."
                  className={`${input} !px-2 font-mono !text-[12px]`}
                />
                <input
                  name="valueName"
                  defaultValue={r.valueName}
                  placeholder="NomeDoValor"
                  className={`${input} !px-2 font-mono !text-[12px]`}
                />
                <select
                  name="kind"
                  defaultValue={r.kind}
                  className={`${input} !px-2 !text-[12.5px]`}
                >
                  {["DWord", "String", "QWord", "ExpandString"].map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
                <input
                  name="value"
                  defaultValue={r.value}
                  className={`${input} !px-2 font-mono !text-[12px]`}
                />
                <button
                  type="button"
                  onClick={() => setRows(rows.filter((_, n) => n !== i))}
                  disabled={rows.length === 1}
                  className="grid place-items-center rounded-lg text-white/25 transition-colors hover:text-[var(--critical)] disabled:opacity-20"
                  aria-label="Remover linha"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="So para" hint="Deixa vazio para todos">
            <div className="mt-1 flex gap-4 text-[13px] text-white/60">
              {["desktop", "laptop"].map((c) => (
                <label key={c} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="chassis"
                    value={c}
                    defaultChecked={tweak?.conditions?.chassis?.includes(c)}
                    className="h-4 w-4 accent-[var(--chart-1)]"
                  />
                  {c}
                </label>
              ))}
            </div>
          </Field>
          <Field label="GPU" hint="Deixa vazio para todas">
            <div className="mt-1 flex gap-4 text-[13px] text-white/60">
              {(["NVIDIA", "AMD", "Intel"] as const).map((g) => (
                <label key={g} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="gpuVendor"
                    value={g}
                    defaultChecked={tweak?.conditions?.gpuVendor?.includes(g)}
                    className="h-4 w-4 accent-[var(--chart-1)]"
                  />
                  {g}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Tipo de GPU" hint="Inclui graficos integrados e dedicados">
            <div className="mt-1 flex flex-wrap gap-4 text-[13px] text-white/60">
              {([
                ["integrated", "Integrada"],
                ["dedicated", "Dedicada"],
              ] as const).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="gpuType"
                    value={value}
                    defaultChecked={tweak?.conditions?.gpuType?.includes(value)}
                    className="h-4 w-4 accent-[var(--chart-1)]"
                  />
                  {label}
                </label>
              ))}
            </div>
          </Field>
        </div>

        <Submit editing={!!tweak} />
      </form>
    </div>
  );
}

const input =
  "w-full rounded-lg border border-white/[0.08] bg-[var(--panel-surface-2)] px-3 py-2 text-[13.5px] text-white outline-none focus:border-[var(--chart-1)]";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-white/50">{label}</label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-[11px] text-white/25">{hint}</p>}
    </div>
  );
}

function Submit({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="rounded-lg bg-[var(--chart-1)] px-5 py-2.5 text-[13px] font-semibold text-[#16082c] transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "A gravar…" : editing ? "Guardar alteracoes" : "Criar tweak"}
    </button>
  );
}
