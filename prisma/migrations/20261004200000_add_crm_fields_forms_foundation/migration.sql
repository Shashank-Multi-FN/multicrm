CREATE TYPE "CrmFieldType" AS ENUM (
    'TEXT',
    'TEXTAREA',
    'NUMBER',
    'EMAIL',
    'PHONE',
    'DATE',
    'DATETIME',
    'BOOLEAN',
    'SELECT'
);

CREATE TYPE "CrmFieldOrigin" AS ENUM ('SYSTEM', 'CUSTOM');

CREATE TABLE "CrmFieldDefinition" (
    "id" TEXT NOT NULL,
    "crmInstanceId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldType" "CrmFieldType" NOT NULL,
    "origin" "CrmFieldOrigin" NOT NULL DEFAULT 'CUSTOM',
    "backingColumn" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL,
    "minLength" INTEGER,
    "maxLength" INTEGER,
    "minValue" DOUBLE PRECISION,
    "maxValue" DOUBLE PRECISION,
    "pattern" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CrmFieldDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CrmFieldDefinition_crmInstanceId_moduleKey_key_key"
    ON "CrmFieldDefinition"("crmInstanceId", "moduleKey", "key");
CREATE UNIQUE INDEX "CrmFieldDefinition_crmInstanceId_moduleKey_id_key"
    ON "CrmFieldDefinition"("crmInstanceId", "moduleKey", "id");
CREATE INDEX "CrmFieldDefinition_crmInstanceId_moduleKey_enabled_displayOrder_idx"
    ON "CrmFieldDefinition"("crmInstanceId", "moduleKey", "enabled", "displayOrder");

ALTER TABLE "CrmFieldDefinition"
    ADD CONSTRAINT "CrmFieldDefinition_crmInstanceId_moduleKey_fkey"
    FOREIGN KEY ("crmInstanceId", "moduleKey")
    REFERENCES "CrmModuleConfiguration"("crmInstanceId", "moduleKey")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CrmFieldOption" (
    "id" TEXT NOT NULL,
    "crmInstanceId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CrmFieldOption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CrmFieldOption_fieldId_key_key"
    ON "CrmFieldOption"("fieldId", "key");
CREATE INDEX "CrmFieldOption_crmInstanceId_moduleKey_fieldId_enabled_sortOrder_idx"
    ON "CrmFieldOption"("crmInstanceId", "moduleKey", "fieldId", "enabled", "sortOrder");

ALTER TABLE "CrmFieldOption"
    ADD CONSTRAINT "CrmFieldOption_crmInstanceId_moduleKey_fieldId_fkey"
    FOREIGN KEY ("crmInstanceId", "moduleKey", "fieldId")
    REFERENCES "CrmFieldDefinition"("crmInstanceId", "moduleKey", "id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CrmForm" (
    "id" TEXT NOT NULL,
    "crmInstanceId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CrmForm_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CrmForm_crmInstanceId_moduleKey_key_key"
    ON "CrmForm"("crmInstanceId", "moduleKey", "key");
CREATE UNIQUE INDEX "CrmForm_crmInstanceId_moduleKey_id_key"
    ON "CrmForm"("crmInstanceId", "moduleKey", "id");
CREATE INDEX "CrmForm_crmInstanceId_moduleKey_enabled_idx"
    ON "CrmForm"("crmInstanceId", "moduleKey", "enabled");

ALTER TABLE "CrmForm"
    ADD CONSTRAINT "CrmForm_crmInstanceId_moduleKey_fkey"
    FOREIGN KEY ("crmInstanceId", "moduleKey")
    REFERENCES "CrmModuleConfiguration"("crmInstanceId", "moduleKey")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CrmFormField" (
    "id" TEXT NOT NULL,
    "crmInstanceId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "requiredOverride" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CrmFormField_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CrmFormField_formId_fieldId_key"
    ON "CrmFormField"("formId", "fieldId");
CREATE INDEX "CrmFormField_crmInstanceId_moduleKey_formId_displayOrder_idx"
    ON "CrmFormField"("crmInstanceId", "moduleKey", "formId", "displayOrder");

ALTER TABLE "CrmFormField"
    ADD CONSTRAINT "CrmFormField_crmInstanceId_moduleKey_formId_fkey"
    FOREIGN KEY ("crmInstanceId", "moduleKey", "formId")
    REFERENCES "CrmForm"("crmInstanceId", "moduleKey", "id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CrmFormField"
    ADD CONSTRAINT "CrmFormField_crmInstanceId_moduleKey_fieldId_fkey"
    FOREIGN KEY ("crmInstanceId", "moduleKey", "fieldId")
    REFERENCES "CrmFieldDefinition"("crmInstanceId", "moduleKey", "id")
    ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "CrmFieldDefinition"
    ("id", "crmInstanceId", "moduleKey", "key", "label", "fieldType", "origin", "backingColumn", "required", "enabled", "displayOrder", "updatedAt")
SELECT
    'field_' || md5(instance."id" || ':' || defaults."moduleKey" || ':' || defaults."key"),
    instance."id",
    defaults."moduleKey",
    defaults."key",
    defaults."label",
    defaults."fieldType"::"CrmFieldType",
    'SYSTEM'::"CrmFieldOrigin",
    defaults."backingColumn",
    defaults."required",
    true,
    defaults."displayOrder",
    CURRENT_TIMESTAMP
FROM "CrmInstance" AS instance
CROSS JOIN (
    VALUES
        ('companies', 'name', 'Name', 'TEXT', 'name', true, 0),
        ('companies', 'email', 'Email', 'EMAIL', 'email', false, 1),
        ('companies', 'phone', 'Phone', 'PHONE', 'phone', false, 2),
        ('companies', 'website', 'Website', 'TEXT', 'website', false, 3),
        ('companies', 'industry', 'Industry', 'TEXT', 'industry', false, 4),
        ('companies', 'status', 'Status', 'TEXT', 'status', false, 5),
        ('contacts', 'first_name', 'First name', 'TEXT', 'firstName', true, 0),
        ('contacts', 'last_name', 'Last name', 'TEXT', 'lastName', true, 1),
        ('contacts', 'email', 'Email', 'EMAIL', 'email', false, 2),
        ('contacts', 'phone', 'Phone', 'PHONE', 'phone', false, 3),
        ('contacts', 'job_title', 'Job title', 'TEXT', 'jobTitle', false, 4),
        ('contacts', 'status', 'Status', 'TEXT', 'status', false, 5),
        ('leads', 'first_name', 'First name', 'TEXT', 'firstName', true, 0),
        ('leads', 'last_name', 'Last name', 'TEXT', 'lastName', true, 1),
        ('leads', 'email', 'Email', 'EMAIL', 'email', false, 2),
        ('leads', 'phone', 'Phone', 'PHONE', 'phone', false, 3),
        ('leads', 'job_title', 'Job title', 'TEXT', 'jobTitle', false, 4),
        ('leads', 'source', 'Source', 'TEXT', 'source', false, 5),
        ('leads', 'status', 'Status', 'SELECT', 'status', false, 6),
        ('tasks', 'title', 'Title', 'TEXT', 'title', true, 0),
        ('tasks', 'description', 'Description', 'TEXTAREA', 'description', false, 1),
        ('tasks', 'due_date', 'Due date', 'DATETIME', 'dueDate', false, 2),
        ('tasks', 'priority', 'Priority', 'SELECT', 'priority', false, 3),
        ('tasks', 'status', 'Status', 'SELECT', 'status', true, 4)
) AS defaults("moduleKey", "key", "label", "fieldType", "backingColumn", "required", "displayOrder");

INSERT INTO "CrmFieldOption"
    ("id", "crmInstanceId", "moduleKey", "fieldId", "key", "label", "enabled", "sortOrder", "updatedAt")
SELECT
    'option_' || md5(field."id" || ':' || options."key"),
    field."crmInstanceId",
    field."moduleKey",
    field."id",
    options."key",
    options."label",
    true,
    options."sortOrder",
    CURRENT_TIMESTAMP
FROM "CrmFieldDefinition" AS field
JOIN (
    VALUES
        ('leads', 'status', 'NEW', 'New', 0),
        ('leads', 'status', 'CONTACTED', 'Contacted', 1),
        ('leads', 'status', 'QUALIFIED', 'Qualified', 2),
        ('leads', 'status', 'CONVERTED', 'Converted', 3),
        ('leads', 'status', 'LOST', 'Lost', 4),
        ('tasks', 'priority', 'LOW', 'Low', 0),
        ('tasks', 'priority', 'MEDIUM', 'Medium', 1),
        ('tasks', 'priority', 'HIGH', 'High', 2),
        ('tasks', 'status', 'TODO', 'To do', 0),
        ('tasks', 'status', 'IN_PROGRESS', 'In progress', 1),
        ('tasks', 'status', 'COMPLETED', 'Completed', 2)
) AS options("moduleKey", "fieldKey", "key", "label", "sortOrder")
    ON options."moduleKey" = field."moduleKey" AND options."fieldKey" = field."key";

INSERT INTO "CrmForm"
    ("id", "crmInstanceId", "moduleKey", "key", "name", "description", "enabled", "updatedAt")
SELECT
    'form_' || md5(instance."id" || ':' || defaults."moduleKey" || ':' || defaults."key"),
    instance."id",
    defaults."moduleKey",
    defaults."key",
    defaults."name",
    defaults."description",
    true,
    CURRENT_TIMESTAMP
FROM "CrmInstance" AS instance
CROSS JOIN (
    VALUES
        ('companies', 'company_create', 'Create company', 'Existing company create form'),
        ('companies', 'company_edit', 'Edit company', 'Existing company edit form'),
        ('contacts', 'contact_create', 'Create contact', 'Existing contact create form'),
        ('contacts', 'contact_edit', 'Edit contact', 'Existing contact edit form'),
        ('leads', 'lead_create', 'Create lead', 'Existing lead create form'),
        ('leads', 'lead_edit', 'Edit lead', 'Existing lead edit form'),
        ('tasks', 'task_create', 'Create task', 'Existing task create form'),
        ('tasks', 'task_edit', 'Edit task', 'Existing task edit form')
) AS defaults("moduleKey", "key", "name", "description");

INSERT INTO "CrmFormField"
    ("id", "crmInstanceId", "moduleKey", "formId", "fieldId", "displayOrder", "requiredOverride", "updatedAt")
SELECT
    'formfield_' || md5(form."id" || ':' || field."id"),
    form."crmInstanceId",
    form."moduleKey",
    form."id",
    field."id",
    field."displayOrder",
    NULL,
    CURRENT_TIMESTAMP
FROM "CrmForm" AS form
JOIN "CrmFieldDefinition" AS field
    ON field."crmInstanceId" = form."crmInstanceId"
    AND field."moduleKey" = form."moduleKey";
