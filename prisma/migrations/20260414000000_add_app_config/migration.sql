-- CreateTable
CREATE TABLE "app_config" (
    "key" VARCHAR(50) NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "app_config_pkey" PRIMARY KEY ("key")
);
