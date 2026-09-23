-- CreateTable
CREATE TABLE "cpfs_gerados" (
    "cpf" VARCHAR(11) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cpfs_gerados_pkey" PRIMARY KEY ("cpf")
);
