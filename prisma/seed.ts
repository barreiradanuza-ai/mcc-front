
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

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
