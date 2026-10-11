CREATE TYPE "CrmConditionalOperator" AS ENUM ('EQUALS', 'NOT_EQUALS', 'IS_EMPTY', 'IS_NOT_EMPTY');
CREATE TYPE "CrmConditionalAction" AS ENUM ('SHOW', 'HIDE', 'REQUIRE', 'OPTIONAL', 'ENABLE', 'DISABLE');

CREATE TABLE "CrmConditionalRule" (
    "id" TEXT NOT NULL,
    "crmInstanceId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "sourceFieldId" TEXT NOT NULL,
    "targetFieldId" TEXT NOT NULL,
    "operator" "CrmConditionalOperator" NOT NULL,
    "comparisonValue" TEXT,
    "action" "CrmConditionalAction" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CrmConditionalRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CrmConditionalRule_crmInstanceId_moduleKey_formId_enabled_s_idx" ON "CrmConditionalRule"("crmInstanceId", "moduleKey", "formId", "enabled", "sortOrder");
CREATE INDEX "CrmConditionalRule_crmInstanceId_moduleKey_sourceFieldId_idx" ON "CrmConditionalRule"("crmInstanceId", "moduleKey", "sourceFieldId");
CREATE INDEX "CrmConditionalRule_crmInstanceId_moduleKey_targetFieldId_idx" ON "CrmConditionalRule"("crmInstanceId", "moduleKey", "targetFieldId");

ALTER TABLE "CrmConditionalRule" ADD CONSTRAINT "CrmConditionalRule_crmInstanceId_moduleKey_formId_fkey" FOREIGN KEY ("crmInstanceId", "moduleKey", "formId") REFERENCES "CrmForm"("crmInstanceId", "moduleKey", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmConditionalRule" ADD CONSTRAINT "CrmConditionalRule_crmInstanceId_moduleKey_sourceFieldId_fkey" FOREIGN KEY ("crmInstanceId", "moduleKey", "sourceFieldId") REFERENCES "CrmFieldDefinition"("crmInstanceId", "moduleKey", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CrmConditionalRule" ADD CONSTRAINT "CrmConditionalRule_crmInstanceId_moduleKey_targetFieldId_fkey" FOREIGN KEY ("crmInstanceId", "moduleKey", "targetFieldId") REFERENCES "CrmFieldDefinition"("crmInstanceId", "moduleKey", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
