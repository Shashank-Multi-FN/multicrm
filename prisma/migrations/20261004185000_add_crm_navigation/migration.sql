CREATE TYPE "CrmModule" AS ENUM (
    'DASHBOARD',
    'LEADS',
    'CONTACTS',
    'COMPANIES',
    'TASKS'
);

CREATE TABLE "CrmNavigationItem" (
    "id" TEXT NOT NULL,
    "crmInstanceId" TEXT NOT NULL,
    "module" "CrmModule" NOT NULL,
    "label" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmNavigationItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CrmNavigationItem_crmInstanceId_module_key"
    ON "CrmNavigationItem"("crmInstanceId", "module");
CREATE INDEX "CrmNavigationItem_crmInstanceId_sortOrder_idx"
    ON "CrmNavigationItem"("crmInstanceId", "sortOrder");

ALTER TABLE "CrmNavigationItem"
    ADD CONSTRAINT "CrmNavigationItem_crmInstanceId_fkey"
    FOREIGN KEY ("crmInstanceId") REFERENCES "CrmInstance"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "CrmNavigationItem"
    ("id", "crmInstanceId", "module", "label", "enabled", "sortOrder", "updatedAt")
SELECT
    'nav_' || md5(instance."id" || ':' || defaults."module"::text),
    instance."id",
    defaults."module",
    defaults."label",
    true,
    defaults."sortOrder",
    CURRENT_TIMESTAMP
FROM "CrmInstance" AS instance
CROSS JOIN (
    VALUES
        ('DASHBOARD'::"CrmModule", 'Dashboard', 0),
        ('LEADS'::"CrmModule", 'Leads', 1),
        ('CONTACTS'::"CrmModule", 'Contacts', 2),
        ('COMPANIES'::"CrmModule", 'Companies', 3),
        ('TASKS'::"CrmModule", 'Tasks', 4)
) AS defaults("module", "label", "sortOrder");
