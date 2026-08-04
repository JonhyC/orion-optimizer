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
  // Tudo isto saiu do SQLite e passou a responder por rede. As quatro
  // leituras sao independentes: em serie somavam quatro idas ao Firestore
  // (~93ms cada) ao tempo de abertura da pagina inicial.
  //
  // Nenhuma destas quatro pode deitar a pagina inicial abaixo.
  //
  // O publicStats e o publishedReviews ja se protegiam sozinhos, mas o
  // activePlans e o currentUser nao: bastava a base de dados falhar - a
  // quota diaria esgotada, por exemplo - para a home responder com o
  // ecra de "Alguma coisa correu mal".
  //
  // O currentUser era o mais traicoeiro: quem NAO tem sessao nem chega a
  // ler nada, portanto a pagina parecia sa a quem a testava deslogado, e
  // so rebentava para quem tinha sessao iniciada.
  //
  // Falhar para "sem planos" e "sem sessao" e seguro: a pagina abre, o
  // conteudo institucional aparece, e o botao de entrar continua la.
  const seguro = async <T,>(nome: string, ler: () => Promise<T>, aoFalhar: T): Promise<T> => {
    try {
      return await ler();
    } catch (erro) {
      console.error(`[orion] ${nome} indisponivel na home:`, (erro as Error)?.message ?? erro);
      return aoFalhar;
    }
  };

  const [stats, reviews, plans, user] = await Promise.all([
    publicStats(),
    publishedReviews(),
    seguro("planos", activePlans, [] as Awaited<ReturnType<typeof activePlans>>),
    seguro("sessao", currentUser, null),
  ]);

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
