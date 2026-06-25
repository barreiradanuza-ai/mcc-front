"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltipContent,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
  Tooltip,
  Legend,
} from "recharts";
import {
  Users,
  CheckCircle2,
  XCircle,
  CalendarDays,
  LayoutDashboard,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface DashboardData {
  totals: { total: number; approved: number; rejected: number; today: number };
  byMotivo: Array<{ motivo: string; count: number }>;
  byCobertura: Array<{ cobertura: string; count: number }>;
  byDay: Array<{ day: string; count: number }>;
}

const MOTIVO_COLORS: Record<string, string> = {
  Aprovado: "hsl(152, 60%, 45%)",
  "Sem cobertura": "hsl(0, 70%, 55%)",
  "Sem WhatsApp": "hsl(270, 60%, 55%)",
  "Número incorreto": "hsl(35, 90%, 55%)",
};

const BAR_COLOR = "hsl(210, 80%, 50%)";

const motivoConfig: ChartConfig = {
  Aprovado: { label: "Aprovado", color: MOTIVO_COLORS["Aprovado"] },
  "Sem cobertura": { label: "Sem cobertura", color: MOTIVO_COLORS["Sem cobertura"] },
  "Sem WhatsApp": { label: "Sem WhatsApp", color: MOTIVO_COLORS["Sem WhatsApp"] },
  "Número incorreto": { label: "Número incorreto", color: MOTIVO_COLORS["Número incorreto"] },
};

const coberturaConfig: ChartConfig = {
  count: { label: "CPFs", color: BAR_COLOR },
};

const areaConfig: ChartConfig = {
  count: { label: "Processados", color: "hsl(210, 80%, 50%)" },
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/mcc/admin/dashboard");
      if (!res.ok) throw new Error("Falha ao carregar dashboard");
      const json: DashboardData = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-mcc-blue/10">
            <LayoutDashboard className="size-5 text-mcc-blue" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
            <p className="text-sm text-slate-500">Visão geral dos processamentos</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card><CardContent className="pt-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
          <Card><CardContent className="pt-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
        </div>
        <Card><CardContent className="pt-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-slate-500">
        <XCircle className="size-10 text-red-400" />
        <p>{error || "Sem dados"}</p>
      </div>
    );
  }

  const { totals, byMotivo, byCobertura, byDay } = data;

  const kpis = [
    { label: "Total processados", value: totals.total, icon: Users, color: "text-slate-600", bg: "bg-slate-50" },
    { label: "Aprovados", value: totals.approved, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Recusados", value: totals.rejected, icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
    { label: "Hoje", value: totals.today, icon: CalendarDays, color: "text-mcc-blue", bg: "bg-mcc-light" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-mcc-blue/10">
          <LayoutDashboard className="size-5 text-mcc-blue" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">Visão geral dos processamentos</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="gap-0 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription className="text-xs font-medium uppercase tracking-wider">
                  {kpi.label}
                </CardDescription>
                <div className={`flex size-8 items-center justify-center rounded-lg ${kpi.bg}`}>
                  <Icon className={`size-4 ${kpi.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <p className={`text-3xl font-bold ${kpi.color}`}>
                  {kpi.value.toLocaleString("pt-BR")}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por motivo</CardTitle>
            <CardDescription>Distribuição de aprovados vs recusados</CardDescription>
          </CardHeader>
          <CardContent>
            {byMotivo.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Sem dados</p>
            ) : (
              <ChartContainer config={motivoConfig} className="mx-auto aspect-square max-h-[280px]">
                <PieChart>
                  <Tooltip content={<ChartTooltipContent hideLabel />} />
                  <Legend content={<ChartLegendContent nameKey="motivo" />} />
                  <Pie
                    data={byMotivo}
                    dataKey="count"
                    nameKey="motivo"
                    cx="50%"
                    cy="45%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                    strokeWidth={2}
                    stroke="hsl(var(--background))"
                  >
                    {byMotivo.map((entry) => (
                      <Cell
                        key={entry.motivo}
                        fill={MOTIVO_COLORS[entry.motivo] ?? "hsl(210, 10%, 70%)"}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top coberturas</CardTitle>
            <CardDescription>Quantidade de CPFs por tipo de cobertura</CardDescription>
          </CardHeader>
          <CardContent>
            {byCobertura.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Sem dados</p>
            ) : (
              <ChartContainer config={coberturaConfig} className="max-h-[280px]">
                <BarChart data={byCobertura} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <YAxis
                    dataKey="cobertura"
                    type="category"
                    width={100}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <XAxis type="number" hide />
                  <Tooltip content={<ChartTooltipContent hideLabel />} />
                  <Bar dataKey="count" fill={BAR_COLOR} radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Processamentos por dia</CardTitle>
          <CardDescription>Últimos 30 dias</CardDescription>
        </CardHeader>
        <CardContent>
          {byDay.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Sem dados</p>
          ) : (
            <ChartContainer config={areaConfig} className="max-h-[260px]">
              <AreaChart data={byDay} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(210, 80%, 50%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(210, 80%, 50%)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => {
                    const d = new Date(String(v) + "T00:00:00");
                    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
                  }}
                  tick={{ fontSize: 11 }}
                />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTooltipContent />} labelFormatter={(v) => {
                  const d = new Date(String(v) + "T00:00:00");
                  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
                }} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(210, 80%, 50%)"
                  strokeWidth={2}
                  fill="url(#fillCount)"
                />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
