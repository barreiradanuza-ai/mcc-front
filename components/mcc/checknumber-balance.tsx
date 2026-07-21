"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Wallet } from "lucide-react";

export function CheckNumberBalance() {
  const [credits, setCredits] = useState<number | null>(null);

  const refresh = useCallback(() => {
    fetch("/api/mcc/admin/checknumber/balance")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setCredits(typeof data?.credits === "number" ? data.credits : -1))
      .catch(() => setCredits(-1));
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener("checknumber:balance-updated", refresh);
    return () => window.removeEventListener("checknumber:balance-updated", refresh);
  }, [refresh]);

  if (credits === null) return null;

  return (
    <a
      href="https://platform.checknumber.ai"
      target="_blank"
      rel="noopener noreferrer"
      className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 transition-colors hover:bg-emerald-100 sm:flex"
    >
      <Wallet className="size-3.5 text-emerald-600" />
      <span className="text-xs text-slate-600">
        <span className="font-bold text-emerald-800">{credits >= 0 ? credits.toLocaleString("pt-BR") : "?"}</span>
        {" "}créditos
      </span>
      <span className="h-3 w-px bg-emerald-300" />
      <span className="text-[10px] font-medium text-emerald-700">CheckNumber</span>
      <ExternalLink className="size-3 text-emerald-400" />
    </a>
  );
}
