"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function formatCep(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length > 5) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return digits;
}

interface HeroSearchProps {
  initialCep?: string;
  initialNumber?: string;
  compact?: boolean;
  address?: string;
}

export function HeroSearch({
  initialCep = "",
  initialNumber = "",
  compact = false,
  address,
}: HeroSearchProps) {
  const [cep, setCep] = useState(initialCep);
  const [number, setNumber] = useState(initialNumber);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8 || !number.trim()) return;
    setLoading(true);
    router.push(
      `/busca?cep=${cleanCep}&number=${encodeURIComponent(number.trim())}`,
    );
  }

  if (compact) {
    return (
      <div className="bg-gradient-to-r from-[#004E9A] to-[#0077CC] px-4 py-6 text-white">
        <div className="mx-auto max-w-4xl">
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-white/80">
                Busque planos do seu endereço:
              </label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="CEP"
                  value={cep}
                  onChange={(e) => setCep(formatCep(e.target.value))}
                  className="h-10 border-white/20 bg-white/10 text-white placeholder:text-white/50 focus:border-white/40"
                />
                <Input
                  type="text"
                  placeholder="Nº"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  className="h-10 w-24 border-white/20 bg-white/10 text-white placeholder:text-white/50 focus:border-white/40"
                />
                <Button
                  type="submit"
                  disabled={loading}
                  className="h-10 bg-[var(--color-mcc-secondary)] px-6 font-semibold text-white hover:bg-[var(--color-mcc-secondary-hover)]"
                >
                  {loading ? "..." : "VER PLANOS"}
                </Button>
              </div>
            </div>
          </form>
          {address && (
            <p className="mt-2 flex items-center gap-1 text-xs text-white/70">
              <MapPin className="h-3 w-3" />
              {address}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#004E9A] via-[#0066CC] to-[#0077CC] px-4 py-20 text-white sm:py-28">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
      <div className="relative mx-auto max-w-3xl text-center">
        <h1 className="mb-4 text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
          Internet Fibra Óptica: encontre o{" "}
          <span className="text-[#7dd3fc]">MELHOR plano</span> para sua casa
        </h1>
        <p className="mb-10 text-base text-white/80 sm:text-lg">
          Informe seu CEP e número da residência para ver as ofertas disponíveis
          no seu endereço:
        </p>

        <form
          onSubmit={handleSubmit}
          className="mx-auto max-w-xl rounded-2xl bg-white/10 p-6 backdrop-blur-sm"
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <label className="mb-1 block text-left text-xs font-medium text-white/70">
                CEP
              </label>
              <Input
                type="text"
                placeholder="00000-000"
                value={cep}
                onChange={(e) => setCep(formatCep(e.target.value))}
                className="h-12 border-white/20 bg-white text-gray-900 placeholder:text-gray-400"
              />
            </div>
            <div className="w-full sm:w-28">
              <label className="mb-1 block text-left text-xs font-medium text-white/70">
                Nº da residência
              </label>
              <Input
                type="text"
                placeholder="Nº"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                className="h-12 border-white/20 bg-white text-gray-900 placeholder:text-gray-400"
              />
            </div>
            <div className="flex items-end">
              <Button
                type="submit"
                disabled={loading}
                size="lg"
                className="h-12 w-full bg-[var(--color-mcc-secondary)] px-8 text-base font-bold text-white hover:bg-[var(--color-mcc-secondary-hover)] sm:w-auto"
              >
                <Search className="mr-2 h-4 w-4" />
                {loading ? "BUSCANDO..." : "VER PLANOS"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}
