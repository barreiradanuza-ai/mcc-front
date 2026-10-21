-- CreateTable
CREATE TABLE "disparo_presets" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "descricao" TEXT,
    "lista_id" VARCHAR(80),
    "lista_nome" VARCHAR(160),
    "tag_id" VARCHAR(80),
    "tag_nome" VARCHAR(160),
    "pipeline_id" VARCHAR(80),
    "pipeline_nome" VARCHAR(160),
    "stage_id" VARCHAR(80),
    "stage_nome" VARCHAR(160),
    "origem" VARCHAR(120),
    "filtro_coluna" VARCHAR(120),
    "filtro_valor" VARCHAR(120),
    "mapeamento" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "disparo_presets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disparo_envios" (
    "id" SERIAL NOT NULL,
    "preset_id" INTEGER,
    "preset_nome" VARCHAR(120) NOT NULL,
    "arquivo" VARCHAR(255) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "total" INTEGER NOT NULL DEFAULT 0,
    "filtrados" INTEGER NOT NULL DEFAULT 0,
    "criados" INTEGER NOT NULL DEFAULT 0,
    "atualizados" INTEGER NOT NULL DEFAULT 0,
    "falhas" INTEGER NOT NULL DEFAULT 0,
    "mensagem" TEXT,
    "erros" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ,

    CONSTRAINT "disparo_envios_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "disparo_envios" ADD CONSTRAINT "disparo_envios_preset_id_fkey" FOREIGN KEY ("preset_id") REFERENCES "disparo_presets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
