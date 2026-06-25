"use client";

import { useState, useMemo } from "react";
import { PlanCard } from "./plan-card";
import { FiltersSidebar } from "./filters-sidebar";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Plan, FilterState, SortOption } from "@/lib/types";

interface PlanListProps {
  plans: Plan[];
  totalFromApi: number;
  cep: string;
  number: string;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "ranking", label: "Ranking (recomendados)" },
  { value: "price_asc", label: "Menor preço" },
  { value: "price_desc", label: "Maior preço" },
  { value: "speed_desc", label: "Maior velocidade" },
];

export function PlanList({ plans, totalFromApi, cep, number }: PlanListProps) {
  const [sort, setSort] = useState<SortOption>("ranking");
  const [filters, setFilters] = useState<FilterState>({
    minSpeed: null,
    maxPrice: null,
    providers: [],
    technologies: [],
  });
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const filtered = useMemo(() => {
    let result = [...plans];

    if (filters.minSpeed != null) {
      result = result.filter(
        (p) => (p.downloadSpeed ?? 0) >= filters.minSpeed!,
      );
    }
    if (filters.maxPrice != null) {
      result = result.filter(
        (p) => p.price != null && p.price <= filters.maxPrice!,
      );
    }
    if (filters.providers.length > 0) {
      result = result.filter((p) => filters.providers.includes(p.providerSlug));
    }
    if (filters.technologies.length > 0) {
      result = result.filter(
        (p) =>
          filters.technologies.includes(p.technologyValue) ||
          filters.technologies.includes(p.technology),
      );
    }

    switch (sort) {
      case "price_asc":
        result.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
        break;
      case "price_desc":
        result.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
        break;
      case "speed_desc":
        result.sort((a, b) => (b.downloadSpeed ?? 0) - (a.downloadSpeed ?? 0));
        break;
      default:
        break;
    }

    return result;
  }, [plans, sort, filters]);

  const activeFiltersCount =
    (filters.minSpeed != null ? 1 : 0) +
    (filters.maxPrice != null ? 1 : 0) +
    filters.providers.length +
    filters.technologies.length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Results header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-600">
            <span className="font-bold text-gray-900">
              {filtered.length} RESULTADOS
            </span>{" "}
            <span className="text-[#0066CC] font-medium">
              {cep.replace(/(\d{5})(\d{3})/, "$1-$2")}
            </span>{" "}
            NÚMERO <span className="text-[#0066CC] font-medium">{number}</span>
          </p>

          {/* Mobile filter toggle */}
          <Button
            variant="outline"
            size="sm"
            className="lg:hidden"
            onClick={() => setShowMobileFilters(!showMobileFilters)}
          >
            <SlidersHorizontal className="mr-1 h-4 w-4" />
            Filtros
            {activeFiltersCount > 0 && (
              <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#0066CC] text-xs text-white">
                {activeFiltersCount}
              </span>
            )}
          </Button>
        </div>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className="cursor-pointer rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-6">
        {/* Desktop sidebar */}
        <div className="hidden w-60 shrink-0 lg:block">
          <FiltersSidebar
            plans={plans}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </div>

        {/* Mobile sidebar overlay */}
        {showMobileFilters && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-black/30"
              onClick={() => setShowMobileFilters(false)}
            />
            <div className="absolute bottom-0 left-0 right-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-bold text-gray-900">Filtros</h2>
                <button
                  className="cursor-pointer"
                  onClick={() => setShowMobileFilters(false)}
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              <FiltersSidebar
                plans={plans}
                filters={filters}
                onFiltersChange={setFilters}
              />
              <Button
                className="mt-6 w-full bg-[#0066CC] text-white hover:bg-[#004E9A]"
                onClick={() => setShowMobileFilters(false)}
              >
                Aplicar filtros ({filtered.length} resultados)
              </Button>
            </div>
          </div>
        )}

        {/* Plan cards */}
        <div className="flex-1 space-y-4">
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center">
              <p className="text-gray-500">
                Nenhum plano encontrado com os filtros selecionados.
              </p>
              <Button
                variant="link"
                className="mt-2 text-[#0066CC]"
                onClick={() =>
                  setFilters({
                    minSpeed: null,
                    maxPrice: null,
                    providers: [],
                    technologies: [],
                  })
                }
              >
                Limpar filtros
              </Button>
            </div>
          ) : (
            filtered.map((plan, i) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                position={i + 1}
                cep={cep}
                number={number}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
