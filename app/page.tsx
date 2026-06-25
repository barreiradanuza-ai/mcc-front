import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { HeroSearch } from "@/components/hero-search";
import {
  Search,
  BarChart3,
  UserCheck,
  Wrench,
  Shield,
  Globe,
  Headphones,
  Zap,
  Eye,
  Clock,
  Instagram,
  Facebook,
} from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <HeroSearch />

      {/* Como Funciona */}
      <section id="como-funciona" className="bg-white px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-2 text-center text-sm font-semibold uppercase tracking-wider text-[#0066CC]">
            Como Funciona
          </h2>
          <p className="mb-12 text-center text-2xl font-bold text-gray-900 sm:text-3xl">
            Encontrar o melhor plano em 4 passos
          </p>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Search,
                step: "01",
                title: "Análise da sua região",
                desc: "Verificamos quais operadoras de fibra atendem seu endereço.",
              },
              {
                icon: BarChart3,
                step: "02",
                title: "Comparação inteligente",
                desc: "Analisamos planos, velocidade, estabilidade e custo-benefício.",
              },
              {
                icon: UserCheck,
                step: "03",
                title: "Indicação personalizada",
                desc: "Indicamos a melhor opção para sua casa, sem viés.",
              },
              {
                icon: Wrench,
                step: "04",
                title: "Instalação acompanhada",
                desc: "Cuidamos do processo até sua internet estar funcionando.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="group rounded-xl border border-gray-100 bg-gray-50 p-6 transition-all hover:border-[#0066CC]/20 hover:bg-white hover:shadow-lg"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-[#0066CC]/10 text-[#0066CC] transition-colors group-hover:bg-[#0066CC] group-hover:text-white">
                  <item.icon className="h-6 w-6" />
                </div>
                <span className="text-xs font-bold text-[#0066CC]/50">
                  PASSO {item.step}
                </span>
                <h3 className="mt-1 mb-2 text-lg font-semibold text-gray-900">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-gray-500">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Por que escolher */}
      <section id="sobre" className="bg-gray-50 px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-2 text-center text-sm font-semibold uppercase tracking-wider text-[#0066CC]">
            Por Que Nos Escolher
          </h2>
          <p className="mb-4 text-center text-2xl font-bold text-gray-900 sm:text-3xl">
            A prioridade é a melhor conexão para sua casa
          </p>
          <p className="mx-auto mb-12 max-w-2xl text-center text-gray-500">
            Não representamos uma operadora específica. Nossa missão é encontrar
            a melhor internet disponível no seu endereço.
          </p>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Globe,
                title: "Atuação Nacional",
                desc: "Parceria com as principais operadoras do Brasil.",
              },
              {
                icon: Headphones,
                title: "Atendimento Especializado",
                desc: "Suporte comercial e técnico do início à instalação.",
              },
              {
                icon: Zap,
                title: "Agilidade Total",
                desc: "Do primeiro contato à instalação, sem burocracia.",
              },
              {
                icon: Eye,
                title: "Transparência",
                desc: "Indicação honesta do melhor plano, sem viés de operadora.",
              },
              {
                icon: Shield,
                title: "Solução Personalizada",
                desc: "Cada endereço recebe uma recomendação sob medida.",
              },
              {
                icon: Clock,
                title: "Processo Acompanhado",
                desc: "Monitoramos cada etapa até a internet funcionar.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-4 rounded-lg border border-gray-100 bg-white p-5"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0066CC]/10 text-[#0066CC]">
                  <item.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="mb-1 font-semibold text-gray-900">
                    {item.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-gray-500">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-[#004E9A] to-[#0077CC] px-4 py-16 text-center text-white">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-4 text-2xl font-bold sm:text-3xl">
            Descubra agora a melhor internet fibra para sua casa
          </h2>
          <p className="mb-8 text-white/80">
            Evite contratar no escuro. Digite seu CEP acima e compare os
            melhores planos disponíveis na sua região.
          </p>
        </div>
      </section>

      {/* Redes sociais — página de vendas */}
      <section
        aria-label="Redes sociais"
        className="border-t border-gray-200 bg-white px-4 py-12"
      >
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 text-center">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#0066CC]">
              Redes sociais
            </h2>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              Acompanhe a Minha Casa Conectada
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <a
              href="https://www.instagram.com/minhacasaconectada_br/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-5 py-3 text-sm font-medium text-gray-800 transition-colors hover:border-[#0066CC]/40 hover:bg-white hover:text-[#0066CC]"
            >
              <Instagram className="h-5 w-5 shrink-0" aria-hidden />
              Instagram
            </a>
            <a
              href="https://www.facebook.com/profile.php?id=61563640237468"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-5 py-3 text-sm font-medium text-gray-800 transition-colors hover:border-[#0066CC]/40 hover:bg-white hover:text-[#0066CC]"
            >
              <Facebook className="h-5 w-5 shrink-0" aria-hidden />
              Facebook
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
