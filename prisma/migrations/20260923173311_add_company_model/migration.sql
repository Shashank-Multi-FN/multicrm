-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "crmInstanceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "industry" TEXT,
    "status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Company_crmInstanceId_idx" ON "Company"("crmInstanceId");

-- CreateIndex
CREATE INDEX "Company_crmInstanceId_name_idx" ON "Company"("crmInstanceId", "name");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_crmInstanceId_fkey" FOREIGN KEY ("crmInstanceId") REFERENCES "CrmInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
