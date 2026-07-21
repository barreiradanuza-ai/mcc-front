import { NextResponse } from "next/server";
import { ensureMccSession } from "@/lib/mcc/authz";
import { getBalance } from "@/lib/mcc/validators/whatsappChecker";

export async function GET() {
  const { error } = await ensureMccSession();
  if (error) return error;

  const credits = await getBalance();

  return NextResponse.json({
    credits,
    dashboardUrl: "https://platform.checknumber.ai",
  });
}
