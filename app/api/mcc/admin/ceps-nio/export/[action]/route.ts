import { NextResponse } from "next/server";
import { ensureMccSession } from "@/lib/mcc/authz";

export const runtime = "nodejs";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.minhacasaconectada.net.br";
const API_KEY = process.env.MCC_BACKEND_API_KEY || process.env.API_KEY || "mcc-n8n-2026-secret";

export async function POST(req: Request, context: { params: Promise<{ action: string }> }) {
  const auth = await ensureMccSession();
  if ("error" in auth) return auth.error;
  const { action } = await context.params;
  if (!["start", "cancel"].includes(action)) return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  const body = action === "cancel" ? await req.text() : undefined;
  const response = await fetch(`${BACKEND_URL}/api/nio/export/${action}`, {
    method: "POST",
    headers: { "x-api-key": API_KEY, ...(body ? { "content-type": "application/json" } : {}) },
    body: body || undefined,
    cache: "no-store",
  });
  return NextResponse.json(await response.json(), { status: response.status });
}

export async function GET(req: Request, context: { params: Promise<{ action: string }> }) {
  const auth = await ensureMccSession();
  if ("error" in auth) return auth.error;
  const { action } = await context.params;
  const incoming = new URL(req.url);
  const response = await fetch(`${BACKEND_URL}/api/nio/export/${action}${incoming.search}`, {
    headers: { "x-api-key": API_KEY }, cache: "no-store",
  });
  if (action === "download") {
    return new NextResponse(await response.arrayBuffer(), {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") || "application/octet-stream", "content-disposition": response.headers.get("content-disposition") || "attachment" },
    });
  }
  return NextResponse.json(await response.json(), { status: response.status });
}
