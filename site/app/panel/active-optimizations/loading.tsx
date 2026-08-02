/**
 * Esqueleto mostrado enquanto a pagina carrega.
 *
 * Tem a FORMA do conteudo real - cabecalho, seis KPIs, cartoes e a coluna
 * lateral - para nada saltar quando os dados chegam. Um spinner centrado
 * nao diz o que vem a seguir e faz a pagina parecer mais lenta do que e.
 *
 * A animacao e so opacidade, que o browser compoe sem voltar a calcular
 * o layout.
 */
export default function Loading() {
  return (
    <div className="animate-pulse pb-4" aria-hidden>
      <header className="flex flex-col gap-5 border-b border-white/[0.06] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Bloco className="h-3 w-24" />
          <Bloco className="mt-3 h-8 w-64" />
          <Bloco className="mt-3 h-4 w-96 max-w-full" />
        </div>
        <div className="flex gap-6">
          <Bloco className="h-9 w-24" />
          <Bloco className="h-9 w-24" />
          <Bloco className="h-10 w-28 rounded-lg" />
        </div>
      </header>

      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-white/[0.07] bg-[var(--panel-surface)] p-4">
            <Bloco className="h-9 w-9 rounded-lg" />
            <Bloco className="mt-3 h-2.5 w-20" />
            <Bloco className="mt-2 h-5 w-14" />
            <Bloco className="mt-1.5 h-2.5 w-24" />
          </div>
        ))}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <div className="flex gap-3">
            <Bloco className="h-10 flex-1 rounded-lg" />
            <Bloco className="h-10 w-[190px] rounded-lg" />
          </div>
          <div className="mt-3 flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Bloco key={i} className="h-7 w-24 rounded-full" />
            ))}
          </div>
          <div className="mt-4 grid gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex gap-4 rounded-xl border border-white/[0.07] bg-[var(--panel-surface)] p-5"
              >
                <Bloco className="h-10 w-10 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex gap-2">
                    <Bloco className="h-6 w-16 rounded-full" />
                    <Bloco className="h-6 w-20 rounded-full" />
                  </div>
                  <Bloco className="mt-3 h-4 w-56 max-w-full" />
                  <Bloco className="mt-2 h-3 w-full max-w-md" />
                  <Bloco className="mt-3 h-3 w-40" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="grid content-start gap-4">
          {[220, 180, 260].map((altura, i) => (
            <Bloco key={i} className="rounded-xl" style={{ height: altura }} />
          ))}
        </aside>
      </div>
    </div>
  );
}

function Bloco({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div className={`rounded bg-white/[0.05] ${className}`} style={style} />;
}
