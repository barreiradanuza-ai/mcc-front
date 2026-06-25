import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";
const API_KEY = process.env.API_KEY || "mcc-n8n-2026-secret";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const res = await fetch(
    `${BACKEND_URL}/api/plans?${searchParams.toString()}`,
    {
      headers: { "X-API-Key": API_KEY },
      cache: "no-store",
    },
  );

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    return NextResponse.json(
      data ?? { detail: `Erro do backend (${res.status})` },
      { status: res.status },
    );
  }

  return NextResponse.json(data);
}
