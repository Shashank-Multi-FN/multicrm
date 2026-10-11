-- CreateEnum
CREATE TYPE "CrmWorkflowEvent" AS ENUM ('RECORD_CREATED', 'RECORD_UPDATED', 'RECORD_DELETED');

-- CreateTable
CREATE TABLE "CrmWorkflow" (
    "id" TEXT NOT NULL,
    "crmInstanceId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "triggerEvent" "CrmWorkflowEvent" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmWorkflowCondition" (
    "id" TEXT NOT NULL,
    "crmInstanceId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "operator" "CrmConditionalOperator" NOT NULL,
    "comparisonValue" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmWorkflowCondition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrmWorkflow_crmInstanceId_moduleKey_enabled_triggerEvent_di_idx" ON "CrmWorkflow"("crmInstanceId", "moduleKey", "enabled", "triggerEvent", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CrmWorkflow_crmInstanceId_moduleKey_id_key" ON "CrmWorkflow"("crmInstanceId", "moduleKey", "id");

-- CreateIndex
CREATE INDEX "CrmWorkflowCondition_crmInstanceId_moduleKey_workflowId_ena_idx" ON "CrmWorkflowCondition"("crmInstanceId", "moduleKey", "workflowId", "enabled", "displayOrder");

-- CreateIndex
CREATE INDEX "CrmWorkflowCondition_crmInstanceId_moduleKey_fieldId_idx" ON "CrmWorkflowCondition"("crmInstanceId", "moduleKey", "fieldId");

-- AddForeignKey
ALTER TABLE "CrmWorkflow" ADD CONSTRAINT "CrmWorkflow_crmInstanceId_fkey" FOREIGN KEY ("crmInstanceId") REFERENCES "CrmInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmWorkflow" ADD CONSTRAINT "CrmWorkflow_crmInstanceId_moduleKey_fkey" FOREIGN KEY ("crmInstanceId", "moduleKey") REFERENCES "CrmModuleConfiguration"("crmInstanceId", "moduleKey") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmWorkflowCondition" ADD CONSTRAINT "CrmWorkflowCondition_crmInstanceId_moduleKey_workflowId_fkey" FOREIGN KEY ("crmInstanceId", "moduleKey", "workflowId") REFERENCES "CrmWorkflow"("crmInstanceId", "moduleKey", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmWorkflowCondition" ADD CONSTRAINT "CrmWorkflowCondition_crmInstanceId_moduleKey_fieldId_fkey" FOREIGN KEY ("crmInstanceId", "moduleKey", "fieldId") REFERENCES "CrmFieldDefinition"("crmInstanceId", "moduleKey", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
