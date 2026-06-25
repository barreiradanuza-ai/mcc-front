"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { HeroSearch } from "@/components/hero-search";
import { PlanList } from "@/components/plan-list";
import { SearchError } from "@/components/search-error";
import { SearchLoading } from "@/components/search-loading";
import { searchPlans } from "@/lib/api";
import type { SearchResponse } from "@/lib/types";

function BuscaContent() {
  const searchParams = useSearchParams();
  const cep = searchParams.get("cep") || "";
  const number = searchParams.get("number") || "";

  const [data, setData] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const doSearch = useCallback(async () => {
    if (!cep || !number) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const result = await searchPlans(cep, number);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [cep, number]);

  useEffect(() => {
    doSearch();
  }, [doSearch]);

  if (!cep || !number) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <HeroSearch />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-gray-500">
            Informe um CEP e número para buscar planos.
          </p>
        </div>
        <Footer />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-50">
        <Header />
        <SearchLoading />
        <Footer />
      </div>
    );
  }

  const address = (() => {
    if (!data) return undefined;
    const { street, neighborhood, city, state } = data.address;
    const line1 = [street, neighborhood].filter(Boolean).join(" - ");
    const line2 = [city, state].filter(Boolean).join("/");
    const full = [line1, line2].filter(Boolean).join(", ");
    return full || undefined;
  })();

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Header />

      <HeroSearch
        initialCep={cep.replace(/(\d{5})(\d{3})/, "$1-$2")}
        initialNumber={number}
        compact
        address={address}
      />

      <main className="flex-1">
        {error ? (
          <SearchError message={error} />
        ) : data && data.plans.length > 0 ? (
          <PlanList
            plans={data.plans}
            totalFromApi={data.totalPlans}
            cep={cep}
            number={number}
          />
        ) : (
          <div className="py-20 text-center">
            <p className="text-lg font-medium text-gray-600">
              Nenhum plano encontrado para este endereço.
            </p>
            <p className="mt-2 text-sm text-gray-400">
              Tente outro CEP ou verifique se o endereço está correto.
            </p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default function BuscaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col bg-gray-50">
          <Header />
          <SearchLoading />
          <Footer />
        </div>
      }
    >
      <BuscaContent />
    </Suspense>
  );
}
