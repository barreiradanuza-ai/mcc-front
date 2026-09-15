CREATE TABLE "super_lista_nio" (
    "id" BIGSERIAL NOT NULL,
    "cep" CHAR(8) NOT NULL,
    "uf" VARCHAR(2) NOT NULL,
    "municipio" VARCHAR(120),
    "bairro" VARCHAR(160),
    "logradouro" VARCHAR(240),
    "no_fachada" VARCHAR(40),
    "complemento1" VARCHAR(160),
    "complemento2" VARCHAR(160),
    "complemento3" VARCHAR(160),
    "codigo_logradouro" VARCHAR(80),
    "codigo_cdo" VARCHAR(80),
    "classificacao" VARCHAR(80),
    "celula" VARCHAR(80),
    "estacao" VARCHAR(80),
    "viabilidade_atual" VARCHAR(100),
    "regiao" VARCHAR(40),
    "relatorio_origem" VARCHAR(120),
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "super_lista_nio_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "super_lista_nio_cep_idx" ON "super_lista_nio"("cep");
CREATE INDEX "super_lista_nio_uf_municipio_idx" ON "super_lista_nio"("uf", "municipio");
CREATE INDEX "super_lista_nio_viabilidade_idx" ON "super_lista_nio"("viabilidade_atual");
