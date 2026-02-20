-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "plan_id" TEXT;

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stripe_price_id" TEXT NOT NULL,
    "price" DECIMAL(10,2),
    "max_users" INTEGER NOT NULL,
    "max_queries" INTEGER,
    "max_receivables" INTEGER,
    "max_storage_gb" INTEGER,
    "features" JSONB NOT NULL DEFAULT '{}',
    "additional_query_fee" DECIMAL(10,2),
    "additional_receivable_fee" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plans_name_key" ON "plans"("name");

-- CreateIndex
CREATE UNIQUE INDEX "plans_stripe_price_id_key" ON "plans"("stripe_price_id");

-- CreateIndex
CREATE INDEX "idx_tenants_plan_id" ON "tenants"("plan_id");

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
