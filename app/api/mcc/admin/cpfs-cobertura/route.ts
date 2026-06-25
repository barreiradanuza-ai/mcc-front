import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureMccSession } from "@/lib/mcc/authz";
import { normalizeCpf, parsePositiveInt } from "@/lib/mcc/admin";

export const runtime = "nodejs";

function getWhere(q: string | null, motivo: string | null) {
  const conditions: Record<string, unknown>[] = [];

  if (motivo === "aprovado") {
    conditions.push({ motivoRecusa: null });
  } else if (motivo && motivo !== "todos") {
    conditions.push({ motivoRecusa: motivo });
  }

  if (q) {
    const trimmed = q.trim();
    const digits = trimmed.replace(/\D/g, "");
    if (digits) {
      conditions.push({ cpf: { contains: digits } });
    } else {
      conditions.push({
        OR: [
          { cobertura: { contains: trimmed, mode: "insensitive" as const } },
          { motivoRecusa: { contains: trimmed, mode: "insensitive" as const } },
        ],
      });
    }
  }

  if (conditions.length === 0) return {};
  if (conditions.length === 1) return conditions[0];
  return { AND: conditions };
}

function getSort(sort: string | null) {
  if (sort === "cpf_desc") return { cpf: "desc" as const };
  if (sort === "cobertura_asc") return { cobertura: "asc" as const };
  if (sort === "cobertura_desc") return { cobertura: "desc" as const };
  if (sort === "motivo_asc") return { motivoRecusa: "asc" as const };
  if (sort === "motivo_desc") return { motivoRecusa: "desc" as const };
  if (sort === "date_desc") return { createdAt: "desc" as const };
  if (sort === "date_asc") return { createdAt: "asc" as const };
  return { cpf: "asc" as const };
}

export async function GET(req: Request) {
  const authResult = await ensureMccSession();
  if ("error" in authResult) return authResult.error;

  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  const motivo = url.searchParams.get("motivo");
  const page = parsePositiveInt(url.searchParams.get("page"), 1, 100000);
  const pageSize = parsePositiveInt(url.searchParams.get("pageSize"), 20, 200);
  const sort = url.searchParams.get("sort");

  const where = getWhere(q, motivo);
  const orderBy = getSort(sort);
  const skip = (page - 1) * pageSize;

  const [total, rows] = await Promise.all([
    prisma.cpfCobertura.count({ where }),
    prisma.cpfCobertura.findMany({
      where,
      orderBy,
      skip,
      take: pageSize,
      select: { cpf: true, cep: true, contato: true, cobertura: true, motivoRecusa: true, createdAt: true },
    }),
  ]);

  const items = rows.map((row) => ({
    cpf: row.cpf,
    cep: row.cep?.trim() ?? null,
    contato: row.contato,
    cobertura: row.cobertura,
    motivoRecusa: row.motivoRecusa,
    createdAt: row.createdAt.toISOString(),
  }));

  return NextResponse.json({
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}

export async function DELETE(req: Request) {
  const authResult = await ensureMccSession();
  if ("error" in authResult) return authResult.error;

  const body = await req.json().catch(() => null);

  if (body?.deleteAll === true) {
    const deleted = await prisma.cpfCobertura.deleteMany({});
    return NextResponse.json({ deleted: deleted.count });
  }

  const rawValues: unknown[] = Array.isArray(body?.values) ? body.values : [];
  if (rawValues.length === 0) {
    return NextResponse.json({ error: "Informe os CPFs para remover" }, { status: 400 });
  }

  const uniqueValues = [
    ...new Set(
      rawValues
        .map((v: unknown) => normalizeCpf(v))
        .filter((value): value is string => typeof value === "string"),
    ),
  ];
  if (uniqueValues.length === 0) {
    return NextResponse.json({ error: "Nenhum CPF válido para remover" }, { status: 400 });
  }

  const deleted = await prisma.cpfCobertura.deleteMany({
    where: { cpf: { in: uniqueValues } },
  });

  return NextResponse.json({ deleted: deleted.count });
}
