import Link from "next/link";

export default function CheckoutSuccessPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--panel-bg)] px-6">
      <div className="max-w-md rounded-lg border border-[var(--good)]/25 bg-[var(--panel-surface)] p-7 text-center">
        <h1 className="text-2xl font-bold text-white">Pagamento recebido</h1>
        <p className="mt-3 text-[13.5px] leading-relaxed text-white/45">
          A compra ficou registada. O plano fica disponivel na tua area pessoal assim que o provedor confirmar o pagamento.
        </p>
        <Link href="/panel/dashboard" className="mt-6 inline-flex rounded-lg bg-[var(--chart-1)] px-5 py-2.5 text-[13px] font-semibold text-[#16082c]">
          Abrir area pessoal
        </Link>
      </div>
    </main>
  );
}
