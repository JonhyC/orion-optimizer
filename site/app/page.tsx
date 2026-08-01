import { activePlans, publicStats, publishedReviews } from "@/lib/site-data";
import { currentUser } from "@/lib/session";
import Nav from "@/components/Nav";
import Hero from "@/components/sections/Hero";
import Features from "@/components/sections/Features";
import Comparison from "@/components/sections/Comparison";
import Packages from "@/components/sections/Packages";
import HowItWorks from "@/components/sections/HowItWorks";
import Stats from "@/components/sections/Stats";
import Reviews from "@/components/sections/Reviews";
import Faq from "@/components/sections/Faq";
import Cta from "@/components/sections/Cta";
import Footer from "@/components/sections/Footer";

// A prova social vem da base de dados a cada pedido: assim que houver
// clientes e avaliacoes reais, aparecem sem ser preciso mexer em codigo.
export const dynamic = "force-dynamic";

export default async function Home() {
  const stats = publicStats();
  const reviews = publishedReviews();
  // activePlans passou a assincrono ao sair do SQLite: o Firestore so
  // responde por rede. Vai em paralelo com a sessao para nao somar esperas.
  const [plans, user] = await Promise.all([activePlans(), currentUser()]);

  return (
    <>
      <Nav signedIn={user !== null} />
      <main className="relative">
        <Hero />
        <Features />
        <Comparison />
        <Packages plans={plans} />
        <HowItWorks />
        <Stats stats={stats} />
        <Reviews reviews={reviews} />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
