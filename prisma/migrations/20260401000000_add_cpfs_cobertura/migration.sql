-- CreateTable
CREATE TABLE "cpfs_cobertura" (
    "cpf" VARCHAR(11) NOT NULL,
    "cobertura" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cpfs_cobertura_pkey" PRIMARY KEY ("cpf")
);
