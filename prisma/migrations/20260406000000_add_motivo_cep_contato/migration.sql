-- AlterTable
ALTER TABLE "cpfs_cobertura" ADD COLUMN IF NOT EXISTS "motivo_recusa" TEXT;
ALTER TABLE "cpfs_cobertura" ADD COLUMN IF NOT EXISTS "cep" CHAR(8);
ALTER TABLE "cpfs_cobertura" ADD COLUMN IF NOT EXISTS "contato" VARCHAR(13);
