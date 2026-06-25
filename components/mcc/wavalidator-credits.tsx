"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Wallet } from "lucide-react";

export function WavalidatorCredits() {
  const [credits, setCredits] = useState<number | null>(null);

  const refresh = useCallback(() => {
    fetch("/api/mcc/admin/wavalidator/credits")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setCredits(data?.credits ?? -1))
      .catch(() => setCredits(-1));
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener("wavalidator:credits-updated", refresh);
    return () => window.removeEventListener("wavalidator:credits-updated", refresh);
  }, [refresh]);

  if (credits === null) return null;

  return (
    <a
      href="https://wavalidator.com/pricing"
      target="_blank"
      rel="noopener noreferrer"
      className="hidden items-center gap-2 rounded-full bg-amber-50 border border-amber-200 px-3 py-1.5 transition-colors hover:bg-amber-100 sm:flex"
    >
      <Wallet className="size-3.5 text-amber-600" />
      <span className="text-xs text-slate-600">
        <span className="font-bold text-amber-800">{credits >= 0 ? credits.toLocaleString("pt-BR") : "?"}</span>
        {" "}créditos
      </span>
      <span className="h-3 w-px bg-amber-300" />
      <span className="text-[10px] font-medium text-amber-700">Wavalidator</span>
      <ExternalLink className="size-3 text-amber-400" />
    </a>
  );
}
