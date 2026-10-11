CREATE TABLE "CrmModuleConfiguration" (
    "id" TEXT NOT NULL,
    "crmInstanceId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "routePath" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmModuleConfiguration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CrmModuleConfiguration_crmInstanceId_moduleKey_key"
    ON "CrmModuleConfiguration"("crmInstanceId", "moduleKey");
CREATE INDEX "CrmModuleConfiguration_crmInstanceId_enabled_sortOrder_idx"
    ON "CrmModuleConfiguration"("crmInstanceId", "enabled", "sortOrder");

ALTER TABLE "CrmModuleConfiguration"
    ADD CONSTRAINT "CrmModuleConfiguration_crmInstanceId_fkey"
    FOREIGN KEY ("crmInstanceId") REFERENCES "CrmInstance"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "CrmModuleConfiguration"
    ("id", "crmInstanceId", "moduleKey", "label", "routePath", "enabled", "sortOrder", "updatedAt")
SELECT
    'module_' || md5(instance."id" || ':' || defaults."moduleKey"),
    instance."id",
    defaults."moduleKey",
    defaults."label",
    defaults."routePath",
    true,
    defaults."sortOrder",
    CURRENT_TIMESTAMP
FROM "CrmInstance" AS instance
CROSS JOIN (
    VALUES
        ('dashboard', 'Dashboard', '/crm', 0),
        ('leads', 'Leads', '/crm/leads', 1),
        ('contacts', 'Contacts', '/crm/contacts', 2),
        ('companies', 'Companies', '/crm/companies', 3),
        ('tasks', 'Tasks', '/crm/tasks', 4)
) AS defaults("moduleKey", "label", "routePath", "sortOrder");

ALTER TABLE "CrmNavigationItem"
    DROP CONSTRAINT "CrmNavigationItem_crmInstanceId_fkey";
ALTER TABLE "CrmNavigationItem"
    RENAME COLUMN "module" TO "moduleKey";
ALTER TABLE "CrmNavigationItem"
    ALTER COLUMN "moduleKey" TYPE TEXT USING lower("moduleKey"::TEXT);

DROP INDEX "CrmNavigationItem_crmInstanceId_module_key";
CREATE UNIQUE INDEX "CrmNavigationItem_crmInstanceId_moduleKey_key"
    ON "CrmNavigationItem"("crmInstanceId", "moduleKey");

ALTER TABLE "CrmNavigationItem"
    ADD CONSTRAINT "CrmNavigationItem_crmInstanceId_moduleKey_fkey"
    FOREIGN KEY ("crmInstanceId", "moduleKey")
    REFERENCES "CrmModuleConfiguration"("crmInstanceId", "moduleKey")
    ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "CrmNavigationItem"
    ("id", "crmInstanceId", "moduleKey", "label", "enabled", "sortOrder", "updatedAt")
SELECT
    'nav_' || md5(instance."id" || ':' || defaults."moduleKey"),
    instance."id",
    defaults."moduleKey",
    defaults."label",
    true,
    defaults."sortOrder",
    CURRENT_TIMESTAMP
FROM "CrmInstance" AS instance
CROSS JOIN (
    VALUES
        ('dashboard', 'Dashboard', 0),
        ('leads', 'Leads', 1),
        ('contacts', 'Contacts', 2),
        ('companies', 'Companies', 3),
        ('tasks', 'Tasks', 4)
) AS defaults("moduleKey", "label", "sortOrder")
ON CONFLICT ("crmInstanceId", "moduleKey") DO NOTHING;

DROP TYPE "CrmModule";
