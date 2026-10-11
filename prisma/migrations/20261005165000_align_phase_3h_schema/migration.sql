-- Reconcile the Phase 3H schema declarations with the database.
-- Existing foreign keys already guarantee these references are valid; only
-- their delete policy changes from CASCADE to RESTRICT.
ALTER TABLE "CustomCompanyFieldValue" DROP CONSTRAINT "CustomCompanyFieldValue_crmInstanceId_moduleKey_fieldId_fi_fkey";
ALTER TABLE "CustomCompanyFieldValue" DROP CONSTRAINT "CustomCompanyFieldValue_optionCrmInstanceId_optionModuleKe_fkey";
ALTER TABLE "CustomContactFieldValue" DROP CONSTRAINT "CustomContactFieldValue_crmInstanceId_moduleKey_fieldId_fi_fkey";
ALTER TABLE "CustomContactFieldValue" DROP CONSTRAINT "CustomContactFieldValue_optionCrmInstanceId_optionModuleKe_fkey";
ALTER TABLE "CustomLeadFieldValue" DROP CONSTRAINT "CustomLeadFieldValue_crmInstanceId_moduleKey_fieldId_field_fkey";
ALTER TABLE "CustomLeadFieldValue" DROP CONSTRAINT "CustomLeadFieldValue_optionCrmInstanceId_optionModuleKey_o_fkey";
ALTER TABLE "CustomTaskFieldValue" DROP CONSTRAINT "CustomTaskFieldValue_crmInstanceId_moduleKey_fieldId_field_fkey";
ALTER TABLE "CustomTaskFieldValue" DROP CONSTRAINT "CustomTaskFieldValue_optionCrmInstanceId_optionModuleKey_o_fkey";

ALTER TABLE "CustomCompanyFieldValue" ADD CONSTRAINT "CustomCompanyFieldValue_crmInstanceId_moduleKey_fieldId_fi_fkey" FOREIGN KEY ("crmInstanceId", "moduleKey", "fieldId", "fieldType", "fieldOrigin") REFERENCES "CrmFieldDefinition"("crmInstanceId", "moduleKey", "id", "fieldType", "origin") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomCompanyFieldValue" ADD CONSTRAINT "CustomCompanyFieldValue_optionCrmInstanceId_optionModuleKe_fkey" FOREIGN KEY ("optionCrmInstanceId", "optionModuleKey", "optionFieldId", "optionId") REFERENCES "CrmFieldOption"("crmInstanceId", "moduleKey", "fieldId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomContactFieldValue" ADD CONSTRAINT "CustomContactFieldValue_crmInstanceId_moduleKey_fieldId_fi_fkey" FOREIGN KEY ("crmInstanceId", "moduleKey", "fieldId", "fieldType", "fieldOrigin") REFERENCES "CrmFieldDefinition"("crmInstanceId", "moduleKey", "id", "fieldType", "origin") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomContactFieldValue" ADD CONSTRAINT "CustomContactFieldValue_optionCrmInstanceId_optionModuleKe_fkey" FOREIGN KEY ("optionCrmInstanceId", "optionModuleKey", "optionFieldId", "optionId") REFERENCES "CrmFieldOption"("crmInstanceId", "moduleKey", "fieldId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomLeadFieldValue" ADD CONSTRAINT "CustomLeadFieldValue_crmInstanceId_moduleKey_fieldId_field_fkey" FOREIGN KEY ("crmInstanceId", "moduleKey", "fieldId", "fieldType", "fieldOrigin") REFERENCES "CrmFieldDefinition"("crmInstanceId", "moduleKey", "id", "fieldType", "origin") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomLeadFieldValue" ADD CONSTRAINT "CustomLeadFieldValue_optionCrmInstanceId_optionModuleKey_o_fkey" FOREIGN KEY ("optionCrmInstanceId", "optionModuleKey", "optionFieldId", "optionId") REFERENCES "CrmFieldOption"("crmInstanceId", "moduleKey", "fieldId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomTaskFieldValue" ADD CONSTRAINT "CustomTaskFieldValue_crmInstanceId_moduleKey_fieldId_field_fkey" FOREIGN KEY ("crmInstanceId", "moduleKey", "fieldId", "fieldType", "fieldOrigin") REFERENCES "CrmFieldDefinition"("crmInstanceId", "moduleKey", "id", "fieldType", "origin") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomTaskFieldValue" ADD CONSTRAINT "CustomTaskFieldValue_optionCrmInstanceId_optionModuleKey_o_fkey" FOREIGN KEY ("optionCrmInstanceId", "optionModuleKey", "optionFieldId", "optionId") REFERENCES "CrmFieldOption"("crmInstanceId", "moduleKey", "fieldId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CrmConfigurationAuditLog" (
    "id" TEXT NOT NULL,
    "crmInstanceId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CrmConfigurationAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CrmConfigurationAuditLog_crmInstanceId_createdAt_idx" ON "CrmConfigurationAuditLog"("crmInstanceId", "createdAt");
CREATE INDEX "CrmConfigurationAuditLog_actorUserId_createdAt_idx" ON "CrmConfigurationAuditLog"("actorUserId", "createdAt");
ALTER TABLE "CrmConfigurationAuditLog" ADD CONSTRAINT "CrmConfigurationAuditLog_crmInstanceId_fkey" FOREIGN KEY ("crmInstanceId") REFERENCES "CrmInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmConfigurationAuditLog" ADD CONSTRAINT "CrmConfigurationAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
