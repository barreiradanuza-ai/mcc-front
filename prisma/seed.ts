
import { PrismaClient } from "../lib/generated/prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "barreiradanuza@gmail.com";
  const password = "Danuza@26";
  const name = "Danuza Barreira";

  const existingUser = await prisma.mccUser.findUnique({ where: { email } });
  if (existingUser) {
    console.log("Usuário já existe:", email);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.mccUser.create({
    data: {
      email,
      name,
      passwordHash,
    },
  });
  console.log("Usuário adicionado com sucesso:", email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
