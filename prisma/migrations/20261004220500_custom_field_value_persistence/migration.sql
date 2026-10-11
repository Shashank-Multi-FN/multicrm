-- CreateTable
CREATE TABLE "CustomCompanyFieldValue" (
    "id" TEXT NOT NULL,
    "crmInstanceId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL DEFAULT 'companies',
    "recordId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "fieldType" "CrmFieldType" NOT NULL,
    "fieldOrigin" "CrmFieldOrigin" NOT NULL DEFAULT 'CUSTOM',
    "textValue" TEXT,
    "numberValue" DOUBLE PRECISION,
    "booleanValue" BOOLEAN,
    "dateValue" DATE,
    "datetimeValue" TIMESTAMP(3),
    "optionCrmInstanceId" TEXT,
    "optionModuleKey" TEXT,
    "optionFieldId" TEXT,
    "optionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomCompanyFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomContactFieldValue" (
    "id" TEXT NOT NULL,
    "crmInstanceId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL DEFAULT 'contacts',
    "recordId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "fieldType" "CrmFieldType" NOT NULL,
    "fieldOrigin" "CrmFieldOrigin" NOT NULL DEFAULT 'CUSTOM',
    "textValue" TEXT,
    "numberValue" DOUBLE PRECISION,
    "booleanValue" BOOLEAN,
    "dateValue" DATE,
    "datetimeValue" TIMESTAMP(3),
    "optionCrmInstanceId" TEXT,
    "optionModuleKey" TEXT,
    "optionFieldId" TEXT,
    "optionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomContactFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomLeadFieldValue" (
    "id" TEXT NOT NULL,
    "crmInstanceId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL DEFAULT 'leads',
    "recordId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "fieldType" "CrmFieldType" NOT NULL,
    "fieldOrigin" "CrmFieldOrigin" NOT NULL DEFAULT 'CUSTOM',
    "textValue" TEXT,
    "numberValue" DOUBLE PRECISION,
    "booleanValue" BOOLEAN,
    "dateValue" DATE,
    "datetimeValue" TIMESTAMP(3),
    "optionCrmInstanceId" TEXT,
    "optionModuleKey" TEXT,
    "optionFieldId" TEXT,
    "optionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomLeadFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomTaskFieldValue" (
    "id" TEXT NOT NULL,
    "crmInstanceId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL DEFAULT 'tasks',
    "recordId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "fieldType" "CrmFieldType" NOT NULL,
    "fieldOrigin" "CrmFieldOrigin" NOT NULL DEFAULT 'CUSTOM',
    "textValue" TEXT,
    "numberValue" DOUBLE PRECISION,
    "booleanValue" BOOLEAN,
    "dateValue" DATE,
    "datetimeValue" TIMESTAMP(3),
    "optionCrmInstanceId" TEXT,
    "optionModuleKey" TEXT,
    "optionFieldId" TEXT,
    "optionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomTaskFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomCompanyFieldValue_crmInstanceId_moduleKey_fieldId_rec_idx" ON "CustomCompanyFieldValue"("crmInstanceId", "moduleKey", "fieldId", "recordId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomCompanyFieldValue_crmInstanceId_moduleKey_recordId_fi_key" ON "CustomCompanyFieldValue"("crmInstanceId", "moduleKey", "recordId", "fieldId");

-- CreateIndex
CREATE INDEX "CustomContactFieldValue_crmInstanceId_moduleKey_fieldId_rec_idx" ON "CustomContactFieldValue"("crmInstanceId", "moduleKey", "fieldId", "recordId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomContactFieldValue_crmInstanceId_moduleKey_recordId_fi_key" ON "CustomContactFieldValue"("crmInstanceId", "moduleKey", "recordId", "fieldId");

-- CreateIndex
CREATE INDEX "CustomLeadFieldValue_crmInstanceId_moduleKey_fieldId_record_idx" ON "CustomLeadFieldValue"("crmInstanceId", "moduleKey", "fieldId", "recordId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomLeadFieldValue_crmInstanceId_moduleKey_recordId_field_key" ON "CustomLeadFieldValue"("crmInstanceId", "moduleKey", "recordId", "fieldId");

-- CreateIndex
CREATE INDEX "CustomTaskFieldValue_crmInstanceId_moduleKey_fieldId_record_idx" ON "CustomTaskFieldValue"("crmInstanceId", "moduleKey", "fieldId", "recordId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomTaskFieldValue_crmInstanceId_moduleKey_recordId_field_key" ON "CustomTaskFieldValue"("crmInstanceId", "moduleKey", "recordId", "fieldId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_crmInstanceId_id_key" ON "Company"("crmInstanceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_crmInstanceId_id_key" ON "Contact"("crmInstanceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "CrmFieldDefinition_crmInstanceId_moduleKey_id_fieldType_ori_key" ON "CrmFieldDefinition"("crmInstanceId", "moduleKey", "id", "fieldType", "origin");

-- CreateIndex
CREATE UNIQUE INDEX "CrmFieldOption_crmInstanceId_moduleKey_fieldId_id_key" ON "CrmFieldOption"("crmInstanceId", "moduleKey", "fieldId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_crmInstanceId_id_key" ON "Lead"("crmInstanceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Task_crmInstanceId_id_key" ON "Task"("crmInstanceId", "id");

-- AddForeignKey
ALTER TABLE "CustomCompanyFieldValue" ADD CONSTRAINT "CustomCompanyFieldValue_crmInstanceId_recordId_fkey" FOREIGN KEY ("crmInstanceId", "recordId") REFERENCES "Company"("crmInstanceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomCompanyFieldValue" ADD CONSTRAINT "CustomCompanyFieldValue_crmInstanceId_moduleKey_fieldId_fi_fkey" FOREIGN KEY ("crmInstanceId", "moduleKey", "fieldId", "fieldType", "fieldOrigin") REFERENCES "CrmFieldDefinition"("crmInstanceId", "moduleKey", "id", "fieldType", "origin") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomCompanyFieldValue" ADD CONSTRAINT "CustomCompanyFieldValue_optionCrmInstanceId_optionModuleKe_fkey" FOREIGN KEY ("optionCrmInstanceId", "optionModuleKey", "optionFieldId", "optionId") REFERENCES "CrmFieldOption"("crmInstanceId", "moduleKey", "fieldId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomContactFieldValue" ADD CONSTRAINT "CustomContactFieldValue_crmInstanceId_recordId_fkey" FOREIGN KEY ("crmInstanceId", "recordId") REFERENCES "Contact"("crmInstanceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomContactFieldValue" ADD CONSTRAINT "CustomContactFieldValue_crmInstanceId_moduleKey_fieldId_fi_fkey" FOREIGN KEY ("crmInstanceId", "moduleKey", "fieldId", "fieldType", "fieldOrigin") REFERENCES "CrmFieldDefinition"("crmInstanceId", "moduleKey", "id", "fieldType", "origin") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomContactFieldValue" ADD CONSTRAINT "CustomContactFieldValue_optionCrmInstanceId_optionModuleKe_fkey" FOREIGN KEY ("optionCrmInstanceId", "optionModuleKey", "optionFieldId", "optionId") REFERENCES "CrmFieldOption"("crmInstanceId", "moduleKey", "fieldId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomLeadFieldValue" ADD CONSTRAINT "CustomLeadFieldValue_crmInstanceId_recordId_fkey" FOREIGN KEY ("crmInstanceId", "recordId") REFERENCES "Lead"("crmInstanceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomLeadFieldValue" ADD CONSTRAINT "CustomLeadFieldValue_crmInstanceId_moduleKey_fieldId_field_fkey" FOREIGN KEY ("crmInstanceId", "moduleKey", "fieldId", "fieldType", "fieldOrigin") REFERENCES "CrmFieldDefinition"("crmInstanceId", "moduleKey", "id", "fieldType", "origin") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomLeadFieldValue" ADD CONSTRAINT "CustomLeadFieldValue_optionCrmInstanceId_optionModuleKey_o_fkey" FOREIGN KEY ("optionCrmInstanceId", "optionModuleKey", "optionFieldId", "optionId") REFERENCES "CrmFieldOption"("crmInstanceId", "moduleKey", "fieldId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomTaskFieldValue" ADD CONSTRAINT "CustomTaskFieldValue_crmInstanceId_recordId_fkey" FOREIGN KEY ("crmInstanceId", "recordId") REFERENCES "Task"("crmInstanceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomTaskFieldValue" ADD CONSTRAINT "CustomTaskFieldValue_crmInstanceId_moduleKey_fieldId_field_fkey" FOREIGN KEY ("crmInstanceId", "moduleKey", "fieldId", "fieldType", "fieldOrigin") REFERENCES "CrmFieldDefinition"("crmInstanceId", "moduleKey", "id", "fieldType", "origin") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomTaskFieldValue" ADD CONSTRAINT "CustomTaskFieldValue_optionCrmInstanceId_optionModuleKey_o_fkey" FOREIGN KEY ("optionCrmInstanceId", "optionModuleKey", "optionFieldId", "optionId") REFERENCES "CrmFieldOption"("crmInstanceId", "moduleKey", "fieldId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomCompanyFieldValue"
    ADD CONSTRAINT "CustomCompanyFieldValue_moduleKey_check"
    CHECK ("moduleKey" = 'companies'),
    ADD CONSTRAINT "CustomCompanyFieldValue_fieldOrigin_check"
    CHECK ("fieldOrigin" = 'CUSTOM'),
    ADD CONSTRAINT "CustomCompanyFieldValue_typed_value_check"
    CHECK (
        (
            "fieldType" IN ('TEXT', 'TEXTAREA', 'EMAIL', 'PHONE')
            AND "textValue" IS NOT NULL
            AND "numberValue" IS NULL
            AND "booleanValue" IS NULL
            AND "dateValue" IS NULL
            AND "datetimeValue" IS NULL
            AND "optionCrmInstanceId" IS NULL
            AND "optionModuleKey" IS NULL
            AND "optionFieldId" IS NULL
            AND "optionId" IS NULL
        )
        OR (
            "fieldType" = 'NUMBER'
            AND "textValue" IS NULL
            AND "numberValue" IS NOT NULL
            AND "booleanValue" IS NULL
            AND "dateValue" IS NULL
            AND "datetimeValue" IS NULL
            AND "optionCrmInstanceId" IS NULL
            AND "optionModuleKey" IS NULL
            AND "optionFieldId" IS NULL
            AND "optionId" IS NULL
        )
        OR (
            "fieldType" = 'BOOLEAN'
            AND "textValue" IS NULL
            AND "numberValue" IS NULL
            AND "booleanValue" IS NOT NULL
            AND "dateValue" IS NULL
            AND "datetimeValue" IS NULL
            AND "optionCrmInstanceId" IS NULL
            AND "optionModuleKey" IS NULL
            AND "optionFieldId" IS NULL
            AND "optionId" IS NULL
        )
        OR (
            "fieldType" = 'DATE'
            AND "textValue" IS NULL
            AND "numberValue" IS NULL
            AND "booleanValue" IS NULL
            AND "dateValue" IS NOT NULL
            AND "datetimeValue" IS NULL
            AND "optionCrmInstanceId" IS NULL
            AND "optionModuleKey" IS NULL
            AND "optionFieldId" IS NULL
            AND "optionId" IS NULL
        )
        OR (
            "fieldType" = 'DATETIME'
            AND "textValue" IS NULL
            AND "numberValue" IS NULL
            AND "booleanValue" IS NULL
            AND "dateValue" IS NULL
            AND "datetimeValue" IS NOT NULL
            AND "optionCrmInstanceId" IS NULL
            AND "optionModuleKey" IS NULL
            AND "optionFieldId" IS NULL
            AND "optionId" IS NULL
        )
        OR (
            "fieldType" = 'SELECT'
            AND "textValue" IS NULL
            AND "numberValue" IS NULL
            AND "booleanValue" IS NULL
            AND "dateValue" IS NULL
            AND "datetimeValue" IS NULL
            AND "optionCrmInstanceId" IS NOT NULL
            AND "optionModuleKey" IS NOT NULL
            AND "optionFieldId" IS NOT NULL
            AND "optionId" IS NOT NULL
            AND "optionCrmInstanceId" = "crmInstanceId"
            AND "optionModuleKey" = "moduleKey"
            AND "optionFieldId" = "fieldId"
        )
    );

ALTER TABLE "CustomContactFieldValue"
    ADD CONSTRAINT "CustomContactFieldValue_moduleKey_check"
    CHECK ("moduleKey" = 'contacts'),
    ADD CONSTRAINT "CustomContactFieldValue_fieldOrigin_check"
    CHECK ("fieldOrigin" = 'CUSTOM'),
    ADD CONSTRAINT "CustomContactFieldValue_typed_value_check"
    CHECK (
        (
            "fieldType" IN ('TEXT', 'TEXTAREA', 'EMAIL', 'PHONE')
            AND "textValue" IS NOT NULL
            AND "numberValue" IS NULL
            AND "booleanValue" IS NULL
            AND "dateValue" IS NULL
            AND "datetimeValue" IS NULL
            AND "optionCrmInstanceId" IS NULL
            AND "optionModuleKey" IS NULL
            AND "optionFieldId" IS NULL
            AND "optionId" IS NULL
        )
        OR (
            "fieldType" = 'NUMBER'
            AND "textValue" IS NULL
            AND "numberValue" IS NOT NULL
            AND "booleanValue" IS NULL
            AND "dateValue" IS NULL
            AND "datetimeValue" IS NULL
            AND "optionCrmInstanceId" IS NULL
            AND "optionModuleKey" IS NULL
            AND "optionFieldId" IS NULL
            AND "optionId" IS NULL
        )
        OR (
            "fieldType" = 'BOOLEAN'
            AND "textValue" IS NULL
            AND "numberValue" IS NULL
            AND "booleanValue" IS NOT NULL
            AND "dateValue" IS NULL
            AND "datetimeValue" IS NULL
            AND "optionCrmInstanceId" IS NULL
            AND "optionModuleKey" IS NULL
            AND "optionFieldId" IS NULL
            AND "optionId" IS NULL
        )
        OR (
            "fieldType" = 'DATE'
            AND "textValue" IS NULL
            AND "numberValue" IS NULL
            AND "booleanValue" IS NULL
            AND "dateValue" IS NOT NULL
            AND "datetimeValue" IS NULL
            AND "optionCrmInstanceId" IS NULL
            AND "optionModuleKey" IS NULL
            AND "optionFieldId" IS NULL
            AND "optionId" IS NULL
        )
        OR (
            "fieldType" = 'DATETIME'
            AND "textValue" IS NULL
            AND "numberValue" IS NULL
            AND "booleanValue" IS NULL
            AND "dateValue" IS NULL
            AND "datetimeValue" IS NOT NULL
            AND "optionCrmInstanceId" IS NULL
            AND "optionModuleKey" IS NULL
            AND "optionFieldId" IS NULL
            AND "optionId" IS NULL
        )
        OR (
            "fieldType" = 'SELECT'
            AND "textValue" IS NULL
            AND "numberValue" IS NULL
            AND "booleanValue" IS NULL
            AND "dateValue" IS NULL
            AND "datetimeValue" IS NULL
            AND "optionCrmInstanceId" IS NOT NULL
            AND "optionModuleKey" IS NOT NULL
            AND "optionFieldId" IS NOT NULL
            AND "optionId" IS NOT NULL
            AND "optionCrmInstanceId" = "crmInstanceId"
            AND "optionModuleKey" = "moduleKey"
            AND "optionFieldId" = "fieldId"
        )
    );

ALTER TABLE "CustomLeadFieldValue"
    ADD CONSTRAINT "CustomLeadFieldValue_moduleKey_check"
    CHECK ("moduleKey" = 'leads'),
    ADD CONSTRAINT "CustomLeadFieldValue_fieldOrigin_check"
    CHECK ("fieldOrigin" = 'CUSTOM'),
    ADD CONSTRAINT "CustomLeadFieldValue_typed_value_check"
    CHECK (
        (
            "fieldType" IN ('TEXT', 'TEXTAREA', 'EMAIL', 'PHONE')
            AND "textValue" IS NOT NULL
            AND "numberValue" IS NULL
            AND "booleanValue" IS NULL
            AND "dateValue" IS NULL
            AND "datetimeValue" IS NULL
            AND "optionCrmInstanceId" IS NULL
            AND "optionModuleKey" IS NULL
            AND "optionFieldId" IS NULL
            AND "optionId" IS NULL
        )
        OR (
            "fieldType" = 'NUMBER'
            AND "textValue" IS NULL
            AND "numberValue" IS NOT NULL
            AND "booleanValue" IS NULL
            AND "dateValue" IS NULL
            AND "datetimeValue" IS NULL
            AND "optionCrmInstanceId" IS NULL
            AND "optionModuleKey" IS NULL
            AND "optionFieldId" IS NULL
            AND "optionId" IS NULL
        )
        OR (
            "fieldType" = 'BOOLEAN'
            AND "textValue" IS NULL
            AND "numberValue" IS NULL
            AND "booleanValue" IS NOT NULL
            AND "dateValue" IS NULL
            AND "datetimeValue" IS NULL
            AND "optionCrmInstanceId" IS NULL
            AND "optionModuleKey" IS NULL
            AND "optionFieldId" IS NULL
            AND "optionId" IS NULL
        )
        OR (
            "fieldType" = 'DATE'
            AND "textValue" IS NULL
            AND "numberValue" IS NULL
            AND "booleanValue" IS NULL
            AND "dateValue" IS NOT NULL
            AND "datetimeValue" IS NULL
            AND "optionCrmInstanceId" IS NULL
            AND "optionModuleKey" IS NULL
            AND "optionFieldId" IS NULL
            AND "optionId" IS NULL
        )
        OR (
            "fieldType" = 'DATETIME'
            AND "textValue" IS NULL
            AND "numberValue" IS NULL
            AND "booleanValue" IS NULL
            AND "dateValue" IS NULL
            AND "datetimeValue" IS NOT NULL
            AND "optionCrmInstanceId" IS NULL
            AND "optionModuleKey" IS NULL
            AND "optionFieldId" IS NULL
            AND "optionId" IS NULL
        )
        OR (
            "fieldType" = 'SELECT'
            AND "textValue" IS NULL
            AND "numberValue" IS NULL
            AND "booleanValue" IS NULL
            AND "dateValue" IS NULL
            AND "datetimeValue" IS NULL
            AND "optionCrmInstanceId" IS NOT NULL
            AND "optionModuleKey" IS NOT NULL
            AND "optionFieldId" IS NOT NULL
            AND "optionId" IS NOT NULL
            AND "optionCrmInstanceId" = "crmInstanceId"
            AND "optionModuleKey" = "moduleKey"
            AND "optionFieldId" = "fieldId"
        )
    );

ALTER TABLE "CustomTaskFieldValue"
    ADD CONSTRAINT "CustomTaskFieldValue_moduleKey_check"
    CHECK ("moduleKey" = 'tasks'),
    ADD CONSTRAINT "CustomTaskFieldValue_fieldOrigin_check"
    CHECK ("fieldOrigin" = 'CUSTOM'),
    ADD CONSTRAINT "CustomTaskFieldValue_typed_value_check"
    CHECK (
        (
            "fieldType" IN ('TEXT', 'TEXTAREA', 'EMAIL', 'PHONE')
            AND "textValue" IS NOT NULL
            AND "numberValue" IS NULL
            AND "booleanValue" IS NULL
            AND "dateValue" IS NULL
            AND "datetimeValue" IS NULL
            AND "optionCrmInstanceId" IS NULL
            AND "optionModuleKey" IS NULL
            AND "optionFieldId" IS NULL
            AND "optionId" IS NULL
        )
        OR (
            "fieldType" = 'NUMBER'
            AND "textValue" IS NULL
            AND "numberValue" IS NOT NULL
            AND "booleanValue" IS NULL
            AND "dateValue" IS NULL
            AND "datetimeValue" IS NULL
            AND "optionCrmInstanceId" IS NULL
            AND "optionModuleKey" IS NULL
            AND "optionFieldId" IS NULL
            AND "optionId" IS NULL
        )
        OR (
            "fieldType" = 'BOOLEAN'
            AND "textValue" IS NULL
            AND "numberValue" IS NULL
            AND "booleanValue" IS NOT NULL
            AND "dateValue" IS NULL
            AND "datetimeValue" IS NULL
            AND "optionCrmInstanceId" IS NULL
            AND "optionModuleKey" IS NULL
            AND "optionFieldId" IS NULL
            AND "optionId" IS NULL
        )
        OR (
            "fieldType" = 'DATE'
            AND "textValue" IS NULL
            AND "numberValue" IS NULL
            AND "booleanValue" IS NULL
            AND "dateValue" IS NOT NULL
            AND "datetimeValue" IS NULL
            AND "optionCrmInstanceId" IS NULL
            AND "optionModuleKey" IS NULL
            AND "optionFieldId" IS NULL
            AND "optionId" IS NULL
        )
        OR (
            "fieldType" = 'DATETIME'
            AND "textValue" IS NULL
            AND "numberValue" IS NULL
            AND "booleanValue" IS NULL
            AND "dateValue" IS NULL
            AND "datetimeValue" IS NOT NULL
            AND "optionCrmInstanceId" IS NULL
            AND "optionModuleKey" IS NULL
            AND "optionFieldId" IS NULL
            AND "optionId" IS NULL
        )
        OR (
            "fieldType" = 'SELECT'
            AND "textValue" IS NULL
            AND "numberValue" IS NULL
            AND "booleanValue" IS NULL
            AND "dateValue" IS NULL
            AND "datetimeValue" IS NULL
            AND "optionCrmInstanceId" IS NOT NULL
            AND "optionModuleKey" IS NOT NULL
            AND "optionFieldId" IS NOT NULL
            AND "optionId" IS NOT NULL
            AND "optionCrmInstanceId" = "crmInstanceId"
            AND "optionModuleKey" = "moduleKey"
            AND "optionFieldId" = "fieldId"
        )
    );
