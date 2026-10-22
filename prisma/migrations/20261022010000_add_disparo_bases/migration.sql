-- CreateTable
CREATE TABLE "disparo_bases" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "arquivo" VARCHAR(255) NOT NULL,
    "headers" JSONB NOT NULL,
    "rows" JSONB NOT NULL,
    "total" INTEGER NOT NULL DEFAULT 0,
    "origem" VARCHAR(40),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disparo_bases_pkey" PRIMARY KEY ("id")
);
