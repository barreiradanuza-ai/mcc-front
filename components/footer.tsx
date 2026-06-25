import { Phone, MapPin } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t bg-[#003366] text-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="mb-4">
              <Image
                src="/logos/logo-white.png"
                alt="Minha Casa Conectada"
                width={500}
                height={500}
                className="h-24 w-auto sm:h-28"
              />
            </div>
            <p className="text-sm leading-relaxed text-white/70">
              Especializada em intermediação, comparação e comercialização de
              planos de internet banda larga de diferentes operadoras.
            </p>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold tracking-wide text-white">
              Links
            </h3>
            <ul className="space-y-2 text-sm text-white/70">
              <li>
                <Link href="/" className="transition-colors hover:text-white">
                  Internet Fibra
                </Link>
              </li>
              <li>
                <Link
                  href="/#como-funciona"
                  className="transition-colors hover:text-white"
                >
                  Como Funciona
                </Link>
              </li>
              <li>
                <Link
                  href="/#sobre"
                  className="transition-colors hover:text-white"
                >
                  Sobre Nós
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold tracking-wide text-white">
              Contato
            </h3>
            <ul className="space-y-4 text-sm text-white/80">
              <li className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-white/60" />
                <span className="leading-relaxed">
                  Av. das Américas, 17.701 — Sala 0203
                  <br />
                  Rio de Janeiro — RJ — CEP 22.790-703
                  <br />
                  Brasil
                </span>
              </li>
              <li>
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-white/60" />
                  <a
                    href="tel:+5521994159540"
                    className="transition-colors hover:text-white"
                  >
                    +55 (11) 9224-9541

                  </a>
                </div>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold tracking-wide text-white">
              Legal
            </h3>
            <ul className="space-y-2 text-sm text-white/70">
              <li>
                <Link
                  href="/politica"
                  className="transition-colors hover:text-white"
                >
                  Política de Privacidade
                </Link>
              </li>
              <li>
                <Link
                  href="/termos"
                  className="transition-colors hover:text-white"
                >
                  Termos de Uso
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6">
          <div className="flex flex-col items-center justify-between gap-4 text-xs text-white/50 sm:flex-row">
            <p>MINHA CASA CONECTADA LTDA &bull; CNPJ: 65.357.689/0001-51</p>
            <p>
              Desenvolvido por{" "}
              <a
                href="https://suamarca.digital"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/60 underline decoration-white/30 underline-offset-2 transition-colors hover:text-white/90"
              >
                suamarca.digital
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
