"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Database, FileSpreadsheet, House, LayoutDashboard, MapPinned, Network, Radio, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/mcc/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/mcc", label: "Processar Planilha", icon: FileSpreadsheet },
  { href: "/mcc/admin/ceps-claro", label: "CEPs Claro", icon: Radio },
  { href: "/mcc/admin/ceps-nio", label: "CEPs Nio", icon: Network },
  { href: "/mcc/admin/ceps-tim", label: "CEPs Tim", icon: Database },
  { href: "/mcc/admin/cidades-promo-claro", label: "Cidades Promo Claro", icon: MapPinned },
  { href: "/mcc/admin/cpfs-cobertura", label: "CPFs Processados", icon: Users },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2 px-2 py-2">
        <House className="size-4 text-slate-500" />
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Navegação MCC</p>
      </div>
      <nav className="flex flex-col gap-1">
        {links.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href ||
            (item.href !== "/mcc" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-mcc-blue text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              )}
            >
              <Icon className="size-4" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
