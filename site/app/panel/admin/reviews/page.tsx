import { requireRole } from "@/lib/session";
import { getDb } from "@/lib/db";
import { dateTime } from "@/lib/stats";
import { Card } from "@/components/panel/Pieces";
import { setReviewApprovedAction } from "../../actions";

export const dynamic = "force-dynamic";

type Row = {
  id: number;
  author_name: string;
  handle: string | null;
  rig: string | null;
  gain: string | null;
  rating: number;
  body: string;
  approved: number;
  created_at: number;
};

export default async function ReviewsPage() {
  await requireRole("staff");

  const rows = getDb()
    .prepare("SELECT * FROM reviews ORDER BY approved ASC, created_at DESC")
    .all() as Row[];

  const pending = rows.filter((r) => !r.approved);
  const live = rows.filter((r) => r.approved);

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-white">Avaliacoes</h1>
      <p className="mt-1.5 text-[14px] text-white/40">
        Nada aparece no site publico antes de ser aprovado aqui.
      </p>

      <Card
        title={`Por aprovar (${pending.length})`}
        subtitle="Visiveis so nesta pagina"
        className="mt-8"
      >
        {pending.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-white/30">Nada a espera.</p>
        ) : (
          <div className="space-y-4">
            {pending.map((r) => (
              <ReviewRow key={r.id} r={r} />
            ))}
          </div>
        )}
      </Card>

      <Card
        title={`Publicadas (${live.length})`}
        subtitle="A aparecer no site"
        className="mt-5"
      >
        {live.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-white/30">
            Ainda nao ha nenhuma publicada. A seccao de avaliacoes do site mostra
            um estado honesto enquanto estiver assim.
          </p>
        ) : (
          <div className="space-y-4">
            {live.map((r) => (
              <ReviewRow key={r.id} r={r} />
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

function ReviewRow({ r }: { r: Row }) {
  return (
    <article className="rounded-xl border border-white/[0.06] bg-[var(--panel-surface-2)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[14px] font-semibold text-white">{r.author_name}</span>
            {r.handle && <span className="text-[12.5px] text-white/30">{r.handle}</span>}
            <span className="text-[12.5px] text-[var(--warning)]">{"★".repeat(r.rating)}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-3 font-mono text-[11.5px] text-white/30">
            {r.rig && <span>{r.rig}</span>}
            {r.gain && <span className="text-[var(--chart-1)]">{r.gain}</span>}
            <span>{dateTime(r.created_at)}</span>
          </div>
        </div>

        <form action={setReviewApprovedAction} className="shrink-0">
          <input type="hidden" name="reviewId" value={r.id} />
          <input type="hidden" name="approved" value={r.approved ? "0" : "1"} />
          <button
            className={`rounded-md border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
              r.approved
                ? "border-white/15 text-white/50 hover:border-white/30 hover:text-white"
                : "border-[var(--good)]/35 text-[var(--good)] hover:bg-[var(--good)]/10"
            }`}
          >
            {r.approved ? "Esconder" : "Publicar"}
          </button>
        </form>
      </div>

      <p className="mt-4 text-[13.5px] leading-relaxed text-white/55">{r.body}</p>
    </article>
  );
}
