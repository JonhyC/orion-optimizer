import { requireRole } from "@/lib/session";
import { listCoupons } from "@/lib/repo/coupons";
import { dateTime, money } from "@/lib/stats";
import { Card, StatusBadge } from "@/components/panel/Pieces";
import { setCouponActiveAction } from "../../actions";
import CouponCreator from "./CouponCreator";

export const dynamic = "force-dynamic";

export default async function CouponsPage() {
  await requireRole("owner");
  const coupons = await listCoupons();

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-white">Cupoes</h1>
      <p className="mt-1.5 text-[14px] text-white/40">
        Codigos de desconto usados no checkout dos planos publicos.
      </p>

      <div className="mt-8">
        <CouponCreator />
      </div>

      <Card className="mt-5">
        {coupons.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-white/30">Ainda nao ha cupoes.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr>
                  {["Codigo", "Desconto", "Usos", "Expira", "Estado", ""].map((h) => (
                    <th key={h} className="border-b border-white/[0.06] px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wide text-white/35">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {coupons.map((coupon) => (
                  <tr key={coupon.id}>
                    <td className="border-b border-white/[0.04] px-3 py-3">
                      <div className="font-mono text-white/80">{coupon.code}</div>
                      {coupon.description && <div className="mt-1 text-[11.5px] text-white/30">{coupon.description}</div>}
                    </td>
                    <td className="border-b border-white/[0.04] px-3 py-3 text-white/65">
                      {coupon.percent_off !== null
                        ? `${coupon.percent_off}%`
                        : money(coupon.amount_off_cents ?? 0, coupon.currency)}
                    </td>
                    <td className="border-b border-white/[0.04] px-3 py-3 tabular-nums text-white/45">
                      {coupon.redeemed}{coupon.max_redemptions ? ` / ${coupon.max_redemptions}` : ""}
                    </td>
                    <td className="border-b border-white/[0.04] px-3 py-3 tabular-nums text-white/45">
                      {coupon.expires_at ? dateTime(coupon.expires_at) : "sem prazo"}
                    </td>
                    <td className="border-b border-white/[0.04] px-3 py-3">
                      <StatusBadge status={coupon.active === 1 ? "active" : "suspended"} />
                    </td>
                    <td className="border-b border-white/[0.04] px-3 py-3 text-right">
                      <form action={setCouponActiveAction}>
                        <input type="hidden" name="couponId" value={coupon.id} />
                        <button
                          name="active"
                          value={coupon.active === 1 ? "0" : "1"}
                          className="rounded-md border border-white/10 px-2.5 py-1 text-[11.5px] text-white/60 hover:border-[var(--chart-1)] hover:text-white"
                        >
                          {coupon.active === 1 ? "Desativar" : "Ativar"}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
