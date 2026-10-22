-- AlterTable
ALTER TABLE "disparo_presets" ADD COLUMN "flow_id" VARCHAR(80),
ADD COLUMN "flow_nome" VARCHAR(160),
ADD COLUMN "impulso_modo" VARCHAR(20) NOT NULL DEFAULT 'criar';

-- AlterTable
ALTER TABLE "disparo_envios" ADD COLUMN "impulso_id" VARCHAR(80),
ADD COLUMN "impulso_status" VARCHAR(40);
