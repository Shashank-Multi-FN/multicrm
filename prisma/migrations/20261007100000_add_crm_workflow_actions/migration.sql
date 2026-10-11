-- CreateEnum
CREATE TYPE "CrmWorkflowActionType" AS ENUM ('CREATE_TASK');

-- CreateEnum
CREATE TYPE "CrmWorkflowActionRunStatus" AS ENUM ('SUCCEEDED', 'FAILED');

-- Extend the workflow-run key for tenant-safe action-run references.
CREATE UNIQUE INDEX "CrmWorkflowRun_scope_id_key" ON "CrmWorkflowRun"("crmInstanceId", "moduleKey", "workflowId", "id");

-- CreateTable
CREATE TABLE "CrmWorkflowAction" (
    "id" TEXT NOT NULL,
    "crmInstanceId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "actionType" "CrmWorkflowActionType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "taskTitle" VARCHAR(200),
    "taskDescription" VARCHAR(2000),
    "taskStatus" VARCHAR(32),
    "taskPriority" VARCHAR(16),
    "taskDueDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CrmWorkflowAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmWorkflowActionRun" (
    "id" TEXT NOT NULL,
    "crmInstanceId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "workflowRunId" TEXT NOT NULL,
    "workflowActionId" TEXT NOT NULL,
    "status" "CrmWorkflowActionRunStatus" NOT NULL,
    "createdTaskId" TEXT,
    "errorMessage" VARCHAR(2000),
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CrmWorkflowActionRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CrmWorkflowAction_crmInstanceId_moduleKey_workflowId_id_key" ON "CrmWorkflowAction"("crmInstanceId", "moduleKey", "workflowId", "id");

-- CreateIndex
CREATE INDEX "CrmWorkflowAction_scope_enabled_order_idx" ON "CrmWorkflowAction"("crmInstanceId", "moduleKey", "workflowId", "enabled", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CrmWorkflowActionRun_event_action_key" ON "CrmWorkflowActionRun"("crmInstanceId", "moduleKey", "workflowRunId", "workflowActionId");

-- CreateIndex
CREATE INDEX "CrmWorkflowActionRun_created_task_idx" ON "CrmWorkflowActionRun"("crmInstanceId", "createdTaskId");

-- CreateIndex
CREATE INDEX "CrmWorkflowActionRun_workflow_date_idx" ON "CrmWorkflowActionRun"("crmInstanceId", "workflowId", "executedAt");

-- AddForeignKey
ALTER TABLE "CrmWorkflowAction" ADD CONSTRAINT "CrmWorkflowAction_crmInstanceId_moduleKey_workflowId_fkey" FOREIGN KEY ("crmInstanceId", "moduleKey", "workflowId") REFERENCES "CrmWorkflow"("crmInstanceId", "moduleKey", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmWorkflowActionRun" ADD CONSTRAINT "CrmWorkflowActionRun_crmInstanceId_fkey" FOREIGN KEY ("crmInstanceId") REFERENCES "CrmInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmWorkflowActionRun" ADD CONSTRAINT "CrmWorkflowActionRun_workflowRun_fkey" FOREIGN KEY ("crmInstanceId", "moduleKey", "workflowId", "workflowRunId") REFERENCES "CrmWorkflowRun"("crmInstanceId", "moduleKey", "workflowId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmWorkflowActionRun" ADD CONSTRAINT "CrmWorkflowActionRun_workflowAction_fkey" FOREIGN KEY ("crmInstanceId", "moduleKey", "workflowId", "workflowActionId") REFERENCES "CrmWorkflowAction"("crmInstanceId", "moduleKey", "workflowId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
