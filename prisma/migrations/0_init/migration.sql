-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "mcc_users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcc_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ceps_claro" (
    "cep" CHAR(8) NOT NULL,

    CONSTRAINT "ceps_claro_pkey" PRIMARY KEY ("cep")
);

-- CreateTable
CREATE TABLE "ceps_tim" (
    "cep" CHAR(8) NOT NULL,

    CONSTRAINT "ceps_tim_pkey" PRIMARY KEY ("cep")
);

-- CreateTable
CREATE TABLE "cidades_promo_claro" (
    "cidade" TEXT NOT NULL,

    CONSTRAINT "cidades_promo_claro_pkey" PRIMARY KEY ("cidade")
);

-- CreateTable
CREATE TABLE "nio_cache_meta" (
    "id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(6),
    "total" INTEGER,

    CONSTRAINT "nio_cache_meta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ceps_nio" (
    "cep" CHAR(8) NOT NULL,

    CONSTRAINT "ceps_nio_pkey" PRIMARY KEY ("cep")
);

-- CreateIndex
CREATE UNIQUE INDEX "mcc_users_email_key" ON "mcc_users"("email");

