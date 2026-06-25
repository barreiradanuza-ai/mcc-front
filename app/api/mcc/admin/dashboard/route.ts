import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureMccSession } from "@/lib/mcc/authz";

export const runtime = "nodejs";

export async function GET() {
  const authResult = await ensureMccSession();
  if ("error" in authResult) return authResult.error;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const [total, approved, rejected, todayCount, motivoGroups, coberturaGroups, dailyRaw] =
    await Promise.all([
      prisma.cpfCobertura.count(),
      prisma.cpfCobertura.count({ where: { motivoRecusa: null } }),
      prisma.cpfCobertura.count({ where: { NOT: { motivoRecusa: null } } }),
      prisma.cpfCobertura.count({ where: { createdAt: { gte: today } } }),
      prisma.cpfCobertura.groupBy({
        by: ["motivoRecusa"],
        _count: { cpf: true },
        orderBy: { _count: { cpf: "desc" } },
      }),
      prisma.cpfCobertura.groupBy({
        by: ["cobertura"],
        _count: { cpf: true },
        orderBy: { _count: { cpf: "desc" } },
        take: 10,
      }),
      prisma.$queryRawUnsafe<Array<{ day: Date; count: bigint }>>(
        `SELECT DATE(created_at) as day, COUNT(*)::bigint as count
         FROM cpfs_cobertura
         WHERE created_at >= $1
         GROUP BY DATE(created_at)
         ORDER BY day ASC`,
        thirtyDaysAgo,
      ),
    ]);

  const byMotivo = motivoGroups.map((g) => ({
    motivo: g.motivoRecusa ?? "Aprovado",
    count: g._count.cpf,
  }));

  const byCobertura = coberturaGroups.map((g) => ({
    cobertura: g.cobertura,
    count: g._count.cpf,
  }));

  const byDay = dailyRaw.map((r) => ({
    day: r.day instanceof Date ? r.day.toISOString().slice(0, 10) : String(r.day).slice(0, 10),
    count: Number(r.count),
  }));

  return NextResponse.json({
    totals: { total, approved, rejected, today: todayCount },
    byMotivo,
    byCobertura,
    byDay,
  });
}
