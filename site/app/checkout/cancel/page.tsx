import Link from "next/link";

export default function CheckoutCancelPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--panel-bg)] px-6">
      <div className="max-w-md rounded-lg border border-white/[0.08] bg-[var(--panel-surface)] p-7 text-center">
        <h1 className="text-2xl font-bold text-white">Pagamento cancelado</h1>
        <p className="mt-3 text-[13.5px] leading-relaxed text-white/45">
          A encomenda ficou pendente e nao alterou a tua licenca.
        </p>
        <Link href="/#packages" className="mt-6 inline-flex rounded-lg bg-[var(--chart-1)] px-5 py-2.5 text-[13px] font-semibold text-[#16082c]">
          Ver planos
        </Link>
      </div>
    </main>
  );
}
