import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createClient() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set");

  // Strip sslmode from the URL so pg doesn't treat 'require' as 'verify-full'
  const url = raw.replace(/[?&]sslmode=[^&]*/g, "").replace(/\?$/, "");
  const needsSsl = raw.includes("digitalocean") || raw.includes("sslmode");

  const adapter = new PrismaPg({
    connectionString: url,
    ssl: needsSsl ? { rejectUnauthorized: false } : false,
  });

  return new PrismaClient({ adapter });
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = createClient();
    }
    return Reflect.get(globalForPrisma.prisma, prop);
  },
});
