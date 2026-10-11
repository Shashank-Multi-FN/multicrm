-- CreateEnum
CREATE TYPE "CrmWorkflowRunStatus" AS ENUM ('MATCHED', 'NOT_MATCHED', 'EVALUATION_FAILED');

-- CreateTable
CREATE TABLE "CrmWorkflowRun" (
    "id" TEXT NOT NULL,
    "crmInstanceId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "triggerEvent" "CrmWorkflowEvent" NOT NULL,
    "status" "CrmWorkflowRunStatus" NOT NULL,
    "evaluationError" VARCHAR(2000),
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmWorkflowRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CrmWorkflowRun_crmInstanceId_moduleKey_workflowId_eventId_key" ON "CrmWorkflowRun"("crmInstanceId", "moduleKey", "workflowId", "eventId");

-- CreateIndex
CREATE INDEX "CrmWorkflowRun_crmInstanceId_moduleKey_recordId_observedAt_idx" ON "CrmWorkflowRun"("crmInstanceId", "moduleKey", "recordId", "observedAt");

-- CreateIndex
CREATE INDEX "CrmWorkflowRun_crmInstanceId_workflowId_observedAt_idx" ON "CrmWorkflowRun"("crmInstanceId", "workflowId", "observedAt");

-- AddForeignKey
ALTER TABLE "CrmWorkflowRun" ADD CONSTRAINT "CrmWorkflowRun_crmInstanceId_fkey" FOREIGN KEY ("crmInstanceId") REFERENCES "CrmInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmWorkflowRun" ADD CONSTRAINT "CrmWorkflowRun_crmInstanceId_moduleKey_workflowId_fkey" FOREIGN KEY ("crmInstanceId", "moduleKey", "workflowId") REFERENCES "CrmWorkflow"("crmInstanceId", "moduleKey", "id") ON DELETE RESTRICT ON UPDATE CASCADE;