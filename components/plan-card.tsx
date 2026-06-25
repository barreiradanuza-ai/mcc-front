"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { Wifi, ChevronDown, ChevronUp, Check, Star } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { Badge } from "@/components/ui/badge";
import type { Plan } from "@/lib/types";

/** Número comercial (E.164 sem +) — mensagens pré-preenchidas na busca por CEP. */
const WHATSAPP_E164 = "5521994159540";

function formatPriceLine(plan: Plan): string {
  if (plan.price == null) return "Preço: sob consulta";
  const whole = Math.floor(plan.price);
  const cents = String(Math.round((plan.price % 1) * 100)).padStart(2, "0");
  return `Preço: R$ ${whole},${cents}/mês`;
}

function buildPlanWhatsAppUrl(plan: Plan, cep: string, number: string): string {
  const digits = cep.replace(/\D/g, "");
  const cepDisplay =
    digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : cep;
  const speed = plan.downloadLabel || `${plan.downloadSpeed ?? "?"} Mega`;
  const text = [
    "Olá! Vim pela Minha Casa Conectada e tenho interesse neste plano:",
    "",
    `*${plan.planName}*`,
    `Operadora: ${plan.providerName}`,
    `Velocidade: ${speed}`,
    formatPriceLine(plan),
    "",
    `CEP: ${cepDisplay}, nº ${number}`,
    "",
    "Podem me ajudar com a contratação?",
  ].join("\n");
  return `https://wa.me/${WHATSAPP_E164}?text=${encodeURIComponent(text)}`;
}

interface PlanCardProps {
  plan: Plan;
  position: number;
  cep: string;
  number: string;
}

export function PlanCard({ plan, position, cep, number }: PlanCardProps) {
  const [expanded, setExpanded] = useState(false);

  const availableBadge = plan.badges.find(
    (b) => b.includes("Disponível") || b.includes("Disponivel"),
  );
  const unavailableBadge = plan.badges.find(
    (b) => b.includes("Indisponível") || b.includes("Indisponivel"),
  );
  const isAvailable = !!availableBadge && !unavailableBadge;

  const whatsappHref = useMemo(
    () => buildPlanWhatsAppUrl(plan, cep, number),
    [plan, cep, number],
  );

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      {plan.promoted && (
        <div className="bg-[#0066CC]/5 px-4 py-1.5 text-center text-xs font-medium text-[#0066CC]">
          Patrocinado
        </div>
      )}

      <div className="p-4 sm:p-5">
        {/* Header: Logo + Name + Badges */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-white p-1">
              {plan.providerLogo ? (
                <Image
                  src={plan.providerLogo}
                  alt={plan.providerName}
                  width={48}
                  height={48}
                  className="h-auto w-full object-contain"
                  unoptimized
                />
              ) : (
                <span className="text-xs font-bold text-gray-400">
                  {plan.providerName.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold leading-tight text-gray-900 sm:text-base">
                {plan.planName}
              </h3>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {isAvailable && (
                  <Badge
                    variant="outline"
                    className="border-[var(--color-mcc-secondary)]/30 bg-[var(--color-mcc-secondary-light)] text-xs text-[var(--color-mcc-secondary-muted)]"
                  >
                    <Check className="mr-1 h-3 w-3" />
                    Disponível no CEP
                  </Badge>
                )}
                {unavailableBadge && (
                  <Badge
                    variant="outline"
                    className="border-red-200 bg-red-50 text-xs text-red-600"
                  >
                    Indisponível no CEP
                  </Badge>
                )}
                {plan.promoted && (
                  <Badge variant="secondary" className="text-xs text-gray-500">
                    Patrocinado
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {plan.providerRating && (
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              <span className="font-medium text-gray-700">
                {plan.providerRating}
              </span>
              {plan.ratingCount && (
                <span className="text-xs">({plan.ratingCount})</span>
              )}
            </div>
          )}
        </div>

        {/* Main info row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 sm:items-center">
          {/* Speed */}
          <div className="flex items-center gap-2">
            <Wifi className="h-5 w-5 text-[#0066CC]" />
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {plan.downloadLabel || `${plan.downloadSpeed ?? "?"} Mega`}
              </p>
              <p className="text-xs text-gray-500">de internet</p>
            </div>
          </div>

          {/* Price */}
          <div>
            {plan.price != null ? (
              <>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-xs text-gray-500">R$</span>
                  <span className="text-3xl font-bold text-gray-900">
                    {Math.floor(plan.price)}
                  </span>
                  <span className="text-sm font-semibold text-gray-500">
                    ,
                    {String(Math.round((plan.price % 1) * 100)).padStart(
                      2,
                      "0",
                    )}
                  </span>
                  <span className="text-xs text-gray-500">/mês</span>
                </div>
                {plan.setupFee && (
                  <p className="text-xs text-gray-500">{plan.setupFee}</p>
                )}
                {plan.priceExtraInfo.map((info, i) => (
                  <p key={i} className="text-xs text-gray-400">
                    {info}
                  </p>
                ))}
              </>
            ) : (
              <p className="text-sm text-gray-400">Preço sob consulta</p>
            )}
          </div>

          {/* Streaming */}
          <div>
            {plan.streamingServices.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-gray-500">
                  Serviços inclusos
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {plan.streamingServices.map((s) => (
                    <div
                      key={s.name}
                      className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-md border border-gray-100"
                      title={s.name}
                    >
                      {s.logo ? (
                        <Image
                          src={s.logo}
                          alt={s.name}
                          width={24}
                          height={24}
                          className="h-full w-full object-contain"
                          unoptimized
                        />
                      ) : (
                        <span className="text-[8px] font-bold text-gray-400">
                          {s.name.slice(0, 2)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* CTA WhatsApp */}
          <div className="flex justify-center sm:justify-end sm:items-center">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`WhatsApp: oferta ${position}, ${plan.planName}`}
              className="inline-flex w-full min-h-[40px] items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold tracking-tight text-white shadow-[0_2px_8px_rgba(37,211,102,0.35)] ring-1 ring-white/20 transition-colors duration-200 hover:bg-[#20bd5a] hover:shadow-[0_3px_12px_rgba(37,211,102,0.4)] active:translate-y-px sm:w-auto sm:min-w-[168px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]/45 focus-visible:ring-offset-2"
            >
              <FaWhatsapp
                className="h-[18px] w-[18px] shrink-0"
                aria-hidden
              />
              <span>Falar no WhatsApp</span>
            </a>
          </div>
        </div>

        {/* Footer info line */}
        {plan.technology && (
          <p className="mt-3 text-xs text-gray-400">
            {plan.technology}
            {plan.contractDuration
              ? ` · Fidelidade: ${plan.contractDuration} meses`
              : " · Sem fidelidade"}
          </p>
        )}

        {/* Expand/collapse */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 flex cursor-pointer items-center gap-1 text-xs font-medium text-[#0066CC] hover:underline"
        >
          {expanded ? (
            <>
              Menos detalhes <ChevronUp className="h-3 w-3" />
            </>
          ) : (
            <>
              Mais detalhes <ChevronDown className="h-3 w-3" />
            </>
          )}
        </button>

        {expanded && (
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 border-t pt-3 text-sm text-gray-600 sm:grid-cols-3">
            {plan.uploadSpeed != null && (
              <div>
                <span className="text-xs text-gray-400">Upload:</span>{" "}
                {plan.uploadSpeed} Mbps
              </div>
            )}
            {plan.technologyValue && (
              <div>
                <span className="text-xs text-gray-400">Tecnologia:</span>{" "}
                {plan.technology}
              </div>
            )}
            {plan.totalAnnualPrice != null && (
              <div>
                <span className="text-xs text-gray-400">Preço anual:</span> R${" "}
                {plan.totalAnnualPrice.toFixed(2)}
              </div>
            )}
            {plan.breakFee != null && (
              <div>
                <span className="text-xs text-gray-400">
                  Multa cancelamento:
                </span>{" "}
                R$ {plan.breakFee.toFixed(2)}
              </div>
            )}
            {plan.contractDuration != null && (
              <div>
                <span className="text-xs text-gray-400">Fidelidade:</span>{" "}
                {plan.contractDuration} meses
              </div>
            )}
            <div>
              <span className="text-xs text-gray-400">Provedor:</span>{" "}
              {plan.providerName}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
