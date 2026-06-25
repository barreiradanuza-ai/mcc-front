import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureMccSession } from "@/lib/mcc/authz";
import { getResourceConfig, normalizeValue, parsePositiveInt } from "@/lib/mcc/admin";

export const runtime = "nodejs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getDelegate(resource: string): any {
  switch (resource) {
    case "ceps-claro":
      return prisma.cepClaro;
    case "ceps-nio":
      return prisma.cepNio;
    case "ceps-tim":
      return prisma.cepTim;
    case "cidades-promo-claro":
      return prisma.cidadePromoClaro;
    default:
      return null;
  }
}

function getSort(column: "cep" | "cidade", sort: string | null) {
  if (sort === "value_desc") return { [column]: "desc" as const };
  return { [column]: "asc" as const };
}

function getWhere(column: "cep" | "cidade", search: string | null) {
  if (!search) return {};
  if (column === "cep") {
    const digits = search.replace(/\D/g, "");
    if (!digits) return {};
    return { [column]: { contains: digits } };
  }
  return { [column]: { contains: search.trim().toUpperCase(), mode: "insensitive" as const } };
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ resource: string }> },
) {
  const authResult = await ensureMccSession();
  if ("error" in authResult) return authResult.error;

  const { resource } = await context.params;
  const config = getResourceConfig(resource);
  const delegate = getDelegate(resource);
  if (!config || !delegate) {
    return NextResponse.json({ error: "Recurso inválido" }, { status: 404 });
  }

  const url = new URL(_req.url);
  const q = url.searchParams.get("q");
  const page = parsePositiveInt(url.searchParams.get("page"), 1, 100000);
  const pageSize = parsePositiveInt(url.searchParams.get("pageSize"), 20, 200);
  const sort = url.searchParams.get("sort");

  const where = getWhere(config.column, q);
  const orderBy = getSort(config.column, sort);
  const skip = (page - 1) * pageSize;

  const [total, rows] = await Promise.all([
    delegate.count({ where }),
    delegate.findMany({
      where,
      orderBy,
      skip,
      take: pageSize,
      select: { [config.column]: true },
    }),
  ]);

  const items = rows.map((row: Record<string, string>) => {
    const value = row[config.column];
    return { id: value, value };
  });

  return NextResponse.json({
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}

export async function POST(
  req: Request,
  context: { params: Promise<{ resource: string }> },
) {
  const authResult = await ensureMccSession();
  if ("error" in authResult) return authResult.error;

  const { resource } = await context.params;
  const config = getResourceConfig(resource);
  const delegate = getDelegate(resource);
  if (!config || !delegate) {
    return NextResponse.json({ error: "Recurso inválido" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const rawValues: unknown[] = Array.isArray(body?.values) ? body.values : [];
  if (rawValues.length === 0) {
    return NextResponse.json({ error: "Informe ao menos um valor" }, { status: 400 });
  }
  if (rawValues.length > 5000) {
    return NextResponse.json({ error: "Limite de 5000 registros por operação" }, { status: 400 });
  }

  const uniqueValues = [
    ...new Set(
      rawValues
        .map((v: unknown) => normalizeValue(resource, v))
        .filter((value): value is string => typeof value === "string"),
    ),
  ];
  if (uniqueValues.length === 0) {
    return NextResponse.json({ error: "Nenhum valor válido para inserir" }, { status: 400 });
  }

  const created = await delegate.createMany({
    data: uniqueValues.map((value) => ({ [config.column]: value })),
    skipDuplicates: true,
  });

  return NextResponse.json({
    inserted: created.count,
    ignored: uniqueValues.length - created.count,
    totalValid: uniqueValues.length,
  });
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ resource: string }> },
) {
  const authResult = await ensureMccSession();
  if ("error" in authResult) return authResult.error;

  const { resource } = await context.params;
  const config = getResourceConfig(resource);
  const delegate = getDelegate(resource);
  if (!config || !delegate) {
    return NextResponse.json({ error: "Recurso inválido" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const rawValues: unknown[] = Array.isArray(body?.values) ? body.values : [];
  if (rawValues.length === 0) {
    return NextResponse.json({ error: "Informe os valores para remover" }, { status: 400 });
  }

  const uniqueValues = [
    ...new Set(
      rawValues
        .map((v: unknown) => normalizeValue(resource, v))
        .filter((value): value is string => typeof value === "string"),
    ),
  ];
  if (uniqueValues.length === 0) {
    return NextResponse.json({ error: "Nenhum valor válido para remover" }, { status: 400 });
  }

  const deleted = await delegate.deleteMany({
    where: { [config.column]: { in: uniqueValues } },
  });

  return NextResponse.json({ deleted: deleted.count });
}
