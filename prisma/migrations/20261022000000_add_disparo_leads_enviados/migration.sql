-- CreateTable
CREATE TABLE "disparo_leads_enviados" (
    "id" SERIAL NOT NULL,
    "telefone" VARCHAR(16) NOT NULL,
    "cpf" VARCHAR(11),
    "dc_lead_id" VARCHAR(80),
    "envio_id" INTEGER,
    "preset_nome" VARCHAR(120),
    "tag_nome" VARCHAR(160),
    "enviado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disparo_leads_enviados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "disparo_leads_enviados_telefone_key" ON "disparo_leads_enviados"("telefone");

-- CreateIndex
CREATE INDEX "disparo_leads_enviados_cpf_idx" ON "disparo_leads_enviados"("cpf");
