import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureMccSession } from "@/lib/mcc/authz";

export async function GET() {
  const { error } = await ensureMccSession();
  if (error) return error;

  const row = await prisma.appConfig.findUnique({
    where: { key: "wavalidator_credits" },
  });

  return NextResponse.json({
    credits: row ? Number(row.value) : null,
    updatedAt: row?.updatedAt ?? null,
    rechargeUrl: "https://wavalidator.com/pricing",
  });
}
