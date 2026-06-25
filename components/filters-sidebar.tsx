"use client";

import { Checkbox } from "@/components/ui/checkbox";
import type { Plan, FilterState } from "@/lib/types";

interface FiltersSidebarProps {
  plans: Plan[];
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

const SPEED_OPTIONS = [
  { label: "Ao menos 100 Mega", value: 100 },
  { label: "Ao menos 500 Mega", value: 500 },
  { label: "Ao menos 2000 Mega", value: 2000 },
];

const PRICE_OPTIONS = [
  { label: "Até R$ 50", value: 50 },
  { label: "Até R$ 100", value: 100 },
  { label: "Até R$ 150", value: 150 },
  { label: "Até R$ 2000", value: 2000 },
];

export function FiltersSidebar({
  plans,
  filters,
  onFiltersChange,
}: FiltersSidebarProps) {
  const providers = getUniqueProviders(plans);
  const technologies = getUniqueTechnologies(plans);

  function toggleProvider(slug: string) {
    const next = filters.providers.includes(slug)
      ? filters.providers.filter((p) => p !== slug)
      : [...filters.providers, slug];
    onFiltersChange({ ...filters, providers: next });
  }

  function toggleTechnology(tech: string) {
    const next = filters.technologies.includes(tech)
      ? filters.technologies.filter((t) => t !== tech)
      : [...filters.technologies, tech];
    onFiltersChange({ ...filters, technologies: next });
  }

  return (
    <aside className="space-y-6 text-sm">
      {/* Speed */}
      <div>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#0066CC]">
          Velocidade da Internet
        </h3>
        <div className="space-y-2">
          {SPEED_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-2 text-gray-700"
            >
              <input
                type="radio"
                name="speed"
                checked={filters.minSpeed === opt.value}
                onChange={() =>
                  onFiltersChange({
                    ...filters,
                    minSpeed: filters.minSpeed === opt.value ? null : opt.value,
                  })
                }
                className="h-4 w-4 accent-[#0066CC]"
              />
              {opt.label}
            </label>
          ))}
          {filters.minSpeed && (
            <button
              onClick={() => onFiltersChange({ ...filters, minSpeed: null })}
              className="cursor-pointer text-xs text-[#0066CC] hover:underline"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Price */}
      <div>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#0066CC]">
          Preço
        </h3>
        <div className="space-y-2">
          {PRICE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-2 text-gray-700"
            >
              <input
                type="radio"
                name="price"
                checked={filters.maxPrice === opt.value}
                onChange={() =>
                  onFiltersChange({
                    ...filters,
                    maxPrice: filters.maxPrice === opt.value ? null : opt.value,
                  })
                }
                className="h-4 w-4 accent-[#0066CC]"
              />
              {opt.label}
            </label>
          ))}
          {filters.maxPrice && (
            <button
              onClick={() => onFiltersChange({ ...filters, maxPrice: null })}
              className="cursor-pointer text-xs text-[#0066CC] hover:underline"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Providers */}
      {providers.length > 0 && (
        <div>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#0066CC]">
            Provedores
          </h3>
          <div className="space-y-2">
            {providers.map((p) => (
              <label
                key={p.slug}
                className="flex cursor-pointer items-center gap-2 text-gray-700"
              >
                <Checkbox
                  checked={filters.providers.includes(p.slug)}
                  onCheckedChange={() => toggleProvider(p.slug)}
                />
                <span>
                  {p.name}{" "}
                  <span className="text-xs text-gray-400">({p.count})</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Technology */}
      {technologies.length > 0 && (
        <div>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#0066CC]">
            Conexão Via
          </h3>
          <div className="space-y-2">
            {technologies.map((t) => (
              <label
                key={t.value}
                className="flex cursor-pointer items-center gap-2 text-gray-700"
              >
                <Checkbox
                  checked={filters.technologies.includes(t.value)}
                  onCheckedChange={() => toggleTechnology(t.value)}
                />
                <span>
                  {t.label}{" "}
                  <span className="text-xs text-gray-400">({t.count})</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

function getUniqueProviders(plans: Plan[]) {
  const map = new Map<string, { name: string; slug: string; count: number }>();
  for (const p of plans) {
    const existing = map.get(p.providerSlug);
    if (existing) {
      existing.count++;
    } else {
      map.set(p.providerSlug, {
        name: p.providerName,
        slug: p.providerSlug,
        count: 1,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

function getUniqueTechnologies(plans: Plan[]) {
  const map = new Map<
    string,
    { label: string; value: string; count: number }
  >();
  for (const p of plans) {
    const tech = p.technologyValue || p.technology;
    if (!tech) continue;
    const existing = map.get(tech);
    if (existing) {
      existing.count++;
    } else {
      map.set(tech, {
        label: p.technology || tech,
        value: tech,
        count: 1,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}
