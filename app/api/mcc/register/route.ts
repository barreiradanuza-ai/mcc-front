import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (process.env.MCC_ALLOW_REGISTRATION !== "true") {
    return NextResponse.json(
      { error: "Cadastro desabilitado" },
      { status: 403 },
    );
  }

  const body = await req.json();
  const { name, email, password } = body as {
    name?: string;
    email?: string;
    password?: string;
  };

  if (!name?.trim() || !email?.trim() || !password) {
    return NextResponse.json(
      { error: "Nome, email e senha são obrigatórios" },
      { status: 400 },
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: "Senha deve ter no mínimo 6 caracteres" },
      { status: 400 },
    );
  }

  const existing = await prisma.mccUser.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (existing) {
    return NextResponse.json(
      { error: "Email já cadastrado" },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.mccUser.create({
    data: {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
