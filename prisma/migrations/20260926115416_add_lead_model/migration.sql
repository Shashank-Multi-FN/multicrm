-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "crmInstanceId" TEXT NOT NULL,
    "companyId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "jobTitle" TEXT,
    "source" TEXT,
    "status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lead_crmInstanceId_idx" ON "Lead"("crmInstanceId");

-- CreateIndex
CREATE INDEX "Lead_companyId_idx" ON "Lead"("companyId");

-- CreateIndex
CREATE INDEX "Lead_crmInstanceId_lastName_idx" ON "Lead"("crmInstanceId", "lastName");

-- CreateIndex
CREATE INDEX "Lead_crmInstanceId_status_idx" ON "Lead"("crmInstanceId", "status");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_crmInstanceId_fkey" FOREIGN KEY ("crmInstanceId") REFERENCES "CrmInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
